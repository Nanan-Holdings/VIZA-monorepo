/**
 * VIZA answer-set → France-Visas field values.
 *
 * The automation layer expects a flat `Record<string, string>` where each key
 * maps to a field in `FV_STEP{N}_FIELDS` (keys match the TypeScript object
 * keys like `nationality`, `maritalStatus`, `travelDocumentNumber`).
 *
 * Translating free-form applicant data (e.g. "Chinese" → "CHN", DOB ISO string
 * → dd/MM/yyyy) should happen in a higher layer (frontend, Supabase view, or
 * an explicit normalizer). This file defines only the wire contract.
 */

import type { FvAutoFunding } from "./selectors";

/**
 * Fields relevant to France-Visas step 1. Values must already be in the
 * France-Visas wire format (ISO-3 country codes, Visa Type enum, etc.).
 */
export interface FvStep1Answers {
  /** ISO-3 nationality code, e.g. "CHN". */
  nationality: string;
  /** "Yes" or "No" (radio). */
  hasNationalFamily: "Yes" | "No";
  /** ISO-3 submission country code. */
  depositCountry: string;
  /** "C"=Short-stay, "D"=Long-stay, "A"=Airport transit. Scope is "C". */
  stayDuration: "C" | "D" | "A";
  /** Destination code — "MET"=France mainland, "MCO"=Monaco, etc. */
  destination: string;
  /** FV internal town code (e.g. "1PE" for Beijing). Depends on depositCountry. */
  depositTown: string;
  /** ISO-3 passport-issuing authority country. */
  authority: string;
  /** Travel document type — "10"=Ordinary passport, etc. */
  travelDocument: string;
  /** Passport number (max 20). */
  travelDocumentNumber: string;
  /** dd/MM/yyyy — passport issue date. */
  releaseDate: string;
  /** dd/MM/yyyy — passport expiry date. */
  expirationDate: string;
  /** Purpose category enum, e.g. "TOUR". */
  purposeCategory: string;
  /** Specific purpose value (depends on purposeCategory). */
  purpose: string;
}

export interface FvStep2Answers {
  sex: "F" | "M" | "X";
  maritalStatus: "DIV" | "MAR" | "AUT" | "PAC" | "SEP" | "CEL" | "VEU";
  surname: string;
  surnameAtBirth?: string;
  firstnames: string;
  dayOfBirth: string;  // 01-31
  monthOfBirth: string; // 01-12
  yearOfBirth: string;  // 4-digit
  placeOfBirth: string;
  countryOfBirth: string;   // ISO-3
  nationalityOfBirth: string; // ISO-3
  idCardNumber?: string;
  street: string;
  zipcode?: string;
  place: string;
  country: string; // ISO-3 country of residence
  phoneNumber: string;
  email: string;
  radioNotResident: "Yes" | "No";
  radioHasFrenchFamily: "Yes" | "No";
  radioHasNationalFamily: "Yes" | "No";
  occupation: string;
  /** Required by France-Visas when occupation is "Other" (65005). */
  occupationOtherSpecify?: string;
  /** Present iff occupation reveals the employer subsection. */
  businessSegment?: string;
  employerName?: string;
  employerStreet?: string;
  employerPlace?: string;
  employerCountry?: string; // ISO-3
  employerPhone?: string;
  employerEmail?: string;
}

export interface FvStep3Answers {
  haveOldSchengenVisas: "Yes" | "No";
  // Required when haveOldSchengenVisas === "Yes":
  validVisaStart?: string;   // dd/MM/yyyy — last Schengen visa start
  validVisaEnd?: string;     // dd/MM/yyyy — last Schengen visa end
  hasFingerPrints?: "Yes" | "No";
  // Optional / required when hasFingerPrints === "Yes":
  dateFingerprints?: string;      // dd/MM/yyyy — optional, last fingerprint capture date
  numVisaBiometrique?: string;    // required — biometric visa number, format <XXX><000000000>
}

export interface FvStep4Answers {
  radioHasSeveralDestination: "Yes" | "No";
  dateOfArrival: string;   // dd/MM/yyyy
  dateOfDeparture: string; // dd/MM/yyyy
  numberOfDays: string;
  /** "1"=single entry, "M"=multiple entries (misleadingly named `applicant-country`). */
  numberOfEntries: "1" | "M";
  numberOfStays: string;
  purposeCategory: string;
}

export interface FvStep5Answers {
  // At least one of cbxHasHostPerson / cbxHasHostOrganization / cbxHasPlaceOfApplication
  // must be set to true for validation to pass.
  cbxHasHostPerson: boolean;
  cbxHasHostOrganization: boolean;
  cbxHasPlaceOfApplication: boolean;
  cbxHasAutoFunding: boolean;
  cbxHasGuarantor: boolean;

  // Required iff cbxHasHostPerson
  hostPersonSurname?: string;
  hostPersonFirstnames?: string;
  hostPersonAddress?: string;
  hostPersonZipcode?: string;
  hostPersonPlace?: string;
  hostPersonCountry?: string; // ISO-3
  hostPersonPhone?: string;
  hostPersonEmail?: string;

  // Required iff cbxHasAutoFunding — at least one funding method must be selected.
  autoFundings?: FvAutoFunding[];

  // Optional representative info (if someone else is filling the form)
  representativeSurname?: string;
  representativeFirstnames?: string;
  representativeStreet?: string;
  representativeZipcode?: string;
  representativePlace?: string;
  representativeCountry?: string;
  representativePhone?: string;
  representativeEmail?: string;
}

/** Full France-Visas answer set across all 5 form steps. */
export interface FvApplicationAnswers {
  step1: FvStep1Answers;
  step2: FvStep2Answers;
  step3: FvStep3Answers;
  step4: FvStep4Answers;
  step5: FvStep5Answers;
}
