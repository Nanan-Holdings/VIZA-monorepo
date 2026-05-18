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
} from '../services/visa-knowledge.service.js';

const logger = new Logger({ serviceName: 'VisaNamespace' });

type SupportedKnowledgeCountry =
  | 'austria'
  | 'australia'
  | 'belgium'
  | 'bulgaria'
  | 'canada'
  | 'cambodia'
  | 'croatia'
  | 'czech_republic'
  | 'denmark'
  | 'egypt'
  | 'estonia'
  | 'finland'
  | 'france'
  | 'germany'
  | 'greece'
  | 'hungary'
  | 'iceland'
  | 'india'
  | 'indonesia'
  | 'italy'
  | 'japan'
  | 'laos'
  | 'latvia'
  | 'liechtenstein'
  | 'lithuania'
  | 'luxembourg'
  | 'malaysia'
  | 'maldives'
  | 'malta'
  | 'mexico'
  | 'morocco'
  | 'nepal'
  | 'netherlands'
  | 'new_zealand'
  | 'norway'
  | 'philippines'
  | 'poland'
  | 'portugal'
  | 'qatar'
  | 'romania'
  | 'saudi_arabia'
  | 'singapore'
  | 'slovakia'
  | 'slovenia'
  | 'south_africa'
  | 'south_korea'
  | 'spain'
  | 'sri_lanka'
  | 'switzerland'
  | 'sweden'
  | 'thailand'
  | 'turkey'
  | 'uk'
  | 'united_arab_emirates'
  | 'us'
  | 'vietnam';

const COUNTRY_DISPLAY_NAMES: Record<SupportedKnowledgeCountry, string> = {
  austria: 'Austria',
  australia: 'Australia',
  belgium: 'Belgium',
  bulgaria: 'Bulgaria',
  canada: 'Canada',
  cambodia: 'Cambodia',
  croatia: 'Croatia',
  czech_republic: 'Czech Republic',
  denmark: 'Denmark',
  egypt: 'Egypt',
  estonia: 'Estonia',
  finland: 'Finland',
  france: 'France',
  germany: 'Germany',
  greece: 'Greece',
  hungary: 'Hungary',
  iceland: 'Iceland',
  india: 'India',
  indonesia: 'Indonesia',
  italy: 'Italy',
  japan: 'Japan',
  laos: 'Laos',
  latvia: 'Latvia',
  liechtenstein: 'Liechtenstein',
  lithuania: 'Lithuania',
  luxembourg: 'Luxembourg',
  malaysia: 'Malaysia',
  maldives: 'Maldives',
  malta: 'Malta',
  mexico: 'Mexico',
  morocco: 'Morocco',
  nepal: 'Nepal',
  netherlands: 'Netherlands',
  new_zealand: 'New Zealand',
  norway: 'Norway',
  philippines: 'Philippines',
  poland: 'Poland',
  portugal: 'Portugal',
  qatar: 'Qatar',
  romania: 'Romania',
  saudi_arabia: 'Saudi Arabia',
  singapore: 'Singapore',
  slovakia: 'Slovakia',
  slovenia: 'Slovenia',
  south_africa: 'South Africa',
  south_korea: 'South Korea',
  spain: 'Spain',
  sri_lanka: 'Sri Lanka',
  switzerland: 'Switzerland',
  sweden: 'Sweden',
  thailand: 'Thailand',
  turkey: 'Turkey',
  uk: 'United Kingdom',
  united_arab_emirates: 'United Arab Emirates',
  us: 'United States',
  vietnam: 'Vietnam',
};

