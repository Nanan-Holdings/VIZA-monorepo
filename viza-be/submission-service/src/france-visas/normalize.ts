/**
 * Normalize VIZA Schengen answers → France-Visas wire format.
 *
 * The VIZA internal-website stores Schengen answers using the seed field
 * names (`surname`, `given_names`, `date_of_birth`, …) and generic enum
 * values (`male`/`female`, ISO-3166-1 alpha-2 country codes, ISO date strings).
 *
 * France-Visas expects step-keyed values in its own wire format:
 *   - ISO-3 country codes (`CHN`, `USA`, `FRA`)
 *   - Single-char sex (`M`, `F`, `X`)
 *   - 3-char civil-status enum (`CEL`, `MAR`, `DIV`, …)
 *   - dd/MM/yyyy dates
 *
 * This module translates between them. Any value that can't be confidently
 * translated returns a `NormalizationError` with the offending field —
 * callers should fail the run rather than submit garbage to France-Visas.
 */

import type { VisaApplicationAnswer, ApplicantProfile, Application } from "../types";
import type {
  FvApplicationAnswers,
  FvStep1Answers,
  FvStep2Answers,
  FvStep3Answers,
  FvStep4Answers,
  FvStep5Answers,
} from "./field-mappings";
import type { FvAutoFunding } from "./selectors";

export class NormalizationError extends Error {
  readonly code = "FV_NORMALIZATION_ERROR" as const;
  readonly field: string;
  constructor(field: string, message: string) {
    super(`[${field}] ${message}`);
    this.name = "NormalizationError";
    this.field = field;
  }
}

/** Flattened answer map keyed by seed `field_name`. */
export type AnswerMap = Record<string, string | null>;

