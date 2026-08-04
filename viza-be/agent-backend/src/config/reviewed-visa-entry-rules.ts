import {
  recommendVisaProduct,
  type VisaProductRecommendation,
} from './visa-product-registry.js';

/** Passport set used by the first reviewed policy matrix. */
export const REVIEWED_MATRIX_PASSPORTS = [
  'CHN',
  'SGP',
  'GBR',
  'USA',
  'CAN',
  'AUS',
  'NZL',
] as const;

export type ReviewedMatrixPassport = (typeof REVIEWED_MATRIX_PASSPORTS)[number];

export const REVIEWED_MATRIX_DESTINATIONS = [
  'indonesia',
  'vietnam',
  'singapore',
  'malaysia',
  'thailand',
  'south_korea',
  'us',
  'france',
  'philippines',
  'uk',
  'taiwan',
] as const;

export type ReviewedMatrixDestination =
  (typeof REVIEWED_MATRIX_DESTINATIONS)[number];

export type ReviewedVisaEntryOutcome =
  | 'visa_exempt'
  | 'visa_required'
  | 'conditional'
  | 'not_applicable';

export interface ReviewedVisaEntryRuleSeed {
  ruleKey: string;
  destinationCountry: ReviewedMatrixDestination;
  passportCountryIso3: ReviewedMatrixPassport;
  passportType: 'ordinary';
  tripPurpose: 'tourism';
  maxStayDays: number | null;
  outcome: ReviewedVisaEntryOutcome;
  visaType: string | null;
  arrivalCardTypes: string[];
  requiredInputs: string[];
  conditions: Record<string, unknown>;
  sourceUrl: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  verifiedAt: string;
  reviewDueAt: string;
  productRecommendations: VisaProductRecommendation[];
}

const VERIFIED_AT = '2026-08-04T00:00:00.000Z';
const DEFAULT_REVIEW_DUE_AT = '2026-10-31';

const SOURCE_URLS: Record<ReviewedMatrixDestination, string> = {
  indonesia: 'https://evisa.imigrasi.go.id/web/home',
  vietnam: 'https://evisa.xuatnhapcanh.gov.vn/trang-chu-ttdt',
  singapore: 'https://www.ica.gov.sg/enter-transit-depart/entering-singapore/visa_requirements',
  malaysia: 'https://www.imi.gov.my/index.php/en/pengumuman/malaysia-digital-arrival-card-mdac/',
  thailand:
    'https://image.mfa.go.th/mfa/0/SRBviAC5gs/Summary_of_Countries_and_Territories_entitled_for_Visa_Exemption_and_Visa_on_Arrival_to_Thailand_2024.pdf',
  south_korea: 'https://www.visa.go.kr/openPage.do?LANG_TYPE=EN&MENU_ID=10105',
  us: 'https://travel.state.gov/content/travel/en/us-visas/tourism-visit/visitor.html',
  france:
    'https://home-affairs.ec.europa.eu/policies/schengen/visa-policy/applying-schengen-visa_en',
  philippines: 'https://etravel.gov.ph/',
  uk: 'https://www.gov.uk/check-eta',
  taiwan: 'https://www.boca.gov.tw/cp-149-4486-7785a-2.html',
};

function products(
  entries: Array<[string, 'required' | 'conditional' | 'optional']>
): VisaProductRecommendation[] {
  return entries.flatMap(([productCode, requirement]) => {
    const recommendation = recommendVisaProduct(productCode, requirement);
    return recommendation ? [recommendation] : [];
  });
}

type RuleOverrides = Partial<
  Pick<
    ReviewedVisaEntryRuleSeed,
    | 'maxStayDays'
    | 'outcome'
    | 'visaType'
    | 'arrivalCardTypes'
    | 'requiredInputs'
    | 'conditions'
    | 'effectiveFrom'
    | 'effectiveTo'
    | 'sourceUrl'
    | 'reviewDueAt'
    | 'productRecommendations'
  >
>;