const COUNTRY_ALIASES: Record<SupportedKnowledgeCountry, string[]> = {
  austria: ['奥地利', 'austria', 'vienna', 'salzburg', '维也纳', '萨尔茨堡'],
  australia: ['澳大利亚', '澳洲', 'australia', 'sydney', 'melbourne', '悉尼', '墨尔本'],
  belgium: ['比利时', 'belgium', 'brussels', 'bruges', '布鲁塞尔', '布鲁日'],
  bulgaria: ['保加利亚', 'bulgaria', 'sofia', '索非亚'],
  canada: ['加拿大', 'canada', 'vancouver', 'toronto', 'montreal', '温哥华', '多伦多', '蒙特利尔'],
  cambodia: ['柬埔寨', 'cambodia', 'phnom penh', 'siem reap', '金边', '暹粒'],
  croatia: ['克罗地亚', 'croatia', 'zagreb', 'dubrovnik', '萨格勒布', '杜布罗夫尼克'],
  czech_republic: ['捷克', 'czech republic', 'czechia', 'prague', '布拉格'],
  denmark: ['丹麦', 'denmark', 'copenhagen', '哥本哈根'],
  egypt: ['埃及', 'egypt', 'cairo', 'luxor', '开罗', '卢克索'],
  estonia: ['爱沙尼亚', 'estonia', 'tallinn', '塔林'],
  finland: ['芬兰', 'finland', 'helsinki', '赫尔辛基'],
  france: ['法国', 'france', 'paris', '巴黎'],
  germany: ['德国', 'germany', 'berlin', 'munich', 'frankfurt', '柏林', '慕尼黑', '法兰克福'],
  greece: ['希腊', 'greece', 'athens', 'santorini', '雅典', '圣托里尼'],
  hungary: ['匈牙利', 'hungary', 'budapest', '布达佩斯'],
  iceland: ['冰岛', 'iceland', 'reykjavik', '雷克雅未克'],
  india: ['india', 'delhi', 'mumbai', 'new delhi', '新德里', '孟买'],
  indonesia: ['印尼', '印度尼西亚', 'indonesia', 'bali', '巴厘岛'],
  italy: ['意大利', 'italy', 'rome', 'milan', 'venice', '罗马', '米兰', '威尼斯'],
  japan: ['日本', 'japan', 'tokyo', 'osaka', 'kyoto', '东京', '大阪', '京都', 'japan evisa'],
  laos: ['老挝', 'laos', 'vientiane', 'luang prabang', '万象', '琅勃拉邦'],
  latvia: ['拉脱维亚', 'latvia', 'riga', '里加'],
  liechtenstein: ['列支敦士登', 'liechtenstein', 'vaduz', '瓦杜兹'],
  lithuania: ['立陶宛', 'lithuania', 'vilnius', '维尔纽斯'],
  luxembourg: ['卢森堡', 'luxembourg'],
  malaysia: ['马来西亚', 'malaysia', 'kuala lumpur', 'penang', 'sabah', '吉隆坡', '槟城', '沙巴'],
  maldives: ['马尔代夫', 'maldives', 'male', '马累'],
  malta: ['马耳他', 'malta', 'valletta', '瓦莱塔'],
  mexico: ['墨西哥', 'mexico', 'mexico city', 'cancun', '墨西哥城', '坎昆'],
  morocco: ['摩洛哥', 'morocco', 'marrakech', 'casablanca', '马拉喀什', '卡萨布兰卡'],
  nepal: ['尼泊尔', 'nepal', 'kathmandu', 'pokhara', '加德满都', '博卡拉'],
  netherlands: ['荷兰', 'netherlands', 'holland', 'amsterdam', '阿姆斯特丹'],
  new_zealand: ['新西兰', 'new zealand', 'auckland', 'queenstown', '奥克兰', '皇后镇'],
  norway: ['挪威', 'norway', 'oslo', 'bergen', '奥斯陆', '卑尔根'],
  philippines: ['菲律宾', 'philippines', 'manila', 'cebu', '马尼拉', '宿务'],
  poland: ['波兰', 'poland', 'warsaw', 'krakow', '华沙', '克拉科夫'],
  portugal: ['葡萄牙', 'portugal', 'lisbon', 'porto', '里斯本', '波尔图'],
  qatar: ['卡塔尔', 'qatar', 'doha', '多哈', 'hayya'],
  romania: ['罗马尼亚', 'romania', 'bucharest', '布加勒斯特'],
  saudi_arabia: ['沙特', '沙特阿拉伯', 'saudi', 'saudi arabia', 'riyadh', 'jeddah', '利雅得', '吉达'],
  singapore: ['新加坡', 'singapore', 'singapore visa', 'sg arrival card', 'sgac'],
  slovakia: ['斯洛伐克', 'slovakia', 'bratislava', '布拉迪斯拉发'],
  slovenia: ['斯洛文尼亚', 'slovenia', 'ljubljana', '卢布尔雅那'],
  south_africa: ['南非', 'south africa', 'cape town', 'johannesburg', '开普敦', '约翰内斯堡'],
  south_korea: ['韩国', '南韩', 'south korea', 'korea', 'seoul', '首尔', 'k-eta', 'keta'],
  spain: ['西班牙', 'spain', 'madrid', 'barcelona', '马德里', '巴塞罗那'],
  sri_lanka: ['斯里兰卡', 'sri lanka', 'colombo', '科伦坡'],
  switzerland: ['瑞士', 'switzerland', 'swiss', 'zurich', 'geneva', '苏黎世', '日内瓦'],
  sweden: ['瑞典', 'sweden', 'stockholm', '斯德哥尔摩'],
  thailand: ['泰国', 'thailand', 'bangkok', 'phuket', 'chiang mai', '曼谷', '普吉', '清迈'],
  turkey: ['土耳其', 'turkey', 'turkiye', 'istanbul', '伊斯坦布尔'],
  uk: ['英国', '英签', 'united kingdom', 'britain', 'england', 'london', '伦敦'],
  united_arab_emirates: ['阿联酋', '迪拜', '阿布扎比', 'uae', 'united arab emirates', 'dubai', 'abu dhabi'],
  us: ['美国', '美签', 'united states', 'u.s.', 'usa', 'us visa', 'b1/b2', 'b-1/b-2', 'ds-160', 'ds160'],
  vietnam: ['越南', 'vietnam', 'hanoi', '河内', 'ho chi minh', 'saigon', '胡志明'],
};

