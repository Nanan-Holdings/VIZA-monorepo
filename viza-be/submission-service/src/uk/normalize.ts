/**
 * Normalize VIZA UK Standard Visitor wizard answers → the seed wire-shape
 * consumed by the page-bindings fillers (`src/uk/page-bindings.ts`).
 *
 * The internal-website UK form stores answers with seed field_names
 * (`phone_number`, `home_address_line_1`, `passport_issue_date`, …) and
 * legacy wizard keys (`telephone_number`, `home_address_line1`, …). This
 * module bridges both into the canonical keys the fillers expect.
 */

import type { ApplicantProfile } from "../types";
import { UkNormalizationError } from "./errors";
import { resolveCountryIso3 } from "./country-iso3";

/** Flat field_name → value map (use buildAnswerMap from halt-runners). */
export type UkAnswerMap = Record<string, string | null | undefined>;

export interface UkNormalizeInput {
  /** Raw wizard answers keyed by the wizard's field keys. */
  answers: UkAnswerMap;
  /** Optional applicant profile, used only as a fallback for core fields. */
  profile?: Partial<ApplicantProfile> | null;
}

const clean = (v: string | null | undefined): string => (v ?? "").trim();

function normalizeCountryForGovUk(v: string | null | undefined): string | undefined {
  const s = clean(v);
  if (!s) return undefined;
  return resolveCountryIso3(s) ?? s;
}

function put(out: Record<string, string>, key: string, value: string | undefined): void {
  if (value !== undefined && value !== "") out[key] = value;
}

function requireStr(v: string | null | undefined, field: string): string {
  const s = clean(v);
  if (!s) throw new UkNormalizationError(field, "missing required value");
  return s;
}

/** Wizard-only keys remapped above — do not pass through verbatim. */
const WIZARD_LEGACY_KEYS = new Set([
  "home_address_line1",
  "home_country",
  "telephone_number",
  "passport_date_of_issue",
  "passport_date_of_expiry",
  "intended_arrival_date",
  "intended_departure_date",
  "employer_address",
  "employer_phone",
  "monthly_income",
  "estimated_trip_cost",
  "trip_cost_currency",
  "uk_address_line1",
  "uk_address_city",
  "uk_address_postcode",
  "host_name",
  "has_visited_uk_before",
]);

/** Pass ISO `YYYY-MM-DD` through; convert `DD/MM/YYYY`; throw on anything else
 *  that is present (so a malformed date doesn't silently disappear). */
function toIsoDate(v: string | null | undefined, field: string): string | undefined {
  const s = clean(v);
  if (!s) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  throw new UkNormalizationError(field, `unrecognized date "${s}" (expected YYYY-MM-DD)`);
}

/** Wizard sex (`Male`/`Female`) → seed enum (`male`/`female`/`unspecified`). */
function toSeedSex(v: string | null | undefined, field: string): string | undefined {
  const s = clean(v).toLowerCase();
  if (!s) return undefined;
  if (s === "male" || s === "m") return "male";
  if (s === "female" || s === "f") return "female";
  if (s === "unspecified" || s === "x" || s === "other") return "unspecified";
  throw new UkNormalizationError(field, `unrecognized sex "${v}"`);
}

/** Lenient Yes/No → `yes`/`no`; returns undefined when absent. */
function toYesNo(v: string | null | undefined): string | undefined {
  const s = clean(v).toLowerCase();
  if (!s) return undefined;
  if (s === "yes" || s === "y" || s === "true" || s === "1") return "yes";
  if (s === "no" || s === "n" || s === "false" || s === "0") return "no";
  return undefined;
}

const MARITAL_STATUSES = new Set([
  "single",
  "married",
  "civil_partnership",
  "unmarried_partner",
  "divorced",
  "widowed",
  "separated",
]);

const EMPLOYMENT_STATUSES = new Set([
  "employed",
  "self_employed",
  "student",
  "retired",
  "unemployed",
]);

/** Wizard / seed purpose value → the seed value the purposeOfVisitForVV filler maps. */
const PURPOSE_MAP: Record<string, string> = {
  tourism: "tourism",
  business: "business",
  visiting_family: "tourism",
  transit: "transit",
  academic: "academic",
  marriage: "marriage",
  wedding_civil_partnership: "marriage",
  medicaltreatment: "medical",
  medical: "medical",
  study: "short_term_study",
  short_term_study: "short_term_study",
  other: "other",
};

const IMMIGRATION_STATUS_MAP: Record<string, string> = {
  temporaryvisa: "temporary_visa",
  temporary_visa: "temporary_visa",
  permanentresident: "permanent_resident",
  permanent_resident: "permanent_resident",
  other: "none",
  none: "none",
};

