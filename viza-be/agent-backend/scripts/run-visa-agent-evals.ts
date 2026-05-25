import {
  createEmptyVisaConversationState,
  parseVisaConversationStateMarker,
  summarizeVisaConversationState,
  updateVisaConversationState,
  type VisaConversationState,
} from '../src/services/visa-conversation-state.service.js';
import {
  COUNTRY_DISPLAY_NAMES,
  getDefaultVisitorVisaType,
  type SupportedKnowledgeCountry,
} from '../src/config/visa-destination-registry.js';
import { documentTypesForIntent } from '../src/services/visa-knowledge.service.js';
import {
  buildCompactAnswerInterpretation,
  buildApplicationFormUrl,
  buildApplicationRedirectBlocks,
  detectUnsupportedServiceCountries,
  inferVisaKnowledgeIntent,
  resolveKnowledgeCountry,
  resolveKnowledgeVisaType,
} from '../src/socket/visa-namespace.js';
import {
  BASE_SYSTEM_PROMPT,
  buildResponseLanguageInstruction,
  buildSystemPrompt,
  normalizeResponseLocale,
} from '../src/agent/index.js';

type EvalCategory =
  | 'schengen_route'
  | 'non_schengen_visitor'
  | 'compact_answer'
  | 'correction'
  | 'unsupported_or_high_risk';

interface EvalMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface EvalCase {
  id: string;
  category: EvalCategory;
  messages: EvalMessage[];
  expected: {
    resolvedCountry?: SupportedKnowledgeCountry | null;
    visaType?: string | null;
    slots?: Partial<{
      nationality: string;
      residenceCountry: string;
      tripPurpose: string;
      stayLengthDays: number;
    }>;
    shouldAskClarification?: boolean;
    mustMentionSources?: boolean;
    mustNotMentionWrongCountry?: SupportedKnowledgeCountry;
  };
}

interface EvalResult {
  id: string;
  category: EvalCategory;
  passed: boolean;
  failures: string[];
}

interface BranchResult {
  id: string;
  category: string;
  passed: boolean;
  failures: string[];
}

function countryList(countries: SupportedKnowledgeCountry[]): string {
  return countries.map((country) => COUNTRY_DISPLAY_NAMES[country]).join(', ');
}

function schengenCase(
  id: string,
  countries: SupportedKnowledgeCountry[],
  days: number[],
  expectedCountry: SupportedKnowledgeCountry
): EvalCase {
  return {
    id,
    category: 'schengen_route',
    messages: [
      {
        role: 'user',
        content: `中国护照，旅游，计划去 ${countryList(countries)}，总共 ${days.reduce((sum, day) => sum + day, 0)} 天`,
      },
      {
        role: 'assistant',
        content: `你在 ${countryList(countries)} 各停留几天？`,
      },
      {
        role: 'user',
        content: days.join('，'),
      },
    ],
    expected: {
      resolvedCountry: expectedCountry,
      visaType: 'schengen_short_stay_tourism',
      slots: { nationality: 'China', tripPurpose: 'tourism' },
      shouldAskClarification: false,
    },
  };
}

function visitorCase(
  id: string,
  country: SupportedKnowledgeCountry,
  visaType = getDefaultVisitorVisaType(country)
): EvalCase {
  return {
    id,
    category: 'non_schengen_visitor',
    messages: [
      {
        role: 'user',
        content: `中国护照去 ${COUNTRY_DISPLAY_NAMES[country]} 旅游 7 天`,
      },
    ],
    expected: {
      resolvedCountry: country,
      visaType,
      slots: { nationality: 'China', tripPurpose: 'tourism', stayLengthDays: 7 },
      shouldAskClarification: false,
    },
  };
}

function correctionCase(
  id: string,
  fromCountry: SupportedKnowledgeCountry,
  toCountry: SupportedKnowledgeCountry
): EvalCase {
  return {
    id,
    category: 'correction',
    messages: [
      {
        role: 'user',
        content: `中国护照去 ${COUNTRY_DISPLAY_NAMES[fromCountry]} 旅游 7 天`,
      },
      {
        role: 'user',
        content: `不对，改成 ${COUNTRY_DISPLAY_NAMES[toCountry]}`,
      },
    ],
    expected: {
      resolvedCountry: toCountry,
      visaType: getDefaultVisitorVisaType(toCountry),
      mustNotMentionWrongCountry: fromCountry,
      shouldAskClarification: false,
    },
  };
}

