import { Namespace, Socket } from 'socket.io';
import { and, eq, asc } from 'drizzle-orm';
import { Logger } from '../utils/logger.js';
import { db } from '../db/index.js';
import { visaChatMessages } from '../db/schema.js';
import {
  streamChat,
  buildApplicationContext,
  buildSystemPrompt,
  normalizeResponseLocale,
  type ApplicationBlockPayload,
} from '../agent/index.js';
import {
  retrieveVisaKnowledge,
  formatKnowledgeContext,
  type VisaKnowledgeIntent,
} from '../services/visa-knowledge.service.js';
import {
  COUNTRY_DISPLAY_NAMES,
  countrySupportsVisaType,
  detectKnowledgeCountries,
  detectKnowledgeCountriesInOrder,
  getDefaultVisitorVisaType,
  isVisaServiceSupportedCountry,
  isSchengenKnowledgeCountry,
  normalizeKnowledgeCountry,
  type SupportedKnowledgeCountry,
} from '../config/visa-destination-registry.js';
import {
  buildVisaConversationStatePrompt,
  loadVisaConversationState,
  saveVisaConversationState,
  summarizeVisaConversationState,
  updateVisaConversationState,
  type VisaConversationState,
} from '../services/visa-conversation-state.service.js';

const logger = new Logger({ serviceName: 'VisaNamespace' });

