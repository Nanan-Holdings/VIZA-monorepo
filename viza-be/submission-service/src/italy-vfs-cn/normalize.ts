/**
 * Normalize harmonized Schengen seed answers (`EU_SCHENGEN_C_SHORT_STAY`)
 * into the VFS Global Italy China corridor wire format.
 *
 * Input shape: the flat answer map produced by VIZA's seed flow —
 * `Record<field_name, string>` keyed by `visa_form_fields.field_name`.
 *
 * Output shape: a per-page typed answer object (`ItVfsAnswers`) consumed
 * by the per-page fill helpers in `fill-steps.ts` (TBD post-walk).
 *
 * The actual field-level mappings are scaffolded but not exhaustive —
 * the live recon walk will tighten them. Anything currently in
 * `TODO(walk)` is conjectural.
 */

import { CorridorIneligibleError } from "./errors";

export type AnswerMap = Record<string, string | undefined>;

export interface ItVfsAnswers {
  personal: ItVfsPersonalAnswers;
  travelDocument: ItVfsTravelDocumentAnswers;
  contact: ItVfsContactAnswers;
  occupation: ItVfsOccupationAnswers;
  trip: ItVfsTripAnswers;
  accommodation: ItVfsAccommodationAnswers;
  travelHistory: ItVfsTravelHistoryAnswers;
  cost: ItVfsCostAnswers;
}

export interface ItVfsPersonalAnswers {
  surname: string;
  surnameAtBirth: string | null;
  givenNames: string;
  dateOfBirth: string;
  placeOfBirthCity: string;
  placeOfBirthCountry: string;
  currentNationality: string;
  nationalityAtBirth: string | null;
  sex: "M" | "F" | "X" | null;
  maritalStatus: string | null;
}

export interface ItVfsTravelDocumentAnswers {
  type: string;
  number: string;
  issueDate: string;
  expiryDate: string;
  issuingCountry: string;
  nationalId: string | null;
}

export interface ItVfsContactAnswers {
  homeAddressLine1: string;
  homeAddressLine2: string | null;
  homeAddressCity: string;
  homeAddressPostalCode: string;
  homeAddressCountry: string;
  email: string;
  phone: string;
}

export interface ItVfsOccupationAnswers {
  occupation: string;
  employerName: string | null;
  employerAddress: string | null;
  employerPhone: string | null;
}

export interface ItVfsTripAnswers {
  purpose: string;
  countryOfMainDestination: string;
  memberStateOfFirstEntry: string;
  numberOfEntriesRequested: "ONE" | "TWO" | "MULTIPLE";
  intendedArrivalDate: string;
  intendedDepartureDate: string;
  durationOfStayDays: number;
}

export interface ItVfsAccommodationAnswers {
  type: string;
  hotelName: string | null;
  hotelAddress: string | null;
  hotelPhone: string | null;
  hotelEmail: string | null;
  hotelConfirmationNumber: string | null;
}

export interface ItVfsTravelHistoryAnswers {
  priorSchengenVisa5y: boolean;
  priorSchengenVisaValidFrom: string | null;
  priorSchengenVisaValidTo: string | null;
  fingerprintsGiven: boolean;
  fingerprintsDate: string | null;
  fingerprintsVisaSticker: string | null;
}

export interface ItVfsCostAnswers {
  costBorneBy: "SELF" | "SPONSOR" | "OTHER";
  selfMeans: ItVfsCostMeans | null;
  sponsorRelationship: string | null;
  sponsorMeans: ItVfsCostMeans | null;
}

export interface ItVfsCostMeans {
  cash: boolean;
  travellerCheques: boolean;
  creditCard: boolean;
  prepaidAccommodation: boolean;
  prepaidTransport: boolean;
  other: string | null;
}

export interface NormalizeInput {
  answers: AnswerMap;
  applicantResidencyCountry: string;
  destinationCountry: string;
}