const evalCases: EvalCase[] = [
  schengenCase('SCH-001', ['switzerland', 'france', 'italy'], [2, 2, 5], 'italy'),
  schengenCase('SCH-002', ['france', 'italy'], [2, 5], 'italy'),
  schengenCase('SCH-003', ['norway', 'iceland'], [5, 2], 'norway'),
  schengenCase('SCH-004', ['spain', 'portugal'], [4, 3], 'spain'),
  schengenCase('SCH-005', ['germany', 'austria', 'czech_republic'], [3, 4, 2], 'austria'),
  schengenCase('SCH-006', ['netherlands', 'belgium'], [3, 4], 'belgium'),
  schengenCase('SCH-007', ['denmark', 'sweden'], [2, 5], 'sweden'),
  schengenCase('SCH-008', ['finland', 'estonia'], [1, 4], 'estonia'),
  schengenCase('SCH-009', ['greece', 'malta', 'italy'], [3, 2, 1], 'greece'),
  schengenCase('SCH-010', ['poland', 'slovakia', 'hungary'], [2, 2, 6], 'hungary'),
  schengenCase('SCH-011', ['latvia', 'lithuania', 'estonia'], [2, 4, 1], 'lithuania'),
  schengenCase('SCH-012', ['croatia', 'slovenia'], [1, 3], 'slovenia'),
  schengenCase('SCH-013', ['luxembourg', 'belgium', 'france'], [1, 1, 4], 'france'),
  schengenCase('SCH-014', ['liechtenstein', 'switzerland'], [1, 6], 'switzerland'),
  schengenCase('SCH-015', ['bulgaria', 'romania'], [3, 5], 'romania'),
  schengenCase('SCH-016', ['austria', 'germany'], [6, 2], 'austria'),
  schengenCase('SCH-017', ['sweden', 'norway', 'denmark'], [2, 5, 2], 'norway'),
  schengenCase('SCH-018', ['portugal', 'spain', 'france'], [2, 4, 3], 'spain'),
  schengenCase('SCH-019', ['italy', 'malta'], [5, 2], 'italy'),
  schengenCase('SCH-020', ['slovakia', 'czech_republic'], [2, 6], 'czech_republic'),

  visitorCase('VIS-001', 'us'),
  visitorCase('VIS-002', 'uk'),
  visitorCase('VIS-003', 'canada'),
  visitorCase('VIS-004', 'australia'),
  visitorCase('VIS-005', 'new_zealand'),
  visitorCase('VIS-006', 'japan'),
  visitorCase('VIS-007', 'south_korea'),
  visitorCase('VIS-008', 'singapore'),
  visitorCase('VIS-009', 'malaysia'),
  visitorCase('VIS-010', 'thailand'),
  visitorCase('VIS-011', 'indonesia'),
  visitorCase('VIS-012', 'vietnam'),
  visitorCase('VIS-013', 'united_arab_emirates'),
  visitorCase('VIS-014', 'egypt'),
  visitorCase('VIS-015', 'turkey'),

  {
    id: 'CMP-001',
    category: 'compact_answer',
    messages: [
      { role: 'user', content: '我想去瑞士旅行' },
      {
        role: 'assistant',
        content: '1. 您的国籍？\n2. 您目前居住在哪个国家？\n3. 计划停留多少天？\n4. 除瑞士外是否去其他申根国家？',
      },
      { role: 'user', content: '中国，新加坡，7天，法国，意大利' },
    ],
    expected: {
      resolvedCountry: 'switzerland',
      visaType: 'schengen_short_stay_tourism',
      slots: { nationality: 'China', residenceCountry: 'Singapore', stayLengthDays: 7 },
      shouldAskClarification: true,
    },
  },
  {
    id: 'CMP-002',
    category: 'compact_answer',
    messages: [
      { role: 'user', content: '我想去法国和意大利旅行，中国护照，旅游，总共7天' },
      { role: 'assistant', content: '你在 France, Italy 各停留几天？' },
      { role: 'user', content: '2，5' },
    ],
    expected: { resolvedCountry: 'italy', visaType: 'schengen_short_stay_tourism' },
  },
  {
    id: 'CMP-003',
    category: 'compact_answer',
    messages: [
      { role: 'assistant', content: '1. destination\n2. nationality\n3. purpose\n4. stay length' },
      { role: 'user', content: 'Japan，中国，旅游，7天' },
    ],
    expected: { resolvedCountry: 'japan', visaType: 'short_term_tourism_evisa' },
  },
  {
    id: 'CMP-004',
    category: 'compact_answer',
    messages: [
      { role: 'assistant', content: '1. destination\n2. nationality\n3. purpose\n4. stay length' },
      { role: 'user', content: 'Canada，中国，旅游，10天' },
    ],
    expected: { resolvedCountry: 'canada', visaType: 'visitor_visa' },
  },
  {
    id: 'CMP-005',
    category: 'compact_answer',
    messages: [
      { role: 'user', content: '我想去 Norway 和 Iceland 旅游，中国护照，总共7天' },
      { role: 'assistant', content: '你在 Norway, Iceland 各停留几天？' },
      { role: 'user', content: '4,3' },
    ],
    expected: { resolvedCountry: 'norway', visaType: 'schengen_short_stay_tourism' },
  },
  {
    id: 'CMP-006',
    category: 'compact_answer',
    messages: [
      { role: 'assistant', content: '1. 您的国籍？\n2. 此次前往 Singapore 的目的？\n3. 停留几天？' },
      { role: 'user', content: '中国，旅游，5天' },
    ],
    expected: { resolvedCountry: 'singapore', visaType: 'entry_visa_or_visit_pass' },
  },
  {
    id: 'CMP-007',
    category: 'compact_answer',
    messages: [
      { role: 'assistant', content: '1. nationality\n2. current residence\n3. stay length\n4. other Schengen countries besides Switzerland' },
      { role: 'user', content: '中国，中国，8天，Germany, Austria' },
    ],
    expected: { resolvedCountry: 'switzerland', visaType: 'schengen_short_stay_tourism' },
  },
  {
    id: 'CMP-008',
    category: 'compact_answer',
    messages: [
      { role: 'user', content: '中国护照去 France 和 Spain 旅游，总共8天' },
      { role: 'assistant', content: '你在 France, Spain 各停留几天？' },
      { role: 'user', content: '3;5' },
    ],
    expected: { resolvedCountry: 'spain', visaType: 'schengen_short_stay_tourism' },
  },
  {
    id: 'CMP-009',
    category: 'compact_answer',
    messages: [
      { role: 'assistant', content: '1. destination\n2. nationality\n3. purpose\n4. stay length' },
      { role: 'user', content: 'United States，中国，商务，6天' },
    ],
    expected: { resolvedCountry: 'us', visaType: 'b1_b2' },
  },
  {
    id: 'CMP-010',
    category: 'compact_answer',
    messages: [
      { role: 'assistant', content: '1. destination\n2. nationality\n3. purpose\n4. stay length' },
      { role: 'user', content: 'United Kingdom，中国，旅游，9天' },
    ],
    expected: { resolvedCountry: 'uk', visaType: 'standard_visitor' },
  },

  correctionCase('COR-001', 'japan', 'south_korea'),
  correctionCase('COR-002', 'canada', 'us'),
  correctionCase('COR-003', 'france', 'italy'),
  correctionCase('COR-004', 'singapore', 'malaysia'),
  correctionCase('COR-005', 'australia', 'new_zealand'),
  correctionCase('COR-006', 'thailand', 'vietnam'),
  correctionCase('COR-007', 'egypt', 'turkey'),
  correctionCase('COR-008', 'spain', 'portugal'),
  correctionCase('COR-009', 'norway', 'iceland'),
  correctionCase('COR-010', 'indonesia', 'philippines'),

  {
    id: 'RISK-001',
    category: 'unsupported_or_high_risk',
    messages: [{ role: 'user', content: '中国护照去美国工作 90 天' }],
    expected: { resolvedCountry: 'us', visaType: null, shouldAskClarification: true },
  },
  {
    id: 'RISK-002',
    category: 'unsupported_or_high_risk',
    messages: [{ role: 'user', content: '中国护照去英国学习 6 个月' }],
    expected: { resolvedCountry: 'uk', visaType: null, shouldAskClarification: true },
  },
  {
    id: 'RISK-003',
    category: 'unsupported_or_high_risk',
    messages: [{ role: 'user', content: '我想申请签证，但还没决定去哪' }],
    expected: { resolvedCountry: null, visaType: null, shouldAskClarification: true },
  },
  {
    id: 'RISK-004',
    category: 'unsupported_or_high_risk',
    messages: [{ role: 'user', content: '官方来源是什么，中国护照去日本旅游7天' }],
    expected: {
      resolvedCountry: 'japan',
      visaType: 'short_term_tourism_evisa',
      mustMentionSources: true,
    },
  },
  {
    id: 'RISK-005',
    category: 'unsupported_or_high_risk',
    messages: [{ role: 'user', content: '帮我填表，中国护照去新加坡旅游5天' }],
    expected: {
      resolvedCountry: 'singapore',
      visaType: 'entry_visa_or_visit_pass',
      mustMentionSources: false,
    },
  },
];

