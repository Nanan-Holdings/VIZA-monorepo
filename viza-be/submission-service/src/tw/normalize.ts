/**
 * Normalize VIZA Taiwan Online Entry Permit wizard answers → the seed
 * wire-shape consumed by src/tw/apply.ts + src/tw/fillers.ts.
 *
 * Field/value contract: viza-be/agent-backend/scripts/seed-tw-entry-permit-
 * form-fields.ts is authoritative — every key this function emits must
 * match a `field_name` defined there, and every enum value must match that
 * file's `options[].value` (e.g. permit_type "1"|"2"|"H", gender "0"|"1",
 * continent "A".."E", birth_place_is_mainland "mainland"|"other").
 *
 * Mirrors src/uk/normalize.ts's shape (clean/put/require helpers, throw
 * TwNormalizationError rather than silently guessing).
 */

import type { ApplicantProfile, Application } from "../types";
import { TwNormalizationError } from "./errors";

export type TwAnswerMap = Record<string, string | null | undefined>;

export interface TwNormalizeInput {
  /** Raw wizard answers keyed by field_name (see seed contract above). */
  answers: TwAnswerMap;
  /** Optional applicant profile, used only as a fallback for core identity fields. */
  profile?: Partial<ApplicantProfile> | null;
  /** Optional application row — accepted for parity with other normalizers
   *  (France/UK) and future use (e.g. deriving defaults from visa_type),
   *  not currently read. */
  application?: Partial<Application> | null;
}

const clean = (v: string | null | undefined): string => (v ?? "").trim();

function put(out: Record<string, string>, key: string, value: string | null | undefined): void {
  const s = clean(value);
  if (s) out[key] = s;
}

function requireStr(v: string | null | undefined, field: string): string {
  const s = clean(v);
  if (!s) throw new TwNormalizationError(field, "missing required value");
  return s;
}

/** Pass ISO `YYYY-MM-DD` through; convert `DD/MM/YYYY`; throw on anything
 *  else that is present (so a malformed date doesn't silently disappear).
 *  Fillers convert this canonical ISO shape to whatever the portal's date
 *  widget actually needs (see fillers.ts twFillDate TODO). */
function toIsoDate(v: string | null | undefined, field: string): string | undefined {
  const s = clean(v);
  if (!s) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  throw new TwNormalizationError(field, `unrecognized date "${s}" (expected YYYY-MM-DD)`);
}

/** Lenient Yes/No → seed's `yes`/`no`; returns undefined when absent. */
function toYesNo(v: string | null | undefined): string | undefined {
  const s = clean(v).toLowerCase();
  if (!s) return undefined;
  if (s === "yes" || s === "y" || s === "true" || s === "1") return "yes";
  if (s === "no" || s === "n" || s === "false" || s === "0") return "no";
  return undefined;
}

function requireYesNo(v: string | null | undefined, field: string): string {
  const yn = toYesNo(v);
  if (!yn) throw new TwNormalizationError(field, `missing/unrecognized yes-no value "${clean(v)}"`);
  return yn;
}

/** Lenient boolean → seed's checkbox convention (`"true"`/`"false"` strings). */
function toBoolStr(v: string | null | undefined): string | undefined {
  const s = clean(v).toLowerCase();
  if (!s) return undefined;
  if (["true", "yes", "y", "1", "on"].includes(s)) return "true";
  if (["false", "no", "n", "0", "off"].includes(s)) return "false";
  return undefined;
}

function requireEnum(v: string | null | undefined, field: string, allowed: ReadonlySet<string>): string {
  const s = clean(v);
  if (!s) throw new TwNormalizationError(field, "missing required value");
  if (!allowed.has(s)) {
    throw new TwNormalizationError(field, `unrecognized value "${s}" (expected one of: ${[...allowed].join(", ")})`);
  }
  return s;
}

function optionalEnum(v: string | null | undefined, field: string, allowed: ReadonlySet<string>): string | undefined {
  const s = clean(v);
  if (!s) return undefined;
  if (!allowed.has(s)) {
    throw new TwNormalizationError(field, `unrecognized value "${s}" (expected one of: ${[...allowed].join(", ")})`);
  }
  return s;
}