async function saveVisibleVisaChatMessage(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<void> {
  const normalizedContent = content.trim();
  if (!normalizedContent) return;

  const existing = await db
    .select({ id: visaChatMessages.id })
    .from(visaChatMessages)
    .where(
      and(
        eq(visaChatMessages.sessionId, sessionId),
        eq(visaChatMessages.role, role),
        eq(visaChatMessages.content, normalizedContent)
      )
    )
    .limit(1);

  if (existing.length > 0) return;

  await db.insert(visaChatMessages).values({
    sessionId,
    role,
    content: normalizedContent,
  });
}

function includesAny(value: string, terms: string[]): boolean {
  return terms.some((term) => value.includes(term));
}

function uniqueCountries(countries: SupportedKnowledgeCountry[]): SupportedKnowledgeCountry[] {
  return Array.from(new Set(countries));
}

export function detectUnsupportedServiceCountries(message: string): SupportedKnowledgeCountry[] {
  return uniqueCountries(detectKnowledgeCountries(message.toLowerCase())).filter(
    (country) => !isVisaServiceSupportedCountry(country)
  );
}

export function resolveKnowledgeCountry(
  message: string,
  applicationCountry?: string | null,
  recentUserContext?: string
): SupportedKnowledgeCountry | null {
  const normalized = message.toLowerCase();
  const matchedCountries = detectKnowledgeCountries(normalized);
  const unsupportedCountries = uniqueCountries(matchedCountries).filter(
    (country) => !isVisaServiceSupportedCountry(country)
  );
  const serviceCountries = uniqueCountries(
    matchedCountries.filter(isVisaServiceSupportedCountry)
  );
  const mentionsSchengen = includesAny(normalized, ['申根', 'schengen']);

  if (
    unsupportedCountries.length === 1 &&
    serviceCountries.length === 1 &&
    serviceCountries[0] === 'us' &&
    includesAny(normalized, ['美国签证', '美签', 'us visa', 'u.s. visa', 'valid us'])
  ) {
    return null;
  }

  if (serviceCountries.length === 1) {
    return serviceCountries[0];
  }

  if (serviceCountries.length > 1) {
    return null;
  }

  if (recentUserContext) {
    const contextCountries = uniqueCountries(
      detectKnowledgeCountries(recentUserContext.toLowerCase()).filter(
        isVisaServiceSupportedCountry
      )
    );

    if (contextCountries.length === 1) {
      return contextCountries[0];
    }

    if (contextCountries.length > 1) {
      return null;
    }
  }

  const contextCountry = normalizeKnowledgeCountry(applicationCountry);
  if (!isVisaServiceSupportedCountry(contextCountry)) {
    return null;
  }
  if (mentionsSchengen && !isSchengenKnowledgeCountry(contextCountry)) {
    return null;
  }

  return contextCountry;
}

export function buildRecentUserContext(
  history: Array<{ role: 'user' | 'assistant'; content: string }>
): string {
  return history
    .filter((msg) => msg.role === 'user')
    .slice(-6)
    .map((msg) => msg.content)
    .join('\n');
}

function splitCompactAnswer(message: string): string[] {
  return message
    .split(/[,，、;；\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function isCompactFollowUp(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed || trimmed.length > 80) return false;
  if (/[?？]/.test(trimmed)) return false;
  return /[,，、;；]/.test(trimmed) || /^[\d\s,，.．、;；天日days]+$/i.test(trimmed);
}

function extractNumberedQuestions(content: string): string[] {
  return content
    .split('\n')
    .map((line) => line.trim())
    .map((line) => {
      const match = line.match(/^(?:[-*]\s*)?(?:\d+[.)、]|[（(]?\d+[）)])\s*(.+)$/);
      return match?.[1]?.trim() ?? '';
    })
    .filter(Boolean);
}

function inferQuestionSlot(question: string): string | null {
  const normalized = question.toLowerCase();
  if (includesAny(normalized, ['国籍', '护照', 'nationality', 'passport'])) {
    return 'nationality/passport';
  }
  if (includesAny(normalized, ['居住', '住在', '所在', 'current residence', 'currently live', 'apply from'])) {
    return 'residence/apply-from';
  }
  if (includesAny(normalized, ['停留', '多少天', '几天', 'how long', 'days'])) {
    return 'stay length';
  }
  if (includesAny(normalized, ['其他申根', '除', 'other schengen'])) {
    return 'other Schengen countries';
  }
  if (includesAny(normalized, ['目的', 'purpose', 'tourism', 'business'])) {
    return 'trip purpose';
  }
  if (includesAny(normalized, ['目的地', 'destination'])) {
    return 'destination';
  }
  return null;
}

function findPriorMainDestination(
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  lastAssistantContent: string
): SupportedKnowledgeCountry | null {
  const exclusionMatch = lastAssistantContent.match(/除(.{0,20}?)(?:外|之外|以外)/);
  if (exclusionMatch?.[1]) {
    const excludedCountries = detectKnowledgeCountriesInOrder(exclusionMatch[1]);
    if (excludedCountries.length === 1) {
      return excludedCountries[0];
    }
  }

  for (const msg of [...history].reverse()) {
    if (msg.role !== 'user') continue;
    const countries = detectKnowledgeCountriesInOrder(msg.content);
    if (countries.length === 1) {
      return countries[0];
    }
  }

  return null;
}

function parseStayDays(value: string): number | null {
  const match = value.trim().match(/^(\d+(?:[.．]\d+)?)\s*(?:天|日|days?)?$/i);
  if (!match) return null;
  return Number(match[1].replace('．', '.'));
}

export function buildCompactAnswerInterpretation(
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  latestMessage: string
): string | null {
  if (!isCompactFollowUp(latestMessage)) return null;

  const priorHistory =
    history[history.length - 1]?.role === 'user' &&
    history[history.length - 1]?.content === latestMessage
      ? history.slice(0, -1)
      : history;
  const lastAssistant = [...priorHistory].reverse().find((msg) => msg.role === 'assistant');
  if (!lastAssistant) return null;

  const parts = splitCompactAnswer(latestMessage);
  const lines: string[] = [
    `The user's latest message "${latestMessage}" is a compact answer to your previous assistant question, not a new standalone visa request.`,
  ];

  const numberedQuestions = extractNumberedQuestions(lastAssistant.content);
  if (numberedQuestions.length >= 2 && parts.length >= 2) {
    lines.push('Map the compact answers to the previous numbered questions in order:');
    numberedQuestions.forEach((question, index) => {
      const slot = inferQuestionSlot(question) ?? `question ${index + 1}`;
      const value =
        index === numberedQuestions.length - 1
          ? parts.slice(index).join(', ')
          : parts[index];
      if (value) {
        lines.push(`- ${slot}: ${value}`);
      }
    });

    const priorMainDestination = findPriorMainDestination(
      priorHistory,
      lastAssistant.content
    );
    const otherSchengenQuestion = numberedQuestions.find(
      (question) => inferQuestionSlot(question) === 'other Schengen countries'
    );
    if (priorMainDestination && otherSchengenQuestion) {
      const otherSchengenValue = parts
        .slice(Math.max(0, numberedQuestions.indexOf(otherSchengenQuestion)))
        .join(', ');
      const otherCountries = detectKnowledgeCountriesInOrder(otherSchengenValue);
      const destinations = Array.from(
        new Set([priorMainDestination, ...otherCountries])
      );
      lines.push(
        `- Preserve the previously stated main destination ${COUNTRY_DISPLAY_NAMES[priorMainDestination]}; the other Schengen countries are ${otherCountries.map((country) => COUNTRY_DISPLAY_NAMES[country]).join(', ') || 'not specified'}.`
      );
      lines.push(
        `- Overall Schengen destination set: ${destinations.map((country) => COUNTRY_DISPLAY_NAMES[country]).join(', ')}. Ask for the day split across all of these if the main application country is still unclear.`
      );
    }
  }

  const numericParts = parts.map(parseStayDays);
  const allPartsAreNumbers =
    numericParts.length > 0 && numericParts.every((part) => part !== null);
  const lastAssistantCountries = detectKnowledgeCountriesInOrder(lastAssistant.content);
  const asksForDaySplit = includesAny(lastAssistant.content.toLowerCase(), [
    '停留',
    '各',
    '几天',
    '多少天',
    'how many days',
    'day split',
  ]);

  if (allPartsAreNumbers && asksForDaySplit && lastAssistantCountries.length > 0) {
    if (lastAssistantCountries.length === numericParts.length) {
      const dayPairs = lastAssistantCountries.map((country, index) => ({
        country,
        days: numericParts[index] ?? 0,
      }));
      lines.push('Interpret the numeric day split in the same country order as the previous assistant question:');
      dayPairs.forEach((pair) => {
        lines.push(`- ${COUNTRY_DISPLAY_NAMES[pair.country]}: ${pair.days} days`);
      });

      const maxDays = Math.max(...dayPairs.map((pair) => pair.days));
      const longest = dayPairs.filter((pair) => pair.days === maxDays);
      if (longest.length === 1 && longest[0]) {
        lines.push(
          `- The longest stay is ${COUNTRY_DISPLAY_NAMES[longest[0].country]}, so that is normally the Schengen application country unless the user clarifies a different main purpose.`
        );
      } else {
        lines.push(
          '- The stay lengths are tied; ask for first entry country or main purpose to choose the Schengen application country.'
        );
      }
    } else {
      lines.push(
        `The user provided ${numericParts.length} numeric value(s), but the previous day-split question mentioned ${lastAssistantCountries.length} country/countries: ${lastAssistantCountries.map((country) => COUNTRY_DISPLAY_NAMES[country]).join(', ')}. Treat this as an incomplete answer to the previous question and ask only for the missing mapping; do not restart the visa intake.`
      );
    }
  }

  return lines.length > 1 ? lines.join('\n') : null;
}

export function resolveKnowledgeVisaType(
  country: SupportedKnowledgeCountry | null,
  message: string,
  applicationVisaType?: string | null,
  recentUserContext?: string
): string | null {
  const normalized = `${message}\n${recentUserContext ?? ''}`.toLowerCase();
  const mentionsVisitorPurpose = includesAny(normalized, [
    '旅游',
    '旅行',
    '观光',
    '探亲',
    '访友',
    '商务',
    '会议',
    'visitor',
    'visit',
    'tourist',
    'tourism',
    'business',
    'holiday',
    'vacation',
    'short stay',
    'short-stay',
    '短期',
  ]);

  if (!country && includesAny(normalized, ['申根', 'schengen'])) {
    return 'schengen_short_stay_tourism';
  }

  if (countrySupportsVisaType(country, applicationVisaType)) {
    return applicationVisaType ?? null;
  }

  if (
    includesAny(normalized, [
      '工作',
      '读书',
      '学习',
      '留学',
      '学生签证',
      '长期',
      '长期居留',
      '长期住',
      '定居',
      '移民',
      '永居',
      '转机',
      '过境',
      'work',
      'study',
      'student',
      'employment',
      'long-term',
      'long term',
      'long stay',
      'residence',
      'transit',
    ])
  ) {
    return null;
  }

  if (
    country &&
    (mentionsVisitorPurpose ||
      (country === 'us' && includesAny(normalized, ['b1', 'b-1', 'b2', 'b-2', 'ds-160', 'ds160'])) ||
      (country === 'vietnam' && includesAny(normalized, ['evisa', 'e-visa', '电子签', '电子签证'])) ||
      (isSchengenKnowledgeCountry(country) && includesAny(normalized, ['申根', 'schengen'])))
  ) {
    return getDefaultVisitorVisaType(country);
  }

  return getDefaultVisitorVisaType(country);
}

/**
 * Payload the client sends on the "visa_chat_message" event.
 */
interface VisaChatRequest {
  user_id: string;
  session_id: string;
  message: string;
  locale?: string;
  service_id?: string;
  history?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

function normalizeClientHistory(
  history: VisaChatRequest['history'],
  latestMessage: string
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const normalized = (history ?? [])
    .filter(
      (msg): msg is { role: 'user' | 'assistant'; content: string } =>
        (msg.role === 'user' || msg.role === 'assistant') &&
        typeof msg.content === 'string' &&
        msg.content.trim().length > 0
    )
    .map((msg) => ({
      role: msg.role,
      content: msg.content.trim(),
    }))
    .slice(-30);

  const latest = normalized[normalized.length - 1];
  if (latest?.role === 'user' && latest.content === latestMessage) {
    return normalized;
  }

  return [...normalized, { role: 'user', content: latestMessage }];
}

export function inferVisaKnowledgeIntent(
  message: string,
  missingSlots: string[] = []
): VisaKnowledgeIntent {
  const normalized = message.toLowerCase();
  if (
    includesAny(normalized, [
      '开始申请',
      '准备好了',
      '帮我申请',
      '帮我填',
      '填表',
      '申请表链接',
      '表格链接',
      '申请页面',
      '下一步',
      '继续申请',
      '前往申请',
      '直达表单',
      '表单链接',
      'start application',
      'ready to apply',
      'apply now',
      'continue application',
      'fill form',
      'form link',
      'form intake',
    ])
  ) {
    return 'form_intake';
  }
  if (
    includesAny(normalized, [
      '费用',
      '多少钱',
      '申请费',
      '处理时间',
      '一般多久',
      '多久能',
      '来得及',
      '有效期',
      '停留多久',
      '签证进度',
      '查询进度',
      '状态',
      '撤回',
      '退款',
      'fee',
      'cost',
      'processing time',
      'validity',
      'status',
      'withdraw',
      'refund',
    ])
  ) {
    return 'fees_timing';
  }
  if (
    includesAny(normalized, [
      '需要签证吗',
      '要签证吗',
      '能不能',
      '是否可以',
      '可以吗',
      '可以在',
      '可以申请',
      '可不可以',
      '会不会影响',
      '会不会很难',
      '难不难',
      '更容易',
      '容易过',
      '保证',
      '通过率',
      '申请地',
      '拒签',
      '假的',
      '造假',
      '伪造',
      '编一份',
      '影响签证',
      '出入境记录',
      '可以改',
      '可以线上',
      '远程工作',
      'eligible',
      'eligibility',
      'qualify',
      'can i apply',
      'do i need a visa',
    ])
  ) {
    return 'eligibility';
  }
  if (includesAny(normalized, ['官方', '来源', '链接', 'source', 'official'])) {
    return 'source_check';
  }
  if (
    includesAny(normalized, [
      '材料',
      '文件',
      '银行流水',
      '资金证明',
      '在职证明',
      '收入证明',
      '证明收入',
      '工作签证',
      '雇主',
      '邀请函',
      '面签',
      '免面签',
      '录指纹',
      '指纹',
      '生物信息',
      '照片',
      '护照有效期',
      '护照还有',
      '旅行保险',
      '保险',
      '翻译',
      '公证',
      '认证',
      '小孩',
      '儿童',
      '未成年人',
      '过境签',
      '过境',
      '转机',
      '申请表怎么填',
      '申请表',
      '旅行计划',
      '准备什么',
      '线上提交',
      '在线提交',
      'documents',
      'requirements',
      'bank statement',
      'proof of funds',
      'employment letter',
      'invitation letter',
      'interview',
      'biometrics',
      'fingerprint',
      'photo',
      'passport validity',
      'insurance',
      'translate',
      'notar',
      'minor',
      'child',
      'transit',
      '需要什么',
    ])
  ) {
    return 'requirements';
  }
  if (missingSlots.length === 0 && includesAny(normalized, ['申请', 'apply'])) {
    return 'form_intake';
  }
  return 'route_recommendation';
}

function isFormIntakeRequest(intent: VisaKnowledgeIntent): boolean {
  return intent === 'form_intake';
}

const APPLICATION_COUNTRY_PARAM_OVERRIDES: Partial<Record<SupportedKnowledgeCountry, string>> = {
  us: 'united_states',
  uk: 'united_kingdom',
};

const APPLICATION_VISA_TYPE_PARAM_OVERRIDES: Record<string, string> = {
  b1_b2: 'DS160',
  standard_visitor: 'UK_STANDARD_VISITOR',
  schengen_short_stay_tourism: 'EU_SCHENGEN_C_SHORT_STAY',
  tourist_b211a: 'B211A',
  hk_visit_visa: 'HK_VISIT_VISA',
  mo_visit_visa: 'MO_VISIT_VISA',
  unified_evisa: 'RU_E_VISA',
};

export function buildApplicationFormUrl(
  country: SupportedKnowledgeCountry,
  visaType: string | null
): string {
  const params = new URLSearchParams({
    country: APPLICATION_COUNTRY_PARAM_OVERRIDES[country] ?? country,
  });

  if (visaType) {
    params.set('visaType', APPLICATION_VISA_TYPE_PARAM_OVERRIDES[visaType] ?? visaType);
  }

  return `/client/application?${params.toString()}`;
}

function buildApplicationRedirectBlock(
  country: SupportedKnowledgeCountry | null,
  visaType: string | null
): ApplicationBlockPayload | null {
  if (!country) return null;

  const displayCountry = COUNTRY_DISPLAY_NAMES[country];
  return {
    blockType: 'application_redirect',
    title: `Open ${displayCountry} application form`,
    description:
      'Continue on the dedicated form page. VIZA chat will keep guidance here and will not collect form fields in chat.',
    saveTarget: 'application_redirect',
    fields: [],
    redirectUrl: buildApplicationFormUrl(country, visaType),
    ctaLabel: 'Open form',
    country,
    visaType,
  };
}

function getSchengenMainCountry(
  state: VisaConversationState
): SupportedKnowledgeCountry | null {
  if (isSchengenKnowledgeCountry(state.mainDestination)) {
    return state.mainDestination;
  }

  const schengenEntries = Object.entries(state.schengenDaySplit).filter(([country]) =>
    isSchengenKnowledgeCountry(country as SupportedKnowledgeCountry)
  ) as Array<[SupportedKnowledgeCountry, number]>;
  if (schengenEntries.length > 0) {
    const maxDays = Math.max(...schengenEntries.map(([, days]) => days));
    const longest = schengenEntries.filter(([, days]) => days === maxDays);
    if (longest.length === 1) return longest[0][0];
  }

  return (
    state.destinationCountries.find((country) => isSchengenKnowledgeCountry(country)) ??
    null
  );
}

export function buildApplicationRedirectBlocks(
  state: VisaConversationState,
  primaryCountry: SupportedKnowledgeCountry | null,
  primaryVisaType: string | null
): ApplicationBlockPayload[] {
  const countries: SupportedKnowledgeCountry[] = [];
  if (primaryCountry) countries.push(primaryCountry);

  const schengenMainCountry = getSchengenMainCountry(state);
  if (schengenMainCountry) countries.push(schengenMainCountry);

  for (const country of state.destinationCountries) {
    if (!isSchengenKnowledgeCountry(country)) countries.push(country);
  }

  const uniqueCountries = Array.from(new Set(countries));
  return uniqueCountries
    .filter(isVisaServiceSupportedCountry)
    .map((country) => {
      const visaType =
        country === primaryCountry
          ? primaryVisaType
          : getDefaultVisitorVisaType(country);
      return buildApplicationRedirectBlock(country, visaType);
    })
    .filter((block): block is ApplicationBlockPayload => Boolean(block));
}

function buildUnsupportedServicePromptNote(
  unsupportedCountries: SupportedKnowledgeCountry[]
): string | null {
  const uniqueUnsupported = uniqueCountries(unsupportedCountries);
  if (uniqueUnsupported.length === 0) return null;

  return [
    `The user mentioned destination(s) that are recognized but not currently open for VIZA application service: ${uniqueUnsupported
      .map((country) => COUNTRY_DISPLAY_NAMES[country])
      .join(', ')}.`,
    'Do not answer with detailed RAG requirements or provide application form links for those unsupported destinations.',
    'Tell the user clearly that VIZA has not opened service for that country/region yet. If the message also includes supported destinations, help only with the supported destinations and separate the unsupported ones.',
  ].join('\n');
}

function buildApplicationRedirectPromptNote(
  blocks: ApplicationBlockPayload[],
  state: VisaConversationState
): string | null {
  if (blocks.length === 0) return null;

  const blockLines = blocks
    .map(
      (block) =>
        `${COUNTRY_DISPLAY_NAMES[block.country as SupportedKnowledgeCountry]}: ${block.visaType ?? 'visitor route'} form link ${block.redirectUrl}`
    )
    .join('\n');
  const nonSchengenDestinations = state.destinationCountries.filter(
    (country) => !isSchengenKnowledgeCountry(country)
  );
  const nonSchengenNote =
    nonSchengenDestinations.length > 0
      ? `The itinerary also includes non-Schengen destination(s): ${nonSchengenDestinations
          .map((country) => COUNTRY_DISPLAY_NAMES[country])
          .join(', ')}. Remind the user these require separate visa/application routes from the Schengen visa.`
      : null;

  return [
    'Application form redirect button(s) have already been sent in this turn.',
    'Mention the relevant form link(s) directly in the text so the user can locate them even if the CTA card is not visible after copying the chat.',
    blockLines,
    nonSchengenNote,
    'Provide a rough overview of requirements and timing from retrieved knowledge. Do not ask the user to fill an inline chat form.',
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n');
}

async function emitAndSaveApplicationBlock(
  socket: Socket,
  sessionId: string,
  toolInput: ApplicationBlockPayload
): Promise<void> {
  socket.emit('application_block', {
    type: 'application_block',
    payload: toolInput,
    timestamp: Date.now(),
  });

  await db.insert(visaChatMessages).values({
    sessionId,
    role: 'block',
    content: toolInput.title,
    blockData: toolInput as unknown as Record<string, unknown>,
  });
}

/**
 * Register all event handlers for the /visa Socket.IO namespace.
 */
export function registerVisaNamespace(nsp: Namespace): void {
  nsp.on('connection', (socket: Socket) => {
    logger.info('Client connected to /visa', {
      socketId: socket.id,
      transport: socket.conn.transport.name,
    });

    // ---- join_room (for proactive messages) --------------------------------
    socket.on('join_room', (room: string) => {
      socket.join(room);
      logger.debug(`Socket ${socket.id} joined room ${room}`);
    });

    // ---- visa_chat_message --------------------------------------------------
    socket.on('visa_chat_message', async (request: VisaChatRequest) => {
      const { user_id, session_id, message } = request;

      logger.info('Received visa_chat_message', {
        userId: user_id,
        sessionId: session_id,
        messageLength: message.length,
        locale: request.locale,
      });

      const startTime = Date.now();

      try {
        // 1. Save user message to DB (non-fatal)
        try {
          await saveVisibleVisaChatMessage(session_id, 'user', message);
        } catch (dbErr) {
          logger.warn('Failed to save user message (DB may be unavailable)', dbErr as Error, {
            sessionId: session_id,
          });
        }

        // 2. Load conversation history (fallback to current message only)
        const clientHistory = normalizeClientHistory(request.history, message);
        let historySource: 'client' | 'database' | 'current_message' =
          clientHistory.length > 1 ? 'client' : 'current_message';
        let chatHistory: { role: 'user' | 'assistant'; content: string }[] =
          clientHistory.length > 0 ? clientHistory : [{ role: 'user', content: message }];

        try {
          const history = await db
            .select({ role: visaChatMessages.role, content: visaChatMessages.content })
            .from(visaChatMessages)
            .where(eq(visaChatMessages.sessionId, session_id))
            .orderBy(asc(visaChatMessages.createdAt))
            .limit(50);

          if (history.length > 0) {
            // Only include user/assistant messages (skip 'block' role for OpenAI API)
            const databaseHistory = history
              .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
              .map((msg) => ({
                role: msg.role as 'user' | 'assistant',
                content: msg.content,
              }));

            if (databaseHistory.length >= clientHistory.length) {
              chatHistory = databaseHistory;
              historySource = 'database';
            }
          }
        } catch (dbErr) {
          logger.warn('Failed to load chat history (using current message only)', dbErr as Error, {
            sessionId: session_id,
          });
        }

        // 3. Build structured state, dynamic system prompt, and RAG context.
        const appContext = await buildApplicationContext(user_id);
        let priorConversationState: VisaConversationState | null = null;
        try {
          priorConversationState = await loadVisaConversationState(session_id);
        } catch (stateErr) {
          logger.warn('Failed to load visa conversation state', stateErr as Error, {
            sessionId: session_id,
          });
        }
        const conversationState = updateVisaConversationState(
          priorConversationState,
          chatHistory,
          message
        );
        try {
          await saveVisaConversationState(session_id, conversationState);
        } catch (stateErr) {
          logger.warn('Failed to save visa conversation state', stateErr as Error, {
            sessionId: session_id,
          });
        }

        const recentUserContext = buildRecentUserContext(chatHistory);
        const rawStateCountry =
          conversationState.mainDestination ??
          (conversationState.destinationCountries.length === 1
            ? conversationState.destinationCountries[0]
            : null);
        const stateCountry = isVisaServiceSupportedCountry(rawStateCountry)
          ? rawStateCountry
          : null;
        const knowledgeCountry =
          stateCountry ??
          resolveKnowledgeCountry(
            message,
            appContext.application?.country,
            recentUserContext
          );
        const knowledgeVisaType = resolveKnowledgeVisaType(
          knowledgeCountry,
          message,
          conversationState.recommendedVisaType ?? appContext.application?.visa_type,
          recentUserContext
        );
        const knowledgeIntent = inferVisaKnowledgeIntent(
          message,
          conversationState.missingSlots
        );
        const compactAnswerInterpretation = buildCompactAnswerInterpretation(
          chatHistory,
          message
        );
        const unsupportedServiceCountries = uniqueCountries([
          ...detectUnsupportedServiceCountries(message),
          ...(rawStateCountry && !isVisaServiceSupportedCountry(rawStateCountry)
            ? [rawStateCountry]
            : []),
        ]);
        const shouldSkipKnowledgeRetrieval =
          unsupportedServiceCountries.length > 0 && !knowledgeCountry;
        const knowledgeResult = shouldSkipKnowledgeRetrieval
          ? {
              chunks: [],
              usedEmbedding: false,
              fallbackReason: "unsupported_service_country",
            }
          : await retrieveVisaKnowledge({
              query: recentUserContext ? `${recentUserContext}\n${message}` : message,
              country: knowledgeCountry,
              visaType: knowledgeVisaType,
              intent: knowledgeIntent,
              matchCount: 5,
            });
        const knowledgeContext = formatKnowledgeContext(knowledgeResult.chunks);
        const statePrompt = buildVisaConversationStatePrompt(conversationState);
        const stateSummary = summarizeVisaConversationState(conversationState);
        const responseLocale = normalizeResponseLocale(request.locale);
        const applicationRedirects = isFormIntakeRequest(knowledgeIntent)
          ? buildApplicationRedirectBlocks(
              conversationState,
              knowledgeCountry,
              knowledgeVisaType ?? (knowledgeCountry ? getDefaultVisitorVisaType(knowledgeCountry) : null)
            )
          : [];
        for (const applicationRedirect of applicationRedirects) {
          try {
            await emitAndSaveApplicationBlock(socket, session_id, applicationRedirect);
          } catch (dbErr) {
            logger.error('Failed to emit/save application redirect block', dbErr as Error, {
              sessionId: session_id,
              blockType: applicationRedirect.blockType,
              country: applicationRedirect.country,
            });
          }
        }
        const applicationRedirectNote = buildApplicationRedirectPromptNote(
          applicationRedirects,
          conversationState
        );
        const unsupportedServiceNote = buildUnsupportedServicePromptNote(
          unsupportedServiceCountries
        );
        const dynamicSystemPrompt = buildSystemPrompt(
          appContext,
          knowledgeContext,
          [
            compactAnswerInterpretation,
            applicationRedirectNote,
            unsupportedServiceNote,
          ]
            .filter((note): note is string => Boolean(note))
            .join('\n\n') || undefined,
          statePrompt,
          responseLocale
        );

        socket.emit('app_log', {
          type: 'rag_retrieval',
          category: 'rag',
          name: 'visa_knowledge',
          result: {
            chunkCount: knowledgeResult.chunks.length,
            country: knowledgeCountry,
            visaType: knowledgeVisaType,
            intent: knowledgeIntent,
            historySource,
            historyLength: chatHistory.length,
            responseLocale,
            resolvedStateSummary: stateSummary,
            stateConfidence: conversationState.confidence,
            usedEmbedding: knowledgeResult.usedEmbedding,
            fallbackReason: knowledgeResult.fallbackReason,
            compactAnswerInterpreted: Boolean(compactAnswerInterpretation),
            unsupportedServiceCountries: unsupportedServiceCountries.map(
              (country) => COUNTRY_DISPLAY_NAMES[country]
            ),
            applicationRedirects: applicationRedirects.map((block) => ({
              country: block.country,
              visaType: block.visaType,
              redirectUrl: block.redirectUrl,
            })),
            topSources: knowledgeResult.chunks.slice(0, 3).map((chunk) => ({
              title: chunk.title,
              country: chunk.country,
              visaType: chunk.visaType,
              documentType: chunk.documentType,
              similarity: chunk.similarity,
            })),
          },
          timestamp: Date.now(),
        });

        // 4. Stream response from OpenAI with dynamic prompt + tool support
        let fullResponse = '';

        await streamChat(
          chatHistory,
          {
            onToken: (text) => {
              socket.emit('token', {
                type: 'token',
                payload: text,
                timestamp: Date.now(),
              });
            },
            onComplete: async (response, toolsUsed) => {
              fullResponse = response;

              // 5. Save assistant text message to DB (only if there's text)
              if (fullResponse.trim()) {
                try {
                  await saveVisibleVisaChatMessage(session_id, 'assistant', fullResponse);
                } catch (dbErr) {
                  logger.error('Failed to save assistant message', dbErr as Error, {
                    sessionId: session_id,
                  });
                }
              }

              // 6. Emit response_complete
              socket.emit('response_complete', {
                type: 'response_complete',
                sessionId: session_id,
                userId: user_id,
                fullResponse,
                toolsUsed,
                escalated: false,
                duration: Date.now() - startTime,
                timestamp: Date.now(),
              });
            },
            onError: (err) => {
              socket.emit('error', {
                type: 'error',
                message: err.message || 'AI agent error',
                code: 'AGENT_ERROR',
                timestamp: Date.now(),
              });
            },
          },
          dynamicSystemPrompt
        );
      } catch (err) {
        logger.error('Error handling visa_chat_message', err as Error, {
          userId: user_id,
          sessionId: session_id,
        });

        socket.emit('error', {
          type: 'error',
          message: err instanceof Error ? err.message : 'Unknown error',
          code: 'AGENT_ERROR',
          timestamp: Date.now(),
        });
      }
    });

    // ---- component_complete (UI component callback) -------------------------
    socket.on('component_complete', (event: { componentId: string; result: unknown }) => {
      logger.debug('Component completed', { componentId: event.componentId });
    });

    // ---- disconnect ---------------------------------------------------------
    socket.on('disconnect', (reason: string) => {
      logger.info('Client disconnected from /visa', {
        socketId: socket.id,
        reason,
      });
    });
  });
}
