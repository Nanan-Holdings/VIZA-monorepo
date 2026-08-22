import { getSupabaseClient } from '../db/supabase-client.js';
import { Logger } from '../utils/logger.js';
import {
  REVIEWED_VISA_ENTRY_RULE_MAP,
  reviewedVisaEntryRuleKey,
  type ReviewedVisaEntryRuleSeed,
} from '../config/reviewed-visa-entry-rules.js';
import {
  getVisaProduct,
  type VisaProductRecommendation,
} from '../config/visa-product-registry.js';

const logger = new Logger({ serviceName: 'VisaEntryRuleService' });

export type VisaEntryOutcome =
  | 'visa_exempt'
  | 'visa_required'
  | 'conditional'
  | 'unknown'
  | 'not_applicable';

export interface VisaEntryRule {
  ruleKey: string;
  destinationCountry: string;
  passportCountryIso3: string;
  passportType: string;
  tripPurpose: string;
  maxStayDays: number | null;
  outcome: VisaEntryOutcome;
  visaType: string | null;
  arrivalCardTypes: string[];
  requiredInputs: string[];
  productRecommendations: VisaProductRecommendation[];
  conditions: Record<string, unknown>;
  sourceUrl: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  verifiedAt: string;
  reviewDueAt: string | null;
  reviewStatus: 'reviewed' | 'placeholder' | null;
}

export interface VisaEntryRuleQuery {
  destinationCountry: string | null;
  passportCountryIso3: string | null;
  passportType: string | null;
  tripPurpose: string | null;
  stayLengthDays: number | null;
}

const SINGAPORE_CHINA_ORDINARY_RULE: VisaEntryRule = {
  ruleKey: 'singapore:CHN:ordinary:tourism:2024-02-09',
  destinationCountry: 'singapore',
  passportCountryIso3: 'CHN',
  passportType: 'ordinary',
  tripPurpose: 'tourism',
  maxStayDays: 30,
  outcome: 'visa_exempt',
  visaType: null,
  arrivalCardTypes: ['SG_ARRIVAL_CARD'],
  requiredInputs: [],
  productRecommendations: [],
  conditions: {
    permittedPurposes: ['tourism', 'business', 'family_visit', 'transit'],
    excludedPurposes: ['work', 'study', 'journalism', 'long_stay'],
    sgacWindow: 'within 3 days before arrival, including the day of arrival',
  },
  sourceUrl:
    'https://www.ica.gov.sg/news-and-publications/newsroom/media-release/mutual-30-day-visa-exemption-arrangement-between-singapore-and-the-people-s-republic-of-china',
  effectiveFrom: '2024-02-09',
  effectiveTo: null,
  verifiedAt: '2026-07-30T00:00:00.000Z',
  reviewDueAt: '2026-10-31',
  reviewStatus: 'reviewed',
};

function isSingaporeChinaOrdinaryExemption(
  query: VisaEntryRuleQuery
): boolean {
  return (
    query.destinationCountry === 'singapore' &&
    query.passportCountryIso3 === 'CHN' &&
    query.passportType === 'ordinary' &&
    ['tourism', 'business', 'family_visit', 'transit'].includes(
      query.tripPurpose ?? 'tourism'
    ) &&
    (query.stayLengthDays === null || query.stayLengthDays <= 30)
  );
}

export function resolveReviewedVisaEntryRule(
  query: VisaEntryRuleQuery
): VisaEntryRule | null {
  if (!query.destinationCountry || !query.passportCountryIso3 || !query.passportType) {
    return null;
  }
  if (isSingaporeChinaOrdinaryExemption(query)) {
    const reviewed = REVIEWED_VISA_ENTRY_RULE_MAP.get(
      reviewedVisaEntryRuleKey(
        query.destinationCountry,
        query.passportCountryIso3,
        query.passportType,
        query.tripPurpose ?? 'tourism'
      )
    );
    return reviewed ? mapReviewedSeed(reviewed) : SINGAPORE_CHINA_ORDINARY_RULE;
  }

  const reviewed = REVIEWED_VISA_ENTRY_RULE_MAP.get(
    reviewedVisaEntryRuleKey(
      query.destinationCountry,
      query.passportCountryIso3,
      query.passportType,
      query.tripPurpose ?? 'tourism'
    )
  );
  return reviewed ? applyStayLength(reviewed, query.stayLengthDays) : null;
}

function mapReviewedSeed(seed: ReviewedVisaEntryRuleSeed): VisaEntryRule {
  return {
    ...seed,
    reviewStatus: 'reviewed',
  };
}