// ── Enum contracts (verbatim from the seed script's option value lists) ────
const CONTINENTS = new Set(["A", "B", "C", "D", "E"]);
const PERMIT_TYPES = new Set(["1", "2", "H"]);
const PERMIT_COUNTS = new Set(["1", "2"]);
const GENDERS = new Set(["0", "1"]);
const ELIGIBILITY_CATEGORIES = new Set(["1", "2", "3", "4"]);
const BIRTH_PLACE = new Set(["mainland", "other"]);
const BIRTH_PLACE_MAINLAND_REGIONS = new Set([
  "湖南", "湖北", "四川", "上海", "南京", "漢口", "重慶", "山東", "山西", "河南",
  "河北", "陝西", "甘肅", "青島", "天津", "北京", "西安", "遼寧", "遼北", "安東",
  "吉林", "松江", "合江", "嫩江", "黑龍江", "興安", "大連", "瀋陽", "哈爾濱", "熱河",
  "察哈爾", "綏遠", "寧夏回族自治區", "內蒙古自治區", "新疆維吾爾自治區", "青海", "西康",
  "西藏自治區", "福建", "廣東", "廣西壯族自治區", "雲南", "貴州", "海南", "廣州", "江蘇",
  "浙江", "安徽", "江西",
]);
const KINSHIP_STATUS = new Set(["1", "2", "3"]);
const OCCUPATION_STUDENT = "14";
const OCCUPATION_UNEMPLOYED = "61";
const OCCUPATION_RETIRED = "62";

/** Wizard gender word → seed's numeric enum (0=male, 1=female), used only as
 *  a profile fallback when the wizard didn't already send "0"/"1" directly. */
function genderWordToSeedCode(v: string | null | undefined): string | undefined {
  const s = clean(v).toLowerCase();
  if (!s) return undefined;
  if (s === "0" || s === "1") return s;
  if (s === "male" || s === "m") return "0";
  if (s === "female" || s === "f") return "1";
  return undefined;
}

const KINSHIP_GROUPS = ["father", "mother", "spouse", "child1", "child2"] as const;
type TwKinshipGroup = (typeof KINSHIP_GROUPS)[number];

export function isTwHouseholdRevokedRequiredFromAnswers(answers: TwAnswerMap | Record<string, string>): boolean {
  return clean(answers.eligibility_category) === "2" && ["50", "51"].includes(clean(answers.embassy_office));
}

/** Keys explicitly handled below — anything else present in the answer map
 *  is passed through verbatim (cleaned) so forward-compatible seed
 *  additions aren't silently dropped, mirroring uk/normalize.ts's
 *  mergePassThrough. */
function buildHandledKeySet(): Set<string> {
  const handled = new Set<string>([
    "continent",
    "embassy_office",
    "photo_upload",
    "first_time_applying",
    "permit_type",
    "permit_count",
    "has_other_nationality_passport",
    "household_revoked",
    "eligibility_category",
    "name_chinese",
    "name_english",
    "date_of_birth",
    "passport_number",
    "passport_expiry_date",
    "gender",
    "overseas_residency_id_number",
    "mainland_id_number_not_applicable",
    "mainland_id_number",
    "birth_place_is_mainland",
    "birth_place_mainland_region",
    "birth_place_other_country",
    "local_mobile_phone",
    "current_occupation",
    "occupation_experience",
    "company_name",
    "job_title",
    "is_taiwanese_spouse",
    "traveling_with_parents",
    "overseas_address",
    "mainland_travel_document",
    "eligibility_supporting_document",
    "hk_macau_id_scan",
    "other_nationality_passport_scan",
    "mainland_id_card_scan",
    "other_supporting_document",
    "tw_contact_city",
    "tw_contact_district",
    "tw_contact_village",
    "tw_contact_neighborhood",
    "tw_contact_road",
    "tw_contact_lane",
    "tw_contact_alley",
    "tw_contact_building_number",
    "tw_local_phone",
    "tw_contact_mobile_not_applicable",
    "tw_contact_mobile",
    "other_nationality_country",
    "other_passport_number",
    "other_passport_expiry_date",
    "past_mainland_political_military_role",
    "past_role_detail",
    "current_mainland_political_military_role",
    "current_role_detail",
    "never_held_mainland_political_military_role",
    "accepted_terms",
  ]);
  for (const group of KINSHIP_GROUPS) {
    handled.add(`kin_${group}_status`);
    handled.add(`kin_${group}_name`);
    handled.add(`kin_${group}_date_of_birth`);
    handled.add(`kin_${group}_phone`);
    handled.add(`kin_${group}_occupation`);
    handled.add(`kin_${group}_service_unit`);
    handled.add(`kin_${group}_job_title`);
    handled.add(`kin_${group}_current_address_same_as_overseas`);
    handled.add(`kin_${group}_current_address`);
  }
  return handled;
}