function resolvedCountry(state: VisaConversationState): SupportedKnowledgeCountry | null {
  return state.mainDestination ?? (state.destinationCountries.length === 1 ? state.destinationCountries[0] : null);
}

function shouldAskClarification(state: VisaConversationState): boolean {
  return state.missingSlots.length > 0 || !state.recommendedVisaType;
}

function applyMessages(messages: EvalMessage[]): {
  state: VisaConversationState;
  history: EvalMessage[];
  lastUserMessage: string;
} {
  let state = createEmptyVisaConversationState();
  const history: EvalMessage[] = [];
  let lastUserMessage = '';

  for (const message of messages) {
    if (message.role === 'user') {
      lastUserMessage = message.content;
      state = updateVisaConversationState(state, [...history, message], message.content);
    }
    history.push(message);
  }

  return { state, history, lastUserMessage };
}

function evaluateCase(testCase: EvalCase): EvalResult {
  const { state, lastUserMessage } = applyMessages(testCase.messages);
  const summary = summarizeVisaConversationState(state);
  const intent = inferVisaKnowledgeIntent(lastUserMessage, state.missingSlots);
  const failures: string[] = [];
  const actualCountry = resolvedCountry(state);

  if (testCase.expected.resolvedCountry !== undefined && actualCountry !== testCase.expected.resolvedCountry) {
    failures.push(`resolvedCountry expected ${testCase.expected.resolvedCountry}, got ${actualCountry}`);
  }

  if (testCase.expected.visaType !== undefined && state.recommendedVisaType !== testCase.expected.visaType) {
    failures.push(`visaType expected ${testCase.expected.visaType}, got ${state.recommendedVisaType}`);
  }

  if (testCase.expected.slots?.nationality && state.nationality !== testCase.expected.slots.nationality) {
    failures.push(`nationality expected ${testCase.expected.slots.nationality}, got ${state.nationality}`);
  }

  if (
    testCase.expected.slots?.residenceCountry &&
    state.residenceCountry !== testCase.expected.slots.residenceCountry
  ) {
    failures.push(`residenceCountry expected ${testCase.expected.slots.residenceCountry}, got ${state.residenceCountry}`);
  }

  if (testCase.expected.slots?.tripPurpose && state.tripPurpose !== testCase.expected.slots.tripPurpose) {
    failures.push(`tripPurpose expected ${testCase.expected.slots.tripPurpose}, got ${state.tripPurpose}`);
  }

  if (
    testCase.expected.slots?.stayLengthDays !== undefined &&
    state.stayLengthDays !== testCase.expected.slots.stayLengthDays
  ) {
    failures.push(`stayLengthDays expected ${testCase.expected.slots.stayLengthDays}, got ${state.stayLengthDays}`);
  }

  if (
    testCase.expected.shouldAskClarification !== undefined &&
    shouldAskClarification(state) !== testCase.expected.shouldAskClarification
  ) {
    failures.push(`shouldAskClarification expected ${testCase.expected.shouldAskClarification}, got ${shouldAskClarification(state)}`);
  }

  if (
    testCase.expected.mustNotMentionWrongCountry &&
    state.destinationCountries.includes(testCase.expected.mustNotMentionWrongCountry)
  ) {
    failures.push(`wrong country remained in destinationCountries: ${testCase.expected.mustNotMentionWrongCountry}`);
  }

  if (testCase.expected.mustMentionSources && intent !== 'source_check') {
    failures.push(`mustMentionSources expected source_check intent, got ${intent}`);
  }

  if (!testCase.expected.mustMentionSources && testCase.id === 'RISK-005' && intent !== 'form_intake') {
    failures.push(`form intake case expected form_intake intent, got ${intent}`);
  }

  if (failures.length > 0) {
    console.log(JSON.stringify({ id: testCase.id, summary, intent, failures }, null, 2));
  }

  return {
    id: testCase.id,
    category: testCase.category,
    passed: failures.length === 0,
    failures,
  };
}