const VFS_CN_RESIDENCY = "CN";
const VFS_CN_DESTINATION = "IT";

/**
 * Pre-flight: verify the applicant matches this corridor before any
 * browser work is done. Raises `CorridorIneligibleError` on mismatch so
 * the dispatcher can route to a different adapter (e.g. France-Visas).
 */
export function assertCorridorEligible(input: NormalizeInput): void {
  const resCountry = (input.applicantResidencyCountry || "").trim().toUpperCase();
  const destCountry = (input.destinationCountry || "").trim().toUpperCase();

  if (resCountry !== VFS_CN_RESIDENCY) {
    throw new CorridorIneligibleError(
      `Italy-VFS-CN corridor requires residency=CN; got ${resCountry || "<unset>"}`,
      { details: { applicantResidencyCountry: resCountry, expected: VFS_CN_RESIDENCY } },
    );
  }
  if (destCountry !== VFS_CN_DESTINATION) {
    throw new CorridorIneligibleError(
      `Italy-VFS-CN corridor requires destination=IT; got ${destCountry || "<unset>"}`,
      { details: { destinationCountry: destCountry, expected: VFS_CN_DESTINATION } },
    );
  }
}

/**
 * Normalize a flat answer map into the corridor's structured input.
 *
 * TODO(walk): this is a draft mapping based on the harmonized seed
 * field names — confirm field-by-field against the live VFS DOM and
 * tighten enum mappings (sex, marital_status, purpose, cost_borne_by).
 */
export function normalizeItVfsAnswers(input: NormalizeInput): ItVfsAnswers {
  assertCorridorEligible(input);
  const a = input.answers;

  return {
    personal: {
      surname: req(a, "surname"),
      surnameAtBirth: opt(a, "surname_at_birth"),
      givenNames: req(a, "given_names"),
      dateOfBirth: req(a, "date_of_birth"),
      placeOfBirthCity: req(a, "place_of_birth_city"),
      placeOfBirthCountry: toIso2(req(a, "place_of_birth_country")),
      currentNationality: toIso2(req(a, "current_nationality")),
      nationalityAtBirth: optIso2(a, "nationality_at_birth"),
      sex: mapSex(a.sex),
      maritalStatus: opt(a, "marital_status"),
    },
    travelDocument: {
      type: req(a, "travel_document_type"),
      number: req(a, "travel_document_number"),
      issueDate: req(a, "travel_document_issue_date"),
      expiryDate: req(a, "travel_document_expiry_date"),
      issuingCountry: toIso2(req(a, "travel_document_issuing_country")),
      nationalId: opt(a, "national_id"),
    },
    contact: {
      homeAddressLine1: req(a, "home_address_line1"),
      homeAddressLine2: opt(a, "home_address_line2"),
      homeAddressCity: req(a, "home_address_city"),
      homeAddressPostalCode: req(a, "home_address_postal_code"),
      homeAddressCountry: toIso2(req(a, "home_address_country")),
      email: req(a, "email"),
      phone: req(a, "phone"),
    },
    occupation: {
      occupation: req(a, "current_occupation"),
      employerName: opt(a, "employer_name"),
      employerAddress: opt(a, "employer_address"),
      employerPhone: opt(a, "employer_phone"),
    },
    trip: {
      purpose: req(a, "purpose_of_journey"),
      countryOfMainDestination: toIso2(req(a, "country_of_main_destination")),
      memberStateOfFirstEntry: toIso2(req(a, "member_state_of_first_entry")),
      numberOfEntriesRequested: mapNumberOfEntries(req(a, "number_of_entries_requested")),
      intendedArrivalDate: req(a, "intended_arrival_date"),
      intendedDepartureDate: req(a, "intended_departure_date"),
      durationOfStayDays: parseIntStrict(req(a, "duration_of_intended_stay_days")),
    },
    accommodation: {
      type: req(a, "accommodation_type"),
      hotelName: opt(a, "hotel_name"),
      hotelAddress: opt(a, "hotel_address"),
      hotelPhone: opt(a, "hotel_phone"),
      hotelEmail: opt(a, "hotel_email"),
      hotelConfirmationNumber: opt(a, "hotel_confirmation_number"),
    },
    travelHistory: {
      priorSchengenVisa5y: toBool(a.prior_schengen_visa_5y),
      priorSchengenVisaValidFrom: opt(a, "prior_schengen_visa_valid_from"),
      priorSchengenVisaValidTo: opt(a, "prior_schengen_visa_valid_to"),
      fingerprintsGiven: toBool(a.prev_schengen_fingerprints_given),
      fingerprintsDate: opt(a, "prev_fingerprints_date"),
      fingerprintsVisaSticker: opt(a, "prev_fingerprints_visa_sticker"),
    },
    cost: buildCostAnswers(a),
  };
}