function applyStayLength(
  seed: ReviewedVisaEntryRuleSeed,
  stayLengthDays: number | null
): VisaEntryRule {
  const rule = mapReviewedSeed(seed);
  if (
    rule.maxStayDays === null ||
    stayLengthDays === null ||
    stayLengthDays <= rule.maxStayDays ||
    rule.outcome === 'not_applicable'
  ) {
    return rule;
  }

  return {
    ...rule,
    outcome: 'conditional',
    visaType: null,
    arrivalCardTypes: [],
    requiredInputs: Array.from(
      new Set([...rule.requiredInputs, 'stayLengthDays'])
    ),
    productRecommendations: [],
    conditions: {
      ...rule.conditions,
      reason: `The requested stay exceeds the reviewed ${rule.maxStayDays}-day route; a longer-stay or different-purpose route must be confirmed.`,
    },
  };
}

function mapRule(row: Record<string, unknown>): VisaEntryRule | null {
  const outcome = row.outcome;
  if (
    outcome !== 'visa_exempt' &&
    outcome !== 'visa_required' &&
    outcome !== 'conditional' &&
    outcome !== 'unknown' &&
    outcome !== 'not_applicable'
  ) {
    return null;
  }
  if (
    typeof row.rule_key !== 'string' ||
    typeof row.destination_country !== 'string' ||
    typeof row.passport_country_iso3 !== 'string' ||
    typeof row.source_url !== 'string' ||
    typeof row.verified_at !== 'string'
  ) {
    return null;
  }
  return {
    ruleKey: row.rule_key,
    destinationCountry: row.destination_country,
    passportCountryIso3: row.passport_country_iso3,
    passportType:
      typeof row.passport_type === 'string' ? row.passport_type : 'ordinary',
    tripPurpose:
      typeof row.trip_purpose === 'string' ? row.trip_purpose : 'tourism',
    maxStayDays:
      typeof row.max_stay_days === 'number' ? row.max_stay_days : null,
    outcome,
    visaType: typeof row.visa_type === 'string' ? row.visa_type : null,
    arrivalCardTypes: Array.isArray(row.arrival_card_types)
      ? row.arrival_card_types.filter(
          (value): value is string => typeof value === 'string'
        )
      : [],
    requiredInputs: Array.isArray(row.required_inputs)
      ? row.required_inputs.filter(
          (value): value is string => typeof value === 'string'
        )
      : [],
    productRecommendations: Array.isArray(row.product_recommendations)
      ? row.product_recommendations.filter(isProductRecommendation)
      : [],
    conditions:
      typeof row.conditions_json === 'object' && row.conditions_json !== null
        ? (row.conditions_json as Record<string, unknown>)
        : {},
    sourceUrl: row.source_url,
    effectiveFrom:
      typeof row.effective_from === 'string' ? row.effective_from : null,
    effectiveTo:
      typeof row.effective_to === 'string' ? row.effective_to : null,
    verifiedAt: row.verified_at,
    reviewDueAt:
      typeof row.review_due_at === 'string' ? row.review_due_at : null,
    reviewStatus:
      row.review_status === 'reviewed' || row.review_status === 'placeholder'
        ? row.review_status
        : null,
  };
}

function isProductRecommendation(value: unknown): value is VisaProductRecommendation {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<VisaProductRecommendation>;
  return (
    typeof candidate.productCode === 'string' &&
    typeof candidate.country === 'string' &&
    typeof candidate.kind === 'string' &&
    typeof candidate.provider === 'string' &&
    typeof candidate.supportLevel === 'string' &&
    typeof candidate.requirement === 'string' &&
    typeof candidate.url === 'string'
  );
}

export async function resolveVisaEntryRule(
  query: VisaEntryRuleQuery
): Promise<VisaEntryRule | null> {
  if (
    !query.destinationCountry ||
    !query.passportCountryIso3 ||
    !query.passportType
  ) {
    return null;
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('visa_entry_rules')
      .select(
        'rule_key, destination_country, passport_country_iso3, passport_type, trip_purpose, max_stay_days, outcome, review_status, visa_type, arrival_card_types, required_inputs, product_recommendations, conditions_json, source_url, effective_from, effective_to, verified_at, review_due_at, visa_knowledge_releases!inner(status)'
      )
      .eq('destination_country', query.destinationCountry)
      .eq('passport_country_iso3', query.passportCountryIso3)
      .eq('passport_type', query.passportType)
      .eq('trip_purpose', query.tripPurpose ?? 'tourism')
      .eq('status', 'active')
      .eq('visa_knowledge_releases.status', 'active')
      .order('verified_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      const rule = mapRule(data as Record<string, unknown>);
      if (rule) {
        if (
          rule.reviewStatus !== 'reviewed' ||
          rule.outcome === 'unknown'
        ) {
          return resolveReviewedVisaEntryRule(query);
        }
        if (
          rule.maxStayDays !== null &&
          query.stayLengthDays !== null &&
          query.stayLengthDays > rule.maxStayDays
        ) {
          return {
            ...rule,
            outcome: 'conditional',
            visaType: null,
            arrivalCardTypes: [],
            requiredInputs: Array.from(
              new Set([...rule.requiredInputs, 'stayLengthDays'])
            ),
            productRecommendations: [],
          };
        }
        return rule;
      }
    } else if (error) {
      logger.warn('Entry-rule lookup failed; using reviewed code fallback', error);
    }
  } catch (error) {
    logger.warn('Entry-rule lookup errored; using reviewed code fallback', error as Error);
  }

  return resolveReviewedVisaEntryRule(query);
}