const HANDLED_KEYS = buildHandledKeySet();

function mergePassThrough(out: Record<string, string>, answers: TwAnswerMap): void {
  for (const [key, value] of Object.entries(answers)) {
    if (HANDLED_KEYS.has(key)) continue;
    if (key in out) continue;
    const s = clean(value);
    if (!s) continue;
    out[key] = s;
  }
}

function normalizeKinshipGroup(
  out: Record<string, string>,
  a: TwAnswerMap,
  group: TwKinshipGroup,
  requiredGroup: boolean,
): void {
  const prefix = `kin_${group}_`;
  const statusField = `${prefix}status`;
  const status = requiredGroup
    ? requireEnum(a[statusField], statusField, KINSHIP_STATUS)
    : optionalEnum(a[statusField], statusField, KINSHIP_STATUS);
  if (status) put(out, statusField, status);

  const requireLivingDetails = requiredGroup && status === "1";
  const readDetail = (field: string): string | undefined =>
    requireLivingDetails ? requireStr(a[field], field) : clean(a[field]) || undefined;

  put(out, `${prefix}name`, readDetail(`${prefix}name`));
  const rawDob = requireLivingDetails
    ? requireStr(a[`${prefix}date_of_birth`], `${prefix}date_of_birth`)
    : a[`${prefix}date_of_birth`];
  const dob = toIsoDate(rawDob, `${prefix}date_of_birth`);
  if (dob) put(out, `${prefix}date_of_birth`, dob);
  put(out, `${prefix}phone`, readDetail(`${prefix}phone`));
  put(out, `${prefix}occupation`, readDetail(`${prefix}occupation`));
  put(out, `${prefix}service_unit`, readDetail(`${prefix}service_unit`));
  put(out, `${prefix}job_title`, readDetail(`${prefix}job_title`));

  const sameAsOverseas = toBoolStr(a[`${prefix}current_address_same_as_overseas`]);
  if (sameAsOverseas) put(out, `${prefix}current_address_same_as_overseas`, sameAsOverseas);
  if (sameAsOverseas === "true") {
    // Mirrors the portal's "同申請人海外地址" quick-fill button.
    const overseas = requireLivingDetails
      ? requireStr(a.overseas_address, `${prefix}current_address`)
      : clean(a.overseas_address);
    if (overseas) put(out, `${prefix}current_address`, overseas);
  } else {
    put(out, `${prefix}current_address`, readDetail(`${prefix}current_address`));
  }
}

function requireApplicantChineseName(value: string | null | undefined): string {
  const name = requireStr(value, "name_chinese");
  if (/[A-Za-z]/.test(name) || !/\p{Script=Han}/u.test(name)) {
    throw new TwNormalizationError(
      "name_chinese",
      "must contain applicant-provided Chinese characters; transliteration is not allowed",
    );
  }
  return name;
}

/**
 * Translate a full TW wizard answer set into the seed-keyed map
 * src/tw/apply.ts consumes. Throws `TwNormalizationError` on unrecognized
 * core enums or missing core identity fields.
 */