const ISO3_COUNTRY_NAMES: Record<string, string> = {
  CHN: "China",
  GBR: "United Kingdom",
  USA: "United States of America",
  HKG: "Hong Kong",
  MAC: "Macao",
  SGP: "Singapore",
};

function countryCodeToName(code: string | undefined): string | undefined {
  if (!code) return undefined;
  const upper = code.toUpperCase();
  return ISO3_COUNTRY_NAMES[upper] ?? code;
}

/** Strip to digits for gov.uk tel field; keep country code (e.g. +86 191… → 86191…). */
function normalizePhoneForGovUk(raw: string): string {
  return raw.trim().replace(/^\+/, "").replace(/[\s-]/g, "");
}

function parseYearsFromDuration(raw: string): string | undefined {
  const m = raw.match(/(\d+)\s*year/i);
  return m?.[1];
}

function defaultVisitDescription(purpose: string): string {
  const p = purpose.toLowerCase();
  if (p === "tourism" || p === "business") {
    return "I plan to visit the United Kingdom for tourism and sightseeing during my scheduled trip dates.";
  }
  if (p) {
    return `I plan to visit the United Kingdom for ${p.replace(/_/g, " ")} during my scheduled trip dates.`;
  }
  return "I plan to visit the United Kingdom during my scheduled trip dates.";
}

function mergePassThrough(out: Record<string, string>, answers: UkAnswerMap): void {
  for (const [key, value] of Object.entries(answers)) {
    if (WIZARD_LEGACY_KEYS.has(key)) continue;
    if (key in out) continue;
    const s = clean(value);
    if (!s) continue;
    if (key.includes("date") || key.endsWith("_date")) {
      try {
        const iso = toIsoDate(s, key);
        if (iso) out[key] = iso;
      } catch {
        // Skip malformed optional dates in pass-through.
      }
    } else {
      out[key] = s;
    }
  }
}

/**
 * Translate a full UK wizard answer set into the seed-keyed map the
 * page-bindings fillers consume. Throws `UkNormalizationError` on
 * unrecognized core enums or missing core identity fields.
 */
