import {
  createEmptyVisaConversationState,
  summarizeVisaConversationState,
  updateVisaConversationState,
  type VisaConversationState,
} from '../src/services/visa-conversation-state.service.js';
import {
  COUNTRY_DISPLAY_NAMES,
  getDefaultVisitorVisaType,
  type SupportedKnowledgeCountry,
} from '../src/config/visa-destination-registry.js';
import { inferVisaKnowledgeIntent } from '../src/socket/visa-namespace.js';

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

function evaluateCase(testCase: EvalCase): EvalResult {
  let state = createEmptyVisaConversationState();
  const history: EvalMessage[] = [];
  let lastUserMessage = '';

  for (const message of testCase.messages) {
    if (message.role === 'user') {
      lastUserMessage = message.content;
      state = updateVisaConversationState(state, [...history, message], message.content);
    }
    history.push(message);
  }

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

const results = evalCases.map(evaluateCase);
const passed = results.filter((result) => result.passed).length;
const passRate = passed / results.length;
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

console.log(
  JSON.stringify(
    {
      total: results.length,
      passed,
      failed: results.length - passed,
      passRate: Number((passRate * 100).toFixed(2)),
      byCategory,
    },
    null,
    2
  )
);

if (results.length < 60) {
  console.error(`Expected at least 60 eval cases, got ${results.length}`);
  process.exit(1);
}

if (passRate < 0.9) {
  console.error('Visa agent eval pass rate is below 90%');
  process.exit(1);
}
