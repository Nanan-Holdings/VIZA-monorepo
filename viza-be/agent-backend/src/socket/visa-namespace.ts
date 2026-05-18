import { Namespace, Socket } from 'socket.io';
import { eq, asc } from 'drizzle-orm';
import { Logger } from '../utils/logger.js';
import { db } from '../db/index.js';
import { visaChatMessages } from '../db/schema.js';
import {
  streamChat,
  buildApplicationContext,
  buildSystemPrompt,
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

function includesAny(value: string, terms: string[]): boolean {
  return terms.some((term) => value.includes(term));
}

export function resolveKnowledgeCountry(
  message: string,
  applicationCountry?: string | null,
  recentUserContext?: string
): SupportedKnowledgeCountry | null {
  const normalized = message.toLowerCase();
  const matchedCountries = detectKnowledgeCountries(normalized);
  const uniqueCountries = Array.from(new Set(matchedCountries));
  const mentionsSchengen = includesAny(normalized, ['申根', 'schengen']);

  if (uniqueCountries.length === 1) {
    return uniqueCountries[0];
  }

  if (
    uniqueCountries.length === 2 &&
    uniqueCountries.includes('mexico') &&
    uniqueCountries.includes('us') &&
    includesAny(normalized, [
      '美国签证',
      '美签',
      'us visa',
      'u.s. visa',
      'usa visa',
      'valid us',
      'visa exemption',
      '免签',
      '豁免',
    ])
  ) {
    return 'mexico';
  }

  if (uniqueCountries.length > 1) {
    return null;
  }

  if (recentUserContext) {
    const contextCountries = Array.from(
      new Set(detectKnowledgeCountries(recentUserContext.toLowerCase()))
    );

    if (contextCountries.length === 1) {
      return contextCountries[0];
    }

    if (contextCountries.length > 1) {
      return null;
    }
  }

  const contextCountry = normalizeKnowledgeCountry(applicationCountry);
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
    .split(/[,，;；\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function isCompactFollowUp(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed || trimmed.length > 80) return false;
  if (/[?？]/.test(trimmed)) return false;
  return /[,，;；]/.test(trimmed) || /^[\d\s,，.．、;；天日days]+$/i.test(trimmed);
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

  if (includesAny(normalized, ['工作', '学习', '留学', 'work', 'study', 'student', 'employment'])) {
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
      '帮我申请',
      '帮我填',
      '填表',
      '表格',
      '下一步',
      'start application',
      'apply now',
      'fill form',
      'form intake',
    ])
  ) {
    return 'form_intake';
  }
  if (includesAny(normalized, ['费用', '多少钱', '处理时间', '多久', 'fee', 'cost', 'processing time'])) {
    return 'fees_timing';
  }
  if (includesAny(normalized, ['材料', '文件', 'documents', 'requirements', '需要什么'])) {
    return 'requirements';
  }
  if (includesAny(normalized, ['能不能', '是否可以', 'eligible', 'eligibility', 'qualify'])) {
    return 'eligibility';
  }
  if (includesAny(normalized, ['官方', '来源', '链接', 'source', 'official'])) {
    return 'source_check';
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
};

function buildApplicationFormUrl(
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
      });

      const startTime = Date.now();

      try {
        // 1. Save user message to DB (non-fatal)
        try {
          await db.insert(visaChatMessages).values({
            sessionId: session_id,
            role: 'user',
            content: message,
          });
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
            // Only include user/assistant messages (skip 'block' role for Anthropic API)
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
        const stateCountry =
          conversationState.mainDestination ??
          (conversationState.destinationCountries.length === 1
            ? conversationState.destinationCountries[0]
            : null);
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
        const knowledgeResult = await retrieveVisaKnowledge({
          query: recentUserContext ? `${recentUserContext}\n${message}` : message,
          country: knowledgeCountry,
          visaType: knowledgeVisaType,
          intent: knowledgeIntent,
          matchCount: 5,
        });
        const knowledgeContext = formatKnowledgeContext(knowledgeResult.chunks);
        const compactAnswerInterpretation = buildCompactAnswerInterpretation(
          chatHistory,
          message
        );
        const statePrompt = buildVisaConversationStatePrompt(conversationState);
        const stateSummary = summarizeVisaConversationState(conversationState);
        const applicationRedirect = isFormIntakeRequest(knowledgeIntent)
          ? buildApplicationRedirectBlock(
              knowledgeCountry,
              knowledgeVisaType ?? (knowledgeCountry ? getDefaultVisitorVisaType(knowledgeCountry) : null)
            )
          : null;
        if (applicationRedirect) {
          try {
            await emitAndSaveApplicationBlock(socket, session_id, applicationRedirect);
          } catch (dbErr) {
            logger.error('Failed to emit/save application redirect block', dbErr as Error, {
              sessionId: session_id,
              blockType: applicationRedirect.blockType,
            });
          }
        }
        const dynamicSystemPrompt = buildSystemPrompt(
          appContext,
          knowledgeContext,
          [
            compactAnswerInterpretation,
            applicationRedirect
              ? 'An application form redirect button has already been sent in this turn. Mention it briefly, provide a rough overview of requirements and timing from retrieved knowledge, and do not ask the user to fill an inline chat form.'
              : null,
          ]
            .filter((note): note is string => Boolean(note))
            .join('\n\n') || undefined,
          statePrompt
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
            resolvedStateSummary: stateSummary,
            stateConfidence: conversationState.confidence,
            usedEmbedding: knowledgeResult.usedEmbedding,
            fallbackReason: knowledgeResult.fallbackReason,
            compactAnswerInterpreted: Boolean(compactAnswerInterpretation),
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

        // 4. Stream response from Claude with dynamic prompt + tool support
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
                  await db.insert(visaChatMessages).values({
                    sessionId: session_id,
                    role: 'assistant',
                    content: fullResponse,
                  });
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