const SCHENGEN_KNOWLEDGE_COUNTRIES = new Set<SupportedKnowledgeCountry>([
  'austria',
  'belgium',
  'bulgaria',
  'croatia',
  'czech_republic',
  'denmark',
  'estonia',
  'finland',
  'france',
  'germany',
  'greece',
  'hungary',
  'iceland',
  'italy',
  'latvia',
  'liechtenstein',
  'lithuania',
  'luxembourg',
  'malta',
  'netherlands',
  'norway',
  'poland',
  'portugal',
  'romania',
  'slovakia',
  'slovenia',
  'spain',
  'switzerland',
  'sweden',
]);

function includesAny(value: string, terms: string[]): boolean {
  return terms.some((term) => value.includes(term));
}

function hasUsKeyword(value: string): boolean {
  return (
    /\bus\b/.test(value) ||
    includesAny(value, [
      '美国',
      '美签',
      'united states',
      'u.s.',
      'usa',
      'us visa',
      'b1/b2',
      'b-1/b-2',
      'ds-160',
      'ds160',
    ])
  );
}

function matchesKnowledgeCountry(
  normalized: string,
  country: SupportedKnowledgeCountry
): boolean {
  if (country === 'us') {
    return hasUsKeyword(normalized);
  }

  if (country === 'uk') {
    return (
      /\buk\b/.test(normalized) ||
      includesAny(normalized, COUNTRY_ALIASES[country])
    );
  }

  if (country === 'india') {
    return (
      (normalized.includes('印度') && !normalized.includes('印度尼西亚')) ||
      includesAny(normalized, COUNTRY_ALIASES[country])
    );
  }

  return includesAny(normalized, COUNTRY_ALIASES[country]);
}

function isSchengenKnowledgeCountry(
  country: SupportedKnowledgeCountry | null
): boolean {
  return Boolean(country && SCHENGEN_KNOWLEDGE_COUNTRIES.has(country));
}

function normalizeKnowledgeCountry(
  country?: string | null
): SupportedKnowledgeCountry | null {
  if (!country) return null;
  const normalized = country.toLowerCase();

  for (const knowledgeCountry of Object.keys(
    COUNTRY_ALIASES
  ) as SupportedKnowledgeCountry[]) {
    if (matchesKnowledgeCountry(normalized, knowledgeCountry)) {
      return knowledgeCountry;
    }
  }

  return null;
}

