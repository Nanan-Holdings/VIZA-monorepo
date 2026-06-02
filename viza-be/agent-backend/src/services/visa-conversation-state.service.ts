import { asc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { visaChatMessages } from '../db/schema.js';
import {
  COUNTRY_DISPLAY_NAMES,
  detectKnowledgeCountriesInOrder,
  earliestCountryIndex,
  getDefaultVisitorVisaType,
  isSchengenKnowledgeCountry,
  type SupportedKnowledgeCountry,
} from '../config/visa-destination-registry.js';

export const VISA_CONVERSATION_STATE_MARKER_PREFIX =
  '__viza_conversation_state__:';

export type TripPurpose =
  | 'tourism'
  | 'business'
  | 'study'
  | 'work'
  | 'family_visit'
  | 'transit'
  | 'long_stay'
  | 'unknown';

export interface VisaConversationState {
  destinationCountries: SupportedKnowledgeCountry[];
  mainDestination: SupportedKnowledgeCountry | null;
  nationality: string | null;
  residenceCountry: string | null;
  residenceCity: string | null;
  tripPurpose: TripPurpose | null;
  stayLengthDays: number | null;
  schengenDaySplit: Partial<Record<SupportedKnowledgeCountry, number>>;
  firstEntryCountry: SupportedKnowledgeCountry | null;
  recommendedVisaType: string | null;
  missingSlots: string[];
  confidence: number;
  updatedAt: string;
}

type ChatTurn = { role: 'user' | 'assistant'; content: string };

type VisaConversationStatePatch = Partial<
  Omit<VisaConversationState, 'missingSlots' | 'confidence' | 'updatedAt'>
>;

const EMPTY_STATE: VisaConversationState = {
  destinationCountries: [],
  mainDestination: null,
  nationality: null,
  residenceCountry: null,
  residenceCity: null,
  tripPurpose: null,
  stayLengthDays: null,
  schengenDaySplit: {},
  firstEntryCountry: null,
  recommendedVisaType: null,
  missingSlots: [],
  confidence: 0,
  updatedAt: new Date(0).toISOString(),
};

function uniqueCountries(
  countries: Array<SupportedKnowledgeCountry | null | undefined>
): SupportedKnowledgeCountry[] {
  return Array.from(
    new Set(countries.filter((country): country is SupportedKnowledgeCountry => Boolean(country)))
  );
}

function normalizeFreeTextCountry(value: string): string {
  const trimmed = value.trim().replace(/^在/, '').replace(/的$/, '').trim();
  if (!trimmed) return trimmed;
  if (/^(中国|china|chinese|中国大陆|大陆)$/i.test(trimmed)) return 'China';
  if (/^(新加坡|singapore)$/i.test(trimmed)) return 'Singapore';
  if (/^(美国|usa|us|united states)$/i.test(trimmed)) return 'United States';
  if (/^(英国|uk|united kingdom)$/i.test(trimmed)) return 'United Kingdom';
  return trimmed;
}

function splitCompactAnswer(message: string): string[] {
  return message
    .split(/[,，、;；\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function isCompactFollowUp(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed || trimmed.length > 100) return false;
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
  if (/(国籍|护照|nationality|passport)/i.test(normalized)) return 'nationality';
  if (/(居住|住在|所在|current residence|currently live|apply from)/i.test(normalized)) {
    return 'residence';
  }
  if (/(停留|多少天|几天|how long|days)/i.test(normalized)) return 'stayLengthDays';
  if (/(其他申根|除|other schengen)/i.test(normalized)) return 'otherSchengenCountries';
  if (/(目的地|destination)/i.test(normalized)) return 'destination';
  if (/(目的|purpose|tourism|business)/i.test(normalized)) return 'tripPurpose';
  return null;
}

function parseStayDays(value: string): number | null {
  const match = value.trim().match(/^(\d+(?:[.．]\d+)?)\s*(?:天|日|days?)?$/i);
  if (!match) return null;
  return Number(match[1].replace('．', '.'));
}

function inferTripPurpose(message: string): TripPurpose | null {
  const normalized = message.toLowerCase();
  if (/(长期居留|长期住|长期生活|定居|移民|永居|long[-\s]?term|long stay|residence)/i.test(normalized)) {
    return 'long_stay';
  }
  if (/(远程工作|工作|work|employment|上班)/i.test(normalized)) return 'work';
  if (/(读书|学习|留学|学生签证|study|student|school)/i.test(normalized)) return 'study';
  if (/(探亲|访友|看朋友|看亲戚|family|friend|relative)/i.test(normalized)) return 'family_visit';
  if (/(商务|会议|business|conference|meeting)/i.test(normalized)) return 'business';
  if (/(转机|过境|transit)/i.test(normalized)) return 'transit';
  if (/(旅游|旅行|观光|度假|演唱会|concert|touris|holiday|vacation|visit)/i.test(normalized)) {
    return 'tourism';
  }
  if (/(?:去|前往|计划去|想去|到|visit).{0,40}(?:签证|visa|停留|\d+(?:[.．]\d+)?\s*(?:天|日|days?))/i.test(normalized)) {
    return 'tourism';
  }
  return null;
}

function extractNationality(message: string): string | null {
  if (/(中国护照|中国国籍|我是中国人|chinese passport|chinese citizen)/i.test(message)) {
    return 'China';
  }

  const passportIsMatch =
    message.match(/(?:持有|持)\s*([\p{Script=Han}A-Za-z\s]+?)(?:的)?(?:护照|passport)/iu) ??
    message.match(/(?:护照是)\s*([\p{Script=Han}A-Za-z\s]+?)(?:的)?(?:[,，、;；。.!?\n]|$)/iu);
  if (passportIsMatch?.[1]) {
    return normalizeFreeTextCountry(passportIsMatch[1]);
  }

  const passportMatch = message.match(/([\p{Script=Han}A-Za-z\s]+?)(?:护照|passport)/iu);
  if (passportMatch?.[1]) {
    return normalizeFreeTextCountry(passportMatch[1]);
  }

  const nationalityMatch = message.match(/(?:国籍是|国籍|nationality is|nationality)\s*[:：]?\s*([\p{Script=Han}A-Za-z\s]+)/iu);
  if (nationalityMatch?.[1]) {
    return normalizeFreeTextCountry(nationalityMatch[1]);
  }

  return null;
}

function isTravelActionResidenceSegment(value: string): boolean {
  return /(转机|过境|入境|旅游|旅行|观光|度假|visit|transit|travel|touris|holiday|vacation)/i.test(
    value
  );
}

function extractResidenceCountry(message: string): string | null {
  const residencePatterns = [
    /(?:人在|目前在|现在在|当前在|我在)\s*([^,，、;；。.!?\n]+)/iu,
    /(?:我(?:住在|居住在|住)|目前(?:住在|居住在)|现在(?:住在|居住在)|常住(?:在)?)\s*([^,，、;；。.!?\n]+)/iu,
    /(?:从)\s*([^,，、;；。.!?\n]+?)\s*(?:出发|申请)/iu,
    /([^,，、;；。.!?\n]+?)\s*(?:PR|pr|永久居民)/iu,
    /(?:live in|living in|resident in|reside in|apply from)\s+([A-Za-z\s]+)/iu,
  ];

  for (const pattern of residencePatterns) {
    const match = message.match(pattern);
    if (match?.[1]) {
      if (isTravelActionResidenceSegment(match[1])) continue;
      const countries = detectKnowledgeCountriesInOrder(match[1]);
      if (countries[0]) return COUNTRY_DISPLAY_NAMES[countries[0]];
      return normalizeFreeTextCountry(match[1]);
    }
  }

  return null;
}

function extractResidenceCountries(message: string): SupportedKnowledgeCountry[] {
  const residenceTextMatches = [
    ...message.matchAll(/(?:人在|目前在|现在在|当前在|我在)([^,，、;；。.!?\n]*)/giu),
    ...message.matchAll(/(?:我(?:住在|居住在|住)|目前(?:住在|居住在)|现在(?:住在|居住在)|常住(?:在)?)([^,，、;；。.!?\n]*)/giu),
    ...message.matchAll(/(?:从)\s*([^,，、;；。.!?\n]+?)\s*(?:出发|申请)/giu),
    ...message.matchAll(/([^,，、;；。.!?\n]+?)\s*(?:PR|pr|永久居民)/giu),
    ...message.matchAll(/(?:live in|living in|resident in|reside in|apply from)\s+([^,，、;；。.!?\n]*)/giu),
  ];
  return uniqueCountries(
    residenceTextMatches.flatMap((match) => {
      if (!match[1] || isTravelActionResidenceSegment(match[1])) return [];
      return detectKnowledgeCountriesInOrder(match[1]);
    })
  );
}

function extractContextOnlyCountries(message: string): SupportedKnowledgeCountry[] {
  const contextMatches = [
    ...message.matchAll(/(?:已有|已经有|有|持有|valid|existing).{0,12}?(?:签证|visa)/giu),
  ];
  return uniqueCountries(
    contextMatches.flatMap((match) => detectKnowledgeCountriesInOrder(match[0]))
  );
}

function extractFirstEntryCountry(message: string): SupportedKnowledgeCountry | null {
  const firstEntryMatch = message.match(/(?:首入境|第一入境|先到|first entry|enter first|arrive first)([^,，、;；。.!?\n]*)/iu)
    ?? message.match(/(?:从)\s*([^,，、;；。.!?\n]+?)\s*(?:入境|进入申根)/iu);
  if (!firstEntryMatch?.[1]) return null;
  return detectKnowledgeCountriesInOrder(firstEntryMatch[1])[0] ?? null;
}

function extractCountryDaySplit(
  message: string,
  countries: SupportedKnowledgeCountry[]
): Partial<Record<SupportedKnowledgeCountry, number>> {
  if (countries.length < 2) return {};

  const equalDaysMatch = message.match(/各\s*(\d+(?:[.．]\d+)?)\s*(?:天|日|days?)/i);
  if (equalDaysMatch?.[1] && countries.length > 1) {
    const days = Number(equalDaysMatch[1].replace('．', '.'));
    return Object.fromEntries(countries.map((country) => [country, days])) as Partial<
      Record<SupportedKnowledgeCountry, number>
    >;
  }

  const normalized = message.toLowerCase();
  const ordered = countries
    .map((country) => ({ country, index: earliestCountryIndex(normalized, country) }))
    .filter((entry) => entry.index >= 0)
    .sort((a, b) => a.index - b.index);
  const daySplit: Partial<Record<SupportedKnowledgeCountry, number>> = {};

  ordered.forEach((entry, index) => {
    const nextIndex = ordered[index + 1]?.index ?? message.length;
    const segment = message.slice(entry.index, nextIndex);
    const daysMatch = segment.match(/(\d+(?:[.．]\d+)?)\s*(?:天|日|days?)/i);
    const isTotalTripDuration = /(总共|总计|共|一共|total)\s*\d/i.test(segment);
    if (daysMatch?.[1] && !isTotalTripDuration) {
      daySplit[entry.country] = Number(daysMatch[1].replace('．', '.'));
    }
  });

  return daySplit;
}

function findLastAssistant(history: ChatTurn[]): ChatTurn | null {
  return [...history].reverse().find((turn) => turn.role === 'assistant') ?? null;
}

function findPriorMainDestination(
  history: ChatTurn[],
  lastAssistantContent: string
): SupportedKnowledgeCountry | null {
  const exclusionMatch = lastAssistantContent.match(/除(.{0,20}?)(?:外|之外|以外)/);
  if (exclusionMatch?.[1]) {
    const excludedCountries = detectKnowledgeCountriesInOrder(exclusionMatch[1]);
    if (excludedCountries.length === 1) return excludedCountries[0];
  }

  for (const turn of [...history].reverse()) {
    if (turn.role !== 'user') continue;
    const countries = detectKnowledgeCountriesInOrder(turn.content);
    if (countries.length === 1) return countries[0];
  }

  const assistantCountries = detectKnowledgeCountriesInOrder(lastAssistantContent);
  if (assistantCountries.length === 1) return assistantCountries[0];

  return null;
}

function buildCompactPatch(
  history: ChatTurn[],
  latestMessage: string
): VisaConversationStatePatch {
  if (!isCompactFollowUp(latestMessage)) return {};
  const priorHistory =
    history[history.length - 1]?.role === 'user' &&
    history[history.length - 1]?.content === latestMessage
      ? history.slice(0, -1)
      : history;
  const lastAssistant = findLastAssistant(priorHistory);
  if (!lastAssistant) return {};

  const patch: VisaConversationStatePatch = {};
  const parts = splitCompactAnswer(latestMessage);
  const numberedQuestions = extractNumberedQuestions(lastAssistant.content);

  if (numberedQuestions.length >= 2 && parts.length >= 2) {
    numberedQuestions.forEach((question, index) => {
      const slot = inferQuestionSlot(question);
      const value =
        index === numberedQuestions.length - 1
          ? parts.slice(index).join(', ')
          : parts[index];
      if (!slot || !value) return;

      if (slot === 'nationality') patch.nationality = normalizeFreeTextCountry(value);
      if (slot === 'residence') patch.residenceCountry = normalizeFreeTextCountry(value);
      if (slot === 'stayLengthDays') {
        const questionCountries = detectKnowledgeCountriesInOrder(question);
        const valueParts = splitCompactAnswer(value);
        const numericValues = valueParts.map(parseStayDays);
        const mapsToCountryDaySplit =
          questionCountries.length > 1 &&
          numericValues.length === questionCountries.length &&
          numericValues.every((days) => days !== null);

        if (mapsToCountryDaySplit) {
          const daySplit: Partial<Record<SupportedKnowledgeCountry, number>> = {};
          questionCountries.forEach((country, countryIndex) => {
            const days = numericValues[countryIndex];
            if (days !== null) daySplit[country] = days;
          });
          patch.schengenDaySplit = {
            ...(patch.schengenDaySplit ?? {}),
            ...daySplit,
          };
          patch.destinationCountries = uniqueCountries([
            ...(patch.destinationCountries ?? []),
            ...questionCountries,
          ]);

          const daySplitEntries = Object.entries(daySplit) as Array<
            [SupportedKnowledgeCountry, number]
          >;
          const schengenEntries = daySplitEntries.filter(([country]) =>
            isSchengenKnowledgeCountry(country)
          );
          const destinationEntries =
            schengenEntries.length > 0 ? schengenEntries : daySplitEntries;
          const maxDays = Math.max(...destinationEntries.map(([, days]) => days));
          const longest = destinationEntries.filter(([, days]) => days === maxDays);
          if (longest.length === 1) patch.mainDestination = longest[0][0];
        } else {
          const days = parseStayDays(value);
          if (days !== null) patch.stayLengthDays = days;
        }
      }
      if (slot === 'tripPurpose') {
        patch.tripPurpose = inferTripPurpose(value) ?? 'unknown';
      }
      if (slot === 'destination' || slot === 'otherSchengenCountries') {
        const countries = detectKnowledgeCountriesInOrder(value);
        const priorMainDestination = findPriorMainDestination(
          priorHistory,
          lastAssistant.content
        );
        patch.destinationCountries = uniqueCountries([
          ...(priorMainDestination ? [priorMainDestination] : []),
          ...countries,
        ]);
        if (priorMainDestination) patch.mainDestination = priorMainDestination;
      }
    });

    const priorMainDestination = findPriorMainDestination(
      priorHistory,
      lastAssistant.content
    );
    if (priorMainDestination && !patch.destinationCountries?.length) {
      patch.destinationCountries = [priorMainDestination];
      patch.mainDestination = priorMainDestination;
    }
  }

  const numericParts = parts.map(parseStayDays);
  const allPartsAreNumbers =
    numericParts.length > 0 && numericParts.every((part) => part !== null);
  const lastAssistantCountries = detectKnowledgeCountriesInOrder(lastAssistant.content);
  const asksForDaySplit = /(停留|各|几天|多少天|how many days|day split)/i.test(
    lastAssistant.content
  );

  if (allPartsAreNumbers && asksForDaySplit && lastAssistantCountries.length > 0) {
    const daySplit: Partial<Record<SupportedKnowledgeCountry, number>> = {};
    lastAssistantCountries.forEach((country, index) => {
      const days = numericParts[index];
      if (days !== null && days !== undefined) daySplit[country] = days;
    });
    patch.schengenDaySplit = daySplit;
    patch.destinationCountries = uniqueCountries(lastAssistantCountries);

    if (lastAssistantCountries.length === numericParts.length) {
      const daySplitEntries = Object.entries(daySplit) as Array<
        [SupportedKnowledgeCountry, number]
      >;
      const schengenEntries = daySplitEntries.filter(([country]) =>
        isSchengenKnowledgeCountry(country)
      );
      const destinationEntries =
        schengenEntries.length > 0 ? schengenEntries : daySplitEntries;
      const maxDays = Math.max(...destinationEntries.map(([, days]) => days));
      const longest = destinationEntries.filter(([, days]) => days === maxDays);
      if (longest.length === 1) {
        patch.mainDestination = longest[0][0];
      }
    }
  }

  return patch;
}

function buildDirectPatch(message: string): VisaConversationStatePatch {
  const patch: VisaConversationStatePatch = {};
  const mentionedCountries = detectKnowledgeCountriesInOrder(message);
  const residenceCountries = extractResidenceCountries(message);
  const contextOnlyCountries = extractContextOnlyCountries(message);
  const destinationCountries = mentionedCountries.filter(
    (country) =>
      !residenceCountries.includes(country) &&
      !(
        contextOnlyCountries.includes(country) &&
        mentionedCountries.some((mentionedCountry) => mentionedCountry !== country)
      )
  );

  if (destinationCountries.length > 0) {
    patch.destinationCountries = uniqueCountries(destinationCountries);
    if (destinationCountries.length === 1) patch.mainDestination = destinationCountries[0];

    const daySplit = extractCountryDaySplit(message, destinationCountries);
    const daySplitEntries = Object.entries(daySplit);
    if (daySplitEntries.length > 0) {
      patch.schengenDaySplit = daySplit;
      if (daySplitEntries.length === destinationCountries.length) {
        patch.stayLengthDays = daySplitEntries.reduce(
          (sum, [, days]) => sum + Number(days),
          0
        );
      }
    }
  }

  const nationality = extractNationality(message);
  if (nationality) patch.nationality = nationality;

  const residenceCountry = extractResidenceCountry(message);
  if (residenceCountry) patch.residenceCountry = residenceCountry;

  const tripPurpose = inferTripPurpose(message);
  if (tripPurpose) patch.tripPurpose = tripPurpose;

  const stayMatch = message.match(/(\d+(?:[.．]\d+)?)\s*(?:天|日|days?)/i);
  if (stayMatch?.[1] && patch.stayLengthDays === undefined) {
    patch.stayLengthDays = Number(stayMatch[1].replace('．', '.'));
  }

  const firstEntryCountry = extractFirstEntryCountry(message);
  if (firstEntryCountry) patch.firstEntryCountry = firstEntryCountry;

  return patch;
}

function isCorrectionMessage(message: string): boolean {
  return /(不对|不是|改成|更正|纠正|actually|instead|change to|changed to)/i.test(
    message
  );
}

function computeMissingSlots(state: VisaConversationState): string[] {
  const missing: string[] = [];
  if (state.destinationCountries.length === 0 && !state.mainDestination) {
    missing.push('destination');
  }
  if (!state.nationality) missing.push('nationality');
  if (!state.tripPurpose) missing.push('tripPurpose');
  if (!state.stayLengthDays) missing.push('stayLengthDays');

  const schengenDestinations = state.destinationCountries.filter((country) =>
    isSchengenKnowledgeCountry(country)
  );
  if (schengenDestinations.length > 1) {
    const splitCountries = Object.keys(state.schengenDaySplit);
    if (splitCountries.length < schengenDestinations.length) {
      missing.push('schengenDaySplit');
    } else if (!state.mainDestination && !state.firstEntryCountry) {
      const dayValues = schengenDestinations
        .map((country) => state.schengenDaySplit[country])
        .filter((days): days is number => typeof days === 'number');
      const maxDays = dayValues.length > 0 ? Math.max(...dayValues) : null;
      const longestCount =
        maxDays === null ? 0 : dayValues.filter((days) => days === maxDays).length;
      if (longestCount > 1) {
        missing.push('firstEntryCountry');
      }
    }
  }

  return Array.from(new Set(missing));
}

function computeConfidence(state: VisaConversationState): number {
  let confidence = 0.2;
  if (state.destinationCountries.length > 0 || state.mainDestination) confidence += 0.2;
  if (state.nationality) confidence += 0.15;
  if (state.tripPurpose) confidence += 0.15;
  if (state.stayLengthDays) confidence += 0.15;
  if (state.recommendedVisaType) confidence += 0.15;
  return Math.min(1, Number(confidence.toFixed(2)));
}

function resolveMainDestination(
  state: VisaConversationState
): SupportedKnowledgeCountry | null {
  if (state.mainDestination) return state.mainDestination;
  if (state.destinationCountries.length === 1) return state.destinationCountries[0];
  if (
    state.firstEntryCountry &&
    state.destinationCountries.includes(state.firstEntryCountry)
  ) {
    return state.firstEntryCountry;
  }

  const splitEntries = Object.entries(state.schengenDaySplit) as Array<
    [SupportedKnowledgeCountry, number]
  >;
  if (splitEntries.length > 0) {
    const schengenEntries = splitEntries.filter(([country]) =>
      isSchengenKnowledgeCountry(country)
    );
    const destinationEntries =
      schengenEntries.length > 0 ? schengenEntries : splitEntries;
    const maxDays = Math.max(...destinationEntries.map(([, days]) => days));
    const longest = destinationEntries.filter(([, days]) => days === maxDays);
    if (longest.length === 1) return longest[0][0];
  }

  return null;
}

function shouldUseVisitorRoute(state: VisaConversationState): boolean {
  return (
    !state.tripPurpose ||
    ['tourism', 'business', 'family_visit', 'unknown'].includes(
      state.tripPurpose
    )
  );
}

export function createEmptyVisaConversationState(): VisaConversationState {
  return {
    ...EMPTY_STATE,
    destinationCountries: [],
    schengenDaySplit: {},
    missingSlots: [...EMPTY_STATE.missingSlots],
  };
}

export function parseVisaConversationStateMarker(
  content: string
): VisaConversationState | null {
  if (!content.startsWith(VISA_CONVERSATION_STATE_MARKER_PREFIX)) return null;
  try {
    const parsed = JSON.parse(
      content.slice(VISA_CONVERSATION_STATE_MARKER_PREFIX.length)
    ) as Partial<VisaConversationState>;
    return normalizeVisaConversationState(parsed);
  } catch {
    return null;
  }
}

export function normalizeVisaConversationState(
  value?: Partial<VisaConversationState> | null
): VisaConversationState {
  const state: VisaConversationState = {
    ...createEmptyVisaConversationState(),
    ...value,
    destinationCountries: uniqueCountries(value?.destinationCountries ?? []),
    mainDestination: value?.mainDestination ?? null,
    schengenDaySplit: value?.schengenDaySplit ?? {},
    missingSlots: value?.missingSlots ?? [],
    updatedAt: value?.updatedAt ?? new Date().toISOString(),
  };
  state.mainDestination = resolveMainDestination(state);
  state.recommendedVisaType =
    state.recommendedVisaType ??
    (shouldUseVisitorRoute(state) ? getDefaultVisitorVisaType(state.mainDestination) : null);
  state.missingSlots = computeMissingSlots(state);
  state.confidence = computeConfidence(state);
  return state;
}

export function updateVisaConversationState(
  priorState: VisaConversationState | null,
  history: ChatTurn[],
  latestMessage: string
): VisaConversationState {
  const previous = normalizeVisaConversationState(priorState);
  const compactPatch = buildCompactPatch(history, latestMessage);
  const directPatch = buildDirectPatch(latestMessage);
  const replacesDestinations = isCorrectionMessage(latestMessage);
  const patch: VisaConversationStatePatch = {
    ...directPatch,
    ...compactPatch,
    destinationCountries: uniqueCountries([
      ...(replacesDestinations ? [] : previous.destinationCountries),
      ...(directPatch.destinationCountries ?? []),
      ...(compactPatch.destinationCountries ?? []),
    ]),
    schengenDaySplit: {
      ...previous.schengenDaySplit,
      ...(directPatch.schengenDaySplit ?? {}),
      ...(compactPatch.schengenDaySplit ?? {}),
    },
  };

  const merged: VisaConversationState = {
    ...previous,
    ...patch,
    destinationCountries:
      patch.destinationCountries && patch.destinationCountries.length > 0
        ? patch.destinationCountries
        : previous.destinationCountries,
    updatedAt: new Date().toISOString(),
  };

  merged.mainDestination = resolveMainDestination(merged);
  merged.recommendedVisaType = shouldUseVisitorRoute(merged)
    ? getDefaultVisitorVisaType(merged.mainDestination)
    : null;
  merged.missingSlots = computeMissingSlots(merged);
  merged.confidence = computeConfidence(merged);
  return merged;
}

export function buildVisaConversationStatePrompt(
  state: VisaConversationState
): string {
  const destinations = state.destinationCountries
    .map((country) => COUNTRY_DISPLAY_NAMES[country])
    .join(', ');
  const daySplit = Object.entries(state.schengenDaySplit)
    .map(([country, days]) => `${COUNTRY_DISPLAY_NAMES[country as SupportedKnowledgeCountry]} ${days} days`)
    .join(', ');

  return [
    `Destinations: ${destinations || 'unknown'}`,
    `Main destination: ${
      state.mainDestination ? COUNTRY_DISPLAY_NAMES[state.mainDestination] : 'unknown'
    }`,
    `Nationality/passport: ${state.nationality ?? 'unknown'}`,
    `Residence/apply-from: ${state.residenceCountry ?? 'unknown'}`,
    `Trip purpose: ${state.tripPurpose ?? 'unknown'}`,
    `Stay length: ${state.stayLengthDays ?? 'unknown'} days`,
    `Schengen day split: ${daySplit || 'unknown'}`,
    `First entry country: ${
      state.firstEntryCountry ? COUNTRY_DISPLAY_NAMES[state.firstEntryCountry] : 'unknown'
    }`,
    `Recommended visa type: ${state.recommendedVisaType ?? 'unknown'}`,
    `Missing slots: ${state.missingSlots.join(', ') || 'none'}`,
    `Confidence: ${state.confidence}`,
  ].join('\n');
}

export function summarizeVisaConversationState(
  state: VisaConversationState
): Record<string, unknown> {
  return {
    destinationCountries: state.destinationCountries,
    mainDestination: state.mainDestination,
    nationality: state.nationality,
    residenceCountry: state.residenceCountry,
    tripPurpose: state.tripPurpose,
    stayLengthDays: state.stayLengthDays,
    schengenDaySplit: state.schengenDaySplit,
    firstEntryCountry: state.firstEntryCountry,
    recommendedVisaType: state.recommendedVisaType,
    missingSlots: state.missingSlots,
    confidence: state.confidence,
  };
}

export async function loadVisaConversationState(
  sessionId: string
): Promise<VisaConversationState> {
  const rows = await db
    .select({ content: visaChatMessages.content })
    .from(visaChatMessages)
    .where(eq(visaChatMessages.sessionId, sessionId))
    .orderBy(asc(visaChatMessages.createdAt))
    .limit(120);

  const latest = rows
    .map((row) => parseVisaConversationStateMarker(row.content))
    .filter((state): state is VisaConversationState => state !== null)
    .at(-1);

  return latest ?? createEmptyVisaConversationState();
}

export async function saveVisaConversationState(
  sessionId: string,
  state: VisaConversationState
): Promise<void> {
  await db.insert(visaChatMessages).values({
    sessionId,
    role: 'system',
    content: `${VISA_CONVERSATION_STATE_MARKER_PREFIX}${JSON.stringify(state)}`,
  });
}