function buildCostAnswers(a: AnswerMap): ItVfsCostAnswers {
  const borne = mapCostBorneBy(req(a, "cost_borne_by"));
  return {
    costBorneBy: borne,
    selfMeans:
      borne === "SELF"
        ? {
            cash: toBool(a.self_means_cash),
            travellerCheques: toBool(a.self_means_traveller_cheques),
            creditCard: toBool(a.self_means_credit_card),
            prepaidAccommodation: toBool(a.self_means_prepaid_accommodation),
            prepaidTransport: toBool(a.self_means_prepaid_transport),
            other: opt(a, "self_means_other"),
          }
        : null,
    sponsorRelationship: borne === "SPONSOR" ? opt(a, "sponsor_relationship") : null,
    sponsorMeans:
      borne === "SPONSOR"
        ? {
            cash: toBool(a.sponsor_means_cash),
            travellerCheques: false,
            creditCard: false,
            prepaidAccommodation: toBool(a.sponsor_means_accommodation),
            prepaidTransport: toBool(a.sponsor_means_transport),
            other: opt(a, "sponsor_means_other"),
          }
        : null,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────

function req(a: AnswerMap, key: string): string {
  const v = a[key];
  if (v === undefined || v === "") {
    throw new Error(`Missing required answer: ${key}`);
  }
  return v;
}

function opt(a: AnswerMap, key: string): string | null {
  const v = a[key];
  return v === undefined || v === "" ? null : v;
}

function optIso2(a: AnswerMap, key: string): string | null {
  const v = opt(a, key);
  return v === null ? null : toIso2(v);
}

function toIso2(value: string): string {
  return value.trim().toUpperCase().slice(0, 2);
}

function toBool(value: string | undefined): boolean {
  if (value === undefined) return false;
  const v = value.trim().toLowerCase();
  return v === "yes" || v === "true" || v === "1";
}

function parseIntStrict(value: string): number {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) {
    throw new Error(`Expected integer, got: ${value}`);
  }
  return n;
}

function mapSex(value: string | undefined): "M" | "F" | "X" | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (v === "male" || v === "m") return "M";
  if (v === "female" || v === "f") return "F";
  if (v === "other" || v === "x" || v === "indeterminate") return "X";
  return null;
}

function mapNumberOfEntries(value: string): "ONE" | "TWO" | "MULTIPLE" {
  const v = value.trim().toLowerCase();
  if (v === "single" || v === "one" || v === "1") return "ONE";
  if (v === "two" || v === "2") return "TWO";
  if (v === "multiple" || v === "m") return "MULTIPLE";
  throw new Error(`Unrecognized number_of_entries_requested: ${value}`);
}

function mapCostBorneBy(value: string): "SELF" | "SPONSOR" | "OTHER" {
  const v = value.trim().toLowerCase();
  if (v === "self" || v === "applicant") return "SELF";
  if (v === "sponsor" || v === "other_person" || v === "host") return "SPONSOR";
  return "OTHER";
}