function detectKnowledgeCountries(value: string): SupportedKnowledgeCountry[] {
  const normalized = value.toLowerCase();
  return (Object.keys(COUNTRY_ALIASES) as SupportedKnowledgeCountry[]).filter(
    (country) => matchesKnowledgeCountry(normalized, country)
  );
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

function earliestCountryIndex(
  normalized: string,
  country: SupportedKnowledgeCountry
): number {
  const indices = COUNTRY_ALIASES[country]
    .map((alias) => normalized.indexOf(alias.toLowerCase()))
    .filter((index) => index >= 0);

  if (country === 'us') {
    const usMatch = /\bus\b/.exec(normalized);
    if (usMatch?.index !== undefined) {
      indices.push(usMatch.index);
    }
  }

  return indices.length > 0 ? Math.min(...indices) : -1;
}

function detectKnowledgeCountriesInOrder(value: string): SupportedKnowledgeCountry[] {
  const normalized = value.toLowerCase();
  return (Object.keys(COUNTRY_ALIASES) as SupportedKnowledgeCountry[])
    .map((country) => ({ country, index: earliestCountryIndex(normalized, country) }))
    .filter((entry) => entry.index >= 0)
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.country);
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

  if (country === 'us') {
    if (
      normalized.includes('b1') ||
      normalized.includes('b-1') ||
      normalized.includes('b2') ||
      normalized.includes('b-2') ||
      normalized.includes('b1/b2') ||
      normalized.includes('b-1/b-2') ||
      normalized.includes('旅游') ||
      normalized.includes('商务') ||
      normalized.includes('visitor') ||
      normalized.includes('tourist') ||
      normalized.includes('business') ||
      normalized.includes('ds-160') ||
      normalized.includes('ds160')
    ) {
      return 'b1_b2';
    }
  }

  if (country === 'indonesia' && mentionsVisitorPurpose) {
    return 'tourist_b211a';
  }

  if (
    country === 'vietnam' &&
    (mentionsVisitorPurpose ||
      includesAny(normalized, ['evisa', 'e-visa', '电子签', '电子签证']))
  ) {
    return 'evisa_tourism';
  }

  if (country === 'uk' && mentionsVisitorPurpose) {
    return 'standard_visitor';
  }

  if (
    isSchengenKnowledgeCountry(country) &&
    (mentionsVisitorPurpose || includesAny(normalized, ['申根', 'schengen']))
  ) {
    return 'schengen_short_stay_tourism';
  }

  if (country === 'singapore' && mentionsVisitorPurpose) {
    return 'entry_visa_or_visit_pass';
  }

  if (country === 'malaysia' && mentionsVisitorPurpose) {
    return 'visa_exemption_or_evisa_tourism';
  }

  if (country === 'thailand' && mentionsVisitorPurpose) {
    return 'visa_exemption_or_tourist_visa';
  }

  if (country === 'canada' && mentionsVisitorPurpose) {
    return 'visitor_visa';
  }

  if (country === 'australia' && mentionsVisitorPurpose) {
    return 'visitor_subclass_600';
  }

  if (country === 'new_zealand' && mentionsVisitorPurpose) {
    return 'visitor_visa';
  }

  if (country === 'japan' && mentionsVisitorPurpose) {
    return 'short_term_tourism_evisa';
  }

  if (country === 'south_korea' && mentionsVisitorPurpose) {
    return 'c3_or_keta';
  }

  if (country === 'united_arab_emirates' && mentionsVisitorPurpose) {
    return 'visa_free_or_tourist_visa';
  }

  if (country === 'egypt' && mentionsVisitorPurpose) {
    return 'evisa_tourism';
  }

  if (country === 'turkey' && mentionsVisitorPurpose) {
    return 'evisa_tourism_business';
  }

  if (country === 'qatar' && mentionsVisitorPurpose) {
    return 'hayya_a1_tourist_visa';
  }

  if (country === 'saudi_arabia' && mentionsVisitorPurpose) {
    return 'tourist_evisa';
  }

  if (country === 'morocco' && mentionsVisitorPurpose) {
    return 'visa_free_or_evisa';
  }

  if (country === 'south_africa' && mentionsVisitorPurpose) {
    return 'visitor_visa_tourism';
  }

  if (country === 'maldives' && mentionsVisitorPurpose) {
    return 'tourist_visa_on_arrival';
  }

  if (country === 'sri_lanka' && mentionsVisitorPurpose) {
    return 'eta_tourism';
  }

  if (country === 'india' && mentionsVisitorPurpose) {
    return 'regular_tourist_visa';
  }

  if (country === 'philippines' && mentionsVisitorPurpose) {
    return 'visa_free_14_days_or_evisa';
  }

  if (country === 'cambodia' && mentionsVisitorPurpose) {
    return 'tourist_evisa';
  }

  if (country === 'laos' && mentionsVisitorPurpose) {
    return 'tourist_evisa';
  }

  if (country === 'nepal' && mentionsVisitorPurpose) {
    return 'tourist_visa_on_arrival';
  }

  if (country === 'mexico' && mentionsVisitorPurpose) {
    return 'visitor_visa_or_exemption';
  }

  if (!country && includesAny(normalized, ['申根', 'schengen'])) {
    return 'schengen_short_stay_tourism';
  }

  if (
    (country === 'indonesia' && applicationVisaType === 'tourist_b211a') ||
    (country === 'us' && applicationVisaType === 'b1_b2') ||
    (country === 'vietnam' && applicationVisaType === 'evisa_tourism') ||
    (country === 'uk' && applicationVisaType === 'standard_visitor') ||
    (isSchengenKnowledgeCountry(country) &&
      applicationVisaType === 'schengen_short_stay_tourism') ||
    (country === 'singapore' &&
      applicationVisaType === 'entry_visa_or_visit_pass') ||
    (country === 'malaysia' &&
      applicationVisaType === 'visa_exemption_or_evisa_tourism') ||
    (country === 'thailand' &&
      applicationVisaType === 'visa_exemption_or_tourist_visa') ||
    (country === 'canada' && applicationVisaType === 'visitor_visa') ||
    (country === 'australia' &&
      applicationVisaType === 'visitor_subclass_600') ||
    (country === 'new_zealand' && applicationVisaType === 'visitor_visa') ||
    (country === 'japan' &&
      applicationVisaType === 'short_term_tourism_evisa') ||
    (country === 'south_korea' && applicationVisaType === 'c3_or_keta') ||
    (country === 'united_arab_emirates' &&
      applicationVisaType === 'visa_free_or_tourist_visa') ||
    (country === 'egypt' && applicationVisaType === 'evisa_tourism') ||
    (country === 'turkey' &&
      applicationVisaType === 'evisa_tourism_business') ||
    (country === 'qatar' &&
      applicationVisaType === 'hayya_a1_tourist_visa') ||
    (country === 'saudi_arabia' &&
      applicationVisaType === 'tourist_evisa') ||
    (country === 'morocco' &&
      applicationVisaType === 'visa_free_or_evisa') ||
    (country === 'south_africa' &&
      applicationVisaType === 'visitor_visa_tourism') ||
    (country === 'maldives' &&
      applicationVisaType === 'tourist_visa_on_arrival') ||
    (country === 'sri_lanka' &&
      applicationVisaType === 'eta_tourism') ||
    (country === 'india' &&
      applicationVisaType === 'regular_tourist_visa') ||
    (country === 'philippines' &&
      applicationVisaType === 'visa_free_14_days_or_evisa') ||
    (country === 'cambodia' &&
      applicationVisaType === 'tourist_evisa') ||
    (country === 'laos' && applicationVisaType === 'tourist_evisa') ||
    (country === 'nepal' &&
      applicationVisaType === 'tourist_visa_on_arrival') ||
    (country === 'mexico' &&
      applicationVisaType === 'visitor_visa_or_exemption')
  ) {
    return applicationVisaType;
  }

  return null;
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

        // 3. Build dynamic system prompt with user application context (US-036)
        //    and retrieved visa knowledge from visa_chunks.
        const appContext = await buildApplicationContext(user_id);
        const recentUserContext = buildRecentUserContext(chatHistory);
        const knowledgeCountry = resolveKnowledgeCountry(
          message,
          appContext.application?.country,
          recentUserContext
        );
        const knowledgeVisaType = resolveKnowledgeVisaType(
          knowledgeCountry,
          message,
          appContext.application?.visa_type,
          recentUserContext
        );
        const knowledgeResult = await retrieveVisaKnowledge({
          query: recentUserContext ? `${recentUserContext}\n${message}` : message,
          country: knowledgeCountry,
          visaType: knowledgeVisaType,
          matchCount: 5,
        });
        const knowledgeContext = formatKnowledgeContext(knowledgeResult.chunks);
        const compactAnswerInterpretation = buildCompactAnswerInterpretation(
          chatHistory,
          message
        );
        const dynamicSystemPrompt = buildSystemPrompt(
          appContext,
          knowledgeContext,
          compactAnswerInterpretation ?? undefined
        );

        socket.emit('app_log', {
          type: 'rag_retrieval',
          category: 'rag',
          name: 'visa_knowledge',
          result: {
            chunkCount: knowledgeResult.chunks.length,
            country: knowledgeCountry,
            visaType: knowledgeVisaType,
            historySource,
            historyLength: chatHistory.length,
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
            // US-037: handle tool use
            onToolUse: async (toolName, toolInput: ApplicationBlockPayload) => {
              logger.info('Tool use: send_application_block', {
                toolName,
                blockType: toolInput.blockType,
                sessionId: session_id,
              });

              // Emit application_block event to the client
              socket.emit('application_block', {
                type: 'application_block',
                payload: toolInput,
                timestamp: Date.now(),
              });

              // Save block record to visa_chat_messages with role='block'
              try {
                await db.insert(visaChatMessages).values({
                  sessionId: session_id,
                  role: 'block',
                  content: toolInput.title,
                  blockData: toolInput as unknown as Record<string, unknown>,
                });
              } catch (dbErr) {
                logger.error('Failed to save block message', dbErr as Error, {
                  sessionId: session_id,
                });
              }
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