function rule(
  destinationCountry: ReviewedMatrixDestination,
  passportCountryIso3: ReviewedMatrixPassport,
  overrides: RuleOverrides
): ReviewedVisaEntryRuleSeed {
  const outcome = overrides.outcome ?? 'conditional';
  const requiredInputs = overrides.requiredInputs ?? [];
  const conditionSummary = {
    passport_type: 'ordinary',
    trip_purpose: 'tourism',
    ...overrides.conditions,
  };
  return {
    ruleKey: `${destinationCountry}:${passportCountryIso3}:ordinary:tourism:reviewed-2026-08-04`,
    destinationCountry,
    passportCountryIso3,
    passportType: 'ordinary',
    tripPurpose: 'tourism',
    maxStayDays: overrides.maxStayDays ?? null,
    outcome,
    visaType: overrides.visaType ?? null,
    arrivalCardTypes: overrides.arrivalCardTypes ?? [],
    requiredInputs,
    conditions: conditionSummary,
    sourceUrl: overrides.sourceUrl ?? SOURCE_URLS[destinationCountry],
    effectiveFrom: overrides.effectiveFrom ?? null,
    effectiveTo: overrides.effectiveTo ?? null,
    verifiedAt: VERIFIED_AT,
    reviewDueAt: overrides.reviewDueAt ?? DEFAULT_REVIEW_DUE_AT,
    productRecommendations: overrides.productRecommendations ?? [],
  };
}

function notApplicable(
  destinationCountry: ReviewedMatrixDestination,
  passportCountryIso3: ReviewedMatrixPassport
): ReviewedVisaEntryRuleSeed {
  return rule(destinationCountry, passportCountryIso3, {
    outcome: 'not_applicable',
    conditions: {
      reason: 'The traveller holds the destination country passport; this matrix covers entry eligibility for foreign visitors.',
    },
  });
}