export function normalizeUkAnswers(input: UkNormalizeInput): Record<string, string> {
  const { answers: a, profile } = input;
  const out: Record<string, string> = {};

  // ── Identity (core — required) ───────────────────────────────────────────
  const fullName = clean(profile?.full_name);
  put(
    out,
    "given_names",
    requireStr(
      clean(a.given_names) || (fullName ? fullName.split(" ").slice(0, -1).join(" ") : ""),
      "given_names",
    ),
  );
  put(
    out,
    "surname",
    requireStr(
      clean(a.surname) || (fullName ? fullName.split(" ").pop() : ""),
      "surname",
    ),
  );
  put(out, "place_of_birth", clean(a.place_of_birth) || clean(profile?.place_of_birth));
  put(out, "date_of_birth", toIsoDate(a.date_of_birth ?? profile?.date_of_birth, "date_of_birth"));
  put(out, "sex", toSeedSex(a.sex ?? profile?.gender, "sex"));

  const marital = clean(a.marital_status).toLowerCase();
  if (marital) {
    if (!MARITAL_STATUSES.has(marital)) {
      throw new UkNormalizationError("marital_status", `unrecognized marital_status "${marital}"`);
    }
    put(out, "marital_status", marital);
  }

  put(out, "country_of_nationality", clean(a.country_of_nationality));
  put(out, "country_of_birth", clean(a.country_of_birth));
  put(out, "has_other_nationalities", toYesNo(a.has_other_nationalities));

  // ── Contact + home address ───────────────────────────────────────────────
  put(out, "email_address", clean(a.email_address) || clean(profile?.email));
  const rawPhone =
    clean(a.phone_number) || clean(a.telephone_number) || clean(profile?.phone);
  if (rawPhone) put(out, "phone_number", normalizePhoneForGovUk(rawPhone));

  put(
    out,
    "home_address_line_1",
    clean(a.home_address_line_1) || clean(a.home_address_line1) || clean(profile?.address),
  );
  put(out, "home_address_line_2", clean(a.home_address_line_2));
  put(out, "home_address_city", clean(a.home_address_city));
  put(out, "home_address_state", clean(a.home_address_state));
  put(out, "home_address_postcode", clean(a.home_address_postcode));
  put(
    out,
    "home_address_country",
    normalizeCountryForGovUk(a.home_address_country) || normalizeCountryForGovUk(a.home_country),
  );
  if (out.home_address_country) {
    put(out, "home_address_country_label", countryCodeToName(out.home_address_country));
  }
  put(out, "correspondence_address_different", toYesNo(a.correspondence_address_different));
  put(out, "correspondence_address_line_1", clean(a.correspondence_address_line_1));
  put(out, "correspondence_address_line_2", clean(a.correspondence_address_line_2));
  put(out, "correspondence_address_city", clean(a.correspondence_address_city));
  put(out, "correspondence_address_state", clean(a.correspondence_address_state));
  put(out, "correspondence_address_postcode", clean(a.correspondence_address_postcode));
  put(out, "correspondence_address_country", normalizeCountryForGovUk(a.correspondence_address_country));
  if (out.correspondence_address_country) {
    put(out, "correspondence_address_country_label", countryCodeToName(out.correspondence_address_country));
  }

  const ho = clean(a.home_ownership).toLowerCase();
  if (ho) {
    put(out, "owns_home", ho === "own" ? "yes" : ho === "rent" ? "no" : toYesNo(a.owns_home));
    put(
      out,
      "home_ownership_label",
      ho === "own" ? "I own it" : ho === "rent" ? "I rent it" : ho === "other" ? "Other" : undefined,
    );
    if (ho === "other") {
      put(out, "other_living_situation_details", clean(a.home_ownership_other_details));
    }
  } else {
    put(out, "owns_home", toYesNo(a.owns_home));
  }
  put(
    out,
    "years_at_address",
    clean(a.years_at_address) || parseYearsFromDuration(clean(a.how_long_at_address)),
  );
  put(out, "months_at_address", clean(a.months_at_address));

  const immRaw = clean(a.immigration_status_in_residence_country ?? a.current_immigration_status);
  if (immRaw) {
    const immKey = immRaw.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
    const mapped = IMMIGRATION_STATUS_MAP[immKey] ?? IMMIGRATION_STATUS_MAP[immRaw.toLowerCase()];
    if (mapped) put(out, "current_immigration_status", mapped);
    if (mapped === "temporary_visa") {
      put(
        out,
        "immigration_status_expiration_date",
        toIsoDate(a.immigration_status_visa_expiry, "immigration_status_visa_expiry"),
      );
    }
    if (mapped === "permanent_resident") {
      put(out, "permanent_resident_year", clean(a.immigration_status_pr_year));
    }
    if (immRaw.toLowerCase() === "other") {
      put(out, "current_immigration_status_details", clean(a.immigration_status_other_details));
    }
  }

  // ── Passport ─────────────────────────────────────────────────────────────
  put(out, "passport_number", clean(a.passport_number) || clean(profile?.passport_number));
  put(
    out,
    "passport_issuing_authority",
    clean(a.passport_issuing_authority) ||
      clean(a.passport_place_of_issue) ||
      countryCodeToName(clean(a.passport_issuing_country)) ||
      countryCodeToName(clean(a.country_of_nationality)),
  );
  put(
    out,
    "passport_issue_date",
    toIsoDate(a.passport_issue_date ?? a.passport_date_of_issue, "passport_issue_date"),
  );
  put(
    out,
    "passport_expiry_date",
    toIsoDate(
      a.passport_expiry_date ?? a.passport_date_of_expiry ?? a.passport_expiration_date,
      "passport_expiry_date",
    ),
  );

  // ── Employment + finance ─────────────────────────────────────────────────
  const employment = clean(a.employment_status).toLowerCase().replace(/-/g, "_");
  if (employment) {
    if (!EMPLOYMENT_STATUSES.has(employment)) {
      throw new UkNormalizationError("employment_status", `unrecognized employment_status "${employment}"`);
    }
    put(out, "employment_status", employment);
  }
  put(out, "employer_name", clean(a.employer_name));
  put(out, "employer_address_line_1", clean(a.employer_address_line_1) || clean(a.employer_address));
  put(out, "employer_phone_number", clean(a.employer_phone_number) || clean(a.employer_phone));
  put(out, "job_title", clean(a.job_title));
  put(out, "job_earnings_amount", clean(a.job_earnings_amount) || clean(a.monthly_income));

  put(out, "planned_spend_amount", clean(a.planned_spend_amount) || clean(a.estimated_trip_cost));
  put(out, "planned_spend_currency", clean(a.planned_spend_currency) || clean(a.trip_cost_currency));
  put(out, "monthly_outgoings_amount", clean(a.monthly_outgoings_amount));
  put(out, "monthly_outgoings_currency", clean(a.monthly_outgoings_currency));

  // `trip_funding_source` never existed upstream (no such wizard field) —
  // the real seed fields are `someone_paying_for_visit` (direct Yes/No) and
  // `who_is_paying` (select: self/sponsor/employer/other). Without this fix,
  // "others_paying_for_visit" was never set, so payingForYourVisit always
  // defaulted to "No" regardless of the real answer.
  const someonePaying = toYesNo(a.someone_paying_for_visit);
  if (someonePaying !== undefined) {
    put(out, "others_paying_for_visit", someonePaying);
  } else {
    const whoIsPaying = clean(a.who_is_paying).toLowerCase();
    if (whoIsPaying) put(out, "others_paying_for_visit", whoIsPaying === "self" ? "no" : "yes");
  }

  // ── Purpose of visit ─────────────────────────────────────────────────────
  const rawPurpose = clean(a.purpose_of_visit).toLowerCase();
  if (rawPurpose) {
    const mapped = PURPOSE_MAP[rawPurpose];
    if (!mapped) {
      throw new UkNormalizationError("purpose_of_visit", `unrecognized purpose "${rawPurpose}"`);
    }
    put(out, "purpose_of_visit", mapped);
    if (rawPurpose === "visiting_family") put(out, "tourism_purpose", "visiting_family");
  }
  const subPurpose = clean(a.tourism_sub_purpose);
  if (subPurpose) put(out, "tourism_purpose", subPurpose);

  // ── Trip dates ───────────────────────────────────────────────────────────
  put(
    out,
    "planned_arrival_date",
    toIsoDate(
      a.planned_arrival_date ?? a.uk_arrival_date ?? a.intended_arrival_date,
      "planned_arrival_date",
    ),
  );
  put(
    out,
    "planned_departure_date",
    toIsoDate(
      a.planned_departure_date ?? a.uk_departure_date ?? a.intended_departure_date,
      "planned_departure_date",
    ),
  );

  // ── UK accommodation (legacy wizard keys + seed keys via pass-through) ───
  const ukLine1 = clean(a.uk_accommodation_address_line_1) || clean(a.uk_address_line1);
  if (ukLine1) {
    put(out, "has_uk_accommodation_address", "yes");
    put(out, "uk_accommodation_address_line_1", ukLine1);
    put(out, "uk_accommodation_city", clean(a.uk_accommodation_city) || clean(a.uk_address_city));
    put(out, "uk_accommodation_postcode", clean(a.uk_accommodation_postcode) || clean(a.uk_address_postcode));
    put(out, "uk_accommodation_name", clean(a.uk_accommodation_name) || clean(a.host_name));
  }

  // ── Background extras ────────────────────────────────────────────────────
  const purposeForDefault = out.purpose_of_visit ?? rawPurpose;
  put(
    out,
    "visit_activities_description",
    clean(a.visit_activities_description) || defaultVisitDescription(purposeForDefault),
  );
  put(out, "has_family_in_uk", toYesNo(a.has_family_in_uk));
  put(out, "has_financial_dependants", toYesNo(a.has_financial_dependants));
  put(out, "travelling_in_organised_group", toYesNo(a.travelling_in_organised_group));
  put(out, "travelling_with_non_partner", toYesNo(a.travelling_with_non_partner));

  const refusedUk = toYesNo(a.has_been_refused_uk_visa ?? a.visa_refused_uk);
  const refusedOther = toYesNo(a.has_been_refused_other_visa ?? a.visa_refused_other_country);
  if (refusedUk !== undefined || refusedOther !== undefined) {
    put(out, "has_immigration_problems", refusedUk === "yes" || refusedOther === "yes" ? "yes" : "no");
  } else {
    const deported = toYesNo(a.deported_removed_refused_entry);
    if (deported !== undefined) {
      put(out, "has_immigration_problems", deported === "yes" ? "yes" : "no");
    }
  }
  put(out, "has_immigration_breach", toYesNo(a.breach_uk_immigration_laws ?? a.has_immigration_breach));
  put(out, "travelled_to_uk_before", toYesNo(a.travelled_to_uk_before ?? a.has_visited_uk_before));
  put(out, "war_crimes_involvement", toYesNo(a.war_crimes_involvement ?? a.war_crimes));
  put(out, "terrorist_activity", toYesNo(a.terrorist_activity ?? a.terrorism_related));
  put(
    out,
    "has_criminal_convictions",
    toYesNo(a.has_criminal_convictions ?? a.criminal_convictions ?? a.decl_no_criminal_convictions),
  );
  put(
    out,
    "preferred_spoken_language",
    clean(a.preferred_spoken_language) ||
      (clean(a.spoken_language_preference) === "other" ? "Other" : clean(a.spoken_language_preference)),
  );
  put(
    out,
    "preferred_spoken_language_details",
    clean(a.preferred_spoken_language_details ?? a.spoken_language_other_details),
  );
  if (clean(a.has_other_income).toLowerCase() === "no") {
    put(out, "other_income_none", "yes");
  }
  put(out, "has_financial_dependants", toYesNo(a.has_financial_dependants ?? a.applying_with_dependants));

  // Preserve seed field_names not explicitly transformed above.
  mergePassThrough(out, a);

  return out;
}