export function buildAnswerMap(answers: readonly VisaApplicationAnswer[]): AnswerMap {
  const out: AnswerMap = {};
  for (const a of answers) {
    // Prefer value_text; fall back to value_json serialized as a string for
    // repeatable / complex fields. Normalize `null`/`undefined` to empty string.
    if (a.value_text !== null && a.value_text !== undefined) {
      out[a.field_name] = a.value_text;
    } else if (a.value_json !== undefined && a.value_json !== null) {
      out[a.field_name] = typeof a.value_json === "string"
        ? a.value_json
        : JSON.stringify(a.value_json);
    } else {
      out[a.field_name] = null;
    }
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────────────
// Enum translations
// ──────────────────────────────────────────────────────────────────────────────

function toYesNo(v: string | null | undefined, field: string): "Yes" | "No" {
  if (v === undefined || v === null) {
    throw new NormalizationError(field, "missing required Yes/No value");
  }
  const s = v.toLowerCase().trim();
  if (s === "yes" || s === "y" || s === "true" || s === "1") return "Yes";
  if (s === "no" || s === "n" || s === "false" || s === "0") return "No";
  throw new NormalizationError(field, `unrecognized Yes/No value: "${v}"`);
}

function toFvSex(seedSex: string | null | undefined, field: string): "F" | "M" | "X" {
  if (!seedSex) throw new NormalizationError(field, "missing sex");
  const s = seedSex.toLowerCase().trim();
  if (s === "male" || s === "m") return "M";
  if (s === "female" || s === "f") return "F";
  if (s === "other" || s === "x" || s === "unspecified") return "X";
  throw new NormalizationError(field, `unrecognized sex value: "${seedSex}"`);
}

/**
 * VIZA civil_status seed values → France-Visas enum.
 * Seed values derived from Schengen Visa Code Annex I field 10.
 */
const CIVIL_STATUS_MAP: Record<string, FvStep2Answers["maritalStatus"]> = {
  single: "CEL",
  married: "MAR",
  divorced: "DIV",
  separated: "SEP",
  widowed: "VEU",
  widower: "VEU",
  partnership: "PAC",
  registered_partnership: "PAC",
  civil_partnership: "PAC",
  other: "AUT",
};
function toFvCivilStatus(v: string | null | undefined, field: string): FvStep2Answers["maritalStatus"] {
  if (!v) throw new NormalizationError(field, "missing civil_status");
  const mapped = CIVIL_STATUS_MAP[v.toLowerCase().trim()];
  if (!mapped) throw new NormalizationError(field, `unrecognized civil_status: "${v}"`);
  return mapped;
}

/**
 * VIZA travel_document_type seed values → France-Visas type code.
 * Seed options per Annex I field 11.
 */
const TRAVEL_DOC_MAP: Record<string, string> = {
  ordinary_passport: "10",
  ordinary: "10",
  passport: "10",
  diplomatic_passport: "30",
  service_passport: "40",
  official_passport: "40",
  seafarer_id_certificate: "152",
  seamans_id: "152",
  seafarer_passport: "310",
  public_affairs_passport: "340",
  travel_document: "440",
  permit_for_entry: "490",
  other: "440",
};
function toFvTravelDocument(v: string | null | undefined, field: string): string {
  if (!v) throw new NormalizationError(field, "missing travel_document_type");
  const mapped = TRAVEL_DOC_MAP[v.toLowerCase().trim()];
  if (!mapped) throw new NormalizationError(field, `unrecognized travel_document_type: "${v}"`);
  return mapped;
}

/**
 * VIZA purpose seed values → France-Visas purposeCategory + purpose pair.
 * Seed `purpose_of_journey` uses tourism/business/etc. labels; FV uses
 * ETAR/VISF/ETAC/VOFF/TRAV/MEDI/TOUR/ETUD codes for the category and
 * a second-level code for the specific purpose.
 */
const PURPOSE_CATEGORY_MAP: Record<string, string> = {
  tourism: "TOUR",
  business: "TRAV",
  visiting_family_friends: "VISF",
  family_or_private_visit: "VISF",
  cultural: "VOFF",
  sports: "VOFF",
  official_visit: "VOFF",
  medical: "MEDI",
  study: "ETUD",
  airport_transit: "TOUR", // FR routes transit through step 1 stayDuration=A
  other: "ETAR",
};
function toFvPurposeCategory(v: string | null | undefined, field: string): string {
  if (!v) throw new NormalizationError(field, "missing purpose_of_journey");
  const mapped = PURPOSE_CATEGORY_MAP[v.toLowerCase().trim()];
  if (!mapped) throw new NormalizationError(field, `unrecognized purpose_of_journey: "${v}"`);
  return mapped;
}

// ──────────────────────────────────────────────────────────────────────────────
// Country-code mapping (ISO-3166-1 alpha-2 → alpha-3).
//
// France-Visas uses alpha-3 throughout; the seed uses alpha-2 per its
// `validation_rules: { source: "ISO3166-1" }`. This table covers the 200+
// countries the FV dropdowns accept. Unknown codes throw NormalizationError
// — the caller must fix the applicant data rather than guess.
// ──────────────────────────────────────────────────────────────────────────────

const A2_TO_A3: Record<string, string> = {
  AF: "AFG", AL: "ALB", DZ: "DZA", AS: "ASM", AD: "AND", AO: "AGO", AG: "ATG",
  AR: "ARG", AM: "ARM", AU: "AUS", AT: "AUT", AZ: "AZE", BS: "BHS", BH: "BHR",
  BD: "BGD", BB: "BRB", BY: "BLR", BE: "BEL", BZ: "BLZ", BJ: "BEN", BT: "BTN",
  BO: "BOL", BA: "BIH", BW: "BWA", BR: "BRA", BN: "BRN", BG: "BGR", BF: "BFA",
  BI: "BDI", KH: "KHM", CM: "CMR", CA: "CAN", CV: "CPV", CF: "CAF", TD: "TCD",
  CL: "CHL", CN: "CHN", CO: "COL", KM: "COM", CG: "RCB", CD: "COD", CR: "CRI",
  CI: "CIV", HR: "HRV", CU: "CUB", CY: "CYP", CZ: "CZE", DK: "DNK", DJ: "DJI",
  DM: "DMA", DO: "DOM", EC: "ECU", EG: "EGY", SV: "SLV", GQ: "GNQ", ER: "ERI",
  EE: "EST", SZ: "SWZ", ET: "ETH", FJ: "FJI", FI: "FIN", FR: "FRA", GA: "GAB",
  GM: "GMB", GE: "GEO", DE: "DEU", GH: "GHA", GR: "GRC", GD: "GRD", GT: "GTM",
  GN: "GIN", GW: "GNB", GY: "GUY", HT: "HTI", HN: "HND", HK: "HKG", HU: "HUN",
  IS: "ISL", IN: "IND", ID: "IDN", IR: "IRN", IQ: "IRQ", IE: "IRL", IL: "ISR",
  IT: "ITA", JM: "JAM", JP: "JPN", JO: "JOR", KZ: "KAZ", KE: "KEN", KI: "KIR",
  KP: "PRK", KR: "KOR", XK: "KOS", KW: "KWT", KG: "KGZ", LA: "LAO", LV: "LVA",
  LB: "LBN", LS: "LSO", LR: "LBR", LY: "LBY", LI: "LIE", LT: "LTU", LU: "LUX",
  MO: "MAC", MG: "MDG", MW: "MWI", MY: "MYS", MV: "MDV", ML: "MLI", MT: "MLT",
  MH: "MHL", MR: "MRT", MU: "MUS", MX: "MEX", FM: "FSM", MD: "MDA", MC: "MCO",
  MN: "MNG", ME: "MNE", MA: "MAR", MZ: "MOZ", MM: "MMR", NA: "NAM", NR: "NRU",
  NP: "NPL", NL: "NLD", NZ: "NZL", NI: "NIC", NE: "NER", NG: "NGA", MK: "MKD",
  NO: "NOR", OM: "OMN", PK: "PAK", PW: "PLW", PS: "PSE", PA: "PAN", PG: "PNG",
  PY: "PRY", PE: "PER", PH: "PHL", PL: "POL", PT: "PRT", QA: "QAT", RO: "ROU",
  RU: "RUS", RW: "RWA", KN: "KNA", LC: "LCA", VC: "VCT", WS: "WSM", SM: "SMR",
  ST: "STP", SA: "SAU", SN: "SEN", RS: "SRB", SC: "SYC", SL: "SLE", SG: "SGP",
  SK: "SVK", SI: "SVN", SB: "SLB", SO: "SOM", ZA: "ZAF", SS: "SSD", ES: "ESP",
  LK: "LKA", SD: "SDN", SR: "SUR", SE: "SWE", CH: "CHE", SY: "SYR", TW: "TWN",
  TJ: "TJK", TZ: "TZA", TH: "THA", TL: "TLS", TG: "TGO", TO: "TON", TT: "TTO",
  TN: "TUN", TR: "TUR", TM: "TKM", TV: "TUV", UG: "UGA", UA: "UKR", AE: "ARE",
  GB: "GBR", US: "USA", UY: "URY", UZ: "UZB", VU: "VUT", VA: "VAT", VE: "VEN",
  VN: "VNM", YE: "YEM", ZM: "ZMB", ZW: "ZWE",
};

const COUNTRY_NAME_TO_A3: Record<string, string> = {
  china: "CHN",
  "people's republic of china": "CHN",
  prc: "CHN",
  中国: "CHN",
  france: "FRA",
  "french republic": "FRA",
  法国: "FRA",
};

export function toFvCountryCode(code: string | null | undefined, field: string): string {
  if (!code) throw new NormalizationError(field, "missing country code");
  const s = code.trim().toUpperCase();
  // Already alpha-3? Pass through if present in the A3 codomain.
  if (s.length === 3 && Object.values(A2_TO_A3).includes(s)) return s;
  // Alpha-2 → alpha-3 lookup.
  if (s.length === 2) {
    const mapped = A2_TO_A3[s];
    if (mapped) return mapped;
  }
  const nameMapped = COUNTRY_NAME_TO_A3[code.trim().toLowerCase()];
  if (nameMapped) return nameMapped;
  throw new NormalizationError(field, `unrecognized country code "${code}"`);
}

// ──────────────────────────────────────────────────────────────────────────────
// Date normalization
// ──────────────────────────────────────────────────────────────────────────────

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const SLASH_DATE_DMY = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

export function toFvDate(v: string | null | undefined, field: string): string {
  if (!v) throw new NormalizationError(field, "missing date");
  const s = v.trim();
  const iso = ISO_DATE_RE.exec(s);
  if (iso) {
    const [, y, m, d] = iso;
    return `${d}/${m}/${y}`;
  }
  const slash = SLASH_DATE_DMY.exec(s);
  if (slash) {
    const [, d, m, y] = slash;
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
  }
  throw new NormalizationError(field, `unrecognized date format "${v}" (expected YYYY-MM-DD or DD/MM/YYYY)`);
}

function splitDateParts(
  v: string | null | undefined,
  field: string,
): { day: string; month: string; year: string } {
  const fv = toFvDate(v, field);
  const [day, month, year] = fv.split("/");
  return { day, month, year };
}

// ──────────────────────────────────────────────────────────────────────────────
// Occupation — seed is free-text; FV is a 37-entry enum.
// We expose a minimal curated mapping and fall back to "other" (65005) if the
// applicant's profession isn't in the taxonomy. Callers can override via a
// supplied table if the frontend collects a closer enum.
// ──────────────────────────────────────────────────────────────────────────────

const OCCUPATION_MAP: Record<string, string> = {
  student: "69005",
  trainee: "69005",
  teacher: "69004",
  researcher: "67004",
  scientist: "67004",
  employee: "69002",
  manual_worker: "79001",
  engineer: "73001",
  software_engineer: "73001",
  computer_engineer: "73001",
  electronics_engineer: "69001",
  journalist: "74001",
  judge: "77001",
  lawyer: "80003",
  diplomat: "68001",
  police: "80002",
  military: "80002",
  civil_servant: "70001",
  company_executive: "67001",
  company_director: "67003",
  politician: "72001",
  retired: "82001",
  unemployed: "67006",
  no_profession: "83001",
  banker: "66001",
  farmer: "65001",
  artist: "65004",
  architect: "65002",
  artisan: "65003",
  driver: "67002",
  shopkeeper: "67008",
  sailor: "77002",
  sportsperson: "83002",
  clergy: "67007",
  doctor: "80005",
  nurse: "80005",
  medical: "80005",
  chemist: "67005",
  fashion: "77003",
  other: "65005",
};
function toFvOccupation(v: string | null | undefined): string {
  if (!v) return "65005"; // default to "Other"
  return OCCUPATION_MAP[v.toLowerCase().trim()] ?? "65005";
}

// ──────────────────────────────────────────────────────────────────────────────
// Entrypoint
// ──────────────────────────────────────────────────────────────────────────────

export interface NormalizeInput {
  /** Flat field_name → value map. Use buildAnswerMap(). */
  answers: AnswerMap;
  /** The applicant profile (fallback source for contact info). */
  profile: ApplicantProfile;
  /** The application row (fallback for trip dates, accommodation). */
  application: Application;
  /**
   * FV-specific values the frontend can NOT derive from the seed alone:
   * submission country (where the applicant will file — usually their
   * country of residence but the applicant chooses a consulate/VAC city),
   * destination, city of submission, and the resolved `purpose` sub-code.
   */
  fvOverrides: {
    /** ISO-3 country where the applicant will submit. */
    depositCountry: string;
    /** FV town code (e.g. "1PE" for Beijing). Must match the deposit-country
     *  cascade output — the frontend should fetch this list from FV. */
    depositTown: string;
    /** ISO-3 passport-issuing authority (default: same as current_nationality). */
    authority?: string;
    /** Main destination code — "MET"=France mainland by default. */
    destination?: string;
    /** Second-level purpose code (depends on purposeCategory). */
    purpose: string;
    /** Occupation override if the frontend collects a specific FV code. */
    occupationCode?: string;
    /** Business segment override if occupation gates employer fields on. */
    businessSegment?: string;
    /** Step 5 host / funding structure — frontend-owned. */
    step5?: Partial<FvStep5Answers>;
  };
}

/**
 * Normalize a full answer set to France-Visas wire format. Throws
 * `NormalizationError` on any unrecognized value.
 */
export function normalizeFvAnswers(input: NormalizeInput): FvApplicationAnswers {
  const { answers: a, profile, application, fvOverrides } = input;

  const nationality = toFvCountryCode(a.current_nationality, "current_nationality");
  const depositCountry = fvOverrides.depositCountry;
  const authority = fvOverrides.authority ?? nationality;
  const destination = fvOverrides.destination ?? "MET";

  const step1: FvStep1Answers = {
    nationality,
    // Seed key: has_eu_family_member (radio Yes/No) — Annex I 17-18.
    hasNationalFamily: toYesNo(a.has_eu_family_member ?? "no", "has_eu_family_member"),
    depositCountry,
    stayDuration: "C",
    destination,
    depositTown: fvOverrides.depositTown,
    authority,
    travelDocument: toFvTravelDocument(a.travel_document_type, "travel_document_type"),
    travelDocumentNumber: requireStr(a.travel_document_number ?? profile.passport_number, "travel_document_number"),
    releaseDate: toFvDate(a.travel_document_issue_date ?? profile.passport_issue_date, "travel_document_issue_date"),
    expirationDate: toFvDate(a.travel_document_expiry_date ?? profile.passport_expiry_date, "travel_document_expiry_date"),
    purposeCategory: toFvPurposeCategory(a.purpose_of_journey, "purpose_of_journey"),
    purpose: fvOverrides.purpose,
  };

  const dob = splitDateParts(a.date_of_birth ?? profile.date_of_birth, "date_of_birth");

  const rawOccupation = a.current_occupation ?? profile.occupation;
  const occupation = fvOverrides.occupationCode ?? toFvOccupation(rawOccupation);

  const step2: FvStep2Answers = {
    sex: toFvSex(a.sex ?? profile.gender, "sex"),
    maritalStatus: toFvCivilStatus(a.civil_status, "civil_status"),
    surname: requireStr(a.surname ?? profile.full_name?.split(" ").pop(), "surname"),
    surnameAtBirth: a.surname_at_birth ?? undefined,
    firstnames: requireStr(a.given_names ?? profile.full_name?.split(" ").slice(0, -1).join(" "), "given_names"),
    dayOfBirth: dob.day,
    monthOfBirth: dob.month,
    yearOfBirth: dob.year,
    placeOfBirth: requireStr(a.place_of_birth ?? profile.place_of_birth, "place_of_birth"),
    countryOfBirth: toFvCountryCode(a.country_of_birth, "country_of_birth"),
    nationalityOfBirth: toFvCountryCode(a.nationality_at_birth ?? a.current_nationality, "nationality_at_birth"),
    idCardNumber: a.national_id_number ?? undefined,
    // Seed: home_address_line_1 (line 2 is optional; we ignore for FV which has 1 line).
    street: requireStr(a.home_address_line_1 ?? profile.address, "home_address_line_1"),
    zipcode: a.home_address_postcode ?? undefined,
    place: requireStr(a.home_address_city, "home_address_city"),
    country: toFvCountryCode(a.home_address_country ?? a.current_nationality, "home_address_country"),
    // Seed key is `phone_number` (not `telephone`).
    phoneNumber: requireStr(a.phone_number ?? profile.phone, "phone_number"),
    email: requireStr(a.email_address ?? profile.email, "email_address"),
    // Seed: residence_country_different (radio Yes/No, asks if applicant resides in a country
    // other than nationality). Direct semantic match for FV's radioNotResident.
    radioNotResident: toYesNo(a.residence_country_different ?? "no", "residence_country_different"),
    // FV-specific: "Do you have a French family member?" — not in the harmonized seed.
    // Frontend should collect it under `fv_has_french_family`; default No.
    radioHasFrenchFamily: toYesNo(a.fv_has_french_family ?? "no", "fv_has_french_family"),
    radioHasNationalFamily: toYesNo(a.has_eu_family_member ?? "no", "has_eu_family_member"),
    // Seed key: current_occupation. Free text → mapped to FV enum via toFvOccupation;
    // frontend can override with fv_occupation_code if it collects an FV-native code.
    occupation,
    occupationOtherSpecify: occupation === "65005" && rawOccupation
      ? rawOccupation.trim().toUpperCase()
      : undefined,
    businessSegment: fvOverrides.businessSegment,
    employerName: a.employer_name ?? undefined,
    employerStreet: a.employer_address_line_1 ?? undefined,
    employerPlace: a.employer_city ?? undefined,
    employerCountry: a.employer_country ? toFvCountryCode(a.employer_country, "employer_country") : undefined,
    employerPhone: a.employer_phone ?? undefined,
    employerEmail: a.employer_email ?? undefined,
  };

  // Seed step 10 (Travel History) names: prior_schengen_visa_5y is a NEW seed
  // entry added to support France's "have you held a Schengen visa in the
  // last 5 years" gate; the seed already has prev_schengen_fingerprints_given
  // (the second-level fingerprints gate) plus prev_fingerprints_date and
  // prev_fingerprints_visa_sticker for the date + biometric-sticker number.
  const hadPriorSchengen = toYesNo(a.prior_schengen_visa_5y ?? "no", "prior_schengen_visa_5y");
  const hasFingerprints = hadPriorSchengen === "Yes"
    ? toYesNo(a.prev_schengen_fingerprints_given ?? "no", "prev_schengen_fingerprints_given")
    : undefined;
  const step3: FvStep3Answers = {
    haveOldSchengenVisas: hadPriorSchengen,
    validVisaStart: hadPriorSchengen === "Yes" && a.prior_schengen_visa_valid_from
      ? toFvDate(a.prior_schengen_visa_valid_from, "prior_schengen_visa_valid_from")
      : undefined,
    validVisaEnd: hadPriorSchengen === "Yes" && a.prior_schengen_visa_valid_to
      ? toFvDate(a.prior_schengen_visa_valid_to, "prior_schengen_visa_valid_to")
      : undefined,
    hasFingerPrints: hasFingerprints,
    dateFingerprints: hasFingerprints === "Yes" && a.prev_fingerprints_date
      ? toFvDate(a.prev_fingerprints_date, "prev_fingerprints_date")
      : undefined,
    numVisaBiometrique: hasFingerprints === "Yes" && a.prev_fingerprints_visa_sticker
      ? a.prev_fingerprints_visa_sticker
      : undefined,
  };

  const step4: FvStep4Answers = {
    // FV-specific: "Will you travel to multiple Schengen destinations?" — not
    // in harmonized seed. Frontend should collect under fv_has_multiple_destinations.
    radioHasSeveralDestination: toYesNo(a.fv_has_multiple_destinations ?? "no", "fv_has_multiple_destinations"),
    dateOfArrival: toFvDate(a.intended_arrival_date ?? application.arrival_date, "intended_arrival_date"),
    dateOfDeparture: toFvDate(a.intended_departure_date ?? application.departure_date, "intended_departure_date"),
    // Seed key: intended_duration_days.
    numberOfDays: requireStr(a.intended_duration_days, "intended_duration_days"),
    // Seed key: number_of_entries_requested. Values per Annex I 26: "1"=single,
    // "2"=two, "M"=multiple. France-Visas only accepts "1" or "M", so we
    // collapse "2" into "M" (multi-entry).
    numberOfEntries: a.number_of_entries_requested === "1" ? "1" : "M",
    // FV-specific: number of stays (defaults to 1; only relevant for multi-entry).
    numberOfStays: a.fv_number_of_stays ?? "1",
    purposeCategory: step1.purposeCategory,
  };

  const step5: FvStep5Answers = {
    cbxHasHostPerson: fvOverrides.step5?.cbxHasHostPerson ?? true,
    cbxHasHostOrganization: fvOverrides.step5?.cbxHasHostOrganization ?? false,
    cbxHasPlaceOfApplication: fvOverrides.step5?.cbxHasPlaceOfApplication ?? false,
    cbxHasAutoFunding: fvOverrides.step5?.cbxHasAutoFunding ?? true,
    cbxHasGuarantor: fvOverrides.step5?.cbxHasGuarantor ?? false,
    hostPersonSurname: fvOverrides.step5?.hostPersonSurname ?? application.accommodation_name ?? undefined,
    hostPersonAddress: fvOverrides.step5?.hostPersonAddress ?? application.accommodation_address ?? undefined,
    hostPersonCountry: fvOverrides.step5?.hostPersonCountry,
    hostPersonFirstnames: fvOverrides.step5?.hostPersonFirstnames,
    hostPersonZipcode: fvOverrides.step5?.hostPersonZipcode,
    hostPersonPlace: fvOverrides.step5?.hostPersonPlace,
    hostPersonPhone: fvOverrides.step5?.hostPersonPhone,
    hostPersonEmail: fvOverrides.step5?.hostPersonEmail,
    autoFundings: (fvOverrides.step5?.autoFundings as readonly FvAutoFunding[] | undefined)?.slice() ?? ["CCR", "ARG"],
    representativeSurname: fvOverrides.step5?.representativeSurname,
    representativeFirstnames: fvOverrides.step5?.representativeFirstnames,
    representativeStreet: fvOverrides.step5?.representativeStreet,
    representativeZipcode: fvOverrides.step5?.representativeZipcode,
    representativePlace: fvOverrides.step5?.representativePlace,
    representativeCountry: fvOverrides.step5?.representativeCountry,
    representativePhone: fvOverrides.step5?.representativePhone,
    representativeEmail: fvOverrides.step5?.representativeEmail,
  };

  return { step1, step2, step3, step4, step5 };
}

function requireStr(v: string | null | undefined, field: string): string {
  if (!v || v.trim().length === 0) {
    throw new NormalizationError(field, "missing required value");
  }
  return v.trim();
}
