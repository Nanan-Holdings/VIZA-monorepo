import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  createEmptyVisaConversationState,
  parseVisaConversationStateMarker,
  summarizeVisaConversationState,
  updateVisaConversationState,
  type VisaConversationState,
} from '../src/services/visa-conversation-state.service.js';
import {
  COUNTRY_DISPLAY_NAMES,
  VISA_SERVICE_COUNTRIES,
  getDefaultVisitorVisaType,
  type SupportedKnowledgeCountry,
} from '../src/config/visa-destination-registry.js';
import {
  documentTypesForIntent,
  type VisaKnowledgeIntent,
} from '../src/services/visa-knowledge.service.js';
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

interface ProductQaCase {
  id: string;
  input: string;
  expected: {
    intent?: VisaKnowledgeIntent;
    resolvedCountry?: SupportedKnowledgeCountry | null;
    visaType?: string | null;
    nationality?: string | null;
    residenceCountry?: string | null;
    tripPurpose?: string | null;
    stayLengthDays?: number;
    knowledgeCountry?: SupportedKnowledgeCountry | null;
    unsupportedServiceCountries?: SupportedKnowledgeCountry[];
    destinationIncludes?: SupportedKnowledgeCountry[];
    destinationExcludes?: SupportedKnowledgeCountry[];
    shouldAskClarification?: boolean;
    promptGuardrails?: string[];
  };
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

const productQaCases: ProductQaCase[] = [
  { id: 'GREET-001', input: '你好', expected: { intent: 'route_recommendation', shouldAskClarification: true, promptGuardrails: ['very short opener'] } },
  {
    id: 'VIZA-001',
    input: '中国护照、人在新加坡、去日本 7 天，需要签证吗？',
    expected: {
      intent: 'eligibility',
      resolvedCountry: 'japan',
      visaType: 'short_term_tourism_evisa',
      nationality: 'China',
      residenceCountry: 'Singapore',
      tripPurpose: 'tourism',
      stayLengthDays: 7,
    },
  },
  { id: 'VIZA-002', input: '去韩国旅游签证一般多久能下来？', expected: { intent: 'fees_timing', resolvedCountry: 'south_korea' } },
  { id: 'VIZA-003', input: '我下周五飞日本，现在申请签证还来得及吗？', expected: { intent: 'fees_timing', resolvedCountry: 'japan', promptGuardrails: ['urgent', 'exact date'] } },
  { id: 'VIZA-004', input: '签证有效期一般多久？可以停留多久？', expected: { intent: 'fees_timing', promptGuardrails: ['visa validity', 'permitted stay duration'] } },
  { id: 'VIZA-005', input: '申请美国旅游签证要面签吗？', expected: { intent: 'requirements', resolvedCountry: 'us', visaType: 'b1_b2' } },
  { id: 'VIZA-006', input: '新加坡 PR 申请日本旅游签需要面签吗？', expected: { intent: 'requirements', resolvedCountry: 'japan', residenceCountry: 'Singapore', destinationExcludes: ['singapore'] } },
  { id: 'VIZA-007', input: '旅游签证需要准备什么材料？', expected: { intent: 'requirements', shouldAskClarification: true } },
  { id: 'VIZA-008', input: '去澳洲旅游签证申请费多少？', expected: { intent: 'fees_timing', resolvedCountry: 'australia' } },
  { id: 'VIZA-009', input: '申请英国签证需要银行流水吗？要几个月？', expected: { intent: 'requirements', resolvedCountry: 'uk' } },
  { id: 'VIZA-010', input: '我没有在职证明，可以申请旅游签吗？', expected: { intent: 'eligibility', shouldAskClarification: true } },
  { id: 'VIZA-011', input: '学生申请申根旅游签要准备什么？', expected: { intent: 'requirements', visaType: 'schengen_short_stay_tourism' } },
  { id: 'VIZA-012', input: '我是自由职业者，申请日本签证怎么证明收入？', expected: { intent: 'requirements', resolvedCountry: 'japan' } },
  { id: 'VIZA-013', input: '商务签和旅游签有什么区别？', expected: { intent: 'route_recommendation', shouldAskClarification: true } },
  { id: 'VIZA-014', input: '我去美国参加会议，应该申请旅游签还是商务签？', expected: { intent: 'route_recommendation', resolvedCountry: 'us', tripPurpose: 'business', visaType: 'b1_b2' } },
  { id: 'VIZA-015', input: '去加拿大看朋友需要邀请函吗？', expected: { intent: 'requirements', resolvedCountry: 'canada', tripPurpose: 'family_visit' } },
  { id: 'VIZA-016', input: '我要去澳洲读书，学生签证需要什么材料？', expected: { intent: 'requirements', resolvedCountry: 'australia', tripPurpose: 'study', visaType: null } },
  { id: 'VIZA-017', input: '工作签证一般需要雇主提供什么？', expected: { intent: 'requirements', tripPurpose: 'work', visaType: null, shouldAskClarification: true } },
  { id: 'VIZA-018', input: '我想申请多次往返签证，可以吗？', expected: { intent: 'eligibility', shouldAskClarification: true } },
  { id: 'VIZA-019', input: '我只是在韩国转机 8 小时，需要过境签吗？', expected: { intent: 'requirements', resolvedCountry: 'south_korea', tripPurpose: 'transit', visaType: null, promptGuardrails: ['transit questions'] } },
  { id: 'VIZA-020', input: '护照还有 5 个月过期，可以申请签证吗？', expected: { intent: 'eligibility', promptGuardrails: ['passport'] } },
  { id: 'VIZA-021', input: '小孩申请签证需要什么额外材料？', expected: { intent: 'requirements' } },
  { id: 'VIZA-022', input: '我之前被拒签过，还能再申请吗？', expected: { intent: 'eligibility', promptGuardrails: ['refusal history'] } },
  { id: 'VIZA-023', input: '拒签记录要不要写？不写会怎样？', expected: { intent: 'eligibility', promptGuardrails: ['refusal history', 'misrepresent'] } },
  { id: 'VIZA-024', input: '我可以用假的酒店订单申请吗？', expected: { intent: 'eligibility', promptGuardrails: ['forge', 'falsify'] } },
  { id: 'VIZA-025', input: '银行流水不够，能不能帮我编一份？', expected: { intent: 'eligibility', promptGuardrails: ['forge', 'falsify', 'funds'] } },
  { id: 'VIZA-026', input: '签证照片有什么要求？', expected: { intent: 'requirements' } },
  { id: 'VIZA-027', input: '申请表怎么填？我不会写旅行计划', expected: { intent: 'requirements', promptGuardrails: ['travel plans'] } },
  { id: 'VIZA-028', input: '我第一次出国，申请日本签证会不会很难？', expected: { intent: 'eligibility', resolvedCountry: 'japan', promptGuardrails: ['Do not guarantee approval'] } },
  { id: 'VIZA-029', input: '没有出入境记录会影响签证吗？', expected: { intent: 'eligibility' } },
  {
    id: 'VIZA-030',
    input: '我人在新加坡，但护照是中国的，可以在新加坡申请日本签证吗？',
    expected: {
      intent: 'eligibility',
      resolvedCountry: 'japan',
      nationality: 'China',
      residenceCountry: 'Singapore',
      destinationExcludes: ['singapore'],
    },
  },
  { id: 'VIZA-031', input: '我从新加坡出发去欧洲，申请申根签证要去哪个国家的大使馆？', expected: { intent: 'route_recommendation', residenceCountry: 'Singapore', shouldAskClarification: true } },
  { id: 'VIZA-032', input: '我去法国 3 天、意大利 6 天、瑞士 2 天，申根签申请哪个国家？', expected: { intent: 'route_recommendation', resolvedCountry: 'italy', visaType: 'schengen_short_stay_tourism', stayLengthDays: 11 } },
  { id: 'VIZA-033', input: '我去法国和德国各 5 天，从法国入境，申请哪个国家？', expected: { intent: 'route_recommendation', resolvedCountry: 'france', visaType: 'schengen_short_stay_tourism', stayLengthDays: 10 } },
  { id: 'VIZA-034', input: '签证下来以后可以改酒店和机票吗？', expected: { intent: 'eligibility' } },
  { id: 'VIZA-035', input: '签证被批准了，但护照还没寄回来，怎么办？', expected: { intent: 'route_recommendation' } },
  { id: 'VIZA-036', input: '怎么查询签证进度？', expected: { intent: 'fees_timing' } },
  { id: 'VIZA-037', input: '签证申请可以撤回吗？费用退吗？', expected: { intent: 'fees_timing' } },
  { id: 'VIZA-038', input: '我需要买机票后才能申请签证吗？', expected: { intent: 'route_recommendation' } },
  { id: 'VIZA-039', input: '需要买旅行保险吗？', expected: { intent: 'requirements' } },
  { id: 'VIZA-040', input: '申请材料需要翻译吗？', expected: { intent: 'requirements' } },
  { id: 'VIZA-041', input: '材料要公证吗？', expected: { intent: 'requirements' } },
  { id: 'VIZA-042', input: '签证申请可以线上提交吗？', expected: { intent: 'eligibility' } },
  { id: 'VIZA-043', input: '需要录指纹吗？', expected: { intent: 'requirements' } },
  { id: 'VIZA-044', input: '我已经有美国签证，申请加拿大会更容易吗？', expected: { intent: 'eligibility', resolvedCountry: 'canada', destinationExcludes: ['us'] } },
  { id: 'VIZA-045', input: '我想去日本看演唱会，应该申请什么签证？', expected: { intent: 'route_recommendation', resolvedCountry: 'japan', tripPurpose: 'tourism' } },
  { id: 'VIZA-046', input: '我去泰国待 45 天，落地签可以吗？', expected: { intent: 'eligibility', resolvedCountry: 'thailand', stayLengthDays: 45 } },
  { id: 'VIZA-047', input: '我可以边旅游边远程工作吗？', expected: { intent: 'eligibility', tripPurpose: 'work', visaType: null, promptGuardrails: ['tourism', 'work'] } },
  { id: 'VIZA-048', input: '我想长期住在日本，有什么签证？', expected: { intent: 'route_recommendation', resolvedCountry: 'japan', tripPurpose: 'long_stay', visaType: null } },
  { id: 'VIZA-049', input: '帮我推荐最容易过的国家签证', expected: { intent: 'eligibility', promptGuardrails: ['Do not guarantee approval'] } },
  { id: 'VIZA-050', input: '你能保证我签证通过吗？', expected: { intent: 'eligibility', promptGuardrails: ['Do not guarantee approval'] } },
  { id: 'VIZA-051', input: '申请美国旅游签证要不要面签？', expected: { intent: 'requirements', resolvedCountry: 'us', visaType: 'b1_b2' } },
  { id: 'VIZA-052', input: '英国签证银行流水要几个月？', expected: { intent: 'requirements', resolvedCountry: 'uk' } },
  { id: 'VIZA-053', input: '我在韩国转机 8 小时，不出机场，需要过境签吗？', expected: { intent: 'requirements', resolvedCountry: 'south_korea', tripPurpose: 'transit', visaType: null, promptGuardrails: ['transit questions'] } },
  { id: 'VIZA-054', input: '伪造银行流水被拒签了，还能再申请吗？', expected: { intent: 'eligibility', promptGuardrails: ['forge', 'falsify', 'refusal history'] } },
  { id: 'VIZA-055', input: '我的护照号是 E12345678，发给你安全吗？', expected: { intent: 'route_recommendation', promptGuardrails: ['sensitive identifiers'] } },
  { id: 'VIZA-056', input: 'I have a Chinese passport, live in Singapore, and want to visit Japan for 7 days. The UI is Chinese, please answer Chinese.', expected: { intent: 'route_recommendation', resolvedCountry: 'japan', nationality: 'China', residenceCountry: 'Singapore', tripPurpose: 'tourism', stayLengthDays: 7 } },
  { id: 'EDGE-001', input: '签证', expected: { intent: 'route_recommendation', shouldAskClarification: true } },
  { id: 'EDGE-002', input: '我要去国外，怎么办？', expected: { intent: 'route_recommendation', shouldAskClarification: true } },
  { id: 'EDGE-003', input: '我是中国人去中国要签证吗？', expected: { intent: 'eligibility', resolvedCountry: null, promptGuardrails: ['own citizenship country'] } },
  { id: 'EDGE-004', input: 'asdfgh visa ???', expected: { intent: 'route_recommendation', shouldAskClarification: true } },
  { id: 'EDGE-005', input: '我护照号码是 E12345678，帮我看看', expected: { intent: 'route_recommendation', promptGuardrails: ['sensitive identifiers'] } },
  { id: 'EDGE-006', input: '这是我的银行流水截图，你帮我看看够不够', expected: { intent: 'requirements', promptGuardrails: ['redact'] } },
  { id: 'EDGE-007', input: '帮我写一封给签证官的解释信', expected: { intent: 'route_recommendation', promptGuardrails: ['truthful', 'editable explanation letters'] } },
  { id: 'EDGE-008', input: '帮我写一封假的在职证明', expected: { intent: 'eligibility', promptGuardrails: ['forge', 'falsify'] } },
  { id: 'EDGE-009', input: '我被拒签了，很急，怎么办？', expected: { intent: 'eligibility', promptGuardrails: ['refusal history', 'urgent'] } },
  { id: 'EDGE-010', input: '我的情况你觉得通过率多少？', expected: { intent: 'eligibility', promptGuardrails: ['exact pass-rate percentage'] } },
];

interface CountryPopularQuestionTemplate {
  key: string;
  intent: VisaKnowledgeIntent;
  input: (country: SupportedKnowledgeCountry) => string;
  assertVisaType?: boolean;
  assertNationality?: boolean;
  assertTripPurpose?: boolean;
  assertStayLength?: boolean;
}

const HIGH_FREQUENCY_COUNTRY_QUESTION_TEMPLATES: CountryPopularQuestionTemplate[] = [
  {
    key: 'need-visa',
    intent: 'eligibility',
    input: (country) => `中国护照去 ${COUNTRY_DISPLAY_NAMES[country]} 旅游 7 天，需要签证吗？`,
    assertVisaType: true,
    assertNationality: true,
    assertTripPurpose: true,
    assertStayLength: true,
  },
  {
    key: 'documents',
    intent: 'requirements',
    input: (country) => `申请 ${COUNTRY_DISPLAY_NAMES[country]} 旅游签证需要准备什么材料？`,
    assertVisaType: true,
    assertTripPurpose: true,
  },
  {
    key: 'fees-timing',
    intent: 'fees_timing',
    input: (country) => `${COUNTRY_DISPLAY_NAMES[country]} 旅游签证一般多久能下来，费用多少？`,
    assertVisaType: true,
    assertTripPurpose: true,
  },
  {
    key: 'start-application',
    intent: 'form_intake',
    input: (country) => `我准备好了，想开始申请 ${COUNTRY_DISPLAY_NAMES[country]} 旅游签证`,
    assertVisaType: true,
    assertTripPurpose: true,
  },
  {
    key: 'official-source',
    intent: 'source_check',
    input: (country) => `请给我 ${COUNTRY_DISPLAY_NAMES[country]} 旅游签证的官方来源`,
    assertVisaType: true,
    assertTripPurpose: true,
  },
];

const serviceCountryList = Array.from(VISA_SERVICE_COUNTRIES);
const unsupportedRecognizedCountries = (
  Object.keys(VISA_DESTINATION_REGISTRY) as SupportedKnowledgeCountry[]
).filter((country) => !VISA_SERVICE_COUNTRIES.has(country));

const countryPopularQaCases: ProductQaCase[] = serviceCountryList.flatMap((country) =>
  HIGH_FREQUENCY_COUNTRY_QUESTION_TEMPLATES.map((template) => ({
    id: `COUNTRY-${country.toUpperCase().replaceAll('_', '-')}-${template.key.toUpperCase()}`,
    input: template.input(country),
    expected: {
      intent: template.intent,
      resolvedCountry: country,
      knowledgeCountry: country,
      visaType: template.assertVisaType ? getDefaultVisitorVisaType(country) : undefined,
      nationality: template.assertNationality ? 'China' : undefined,
      tripPurpose: template.assertTripPurpose ? 'tourism' : undefined,
      stayLengthDays: template.assertStayLength ? 7 : undefined,
    },
  }))
);

const unsupportedServiceQaCases: ProductQaCase[] = unsupportedRecognizedCountries.map(
  (country) => ({
    id: `UNSUPPORTED-${country.toUpperCase().replaceAll('_', '-')}`,
    input: `中国护照去 ${COUNTRY_DISPLAY_NAMES[country]} 旅游 7 天，VIZA 现在能办理吗？`,
    expected: {
      resolvedCountry: country,
      knowledgeCountry: null,
      unsupportedServiceCountries: [country],
    },
  })
);

const allProductQaCases = [
  ...productQaCases,
  ...countryPopularQaCases,
  ...unsupportedServiceQaCases,
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

function evaluateProductQaCase(testCase: ProductQaCase): EvalResult {
  const { state, lastUserMessage } = applyMessages([
    { role: 'user', content: testCase.input },
  ]);
  const actualCountry = resolvedCountry(state);
  const intent = inferVisaKnowledgeIntent(lastUserMessage, state.missingSlots);
  const actualVisaType =
    state.recommendedVisaType ?? resolveKnowledgeVisaType(actualCountry, lastUserMessage);
  const actualKnowledgeCountry = isVisaServiceSupportedCountry(actualCountry)
    ? actualCountry
    : resolveKnowledgeCountry(lastUserMessage);
  const actualUnsupportedServiceCountries = uniqueCountryList([
    ...detectUnsupportedServiceCountries(lastUserMessage),
    actualCountry && !isVisaServiceSupportedCountry(actualCountry) ? actualCountry : null,
  ]);
  const failures: string[] = [];

  if (testCase.expected.intent !== undefined && intent !== testCase.expected.intent) {
    failures.push(`intent expected ${testCase.expected.intent}, got ${intent}`);
  }

  if (
    testCase.expected.resolvedCountry !== undefined &&
    actualCountry !== testCase.expected.resolvedCountry
  ) {
    failures.push(`resolvedCountry expected ${testCase.expected.resolvedCountry}, got ${actualCountry}`);
  }

  if (
    testCase.expected.visaType !== undefined &&
    actualVisaType !== testCase.expected.visaType
  ) {
    failures.push(`visaType expected ${testCase.expected.visaType}, got ${actualVisaType}`);
  }

  if (
    testCase.expected.nationality !== undefined &&
    state.nationality !== testCase.expected.nationality
  ) {
    failures.push(`nationality expected ${testCase.expected.nationality}, got ${state.nationality}`);
  }

  if (
    testCase.expected.residenceCountry !== undefined &&
    state.residenceCountry !== testCase.expected.residenceCountry
  ) {
    failures.push(`residenceCountry expected ${testCase.expected.residenceCountry}, got ${state.residenceCountry}`);
  }

  if (
    testCase.expected.tripPurpose !== undefined &&
    state.tripPurpose !== testCase.expected.tripPurpose
  ) {
    failures.push(`tripPurpose expected ${testCase.expected.tripPurpose}, got ${state.tripPurpose}`);
  }

  if (
    testCase.expected.stayLengthDays !== undefined &&
    state.stayLengthDays !== testCase.expected.stayLengthDays
  ) {
    failures.push(`stayLengthDays expected ${testCase.expected.stayLengthDays}, got ${state.stayLengthDays}`);
  }

  if (
    testCase.expected.knowledgeCountry !== undefined &&
    actualKnowledgeCountry !== testCase.expected.knowledgeCountry
  ) {
    failures.push(`knowledgeCountry expected ${testCase.expected.knowledgeCountry}, got ${actualKnowledgeCountry}`);
  }

  if (testCase.expected.unsupportedServiceCountries !== undefined) {
    const unsupportedFailure = expectArrayEqual(
      'unsupportedServiceCountries',
      actualUnsupportedServiceCountries,
      testCase.expected.unsupportedServiceCountries
    );
    if (unsupportedFailure) failures.push(unsupportedFailure);
  }

  for (const country of testCase.expected.destinationIncludes ?? []) {
    if (!state.destinationCountries.includes(country)) {
      failures.push(`destinationCountries expected to include ${country}`);
    }
  }

  for (const country of testCase.expected.destinationExcludes ?? []) {
    if (state.destinationCountries.includes(country)) {
      failures.push(`destinationCountries expected to exclude ${country}`);
    }
  }

  if (
    testCase.expected.shouldAskClarification !== undefined &&
    shouldAskClarification(state) !== testCase.expected.shouldAskClarification
  ) {
    failures.push(
      `shouldAskClarification expected ${testCase.expected.shouldAskClarification}, got ${shouldAskClarification(state)}`
    );
  }

  for (const guardrail of testCase.expected.promptGuardrails ?? []) {
    if (!BASE_SYSTEM_PROMPT.toLowerCase().includes(guardrail.toLowerCase())) {
      failures.push(`BASE_SYSTEM_PROMPT missing guardrail text: ${guardrail}`);
    }
  }

  if (failures.length > 0) {
    console.log(
      JSON.stringify(
        {
          id: testCase.id,
          input: testCase.input,
          summary: summarizeVisaConversationState(state),
          intent,
          actualVisaType,
          actualKnowledgeCountry,
          actualUnsupportedServiceCountries,
          failures,
        },
        null,
        2
      )
    );
  }

  return {
    id: testCase.id,
    category: testCase.id.startsWith('EDGE-')
      ? 'edge_product_qa'
      : testCase.id.startsWith('COUNTRY-')
        ? 'country_matrix_qa'
        : testCase.id.startsWith('UNSUPPORTED-')
          ? 'unsupported_boundary_qa'
          : 'viza_product_qa',
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

const VISA_RAG_SEED_DIR = fileURLToPath(
  new URL('../../../knowledge-base/visa-rag-seeds/countries/', import.meta.url)
);
const FRONTEND_PRICING_FILE = fileURLToPath(
  new URL('../../../viza-fe/internal-website/lib/pricing.ts', import.meta.url)
);
const PRICING_COUNTRY_TO_RAG_COUNTRY: Record<string, SupportedKnowledgeCountry | 'schengen_area'> = {
  united_states: 'us',
  united_kingdom: 'uk',
  european_union: 'schengen_area',
};

function seedExists(country: SupportedKnowledgeCountry): boolean {
  return existsSync(`${VISA_RAG_SEED_DIR}/${country}.json`);
}

function pricingCountries(): string[] {
  const pricingSource = readFileSync(FRONTEND_PRICING_FILE, 'utf8');
  return Array.from(
    new Set(
      [...pricingSource.matchAll(/country:\s*"([^"]+)"/g)].map((match) => match[1])
    )
  );
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

    branch('LONG-001', 'long_conversation_memory_branch', () => {
      const { state, lastUserMessage } = applyMessages([
        { role: 'user', content: '你好' },
        {
          role: 'assistant',
          content: '你好，我是 VIZA。请告诉我目的地、护照/国籍、出行目的和停留时间。',
        },
        { role: 'user', content: '中国护照、人在新加坡、去日本 7 天' },
        {
          role: 'assistant',
          content: '基于你持中国护照、从新加坡申请、去日本旅游 7 天，我可以先说明日本短期旅游签证路线。',
        },
        { role: 'user', content: '那银行流水需要几个月？' },
      ]);
      return [
        expectEqual('remembered Japan after greeting and follow-up', state.mainDestination, 'japan'),
        expectEqual('remembered nationality', state.nationality, 'China'),
        expectEqual('remembered Singapore residence', state.residenceCountry, 'Singapore'),
        expectEqual('remembered stay length', state.stayLengthDays, 7),
        expectEqual('bank statement follow-up intent', inferVisaKnowledgeIntent(lastUserMessage, state.missingSlots), 'requirements'),
      ];
    }),
    branch('LONG-002', 'long_conversation_memory_branch', () => {
      const { state, lastUserMessage } = applyMessages([
        { role: 'user', content: '中国护照，人在新加坡，去法国和意大利旅游，总共 7 天' },
        { role: 'assistant', content: '你在 France, Italy 各停留几天？' },
        { role: 'user', content: '2，5' },
        { role: 'assistant', content: '意大利停留 5 天，比法国更久，通常按意大利作为申根主目的地。' },
        { role: 'user', content: '那主目的地还是意大利吗？' },
      ]);
      return [
        expectEqual('Schengen compact split keeps Italy main destination', state.mainDestination, 'italy'),
        expectEqual('France split retained', state.schengenDaySplit.france ?? null, 2),
        expectEqual('Italy split retained', state.schengenDaySplit.italy ?? null, 5),
        expectEqual('Singapore residence retained through Schengen follow-up', state.residenceCountry, 'Singapore'),
        expectEqual('main-destination follow-up intent', inferVisaKnowledgeIntent(lastUserMessage, state.missingSlots), 'route_recommendation'),
      ];
    }),
    branch('LONG-003', 'long_conversation_memory_branch', () => {
      const { state, lastUserMessage } = applyMessages([
        { role: 'user', content: '中国护照去加拿大旅游 10 天' },
        { role: 'assistant', content: 'Canada 旅游一般走 visitor visa 路线。' },
        { role: 'user', content: '需要什么材料？' },
        { role: 'assistant', content: '需要按加拿大 visitor visa 准备材料。' },
        { role: 'user', content: '不对，改成美国' },
        { role: 'assistant', content: '好的，已改为 United States。' },
        { role: 'user', content: '美国旅游签要面签吗？' },
      ]);
      return [
        expectEqual('correction replaces Canada with US', state.mainDestination, 'us'),
        expectEqual('old Canada removed in long conversation', state.destinationCountries.includes('canada'), false),
        expectEqual('US interview follow-up intent', inferVisaKnowledgeIntent(lastUserMessage, state.missingSlots), 'requirements'),
        expectEqual('US visitor visa retained', state.recommendedVisaType, 'b1_b2'),
      ];
    }),
    branch('LONG-004', 'long_conversation_memory_branch', () => {
      const { state, lastUserMessage } = applyMessages([
        { role: 'user', content: '中国护照，人在新加坡，去法国 5 天，再去英国 3 天旅游' },
        {
          role: 'assistant',
          content: '法国属于申根，英国需要单独路线；如果准备好了，我会给你对应申请入口。',
        },
        { role: 'user', content: '准备好了' },
      ]);
      const blocks = buildApplicationRedirectBlocks(
        state,
        state.mainDestination,
        state.recommendedVisaType
      );
      const urls = blocks.map((block) => block.redirectUrl);
      return [
        expectEqual('mixed long conversation form intent', inferVisaKnowledgeIntent(lastUserMessage, state.missingSlots), 'form_intake'),
        expectEqual('France remains Schengen main destination', state.mainDestination, 'france'),
        expectEqual('UK remains separate destination', state.destinationCountries.includes('uk'), true),
        expectEqual('France Schengen redirect emitted', urls.includes('/client/application?country=france&visaType=EU_SCHENGEN_C_SHORT_STAY'), true),
        expectEqual('UK redirect emitted', urls.includes('/client/application?country=united_kingdom&visaType=UK_STANDARD_VISITOR'), true),
      ];
    }),
    branch('LONG-005', 'long_conversation_memory_branch', () => {
      const { state, lastUserMessage } = applyMessages([
        { role: 'user', content: '中国护照，人在新加坡，去日本旅游 7 天' },
        { role: 'assistant', content: '日本短期旅游路线已记录。' },
        { role: 'user', content: '其实改成墨西哥，有有效美国签证' },
      ]);
      return [
        expectEqual('unsupported correction moves to Mexico', state.mainDestination, 'mexico'),
        expectEqual('old Japan removed after unsupported correction', state.destinationCountries.includes('japan'), false),
        expectArrayEqual('Mexico service boundary detected', detectUnsupportedServiceCountries(lastUserMessage), ['mexico']),
        expectEqual('Mexico does not route to knowledge country', resolveKnowledgeCountry(lastUserMessage), null),
      ];
    }),
    branch('LONG-006', 'long_conversation_memory_branch', () => {
      const { state } = applyMessages([
        {
          role: 'user',
          content: 'I have a Chinese passport, live in Singapore, and want to visit Japan for 7 days.',
        },
      ]);
      const prompt = buildSystemPrompt(
        { profile: null, application: null },
        undefined,
        undefined,
        buildVisaConversationStatePrompt(state),
        'zh'
      );
      return [
        expectEqual('English input resolves Japan', state.mainDestination, 'japan'),
        expectEqual('English input keeps Singapore residence', state.residenceCountry, 'Singapore'),
        expectEqual('English input keeps Chinese passport', state.nationality, 'China'),
        expectEqual('Chinese UI prompt still requires Chinese answer', prompt.includes('Respond primarily in Simplified Chinese even if the user writes in English'), true),
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
    branch('SERVICE-RAG-001', 'service_rag_coverage_branch', () => {
      const missingSeeds = Array.from(VISA_SERVICE_COUNTRIES).filter(
        (country) => !seedExists(country)
      );
      return [
        expectArrayEqual('every service country has a RAG seed file', missingSeeds, []),
      ];
    }),
    branch('SERVICE-RAG-002', 'service_rag_coverage_branch', () => {
      const missingPricingSeeds = pricingCountries()
        .map((country) => ({
          pricingCountry: country,
          ragCountry: PRICING_COUNTRY_TO_RAG_COUNTRY[country] ?? (country as SupportedKnowledgeCountry),
        }))
        .filter((entry) => entry.ragCountry !== 'schengen_area')
        .filter((entry) => !seedExists(entry.ragCountry as SupportedKnowledgeCountry))
        .map((entry) => `${entry.pricingCountry}->${entry.ragCountry}`);
      return [
        expectArrayEqual('every pricing/form country maps to a RAG seed file', missingPricingSeeds, []),
      ];
    }),
  ];
}

const results = evalCases.map(evaluateCase);
const productResults = productQaCases.map(evaluateProductQaCase);
const branchResults = evaluateBranchTests();
const passed = results.filter((result) => result.passed).length;
const productPassed = productResults.filter((result) => result.passed).length;
const passRate = passed / results.length;
const productPassRate = productPassed / productResults.length;
const branchPassed = branchResults.filter((result) => result.passed).length;
const branchPassRate = branchPassed / branchResults.length;
const combinedPassed = passed + productPassed + branchPassed;
const combinedTotal = results.length + productResults.length + branchResults.length;
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
const productByCategory = productResults.reduce<Record<string, { passed: number; total: number }>>(
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
      productQaTotal: productResults.length,
      productQaPassed: productPassed,
      productQaFailed: productResults.length - productPassed,
      productQaPassRate: Number((productPassRate * 100).toFixed(2)),
      branchTotal: branchResults.length,
      branchPassed,
      branchFailed: branchResults.length - branchPassed,
      branchPassRate: Number((branchPassRate * 100).toFixed(2)),
      combinedTotal,
      combinedPassed,
      combinedFailed: combinedTotal - combinedPassed,
      combinedPassRate: Number(((combinedPassed / combinedTotal) * 100).toFixed(2)),
      byCategory,
      productByCategory,
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

if (productResults.length < 60) {
  console.error(`Expected at least 60 product QA cases, got ${productResults.length}`);
  process.exit(1);
}

if (passRate < 0.9) {
  console.error('Visa agent eval pass rate is below 90%');
  process.exit(1);
}

if (productPassRate < 1) {
  console.error('Visa agent product QA cases must pass at 100%');
  process.exit(1);
}

if (branchPassRate < 1) {
  console.error('Visa agent branch robustness tests must pass at 100%');
  process.exit(1);
}