function buildReviewedMatrix(): ReviewedVisaEntryRuleSeed[] {
  const rows: ReviewedVisaEntryRuleSeed[] = [];

  // Indonesia: all seven passports are listed for Visa on Arrival/e-VoA.
  // Singapore citizens have an additional ASEAN/BVK path whose exact current
  // conditions are residence/entry dependent, so retain a conditional row.
  rows.push(
    rule('indonesia', 'CHN', {
      outcome: 'visa_required',
      maxStayDays: 30,
      visaType: 'ID_B1_EVOA',
      productRecommendations: products([['ID_B1_EVOA', 'required']]),
      conditions: { route: 'Visa on Arrival or electronic Visa on Arrival (B1)', arrival_card_required: true },
    }),
    rule('indonesia', 'SGP', {
      outcome: 'visa_exempt',
      maxStayDays: 30,
      conditions: { route: 'ASEAN short-visit visa exemption; confirm current entry conditions', arrival_card_required: true },
    }),
    ...(['GBR', 'USA', 'CAN', 'AUS', 'NZL'] as const).map((passport) =>
      rule('indonesia', passport, {
        outcome: 'visa_required',
        maxStayDays: 30,
        visaType: 'ID_B1_EVOA',
        productRecommendations: products([['ID_B1_EVOA', 'required']]),
        conditions: { route: 'Visa on Arrival or electronic Visa on Arrival (B1)', arrival_card_required: true },
      })
    )
  );

  // Vietnam: the current visa-exemption list covers Singapore (30 days) and
  // the United Kingdom (45 days); the remaining matrix passports use the
  // universal 90-day e-visa route. The separate pre-arrival declaration is
  // only recommended after the traveller confirms that the official portal
  // applies to their entry channel.
  rows.push(
    rule('vietnam', 'CHN', {
      outcome: 'visa_required',
      maxStayDays: 90,
      visaType: 'VN_E_VISA',
      productRecommendations: products([['VN_E_VISA', 'required']]),
      conditions: { route: 'Vietnam electronic visa; single or multiple entry', entry_port_required: true },
    }),
    rule('vietnam', 'SGP', {
      outcome: 'visa_exempt',
      maxStayDays: 30,
      productRecommendations: products([['VN_PREARRIVAL_DECLARATION', 'conditional']]),
      conditions: { exemption: 'Vietnam visa-exemption list for Singapore ordinary passports', prearrival_policy_check_required: true },
    }),
    rule('vietnam', 'GBR', {
      outcome: 'visa_exempt',
      maxStayDays: 45,
      productRecommendations: products([['VN_PREARRIVAL_DECLARATION', 'conditional']]),
      conditions: { exemption: 'Vietnam visa-exemption list for United Kingdom ordinary passports', prearrival_policy_check_required: true },
    }),
    ...(['USA', 'CAN', 'AUS', 'NZL'] as const).map((passport) =>
      rule('vietnam', passport, {
        outcome: 'visa_required',
        maxStayDays: 90,
        visaType: 'VN_E_VISA',
        productRecommendations: products([['VN_E_VISA', 'required']]),
        conditions: { route: 'Vietnam electronic visa; single or multiple entry', entry_port_required: true },
      })
    )
  );

  // Singapore: China ordinary passports have the reviewed 30-day bilateral
  // exemption. Other listed visitor passports are normally visa-exempt for
  // short visits; the digital pass issued at entry controls the final stay.
  rows.push(
    rule('singapore', 'CHN', {
      outcome: 'visa_exempt',
      maxStayDays: 30,
      arrivalCardTypes: ['SG_ARRIVAL_CARD'],
      effectiveFrom: '2024-02-09',
      productRecommendations: products([['SG_ARRIVAL_CARD', 'required']]),
      conditions: { permitted_purposes: ['tourism', 'business', 'family_visit', 'transit'], sgac_window: 'within 3 days before arrival, including arrival day' },
    }),
    notApplicable('singapore', 'SGP'),
    ...(['GBR', 'USA', 'CAN', 'AUS', 'NZL'] as const).map((passport) =>
      rule('singapore', passport, {
        outcome: 'visa_exempt',
        maxStayDays: 90,
        arrivalCardTypes: ['SG_ARRIVAL_CARD'],
        productRecommendations: products([['SG_ARRIVAL_CARD', 'required']]),
        conditions: { sgac_window: 'within 3 days before arrival, including arrival day', final_stay_decided_by_ica: true },
      })
    )
  );

  // Malaysia: the seven passports are covered by social-visit visa
  // exemptions; China is explicitly capped at 30 days in the reviewed seed.
  // MDAC remains a separate declaration and has country-specific exemptions.
  rows.push(
    rule('malaysia', 'CHN', {
      outcome: 'visa_exempt',
      maxStayDays: 30,
      arrivalCardTypes: ['MY_MDAC_ARRIVAL_CARD'],
      productRecommendations: products([['MY_MDAC_ARRIVAL_CARD', 'required']]),
      conditions: { social_visit_only: true, mdac_exemption_check_required: true },
    }),
    rule('malaysia', 'SGP', {
      outcome: 'visa_exempt',
      maxStayDays: 30,
      conditions: { social_visit_only: true, mdac_exempt_for_singapore_citizens: true },
    }),
    ...(['GBR', 'USA', 'CAN', 'AUS', 'NZL'] as const).map((passport) =>
      rule('malaysia', passport, {
        outcome: 'visa_exempt',
        maxStayDays: 90,
        arrivalCardTypes: ['MY_MDAC_ARRIVAL_CARD'],
        productRecommendations: products([['MY_MDAC_ARRIVAL_CARD', 'required']]),
        conditions: { social_visit_only: true, mdac_exemption_check_required: true },
      })
    )
  );

  // Thailand's current official exemption list grants up to 60 days for the
  // seven ordinary-passport nationalities. TDAC is independent of the visa
  // conclusion and is required for ordinary foreign arrivals.
  rows.push(
    ...REVIEWED_MATRIX_PASSPORTS.map((passport) =>
      rule('thailand', passport, {
        outcome: 'visa_exempt',
        maxStayDays: 60,
        effectiveFrom: '2024-07-15',
        reviewDueAt: '2026-08-11',
        arrivalCardTypes: ['TH_TDAC_ARRIVAL_CARD'],
        productRecommendations: products([['TH_TDAC_ARRIVAL_CARD', 'required']]),
        conditions: {
          tdac_required: true,
          final_admission_decided_at_border: true,
          pending_policy_revision: true,
          pending_policy_revision_source:
            'https://consular.mfa.go.th/th/content/20-5-69-0000',
          note:
            'Thailand announced a replacement scheme on 19 May 2026; recheck the Royal Gazette/current MFA list before travel.',
        },
      })
    )
  );

  // Korea: China ordinary passports use a C-3 short-term visitor visa. The
  // other six nationalities are visa-exempt and may need K-ETA; temporary
  // K-ETA exemptions are deliberately represented as a conditional product.
  rows.push(
    rule('south_korea', 'CHN', {
      outcome: 'visa_required',
      maxStayDays: 90,
      visaType: 'KR_C39_SHORT_TERM_VISIT',
      productRecommendations: products([['KR_C39_SHORT_TERM_VISIT', 'required']]),
      conditions: { individual_tourism_route: 'C-3-9; exact subtype and local documents depend on the Korean mission' },
    }),
    ...(['SGP', 'GBR', 'USA', 'CAN', 'AUS', 'NZL'] as const).map((passport) =>
      rule('south_korea', passport, {
        outcome: 'visa_exempt',
        maxStayDays: 90,
        requiredInputs: ['kEtaExemptionStatus'],
        effectiveTo: '2026-12-31',
        conditions: { k_eta_eligibility_required: true, k_eta_is_not_a_visa: true, temporary_exemption_review_date: '2026-12-31' },
      })
    )
  );

  // United States: China uses B-1/B-2/DS-160. Singapore, UK, Australia and
  // New Zealand are VWP/ESTA travellers; Canada is visa-exempt but does not
  // use ESTA and receives an admission period at the port of entry.
  rows.push(
    rule('us', 'CHN', {
      outcome: 'visa_required',
      visaType: 'DS160',
      productRecommendations: products([['DS160', 'required']]),
      conditions: { route: 'B-1/B-2 visitor visa and DS-160', esta_not_applicable: true },
    }),
    ...(['SGP', 'GBR', 'AUS', 'NZL'] as const).map((passport) =>
      rule('us', passport, {
        outcome: 'visa_exempt',
        maxStayDays: 90,
        productRecommendations: products([['US_ESTA', 'required']]),
        conditions: { route: 'Visa Waiver Program', esta_required_before_boarding: true },
      })
    ),
    rule('us', 'USA', {
      outcome: 'not_applicable',
      conditions: { reason: 'The traveller holds a United States passport; this matrix covers foreign visitors.' },
    }),
    rule('us', 'CAN', {
      outcome: 'visa_exempt',
      productRecommendations: [],
      conditions: { route: 'Canada-US visa exemption; admission period is set by CBP/I-94', esta_not_applicable: true },
    })
  );

  // France follows the Schengen short-stay 90/180 rule. China requires a
  // Schengen visa; the other matrix passports are visa-exempt. ETIAS is not
  // recommended until its activation is formally confirmed.
  rows.push(
    rule('france', 'CHN', {
      outcome: 'visa_required',
      maxStayDays: 90,
      visaType: 'EU_SCHENGEN_C_SHORT_STAY',
      productRecommendations: products([['EU_SCHENGEN_C_SHORT_STAY', 'required']]),
      conditions: { schengen_rule: '90 days in any rolling 180-day period', competent_consulate_required: true },
    }),
    ...(['SGP', 'GBR', 'USA', 'CAN', 'AUS', 'NZL'] as const).map((passport) =>
      rule('france', passport, {
        outcome: 'visa_exempt',
        maxStayDays: 90,
        productRecommendations: [],
        conditions: { schengen_rule: '90 days in any rolling 180-day period', etias_status_must_be_checked: true },
      })
    )
  );

  // The Philippines: the reviewed China pilot permits up to 14 days for
  // tourism/business visitor travel; other listed passports are visa-exempt
  // for up to 30 days. eTravel is independent and is recommended for all.
  rows.push(
    rule('philippines', 'CHN', {
      outcome: 'visa_exempt',
      maxStayDays: 14,
      arrivalCardTypes: ['PH_ETRAVEL_ARRIVAL_CARD'],
      effectiveFrom: '2026-01-16',
      effectiveTo: '2027-01-15',
      reviewDueAt: '2026-12-15',
      sourceUrl: 'https://chongqingpcg.dfa.gov.ph/example-pages/news-press-releases/1167-philippines-to-allow-visa-free-entry-for-14-days-for-chinese-nationals',
      productRecommendations: products([['PH_ETRAVEL_ARRIVAL_CARD', 'required']]),
      conditions: {
        pilot_scope: ['tourism', 'business_visitor'],
        passport_validity_months: 6,
        hotel_and_return_ticket_required: true,
        designated_ports: ['Ninoy Aquino International Airport (NAIA), Metro Manila', 'Mactan-Cebu International Airport (MCIA), Cebu'],
        non_extendable: true,
        non_convertible: true,
        policy_review_date: '2027-01-15',
      },
    }),
    ...(['SGP', 'GBR', 'USA', 'CAN', 'AUS', 'NZL'] as const).map((passport) =>
      rule('philippines', passport, {
        outcome: 'visa_exempt',
        maxStayDays: 30,
        arrivalCardTypes: ['PH_ETRAVEL_ARRIVAL_CARD'],
        productRecommendations: products([['PH_ETRAVEL_ARRIVAL_CARD', 'required']]),
        conditions: { passport_validity_months: 6, return_or_onward_ticket_required: true },
      })
    )
  );

  // UK: China requires a Standard Visitor route; the other foreign visitor
  // passports are visa-exempt but require an ETA under the current rollout.
  rows.push(
    rule('uk', 'CHN', {
      outcome: 'visa_required',
      maxStayDays: 180,
      visaType: 'UK_STANDARD_VISITOR',
      productRecommendations: products([['UK_STANDARD_VISITOR', 'required']]),
      conditions: { route: 'Standard Visitor; usual maximum 6 months', eta_not_a_visa: true },
    }),
    notApplicable('uk', 'GBR'),
    ...(['SGP', 'USA', 'CAN', 'AUS', 'NZL'] as const).map((passport) =>
      rule('uk', passport, {
        outcome: 'visa_exempt',
        maxStayDays: 180,
        productRecommendations: products([['UK_ETA', 'required']]),
        conditions: { route: 'visitor visa exemption subject to ETA and border rules', eta_not_a_visa: true },
      })
    )
  );

  // Taiwan: mainland Chinese ordinary passports require the overseas-China
  // tourism entry permit and must prove the applicable residence route. The
  // other matrix passports are visa-exempt for short visits and should use
  // the official Taiwan arrival card.
  rows.push(
    rule('taiwan', 'CHN', {
      outcome: 'conditional',
      visaType: 'TW_ENTRY_PERMIT',
      sourceUrl: 'https://coa.immigration.gov.tw/coa-frontend/overseas-foreign-china',
      requiredInputs: ['residenceCountry', 'residenceStatus', 'residenceDuration', 'entryPermitEligibilityPath'],
      productRecommendations: products([['TW_ENTRY_PERMIT', 'conditional']]),
      conditions: { route: 'Overseas mainland-Chinese tourist entry permit', supported_residence_example: 'Singapore', passport_validity_months: 6 },
    }),
    ...(['SGP', 'GBR', 'USA', 'CAN', 'AUS', 'NZL'] as const).map((passport) =>
      rule('taiwan', passport, {
        outcome: 'visa_exempt',
        maxStayDays: passport === 'SGP' ? 30 : 90,
        arrivalCardTypes: ['TW_ARRIVAL_CARD'],
        productRecommendations: products([['TW_ARRIVAL_CARD', 'required']]),
        conditions: { twac_required: true, final_admission_decided_at_border: true },
      })
    )
  );

  return rows;
}

export const REVIEWED_VISA_ENTRY_RULES = buildReviewedMatrix();

export const REVIEWED_VISA_ENTRY_RULE_MAP = new Map(
  REVIEWED_VISA_ENTRY_RULES.map((entry) => [
    `${entry.destinationCountry}:${entry.passportCountryIso3}:${entry.passportType}:${entry.tripPurpose}`,
    entry,
  ])
);

export function reviewedVisaEntryRuleKey(
  destinationCountry: string,
  passportCountryIso3: string,
  passportType = 'ordinary',
  tripPurpose = 'tourism'
): string {
  return `${destinationCountry}:${passportCountryIso3}:${passportType}:${tripPurpose}`;
}
