/**
 * Normalize VIZA UK Standard Visitor wizard answers → the seed wire-shape
 * consumed by the page-bindings fillers (`src/uk/page-bindings.ts`).
 *
 * Mirrors `france-visas/normalize.ts`. The internal-website UK wizard
 * (`components/client/wizards/uk/config.ts`) stores answers with its own
 * keys/values:
 *   - `home_address_line1`, `home_country`, `telephone_number`, …
 *   - sex as `Male` / `Female`
 *   - countries as ISO-3 alpha codes (`CHN`, `USA`, `GBR`)
 *   - dates as ISO `YYYY-MM-DD`
 *
 * The page-bindings fillers expect the *seed* field_names + generic enums
 * (`home_address_line_1`, `home_address_country`, `phone_number`, sex `male`,
 * …) and do their own enum→gov.uk-label mapping inline. This module bridges
 * the two.
 *
 * Best-effort: missing optional answers are left absent — the runner saves
 * the page blank and the applicant completes it at the review/declaration
 * step, which is the agreed stop boundary. A present-but-unrecognized value
 * for a core enum (sex, marital status, employment status, purpose) or a
 * missing core identity field throws `UkNormalizationError`, so the run halts
 * for human review rather than silently mis-stating the form.
 */

import type { ApplicantProfile } from "../types";
import { UkNormalizationError } from "./errors";

/** Flat field_name → value map (use buildAnswerMap from halt-runners). */
export type UkAnswerMap = Record<string, string | null | undefined>;

export interface UkNormalizeInput {
  /** Raw wizard answers keyed by the wizard's field keys. */
  answers: UkAnswerMap;
  /** Optional applicant profile, used only as a fallback for core fields. */
  profile?: Partial<ApplicantProfile> | null;
}

const clean = (v: string | null | undefined): string => (v ?? "").trim();

function put(out: Record<string, string>, key: string, value: string | undefined): void {
  if (value !== undefined && value !== "") out[key] = value;
}

function requireStr(v: string | null | undefined, field: string): string {
  const s = clean(v);
  if (!s) throw new UkNormalizationError(field, "missing required value");
  return s;
}

// ── value translators ──────────────────────────────────────────────────────

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

/** Wizard purpose value → the seed value the purposeOfVisitForVV filler maps. */
const PURPOSE_MAP: Record<string, string> = {
  tourism: "tourism",
  business: "business",
  visiting_family: "tourism", // gov.uk routes "visiting family" under Tourism
  study: "short_term_study",
  medical: "medical",
  wedding_civil_partnership: "marriage",
  transit: "transit",
  other: "other",
};

// ── entrypoint ───────────────────────────────────────────────────────────────

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

  // marital_status — wizard values already match the filler's keys; validate.
  const marital = clean(a.marital_status).toLowerCase();
  if (marital) {
    if (!MARITAL_STATUSES.has(marital)) {
      throw new UkNormalizationError("marital_status", `unrecognized marital_status "${marital}"`);
    }
    put(out, "marital_status", marital);
  }

  // Nationality / birth countries — wizard stores ISO-3 alpha; ukSelectCountry
  // now selects by value, so pass the code through unchanged.
  put(out, "country_of_nationality", clean(a.country_of_nationality));
  put(out, "country_of_birth", clean(a.country_of_birth));
  put(out, "has_other_nationalities", toYesNo(a.has_other_nationalities));

  // ── Contact + home address ───────────────────────────────────────────────
  put(out, "email_address", clean(a.email_address) || clean(profile?.email));
  put(out, "phone_number", clean(a.telephone_number) || clean(profile?.phone));
  put(out, "home_address_line_1", clean(a.home_address_line1) || clean(profile?.address));
  put(out, "home_address_city", clean(a.home_address_city));
  put(out, "home_address_postcode", clean(a.home_address_postcode));
  put(out, "home_address_country", clean(a.home_country));
  put(out, "owns_home", toYesNo(a.owns_home));

  // ── Passport ─────────────────────────────────────────────────────────────
  put(out, "passport_number", clean(a.passport_number) || clean(profile?.passport_number));
  put(out, "passport_issuing_authority", clean(a.passport_issuing_authority));
  put(out, "passport_issue_date", toIsoDate(a.passport_date_of_issue, "passport_date_of_issue"));
  put(out, "passport_expiry_date", toIsoDate(a.passport_date_of_expiry, "passport_date_of_expiry"));

  // ── Employment + finance ─────────────────────────────────────────────────
  const employment = clean(a.employment_status).toLowerCase();
  if (employment) {
    if (!EMPLOYMENT_STATUSES.has(employment)) {
      throw new UkNormalizationError("employment_status", `unrecognized employment_status "${employment}"`);
    }
    put(out, "employment_status", employment);
  }
  put(out, "employer_name", clean(a.employer_name));
  put(out, "employer_address_line_1", clean(a.employer_address));
  put(out, "employer_phone_number", clean(a.employer_phone));
  put(out, "job_title", clean(a.job_title));
  put(out, "job_earnings_amount", clean(a.monthly_income));

  // Trip cost → planned spend.
  put(out, "planned_spend_amount", clean(a.estimated_trip_cost));
  put(out, "planned_spend_currency", clean(a.trip_cost_currency));

  // Funding source → "is anyone else paying?" (anything other than self = yes).
  const fundingSource = clean(a.trip_funding_source).toLowerCase();
  if (fundingSource) put(out, "others_paying_for_visit", fundingSource === "self" ? "no" : "yes");

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

  // ── Trip dates ───────────────────────────────────────────────────────────
  put(out, "planned_arrival_date", toIsoDate(a.intended_arrival_date, "intended_arrival_date"));
  put(out, "planned_departure_date", toIsoDate(a.intended_departure_date, "intended_departure_date"));

  // ── UK accommodation ─────────────────────────────────────────────────────
  const ukLine1 = clean(a.uk_address_line1);
  if (ukLine1) {
    put(out, "has_uk_accommodation_address", "yes");
    put(out, "uk_accommodation_address_line_1", ukLine1);
    put(out, "uk_accommodation_city", clean(a.uk_address_city));
    put(out, "uk_accommodation_postcode", clean(a.uk_address_postcode));
    put(out, "uk_accommodation_name", clean(a.host_name));
  }

  // ── Background extras (wizard keys already match the filler seed keys) ────
  put(out, "visit_activities_description", clean(a.visit_activities_description));
  put(out, "has_family_in_uk", toYesNo(a.has_family_in_uk));
  put(out, "has_financial_dependants", toYesNo(a.has_financial_dependants));
  put(out, "travelling_in_organised_group", toYesNo(a.travelling_in_organised_group));
  put(out, "travelling_with_non_partner", toYesNo(a.travelling_with_non_partner));

  // ── Travel history ───────────────────────────────────────────────────────
  put(out, "travelled_to_uk_before", toYesNo(a.has_visited_uk_before));

  // ── Immigration history (truthful: a prior refusal IS an immigration
  //    problem). Detail sub-pages aren't auto-filled; the applicant adds them
  //    at review. We only set a definite yes/no when the wizard collected it. ─
  const refusedUk = toYesNo(a.has_been_refused_uk_visa);
  const refusedOther = toYesNo(a.has_been_refused_other_visa);
  if (refusedUk !== undefined || refusedOther !== undefined) {
    put(out, "has_immigration_problems", refusedUk === "yes" || refusedOther === "yes" ? "yes" : "no");
  }

  return out;
}
