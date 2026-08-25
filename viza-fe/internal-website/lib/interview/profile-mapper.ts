import type {
  ApplicantProfile,
  InterviewProfileField,
  InterviewProfileFieldState,
  InterviewProfileValueSource,
  InterviewPurpose,
} from "@/app/api/interview/types";

export type StoredAnswers = Record<string, { value: string; source: string | null }>;

type Candidate = {
  value: string;
  source: InterviewProfileValueSource;
  confirmed: boolean;
};

export interface MappedInterviewProfile {
  profile: ApplicantProfile;
  missingFields: InterviewProfileField[];
  verifiedFields: InterviewProfileField[];
  needsConfirmationFields: InterviewProfileField[];
  fieldStates: InterviewProfileFieldState[];
}

const PROFILE_FIELDS: InterviewProfileField[] = [
  "purpose",
  "purposeDetails",
  "destinations",
  "travelDates",
  "duration",
  "funding",
  "budget",
  "occupation",
  "employer",
  "homeTies",
  "previousTravel",
  "companions",
  "usContact",
  "refusalHistory",
];

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function unique(candidates: Candidate[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = candidate.value.toLocaleLowerCase();
    if (!candidate.value || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function savedCandidates(answers: StoredAnswers, keys: string[]): Candidate[] {
  const candidates: Candidate[] = [];
  for (const [fieldName, answer] of Object.entries(answers)) {
    if (!keys.some((key) => fieldName === key || fieldName.startsWith(`${key}[`) || fieldName.startsWith(`${key}.`) || fieldName.startsWith(`${key}__`))) continue;
    const value = clean(answer.value);
    if (!value) continue;
    candidates.push({
      value,
      source: "saved_application",
      confirmed: answer.source === "user",
    });
  }
  return unique(candidates);
}

function objectAt(value: unknown, key: string): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const child = (value as Record<string, unknown>)[key];
  return child && typeof child === "object" && !Array.isArray(child)
    ? child as Record<string, unknown>
    : null;
}

function simplifiedRoot(value: unknown) {
  return objectAt(value, "form") ?? (value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null);
}

function simplifiedStrings(section: Record<string, unknown> | null, keys: string[]): Candidate[] {
  if (!section) return [];
  const candidates: Candidate[] = [];
  for (const key of keys) {
    const value = section[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        const text = clean(item);
        if (text) candidates.push({ value: text, source: "simplified_form", confirmed: false });
      }
      continue;
    }
    const text = clean(value);
    if (text) candidates.push({ value: text, source: "simplified_form", confirmed: false });
  }
  return unique(candidates);
}

function joined(candidates: Candidate[]) {
  return unique(candidates).map((candidate) => candidate.value).join(" / ");
}

function inferPurpose(value: string): InterviewPurpose {
  if (/business|商务|商務/i.test(value)) return "business";
  if (/touris|pleasure|旅游|旅遊|观光|觀光/i.test(value)) return "tourism";
  if (/family|relative|friend|探亲|探親|访友|訪友/i.test(value)) return "family_visit";
  if (/medical|treatment|就医|就醫|治疗|治療/i.test(value)) return "medical";
  return "other";
}

function friendlyPurpose(candidates: Candidate[]) {
  const raw = joined(candidates);
  if (/B1\s*\/\s*B2/i.test(raw) && !/business|touris|商务|商務|旅游|旅遊/i.test(raw)) {
    return "B1/B2 短期商务或旅游访问";
  }
  return raw;
}

function friendlyFunding(candidates: Candidate[]) {
  const labels: Record<string, string> = {
    self: "本人承担",
    other_person: "其他个人承担",
    present_employer: "现雇主承担",
    employer_in_us: "美国雇主承担",
    other_company: "其他公司或机构承担",
  };
  return joined(candidates.map((candidate) => ({
    ...candidate,
    value: labels[candidate.value.toLowerCase()] ?? candidate.value,
  })));
}

function friendlyYesNo(value: string, yesLabel: string, noLabel: string) {
  if (/^(yes|true)$/i.test(value)) return yesLabel;
  if (/^(no|false)$/i.test(value)) return noLabel;
  return value;
}

function statusFor(field: InterviewProfileField, value: string, candidates: Candidate[]): InterviewProfileFieldState {
  if (!value) return { field, status: "missing", source: null };
  const confirmed = candidates.length > 0 && candidates.every((candidate) => candidate.confirmed);
  const source = candidates.some((candidate) => candidate.source === "saved_application")
    ? "saved_application"
    : candidates[0]?.source ?? "derived";
  return {
    field,
    status: confirmed ? "confirmed" : "needs_confirmation",
    source,
  };
}

function withUnit(valueCandidates: Candidate[], unitCandidates: Candidate[]) {
  const value = joined(valueCandidates);
  if (!value) return "";
  const unit = joined(unitCandidates);
  return unit ? `${value} ${unit}` : value;
}

export function parseSimplifiedFormState(raw: string | null | undefined): unknown | null {
  if (!raw?.trim()) return null;
  try {
    const value = JSON.parse(raw) as unknown;
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

export function mapDs160AnswersToInterviewProfile(
  answers: StoredAnswers,
  simplifiedState?: unknown,
): MappedInterviewProfile {
  const root = simplifiedRoot(simplifiedState);
  const travel = objectAt(root, "travel");
  const work = objectAt(root, "work");
  const usContact = objectAt(root, "usContact");

  const purposeCandidates = [
    ...savedCandidates(answers, ["purpose_of_trip_details", "trip_purpose_details", "purpose_of_trip", "purpose_of_trip_specify"]),
    ...simplifiedStrings(travel, ["purposeDetails", "tripPurposeDetails"]),
  ];
  const destinationCandidates = [
    ...savedCandidates(answers, ["planned_location", "arrival_city", "departure_city", "us_address_city"]),
    ...simplifiedStrings(travel, ["placesToVisit", "arrivalCity", "departureCity", "usCity", "hotelName"]),
  ];
  const travelDateCandidates = [
    ...savedCandidates(answers, ["arrival_date", "intended_arrival_date", "departure_date"]),
    ...simplifiedStrings(travel, ["arrivalDate", "departureDate"]),
  ];
  const durationValueCandidates = [
    ...savedCandidates(answers, ["intended_length_of_stay_value", "intended_length_of_stay"]),
    ...simplifiedStrings(travel, ["lengthValue"]),
  ];
  const durationUnitCandidates = [
    ...savedCandidates(answers, ["intended_length_of_stay_unit"]),
    ...simplifiedStrings(travel, ["lengthUnit"]),
  ];
  const fundingCandidates = [
    ...savedCandidates(answers, ["trip_payer_type", "payer_relationship", "payer_org_name", "payer_organization_name"]),
    ...simplifiedStrings(travel, ["tripPayer", "payerRelationship", "payerOrgName"]),
  ];
  const budgetCandidates = savedCandidates(answers, ["trip_budget", "travel_budget"]);
  const occupationCandidates = [
    ...savedCandidates(answers, ["primary_occupation", "job_title", "occupation_other_explain", "not_employed_explain"]),
    ...simplifiedStrings(work, ["primaryOccupation", "jobTitle", "occupationOtherExplain"]),
  ];
  const employerCandidates = [
    ...savedCandidates(answers, ["employer_name", "education_institution_name"]),
    ...simplifiedStrings(work, ["employerName", "educationInstitution"]),
  ];
  const homeTiesCandidates = savedCandidates(answers, ["home_ties", "return_plan", "reason_to_return", "return_obligations"]);

  const usHistoryCandidates = savedCandidates(answers, ["has_been_in_us", "previous_visit_date_arrived", "previous_visit_length_of_stay"]);
  const internationalHistoryCandidates = savedCandidates(answers, ["has_traveled_last_five_years", "traveled_country", "previous_travel", "countries_visited"]);
  const previousTravelCandidates = unique([
    ...usHistoryCandidates.map((candidate) => ({ ...candidate, value: friendlyYesNo(candidate.value, "有赴美记录", "无赴美记录") })),
    ...internationalHistoryCandidates.map((candidate) => ({ ...candidate, value: friendlyYesNo(candidate.value, "近五年有其他国家或地区旅行记录", "近五年无其他国家或地区旅行记录") })),
    ...simplifiedStrings(travel, ["visitedCountries"]),
    ...simplifiedStrings(work, ["traveledCountry"]),
  ]);
  const companionCandidates = [
    ...savedCandidates(answers, ["has_companions", "companion_group_travel", "companion_group_name", "companion_relationship"]),
    ...simplifiedStrings(travel, ["hasCompanions", "companionGroupName", "companionRelationship"]),
  ].map((candidate) => ({ ...candidate, value: friendlyYesNo(candidate.value, "有同行人", "独自出行") }));
  const usContactCandidates = [
    ...savedCandidates(answers, ["us_contact_relationship", "us_contact_organization", "us_contact_organization_name"]),
    ...simplifiedStrings(usContact, ["relationship", "organizationName"]),
  ];
  const refusalCandidates = [
    ...savedCandidates(answers, ["has_been_refused", "refusal_explain"]),
    ...simplifiedStrings(travel, ["previousRefusal", "previousRefusalExplanation"]),
  ].map((candidate) => ({ ...candidate, value: friendlyYesNo(candidate.value, "有拒签或拒绝入境记录", "无拒签或拒绝入境记录") }));

  const rawPurpose = joined(purposeCandidates);
  const normalizedPurposeCodes = rawPurpose.replace(/\s/g, "");
  const ambiguousB1B2Purpose = /^(?:B|B1|B2)(?:\/(?:B|B1|B2))*$/i.test(normalizedPurposeCodes)
    && !/business|touris|商务|商務|旅游|旅遊/i.test(rawPurpose);
  const purposeDetails = friendlyPurpose(purposeCandidates);
  const duration = withUnit(durationValueCandidates, durationUnitCandidates);
  const candidatesByField: Record<InterviewProfileField, Candidate[]> = {
    purpose: purposeCandidates,
    purposeDetails: purposeCandidates,
    destinations: destinationCandidates,
    travelDates: travelDateCandidates,
    duration: durationValueCandidates.length ? [...durationValueCandidates, ...durationUnitCandidates] : [],
    funding: fundingCandidates,
    budget: budgetCandidates,
    occupation: occupationCandidates,
    employer: employerCandidates,
    homeTies: homeTiesCandidates,
    previousTravel: previousTravelCandidates,
    companions: companionCandidates,
    usContact: usContactCandidates,
    refusalHistory: refusalCandidates,
  };
  const profile: ApplicantProfile = {
    purpose: ambiguousB1B2Purpose ? "other" : inferPurpose(purposeDetails),
    purposeDetails,
    destinations: joined(destinationCandidates),
    travelDates: joined(travelDateCandidates),
    duration,
    funding: friendlyFunding(fundingCandidates),
    budget: joined(budgetCandidates),
    occupation: joined(occupationCandidates),
    employer: joined(employerCandidates),
    homeTies: joined(homeTiesCandidates),
    previousTravel: joined(previousTravelCandidates),
    companions: joined(companionCandidates),
    usContact: joined(usContactCandidates),
    refusalHistory: joined(refusalCandidates),
  };

  const fieldStates = PROFILE_FIELDS.map((field) => statusFor(
    field,
    field === "purpose" ? purposeDetails : clean(profile[field]),
    candidatesByField[field],
  ));
  if (ambiguousB1B2Purpose && purposeDetails) {
    for (const field of ["purpose", "purposeDetails"] as const) {
      const state = fieldStates.find((candidate) => candidate.field === field);
      if (state) state.status = "needs_confirmation";
    }
  }
  const missingFields = fieldStates.filter((state) => state.status === "missing").map((state) => state.field);
  const verifiedFields = fieldStates.filter((state) => state.status === "confirmed").map((state) => state.field);
  const needsConfirmationFields = fieldStates.filter((state) => state.status === "needs_confirmation").map((state) => state.field);

  return { profile, missingFields, verifiedFields, needsConfirmationFields, fieldStates };
}