export function normalizeTwAnswers(input: TwNormalizeInput): Record<string, string> {
  const { answers: a, profile } = input;
  const out: Record<string, string> = {};

  // ── Delivery location ────────────────────────────────────────────────────
  put(out, "continent", requireEnum(a.continent, "continent", CONTINENTS));
  put(out, "embassy_office", requireStr(a.embassy_office, "embassy_office"));

  // ── Photo & basic status ─────────────────────────────────────────────────
  put(out, "photo_upload", a.photo_upload); // storage path/ref; apply.ts resolves the local file
  put(out, "first_time_applying", requireYesNo(a.first_time_applying, "first_time_applying"));
  put(out, "permit_type", requireEnum(a.permit_type, "permit_type", PERMIT_TYPES));
  put(out, "permit_count", requireEnum(a.permit_count, "permit_count", PERMIT_COUNTS));
  put(
    out,
    "has_other_nationality_passport",
    requireYesNo(a.has_other_nationality_passport, "has_other_nationality_passport"),
  );
  put(out, "eligibility_category", requireEnum(a.eligibility_category, "eligibility_category", ELIGIBILITY_CATEGORIES));
  if (isTwHouseholdRevokedRequiredFromAnswers(out)) {
    put(out, "household_revoked", requireYesNo(a.household_revoked, "household_revoked"));
  }

  // ── Applicant identity ───────────────────────────────────────────────────
  put(out, "name_chinese", requireApplicantChineseName(a.name_chinese));
  // Passport-facing English name is conventionally uppercase.
  put(out, "name_english", requireStr(a.name_english, "name_english").toUpperCase());
  put(out, "date_of_birth", requireStr(toIsoDate(a.date_of_birth ?? profile?.date_of_birth, "date_of_birth"), "date_of_birth"));
  put(out, "passport_number", requireStr(a.passport_number ?? profile?.passport_number, "passport_number"));
  put(
    out,
    "passport_expiry_date",
    requireStr(
      toIsoDate(a.passport_expiry_date ?? profile?.passport_expiry_date, "passport_expiry_date"),
      "passport_expiry_date",
    ),
  );
  put(out, "gender", requireEnum(a.gender ?? genderWordToSeedCode(profile?.gender), "gender", GENDERS));
  put(out, "overseas_residency_id_number", requireStr(a.overseas_residency_id_number, "overseas_residency_id_number"));

  const noMainlandId = toBoolStr(a.mainland_id_number_not_applicable) ?? "false";
  put(out, "mainland_id_number_not_applicable", noMainlandId);
  if (noMainlandId !== "true") put(out, "mainland_id_number", a.mainland_id_number);

  const birthPlace = requireEnum(a.birth_place_is_mainland, "birth_place_is_mainland", BIRTH_PLACE);
  put(out, "birth_place_is_mainland", birthPlace);
  if (birthPlace === "mainland") {
    put(
      out,
      "birth_place_mainland_region",
      requireEnum(a.birth_place_mainland_region, "birth_place_mainland_region", BIRTH_PLACE_MAINLAND_REGIONS),
    );
  } else {
    put(out, "birth_place_other_country", requireStr(a.birth_place_other_country, "birth_place_other_country"));
  }

  put(out, "local_mobile_phone", requireStr(a.local_mobile_phone, "local_mobile_phone"));
  const currentOccupation = requireStr(a.current_occupation, "current_occupation");
  put(out, "current_occupation", currentOccupation);
  put(out, "occupation_experience", a.occupation_experience);
  if (currentOccupation === OCCUPATION_STUDENT) {
    put(out, "company_name", requireStr(a.company_name, "company_name"));
  } else if (currentOccupation !== OCCUPATION_RETIRED && currentOccupation !== OCCUPATION_UNEMPLOYED) {
    put(out, "company_name", requireStr(a.company_name, "company_name"));
    put(out, "job_title", requireStr(a.job_title, "job_title"));
  }
  // Confirmed live to carry a required asterisk (see seed script comment).
  put(out, "is_taiwanese_spouse", requireYesNo(a.is_taiwanese_spouse, "is_taiwanese_spouse"));
  put(out, "traveling_with_parents", toYesNo(a.traveling_with_parents));
  put(out, "overseas_address", requireStr(a.overseas_address, "overseas_address"));

  // ── Supporting documents (應檢附文件, confirmed live) ─────────────────────
  // IMPORTANT: unlike every other field in this function, these are NOT
  // read from `answers` (visa_application_answers) at all. A deeper check
  // found the applicant's uploaded files live entirely in a separate table
  // (application_documents, keyed by requirement_key), and there is no
  // production code path that also mirrors them into visa_application_answers
  // — so treating them as text answers here would just always throw
  // "missing required value". The queue layer (halt-runners.ts) resolves
  // these directly from application_documents via
  // src/documents/resolve-application-documents.ts and passes local file
  // paths through TwApplyOptions.supportingDocuments, bypassing this
  // normalizer entirely — mirroring how photoFilePath already worked.
  // Presence/required-ness of each document is therefore validated in
  // halt-runners.ts, not here.

  // ── Taiwan contact address ───────────────────────────────────────────────
  put(out, "tw_contact_city", requireStr(a.tw_contact_city, "tw_contact_city"));
  put(out, "tw_contact_district", a.tw_contact_district);
  put(out, "tw_contact_village", a.tw_contact_village);
  put(out, "tw_contact_neighborhood", a.tw_contact_neighborhood);
  put(out, "tw_contact_road", requireStr(a.tw_contact_road, "tw_contact_road"));
  put(out, "tw_contact_lane", a.tw_contact_lane);
  put(out, "tw_contact_alley", a.tw_contact_alley);
  put(out, "tw_contact_building_number", requireStr(a.tw_contact_building_number, "tw_contact_building_number"));
  put(out, "tw_local_phone", a.tw_local_phone);

  const noTwMobile = toBoolStr(a.tw_contact_mobile_not_applicable) ?? "false";
  put(out, "tw_contact_mobile_not_applicable", noTwMobile);
  if (noTwMobile !== "true") put(out, "tw_contact_mobile", a.tw_contact_mobile);

  // ── Other nationality (conditional) ──────────────────────────────────────
  if (out.has_other_nationality_passport === "yes") {
    put(out, "other_nationality_country", requireStr(a.other_nationality_country, "other_nationality_country"));
    put(out, "other_passport_number", requireStr(a.other_passport_number, "other_passport_number"));
    put(
      out,
      "other_passport_expiry_date",
      requireStr(
        toIsoDate(a.other_passport_expiry_date, "other_passport_expiry_date"),
        "other_passport_expiry_date",
      ),
    );
  }

  // Father/mother status is required. When either is living, the official
  // form requires that parent's details; never synthesize missing answers.
  normalizeKinshipGroup(out, a, "father", true);
  normalizeKinshipGroup(out, a, "mother", true);
  normalizeKinshipGroup(out, a, "spouse", false);
  normalizeKinshipGroup(out, a, "child1", false);
  normalizeKinshipGroup(out, a, "child2", false);

  // ── Declaration ───────────────────────────────────────────────────────────
  const pastRole = toBoolStr(a.past_mainland_political_military_role) ?? "false";
  put(out, "past_mainland_political_military_role", pastRole);
  if (pastRole === "true") put(out, "past_role_detail", requireStr(a.past_role_detail, "past_role_detail"));

  const currentRole = toBoolStr(a.current_mainland_political_military_role) ?? "false";
  put(out, "current_mainland_political_military_role", currentRole);
  if (currentRole === "true") put(out, "current_role_detail", requireStr(a.current_role_detail, "current_role_detail"));

  put(
    out,
    "never_held_mainland_political_military_role",
    toBoolStr(a.never_held_mainland_political_military_role) ?? "false",
  );

  const acceptedTerms = toBoolStr(a.accepted_terms) ?? "false";
  if (acceptedTerms !== "true") {
    throw new TwNormalizationError("accepted_terms", "applicant must accept the terms and conditions (mustBeTrue)");
  }
  put(out, "accepted_terms", acceptedTerms);

  // Preserve seed field_names not explicitly transformed above.
  mergePassThrough(out, a);

  return out;
}