export function buildVisaEntryRulePrompt(
  rule: VisaEntryRule | null,
  locale: 'en' | 'zh' = 'en'
): string {
  if (!rule) {
    return [
      'Deterministic entry-rule result: unknown.',
      'Do not infer visa eligibility from general RAG text.',
      'Say that eligibility has not been confirmed and ask only for missing passport type, purpose, or stay details.',
    ].join('\n');
  }

  if (rule.outcome === 'not_applicable') {
    return [
      'Deterministic entry-rule result: not applicable.',
      'The traveller holds the destination country passport; this visitor matrix does not apply.',
    ].join('\n');
  }

  if (
    rule.destinationCountry === 'singapore' &&
    rule.passportCountryIso3 === 'CHN' &&
    rule.passportType === 'ordinary' &&
    rule.tripPurpose === 'tourism' &&
    rule.outcome === 'visa_exempt' &&
    rule.maxStayDays === 30
  ) {
    const policyLead =
      locale === 'zh'
        ? '持中国普通护照以旅游目的赴新加坡，按当前规则可免签停留不超过30天；仍须在抵达新加坡前3天内（含抵达当天）提交新加坡电子入境卡。新加坡电子入境卡是独立的入境申报，不是签证。'
        : 'PRC ordinary-passport holders travelling to Singapore for tourism are visa-exempt for stays of up to 30 days under the current rule. They must still submit the SG Arrival Card within the 3 days before arriving in Singapore, including the arrival day. The SG Arrival Card is a separate entry declaration, not a visa.';
    return [
      'MANDATORY POLICY LEAD (copy exactly as the first paragraph):',
      policyLead,
      `Official source: ${rule.sourceUrl}`,
      'Never route this traveller to SG_VISITOR_VISA.',
    ].join('\n');
  }

  const productName = (productCode: string | null): string => {
    if (!productCode) return locale === 'zh' ? '无' : 'none';
    const product = getVisaProduct(productCode);
    return locale === 'zh' ? product?.displayNameZh ?? '待确认产品' : product?.displayNameEn ?? productCode;
  };
  const recommendationNames = rule.productRecommendations.map((product) =>
    locale === 'zh' ? product.displayNameZh : product.productCode
  );
  if (locale === 'zh') {
    return [
      `确定性入境结论：${rule.outcome}`,
      `本规则覆盖的最长停留：${rule.maxStayDays ?? '未指定'}天`,
      `签证产品：${productName(rule.visaType)}`,
      `独立入境申报：${rule.arrivalCardTypes.length > 0 ? rule.arrivalCardTypes.map(productName).join('、') : '无'}`,
      `作出推荐前仍需确认：${rule.requiredInputs.join('、') || '无'}`,
      `可用产品：${recommendationNames.join('、') || '无'}`,
      `官方来源：${rule.sourceUrl}`,
      '确定性规则控制资格结论；RAG 只能补充材料、流程和注意事项，不得推翻该结论。',
    ].join('\n');
  }
  return [
    `Deterministic entry-rule outcome: ${rule.outcome}`,
    `Maximum covered stay: ${rule.maxStayDays ?? 'not specified'} days`,
    `Visa product: ${productName(rule.visaType)}`,
    `Separate arrival-card products: ${rule.arrivalCardTypes.join(', ') || 'none'}`,
    `Required inputs before a recommendation: ${rule.requiredInputs.join(', ') || 'none'}`,
    `Product recommendations: ${recommendationNames.join(', ') || 'none'}`,
    `Official source: ${rule.sourceUrl}`,
    'This deterministic result controls the eligibility conclusion. RAG may only add materials, process, and caveats.',
  ].join('\n');
}