function expectEqual<T>(label: string, actual: T, expected: T): string | null {
  return Object.is(actual, expected)
    ? null
    : `${label} expected ${String(expected)}, got ${String(actual)}`;
}

function expectArrayEqual<T>(label: string, actual: T[] | undefined, expected: T[]): string | null {
  const normalizedActual = JSON.stringify(actual ?? []);
  const normalizedExpected = JSON.stringify(expected);
  return normalizedActual === normalizedExpected
    ? null
    : `${label} expected ${normalizedExpected}, got ${normalizedActual}`;
}

function branch(
  id: string,
  category: string,
  run: () => Array<string | null>
): BranchResult {
  const failures = run().filter((failure): failure is string => failure !== null);
  if (failures.length > 0) {
    console.log(JSON.stringify({ id, category, failures }, null, 2));
  }
  return {
    id,
    category,
    passed: failures.length === 0,
    failures,
  };
}

function evaluateBranchTests(): BranchResult[] {
  return [
    branch('INTENT-001', 'intent_branch', () => [
      expectEqual(
        'default route recommendation intent',
        inferVisaKnowledgeIntent('中国护照去日本旅游7天', []),
        'route_recommendation'
      ),
    ]),
    branch('INTENT-002', 'intent_branch', () => [
      expectEqual(
        'Chinese form intake intent',
        inferVisaKnowledgeIntent('开始申请，中国护照去新加坡旅游5天', ['nationality']),
        'form_intake'
      ),
    ]),
    branch('INTENT-003', 'intent_branch', () => [
      expectEqual(
        'apply intent when no missing slots',
        inferVisaKnowledgeIntent('apply now', []),
        'form_intake'
      ),
    ]),
    branch('INTENT-004', 'intent_branch', () => [
      expectEqual('fees intent', inferVisaKnowledgeIntent('费用多少钱，处理时间多久', []), 'fees_timing'),
    ]),
    branch('INTENT-005', 'intent_branch', () => [
      expectEqual('requirements intent', inferVisaKnowledgeIntent('需要什么材料和文件', []), 'requirements'),
    ]),
    branch('INTENT-006', 'intent_branch', () => [
      expectEqual('eligibility intent', inferVisaKnowledgeIntent('我能不能申请这个签证', []), 'eligibility'),
    ]),
    branch('INTENT-007', 'intent_branch', () => [
      expectEqual('source intent', inferVisaKnowledgeIntent('请给我官方来源链接', []), 'source_check'),
    ]),
    branch('INTENT-008', 'intent_branch', () => [
      expectEqual(
        'generic apply waits when slots are missing',
        inferVisaKnowledgeIntent('I want to apply', ['destination']),
        'route_recommendation'
      ),
    ]),

    branch('RAGDOC-001', 'rag_document_type_branch', () => [
      expectArrayEqual('route docs', documentTypesForIntent('route_recommendation'), ['requirements', 'process']),
      expectArrayEqual('requirements docs', documentTypesForIntent('requirements'), ['requirements', 'form_requirements', 'photo_requirements']),
      expectArrayEqual('form docs', documentTypesForIntent('form_intake'), ['form_requirements', 'photo_requirements', 'requirements', 'process']),
      expectArrayEqual('fees docs', documentTypesForIntent('fees_timing'), ['requirements', 'process']),
      expectArrayEqual('eligibility docs', documentTypesForIntent('eligibility'), ['requirements']),
      expectArrayEqual('source docs', documentTypesForIntent('source_check'), ['requirements', 'process', 'form_requirements', 'photo_requirements']),
    ]),
    branch('RAGDOC-002', 'rag_document_type_branch', () => [
      expectEqual('undefined intent docs', documentTypesForIntent(undefined), undefined),
    ]),

    branch('COUNTRY-001', 'country_routing_branch', () => [
      expectEqual('single explicit country', resolveKnowledgeCountry('中国护照去日本旅游7天'), 'japan'),
    ]),
    branch('COUNTRY-002', 'country_routing_branch', () => [
      expectEqual(
        'Mexico is recognized but not routed to RAG because service is not open',
        resolveKnowledgeCountry('中国护照去墨西哥旅游，有有效美国签证能不能免签'),
        null
      ),
      expectArrayEqual(
        'Mexico appears in unsupported service list',
        detectUnsupportedServiceCountries('中国护照去墨西哥旅游，有有效美国签证能不能免签'),
        ['mexico']
      ),
    ]),
    branch('COUNTRY-003', 'country_routing_branch', () => [
      expectEqual('multi-country route unresolved', resolveKnowledgeCountry('法国和意大利旅游'), null),
    ]),
    branch('COUNTRY-004', 'country_routing_branch', () => [
      expectEqual('recent context fallback', resolveKnowledgeCountry('需要什么材料', null, '我想去瑞士旅行'), 'switzerland'),
    ]),
    branch('COUNTRY-005', 'country_routing_branch', () => [
      expectEqual('multi-country recent context unresolved', resolveKnowledgeCountry('需要什么材料', null, '法国 意大利'), null),
    ]),
    branch('COUNTRY-006', 'country_routing_branch', () => [
      expectEqual('Schengen does not use stale non-Schengen app country', resolveKnowledgeCountry('申根签证怎么办', 'Indonesia'), null),
    ]),
    branch('COUNTRY-007', 'country_routing_branch', () => [
      expectEqual('application country fallback', resolveKnowledgeCountry('需要材料', 'Japan'), 'japan'),
    ]),
    branch('COUNTRY-008', 'country_routing_branch', () => [
      expectEqual('India alias avoids Indonesia collision', resolveKnowledgeCountry('中国护照去印度旅游'), 'india'),
      expectEqual('Indonesia remains Indonesia', resolveKnowledgeCountry('中国护照去印度尼西亚旅游'), 'indonesia'),
    ]),
    branch('COUNTRY-009', 'country_routing_branch', () => [
      expectEqual('UK short alias branch', resolveKnowledgeCountry('go to UK for tourism'), 'uk'),
      expectEqual('US word-boundary branch', resolveKnowledgeCountry('US visa for tourism'), 'us'),
    ]),
    branch('COUNTRY-010', 'country_routing_branch', () => [
      expectEqual('Schengen can use Schengen app country fallback', resolveKnowledgeCountry('申根签证怎么办', 'France'), 'france'),
    ]),
    branch('COUNTRY-011', 'country_routing_branch', () => [
      expectEqual('Hong Kong service country routes', resolveKnowledgeCountry('中国护照去香港旅游'), 'hong_kong'),
      expectEqual('Macau service country routes', resolveKnowledgeCountry('中国护照去澳门旅游'), 'macau'),
      expectEqual('Russia service country routes', resolveKnowledgeCountry('中国护照去俄罗斯旅游'), 'russia'),
    ]),

    branch('VISA-001', 'visa_type_branch', () => [
      expectEqual('generic Schengen visa type', resolveKnowledgeVisaType(null, '申根旅游签证'), 'schengen_short_stay_tourism'),
    ]),
    branch('VISA-002', 'visa_type_branch', () => [
      expectEqual('US DS-160 branch', resolveKnowledgeVisaType('us', '我要填 DS-160'), 'b1_b2'),
    ]),
    branch('VISA-003', 'visa_type_branch', () => [
      expectEqual('Vietnam eVisa branch', resolveKnowledgeVisaType('vietnam', '电子签证怎么申请'), 'evisa_tourism'),
    ]),
    branch('VISA-004', 'visa_type_branch', () => [
      expectEqual('work does not force visitor visa', resolveKnowledgeVisaType('us', '去美国工作90天'), null),
      expectEqual('study does not force visitor visa', resolveKnowledgeVisaType('uk', '英国学习6个月'), null),
    ]),
    branch('VISA-005', 'visa_type_branch', () => [
      expectEqual('valid app visa type fallback', resolveKnowledgeVisaType('canada', '需要材料', 'visitor_visa'), 'visitor_visa'),
      expectEqual('invalid app visa type replaced by registry default', resolveKnowledgeVisaType('japan', '需要材料', 'tourist_b211a'), 'short_term_tourism_evisa'),
    ]),
    branch('VISA-006', 'visa_type_branch', () => [
      expectEqual('no country and no Schengen remains unresolved', resolveKnowledgeVisaType(null, '需要材料'), null),
    ]),

    branch('STATE-001', 'state_branch', () => {
      const { state } = applyMessages([
        { role: 'user', content: '我住新加坡，想去瑞士，还会去法国，中国护照，旅游7天' },
      ]);
      return [
        expectEqual('residence country', state.residenceCountry, 'Singapore'),
        expectEqual('Singapore is not destination', state.destinationCountries.includes('singapore'), false),
        expectEqual('Switzerland destination retained', state.destinationCountries.includes('switzerland'), true),
        expectEqual('France destination retained', state.destinationCountries.includes('france'), true),
      ];
    }),
    branch('STATE-002', 'state_branch', () => {
      const { state } = applyMessages([
        { role: 'user', content: '中国护照去法国和意大利旅游，总共6天' },
        { role: 'assistant', content: '你在 France, Italy 各停留几天？' },
        { role: 'user', content: '3，3' },
      ]);
      return [
        expectEqual('tie leaves main destination unresolved', state.mainDestination, null),
        expectEqual('tie asks for first entry', state.missingSlots.includes('firstEntryCountry'), true),
      ];
    }),
    branch('STATE-003', 'state_branch', () => {
      const { state } = applyMessages([
        { role: 'user', content: '中国护照去法国、意大利、西班牙旅游，总共10天' },
        { role: 'assistant', content: '你在 France, Italy, Spain 各停留几天？' },
        { role: 'user', content: '2，5' },
      ]);
      return [
        expectEqual('mismatch asks for full day split', state.missingSlots.includes('schengenDaySplit'), true),
      ];
    }),
    branch('STATE-004', 'state_branch', () => {
      const { state } = applyMessages([
        { role: 'user', content: '中国护照去加拿大旅游7天' },
        { role: 'user', content: '不对，改成美国' },
      ]);
      return [
        expectEqual('corrected country', state.mainDestination, 'us'),
        expectEqual('old country removed', state.destinationCountries.includes('canada'), false),
      ];
    }),
    branch('STATE-005', 'state_branch', () => {
      const { state } = applyMessages([
        { role: 'user', content: '中国护照去美国工作90天' },
      ]);
      return [
        expectEqual('work purpose', state.tripPurpose, 'work'),
        expectEqual('work has no visitor recommendation', state.recommendedVisaType, null),
      ];
    }),
    branch('STATE-006', 'state_branch', () => {
      const state = updateVisaConversationState(null, [], '中国护照去日本旅游7天');
      const marker = `__viza_conversation_state__:${JSON.stringify(state)}`;
      const parsed = parseVisaConversationStateMarker(marker);
      return [
        expectEqual('marker parses', Boolean(parsed), true),
        expectEqual('marker country', parsed?.mainDestination ?? null, 'japan'),
        expectEqual('non-marker ignored', parseVisaConversationStateMarker('hello'), null),
      ];
    }),
    branch('STATE-007', 'state_branch', () => {
      const { state } = applyMessages([
        { role: 'user', content: '中国护照去法国和意大利旅游，总共6天' },
        { role: 'assistant', content: '你在 France, Italy 各停留几天？' },
        { role: 'user', content: '3，3' },
        { role: 'user', content: '首入境意大利' },
      ]);
      return [
        expectEqual('first entry resolves tied Schengen country', state.mainDestination, 'italy'),
        expectEqual('first entry missing slot cleared', state.missingSlots.includes('firstEntryCountry'), false),
      ];
    }),
    branch('STATE-008', 'state_branch', () => {
      const { state } = applyMessages([
        { role: 'user', content: '中国护照，旅游，去 France 和 Italy，各3天，first entry France' },
      ]);
      return [
        expectEqual('direct first entry branch', state.firstEntryCountry, 'france'),
        expectEqual('direct first entry main destination', state.mainDestination, 'france'),
      ];
    }),
    branch('STATE-009', 'state_branch', () => {
      const { state } = applyMessages([
        { role: 'user', content: '我想去巴黎，还有冰岛和英国' },
        {
          role: 'assistant',
          content:
            '1. 您持哪国护照？\n2. 您目前居住在哪里？\n3. 旅行目的？\n4. 在 France, Iceland, United Kingdom 各计划停留多少天？',
        },
        { role: 'user', content: '中国，新加坡，旅游，4，5，6' },
      ]);
      return [
        expectEqual('mixed itinerary keeps UK destination', state.destinationCountries.includes('uk'), true),
        expectEqual('mixed itinerary chooses longest Schengen stay', state.mainDestination, 'iceland'),
        expectEqual('mixed itinerary visitor route is Schengen', state.recommendedVisaType, 'schengen_short_stay_tourism'),
      ];
    }),

    branch('COMPACT-001', 'compact_interpretation_branch', () => [
      expectEqual('non-compact returns null', buildCompactAnswerInterpretation([], '我想去日本旅游'), null),
      expectEqual('no assistant returns null', buildCompactAnswerInterpretation([{ role: 'user', content: '2，5' }], '2，5'), null),
    ]),
    branch('COMPACT-002', 'compact_interpretation_branch', () => {
      const note = buildCompactAnswerInterpretation(
        [
          { role: 'user', content: '我想去法国和意大利旅游' },
          { role: 'assistant', content: '你在 France, Italy 各停留几天？' },
          { role: 'user', content: '2，5' },
        ],
        '2，5'
      );
      return [
        expectEqual('numeric split has longest stay note', Boolean(note?.includes('longest stay is Italy')), true),
      ];
    }),
    branch('COMPACT-003', 'compact_interpretation_branch', () => {
      const note = buildCompactAnswerInterpretation(
        [
          { role: 'user', content: '我想去法国、意大利、西班牙旅游' },
          { role: 'assistant', content: '你在 France, Italy, Spain 各停留几天？' },
          { role: 'user', content: '2，5' },
        ],
        '2，5'
      );
      return [
        expectEqual('numeric mismatch has incomplete note', Boolean(note?.includes('incomplete answer')), true),
      ];
    }),

    branch('FORMAT-001', 'formatting_branch', () => [
      expectEqual('prompt bans Markdown formatting', BASE_SYSTEM_PROMPT.includes('Do not use Markdown formatting'), true),
      expectEqual('prompt bans Markdown tables', BASE_SYSTEM_PROMPT.includes('tables'), true),
      expectEqual('prompt requires plain text only', BASE_SYSTEM_PROMPT.includes('Use plain text only'), true),
      expectEqual('prompt still cites sources', BASE_SYSTEM_PROMPT.includes('source title or URL'), true),
      expectEqual('prompt forbids chat form collection', BASE_SYSTEM_PROMPT.includes('Do not collect application form fields inside VIZA chat'), true),
      expectEqual('prompt asks for rough overview before redirect', BASE_SYSTEM_PROMPT.includes('give a rough idea first'), true),
    ]),
    branch('LANG-001', 'language_branch', () => [
      expectEqual('zh locale normalizes to zh', normalizeResponseLocale('zh-CN'), 'zh'),
      expectEqual('en locale normalizes to en', normalizeResponseLocale('en'), 'en'),
      expectEqual('missing locale defaults to en', normalizeResponseLocale(undefined), 'en'),
      expectEqual(
        'zh instruction ignores latest user language',
        buildResponseLanguageInstruction('zh').includes('Respond primarily in Simplified Chinese even if the user writes in English'),
        true
      ),
      expectEqual(
        'en instruction ignores latest user language',
        buildResponseLanguageInstruction('en').includes('Respond primarily in English even if the user writes in Chinese'),
        true
      ),
      expectEqual(
        'system prompt includes selected Chinese interface language',
        buildSystemPrompt({ profile: null, application: null }, undefined, undefined, undefined, 'zh').includes('Selected interface language: Simplified Chinese'),
        true
      ),
    ]),
    branch('REDIRECT-001', 'redirect_branch', () => {
      const { state } = applyMessages([
        { role: 'user', content: '我想去巴黎，还有冰岛和英国' },
        {
          role: 'assistant',
          content:
            '1. 您持哪国护照？\n2. 您目前居住在哪里？\n3. 旅行目的？\n4. 在 France, Iceland, United Kingdom 各计划停留多少天？',
        },
        { role: 'user', content: '中国，新加坡，旅游，4，5，6' },
      ]);
      const blocks = buildApplicationRedirectBlocks(
        state,
        state.mainDestination,
        state.recommendedVisaType
      );
      const urls = blocks.map((block) => block.redirectUrl);
      return [
        expectEqual('ready phrase triggers form redirect intent', inferVisaKnowledgeIntent('准备好了', []).toString(), 'form_intake'),
        expectEqual('uk form link phrase triggers form redirect intent', inferVisaKnowledgeIntent('给我英国签证申请表链接', []).toString(), 'form_intake'),
        expectEqual('iceland Schengen form link emitted', urls.includes('/client/application?country=iceland&visaType=EU_SCHENGEN_C_SHORT_STAY'), true),
        expectEqual('uk separate form link emitted', urls.includes('/client/application?country=united_kingdom&visaType=UK_STANDARD_VISITOR'), true),
        expectEqual('direct url helper maps Iceland Schengen', buildApplicationFormUrl('iceland', 'schengen_short_stay_tourism'), '/client/application?country=iceland&visaType=EU_SCHENGEN_C_SHORT_STAY'),
        expectEqual('direct url helper maps UK Standard Visitor', buildApplicationFormUrl('uk', 'standard_visitor'), '/client/application?country=united_kingdom&visaType=UK_STANDARD_VISITOR'),
        expectEqual('direct url helper maps Hong Kong Visit Visa', buildApplicationFormUrl('hong_kong', 'hk_visit_visa'), '/client/application?country=hong_kong&visaType=HK_VISIT_VISA'),
        expectEqual('direct url helper maps Macau Visit Visa', buildApplicationFormUrl('macau', 'mo_visit_visa'), '/client/application?country=macau&visaType=MO_VISIT_VISA'),
        expectEqual('direct url helper maps Russia eVisa', buildApplicationFormUrl('russia', 'unified_evisa'), '/client/application?country=russia&visaType=RU_E_VISA'),
      ];
    }),
  ];
}

const results = evalCases.map(evaluateCase);
const branchResults = evaluateBranchTests();
const passed = results.filter((result) => result.passed).length;
const passRate = passed / results.length;
const branchPassed = branchResults.filter((result) => result.passed).length;
const branchPassRate = branchPassed / branchResults.length;
const combinedPassed = passed + branchPassed;
const combinedTotal = results.length + branchResults.length;
const byCategory = results.reduce<Record<string, { passed: number; total: number }>>(
  (acc, result) => {
    const entry = acc[result.category] ?? { passed: 0, total: 0 };
    entry.total += 1;
    if (result.passed) entry.passed += 1;
    acc[result.category] = entry;
    return acc;
  },
  {}
);
const branchByCategory = branchResults.reduce<Record<string, { passed: number; total: number }>>(
  (acc, result) => {
    const entry = acc[result.category] ?? { passed: 0, total: 0 };
    entry.total += 1;
    if (result.passed) entry.passed += 1;
    acc[result.category] = entry;
    return acc;
  },
  {}
);

console.log(
  JSON.stringify(
    {
      promptEvalTotal: results.length,
      promptEvalPassed: passed,
      promptEvalFailed: results.length - passed,
      promptEvalPassRate: Number((passRate * 100).toFixed(2)),
      branchTotal: branchResults.length,
      branchPassed,
      branchFailed: branchResults.length - branchPassed,
      branchPassRate: Number((branchPassRate * 100).toFixed(2)),
      combinedTotal,
      combinedPassed,
      combinedFailed: combinedTotal - combinedPassed,
      combinedPassRate: Number(((combinedPassed / combinedTotal) * 100).toFixed(2)),
      byCategory,
      branchByCategory,
    },
    null,
    2
  )
);

if (results.length < 60) {
  console.error(`Expected at least 60 eval cases, got ${results.length}`);
  process.exit(1);
}

if (branchResults.length < 35) {
  console.error(`Expected at least 35 branch tests, got ${branchResults.length}`);
  process.exit(1);
}

if (passRate < 0.9) {
  console.error('Visa agent eval pass rate is below 90%');
  process.exit(1);
}

if (branchPassRate < 1) {
  console.error('Visa agent branch robustness tests must pass at 100%');
  process.exit(1);
}
