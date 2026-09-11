/**
 * DS-160 End-to-End Completeness Verification
 *
 * Verifies that a fully completed simplified form yields a DS-160-complete
 * answer set in storage and aligns with the backend autofill mappings.
 *
 * Run: npx tsx src/ds160-completeness-verify.ts
 *
 * US-020: Verify end-to-end DS-160 completeness from simplified intake to backend answer set
 */

import {
  ds160PersonalInfoMappings,
  ds160TravelMappings,
  ds160PassportMappings,
  ds160ContactMappings,
  ds160WorkMappings,
} from "./ds160-form-mappings";
import { deriveDS160Answers } from "./ds160-derive-answers";
import { findMissingDs160SecurityBackgroundAnswers } from "./ceac/security-background";
import { findMissingDs160WorkAdditionalAnswers } from "./ceac/work-education-additional";

// ═══════════════════════════════════════════════════════════════════════════════
// 1. COMPLETE SIMPLIFIED FORM PAYLOAD (simulates a fully filled form)
// ═══════════════════════════════════════════════════════════════════════════════

/** Simulates PersonalInfoData from the hardcoded PersonalInfoStep */
const SAMPLE_PERSONAL = {
  surname: "ZHANG",
  givenNames: "WEI",
  fullNameNativeAlphabet: "张伟",
  sex: "M",
  maritalStatus: "SINGLE",
  dateOfBirth: "1990-05-15",
  cityOfBirth: "Beijing",
  stateOfBirth: "Beijing",
  countryOfBirth: "China",
  nationality: "China",
};

/** Simulates PassportData from the hardcoded PassportStep */
const SAMPLE_PASSPORT = {
  passportDocumentType: "REGULAR",
  passportNumber: "E12345678",
  passportBookNumber: "B987654",
  passportIssuingCountry: "China",
  passportIssuanceCity: "Beijing",
  passportIssuanceDate: "2020-01-10",
  passportExpirationDate: "2030-01-09",
};

/** Simulates TravelInfoData from the hardcoded TravelInfoStep */
const SAMPLE_TRAVEL = {
  purposeOfTrip: "B1/B2",
  arrivalDate: "2026-07-01",
  departureDate: "2026-07-15",
  arrivalCity: "Los Angeles",
  accommodationName: "Hilton Los Angeles",
  usAddressStreet1: "555 Universal Hollywood Dr",
  usAddressCity: "Los Angeles",
  usAddressState: "CA",
  usAddressZip: "90068",
};

/** Simulates dynamic form answers collected by DynamicStepForm */
const SAMPLE_DYNAMIC: Record<string, string> = {
  // Personal Info (fields not in hardcoded steps)
  national_id_number: "110101199005151234",
  us_social_security_number: "DOES NOT APPLY",
  us_taxpayer_id: "DOES NOT APPLY",
  // Address and Phone
  home_address_line1: "123 Chang'an Ave",
  home_address_line2: "Apt 4B",
  home_address_city: "Beijing",
  home_address_state_province: "Beijing",
  home_address_postal_code: "100000",
  home_address_country: "China",
  mailing_same_as_home: "yes",
  primary_phone: "+86-10-12345678",
  secondary_phone: "does_not_apply",
  work_phone: "+86-10-87654321",
  has_other_phones: "no",
  email_address: "zhang.wei@example.com",
  has_other_emails: "no",
  social_media_platform: "INSTAGRAM",
  social_media_handle: "zhangwei1990",
  has_other_social_media: "no",
  // US Contact
  us_contact_surname: "SMITH",
  us_contact_given_names: "JOHN",
  us_contact_organization: "ABC Corp",
  us_contact_relationship: "BUSINESS ASSOCIATE",
  us_contact_address_street1: "100 Main St",
  us_contact_city: "Los Angeles",
  us_contact_state: "CA",
  us_contact_zip: "90001",
  us_contact_phone: "+1-213-555-0100",
  us_contact_email: "john.smith@abc.com",
  // Family
  father_surname: "ZHANG",
  father_given_names: "GUOQIANG",
  father_date_of_birth: "1960-03-20",
  father_in_us: "no",
  mother_surname: "LI",
  mother_given_names: "MEILING",
  mother_date_of_birth: "1962-08-15",
  mother_in_us: "no",
  has_immediate_us_relatives: "no",
  // Work/Education
  primary_occupation: "BUSINESS",
  employer_name: "XYZ Technology Co.",
  employer_address_line1: "456 Zhongguancun St",
  employer_city: "Beijing",
  employer_state_province: "Beijing",
  employer_postal_code: "100080",
  employer_country: "China",
  employer_phone: "+86-10-55551234",
  job_title: "Software Engineer",
  employment_start_date: "2015-06-01",
  monthly_salary: "30000",
  job_duties: "Software development and system architecture",
  has_attended_education: "yes",
  education_institution_name: "Tsinghua University",
  education_course_of_study: "Computer Science",
  // Previous US Travel
  has_been_in_us: "no",
  has_us_visa: "no",
  has_been_refused: "no",
  immigrant_petition_filed: "no",
  // Security (all "no" for a clean application)
  has_communicable_disease: "no",
  has_physical_mental_disorder: "no",
  is_drug_abuser: "no",
  has_arrest_conviction: "no",
  has_violated_controlled_substance: "no",
  has_prostitution: "no",
  has_money_laundering: "no",
  has_human_trafficking: "no",
  has_aided_human_trafficking: "no",
  has_trafficking_beneficiary: "no",
  intend_espionage: "no",
  intend_terrorist_activity: "no",
  has_provided_terrorist_support: "no",
  is_terrorist_member: "no",
  is_terrorist_family: "no",
  has_genocide: "no",
  has_torture: "no",
  has_extrajudicial_killings: "no",
  has_child_soldier: "no",
  has_religious_freedom_violation: "no",
  has_population_control: "no",
  has_coercive_transplant: "no",
  has_immigration_fraud: "no",
  has_removal_deportation_hearing: "no",
  has_failed_removal_hearing: "no",
  has_overstayed: "no",
  has_removal_order: "no",
  has_withheld_child_custody: "no",
  has_voted_illegally: "no",
  has_renounced_citizenship: "no",
};

// ═══════════════════════════════════════════════════════════════════════════════
// 2. DETERMINISTIC FLATTENING (mirrors ds160-normalize.ts)
// ═══════════════════════════════════════════════════════════════════════════════

function flattenHardcodedSteps(): Record<string, string> {
  const answers: Record<string, string> = {};
  const p = SAMPLE_PERSONAL;
  const pp = SAMPLE_PASSPORT;
  const t = SAMPLE_TRAVEL;

  // Personal
  answers.surname = p.surname;
  answers.given_names = p.givenNames;
  answers.full_name_native_alphabet = p.fullNameNativeAlphabet;
  answers.sex = p.sex;
  answers.marital_status = p.maritalStatus;
  answers.date_of_birth = p.dateOfBirth;
  answers.city_of_birth = p.cityOfBirth;
  answers.state_of_birth = p.stateOfBirth;
  answers.country_of_birth = p.countryOfBirth;
  answers.nationality_country = p.nationality;

  // Passport
  answers.passport_document_type = pp.passportDocumentType;
  answers.passport_number = pp.passportNumber;
  answers.passport_book_number = pp.passportBookNumber;
  answers.passport_issuing_country = pp.passportIssuingCountry;
  answers.passport_issuance_city = pp.passportIssuanceCity;
  answers.passport_issuance_date = pp.passportIssuanceDate;
  answers.passport_expiration_date = pp.passportExpirationDate;

  // Travel
  answers.purpose_of_trip = t.purposeOfTrip;
  answers.arrival_city = t.arrivalCity;
  answers.planned_location = t.accommodationName;
  answers.us_address_street1 = t.usAddressStreet1;
  answers.us_address_street = t.usAddressStreet1; // CEAC autofill alias
  answers.us_address_city = t.usAddressCity;
  answers.us_address_state = t.usAddressState;
  answers.us_address_zip = t.usAddressZip;

  // Date decomposition
  const arrival = new Date(t.arrivalDate);
  answers.arrival_date_day = String(arrival.getDate()).padStart(2, "0");
  answers.arrival_date_month = String(arrival.getMonth() + 1).padStart(2, "0");
  answers.arrival_date_year = String(arrival.getFullYear());
  answers.intended_arrival_date_day = answers.arrival_date_day;
  answers.intended_arrival_date_month = answers.arrival_date_month;
  answers.intended_arrival_date_year = answers.arrival_date_year;
  answers.intended_arrival_date = t.arrivalDate; // CEAC autofill alias (full date)

  const departure = new Date(t.departureDate);
  answers.departure_date_day = String(departure.getDate()).padStart(2, "0");
  answers.departure_date_month = String(departure.getMonth() + 1).padStart(2, "0");
  answers.departure_date_year = String(departure.getFullYear());

  // Length of stay
  const diffDays = Math.round((departure.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24));
  answers.intended_length_of_stay_value = String(diffDays);
  answers.intended_length_of_stay_unit = "D";
  answers.intended_length_of_stay = String(diffDays); // CEAC autofill alias

  return answers;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

interface VerificationResult {
  totalMappedKeys: number;
  coveredByAnswers: number;
  missingKeys: string[];
  coveragePercent: string;
  allCovered: boolean;
}

function hasAnswer(answers: Record<string, string>, key: string): boolean {
  return Boolean(answers[key]?.trim());
}

function isMappedKeySatisfied(
  answers: Record<string, string>,
  mappings: Record<string, unknown>,
  key: string,
): boolean {
  if (hasAnswer(answers, key)) return true;

  if (key.endsWith("_na")) {
    return hasAnswer(answers, key.slice(0, -3));
  }

  const naKey = `${key}_na`;
  return naKey in mappings && answers[naKey] === "Y";
}

export function findMissingWorkIncomeAnswers(
  intakeAnswers: Record<string, string>,
): string[] {
  const answers = deriveDS160Answers({ ...intakeAnswers });
  const missing: string[] = [];

  const requireAnswer = (key: string) => {
    if (!hasAnswer(answers, key)) missing.push(key);
  };
  const requireAnswerOrNa = (key: string) => {
    if (!hasAnswer(answers, key) && answers[`${key}_na`] !== "Y") {
      missing.push(`${key}|${key}_na`);
    }
  };

  requireAnswer("employer_address_city");
  requireAnswerOrNa("employer_address_state");
  requireAnswerOrNa("employer_address_postal");
  requireAnswer("employer_address_country");
  requireAnswer("employment_start_date_day");
  requireAnswer("employment_start_date_month");
  requireAnswer("employment_start_date_year");
  requireAnswerOrNa("monthly_income");

  return missing;
}

const NON_EMPLOYED_OCCUPATIONS = new Set([
  "HOMEMAKER",
  "NOT EMPLOYED",
  "RETIRED",
  "STUDENT",
]);

function normalizedBoolean(value: string | undefined): boolean | null {
  if (/^(Y|YES|TRUE|1)$/i.test(value?.trim() ?? "")) return true;
  if (/^(N|NO|FALSE|0)$/i.test(value?.trim() ?? "")) return false;
  return null;
}

function hasOwnAnswer(answers: Record<string, string>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(answers, key);
}

function parseCompanions(value: string | undefined): Array<Record<string, unknown>> {
  if (!value?.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
      : [];
  } catch {
    return [];
  }
}

function isCompleteStringArray(value: string | undefined): boolean {
  if (!value?.trim()) return false;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.length > 0 && parsed.every(
      (item) => typeof item === "string" && item.trim().length > 0,
    );
  } catch {
    return false;
  }
}

function parseStrictObjectArray(value: string | undefined): Array<Record<string, unknown>> | null {
  if (!value?.trim()) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return null;
    if (!parsed.every((item) => Boolean(item) && typeof item === "object" && !Array.isArray(item))) {
      return null;
    }
    return parsed as Array<Record<string, unknown>>;
  } catch {
    return null;
  }
}

function parseObjectArray(value: string | undefined): Array<Record<string, unknown>> {
  if (!value?.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
      : [];
  } catch {
    return [];
  }
}

/** Runtime gate for every mapped conditional branch before CEAC is touched. */
export function findMissingDs160RuntimeAnswers(
  intakeAnswers: Record<string, string>,
): string[] {
  const answers = deriveDS160Answers({ ...intakeAnswers });
  const missing: string[] = [];

  const requireAnswerOrNa = (key: string) => {
    if (!hasAnswer(answers, key) && answers[`${key}_na`] !== "Y") {
      missing.push(`${key}|${key}_na`);
    }
  };

  requireAnswerOrNa("state_of_birth");
  requireAnswerOrNa("passport_book_number");

  for (const key of [
    "home_address_line1",
    "home_address_city",
    "home_address_country",
    "primary_phone",
    "email_address",
  ]) {
    if (!hasAnswer(answers, key)) missing.push(key);
  }
  requireAnswerOrNa("home_address_state");
  requireAnswerOrNa("home_address_postal");
  requireAnswerOrNa("secondary_phone");
  requireAnswerOrNa("work_phone");

  const mailingSame = normalizedBoolean(answers.mailing_same_as_home);
  if (mailingSame === null) {
    missing.push("mailing_same_as_home");
  } else if (!mailingSame) {
    for (const key of ["mailing_address_line1", "mailing_address_city", "mailing_address_country"]) {
      if (!hasAnswer(answers, key)) missing.push(key);
    }
    requireAnswerOrNa("mailing_address_state");
    requireAnswerOrNa("mailing_address_postal");
  }

  const hasOtherPhones = normalizedBoolean(answers.has_other_phone ?? answers.has_other_phones);
  if (hasOtherPhones === null) {
    missing.push("has_other_phones");
  } else if (hasOtherPhones) {
    const hasCanonicalRows = hasOwnAnswer(answers, "additional_phones[]");
    if (
      (hasCanonicalRows && !isCompleteStringArray(answers["additional_phones[]"])) ||
      (!hasCanonicalRows && !hasAnswer(answers, "additional_phone"))
    ) {
      missing.push("additional_phones[]");
    }
  }

  const hasOtherEmails = normalizedBoolean(answers.has_other_email ?? answers.has_other_emails);
  if (hasOtherEmails === null) {
    missing.push("has_other_emails");
  } else if (hasOtherEmails) {
    const hasCanonicalRows = hasOwnAnswer(answers, "additional_emails[]");
    if (
      (hasCanonicalRows && !isCompleteStringArray(answers["additional_emails[]"])) ||
      (!hasCanonicalRows && !hasAnswer(answers, "additional_email"))
    ) {
      missing.push("additional_emails[]");
    }
  }

  const hasCanonicalSocialRows = hasOwnAnswer(answers, "social_media[]");
  const strictSocialRows = hasCanonicalSocialRows
    ? parseStrictObjectArray(answers["social_media[]"])
    : null;
  const socialRows = strictSocialRows ?? parseObjectArray(answers["social_media[]"]);
  if (hasCanonicalSocialRows && !strictSocialRows) {
    missing.push("social_media[]");
  } else if (socialRows.length > 0) {
    if (socialRows.length > 1 && socialRows.some((row) => String(row.platform ?? "").trim().toUpperCase() === "NONE")) {
      missing.push("social_media[]");
    }
    socialRows.forEach((row, index) => {
      const platform = String(row.platform ?? "").trim();
      if (!platform) missing.push(`social_media[${index}].platform`);
      if (platform.toUpperCase() !== "NONE" && !String(row.handle ?? row.identifier ?? "").trim()) {
        missing.push(`social_media[${index}].handle`);
      }
    });
  } else if (!hasAnswer(answers, "social_media_provider")) {
    missing.push("social_media_provider");
  } else if (answers.social_media_provider !== "NONE" && !hasAnswer(answers, "social_media_identifier")) {
    missing.push("social_media_identifier");
  }

  const hasOtherSocialMedia = normalizedBoolean(answers.has_other_social_media);
  if (hasOtherSocialMedia === null) {
    missing.push("has_other_social_media");
  } else if (hasOtherSocialMedia) {
    const hasCanonicalRows = hasOwnAnswer(answers, "other_social_media[]");
    const strictRows = hasCanonicalRows
      ? parseStrictObjectArray(answers["other_social_media[]"])
      : null;
    const rows = strictRows ?? parseObjectArray(answers["other_social_media[]"]);
    if (!hasCanonicalRows || !strictRows || rows.length === 0) {
      missing.push("other_social_media[]");
    } else {
      rows.forEach((row, index) => {
        const platform = String(row.platform ?? row.name ?? "").trim();
        const handle = String(row.handle ?? row.identifier ?? row.username ?? "").trim();
        if (!platform) missing.push(`other_social_media[${index}].platform`);
        if (!handle) missing.push(`other_social_media[${index}].handle`);
      });
    }
  }

  const hasCompanions = normalizedBoolean(
    answers.has_companions ?? answers["travel.hasCompanions"],
  );
  if (hasCompanions === null) {
    missing.push("has_companions");
  } else if (hasCompanions) {
    const groupTravel = normalizedBoolean(
      answers.companion_group_travel ?? answers["travel.companionGroupTravel"],
    );
    if (groupTravel === null) {
      missing.push("companion_group_travel");
    } else if (groupTravel) {
      if (!hasAnswer(answers, "companion_group_name")) missing.push("companion_group_name");
    } else {
      const companions = parseCompanions(answers["companions[]"]);
      const legacyCompanion = {
        firstName: answers.companion_given_names,
        lastName: answers.companion_surname,
        relationship: answers.companion_relationship,
      };
      const rows = companions.length > 0
        ? companions
        : Object.values(legacyCompanion).some((value) => Boolean(value?.trim()))
          ? [legacyCompanion]
          : [];
      if (rows.length === 0) {
        missing.push("companions[]");
      } else {
        rows.forEach((row, index) => {
          const givenNames = String(row.firstName ?? row.givenNames ?? "").trim();
          const surname = String(row.lastName ?? row.surname ?? "").trim();
          const relationship = String(row.relationship ?? "").trim();
          if (!givenNames) missing.push(`companions[${index}].firstName`);
          if (!surname) missing.push(`companions[${index}].lastName`);
          if (!relationship) missing.push(`companions[${index}].relationship`);
        });
      }
    }
  }

  missing.push(...findMissingDs160WorkAdditionalAnswers(answers));
  missing.push(...findMissingDs160SecurityBackgroundAnswers(answers));

  const occupation = answers.primary_occupation?.trim().toUpperCase();
  if (!occupation) {
    missing.push("primary_occupation");
  } else if (!NON_EMPLOYED_OCCUPATIONS.has(occupation)) {
    const requiredWorkKeys = [
      "employer_name",
      "employer_address_line1",
      "employer_phone",
      "job_title",
      "job_duties",
    ];
    for (const key of requiredWorkKeys) {
      if (!hasAnswer(answers, key)) missing.push(key);
    }
    missing.push(...findMissingWorkIncomeAnswers(answers));
  }

  return [...new Set(missing)];
}

export class Ds160CompletenessError extends Error {
  constructor(readonly missingKeys: string[]) {
    super(`DS-160 answers are incomplete: ${missingKeys.join(", ")}`);
    this.name = "Ds160CompletenessError";
  }
}

export function assertDs160ReadyForCeac(
  intakeAnswers: Record<string, string>,
): Record<string, string> {
  const answers = deriveDS160Answers({ ...intakeAnswers });
  const missing = findMissingDs160RuntimeAnswers(answers);
  if (missing.length > 0) throw new Ds160CompletenessError(missing);
  return answers;
}

export function buildSampleDS160Answers(): Record<string, string> {
  // Merge hardcoded + dynamic into a single answer set (as persistDS160AnswerSet does)
  const hardcoded = flattenHardcodedSteps();
  return deriveDS160Answers({ ...hardcoded, ...SAMPLE_DYNAMIC });
}

export function verify(): VerificationResult {
  const allAnswers = buildSampleDS160Answers();

  // Get all DS-160 keys that the CEAC autofill worker actually uses
  const ceacMappings = {
    ...ds160PersonalInfoMappings,
    ...ds160TravelMappings,
    ...ds160PassportMappings,
    ...ds160ContactMappings,
    ...ds160WorkMappings,
  };

  const ceacKeys = Object.keys(ceacMappings);
  const missing: string[] = [];

  for (const key of ceacKeys) {
    if (!isMappedKeySatisfied(allAnswers, ceacMappings, key)) {
      missing.push(key);
    }
  }

  return {
    totalMappedKeys: ceacKeys.length,
    coveredByAnswers: ceacKeys.length - missing.length,
    missingKeys: missing,
    coveragePercent: `${(((ceacKeys.length - missing.length) / ceacKeys.length) * 100).toFixed(1)}%`,
    allCovered: missing.length === 0,
  };
}

function runVerification() {
  const hardcoded = flattenHardcodedSteps();
  const allAnswers = buildSampleDS160Answers();

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  DS-160 END-TO-END COMPLETENESS VERIFICATION");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Step 1: Verify hardcoded flattening
  console.log("── Step 1: Hardcoded Step Flattening ──");
  console.log(`   PersonalInfoStep → ${Object.keys(flattenHardcodedSteps()).filter((k) =>
    ["surname", "given_names", "sex", "marital_status", "date_of_birth", "city_of_birth", "state_of_birth", "country_of_birth", "nationality_country", "full_name_native_alphabet"].includes(k)
  ).length}/10 personal fields`);
  console.log(`   PassportStep     → ${Object.keys(flattenHardcodedSteps()).filter((k) =>
    k.startsWith("passport_")
  ).length}/7 passport fields`);
  console.log(`   TravelInfoStep   → ${Object.keys(flattenHardcodedSteps()).filter((k) =>
    ["purpose_of_trip", "arrival_city", "planned_location", "us_address_street1", "us_address_city", "us_address_state", "us_address_zip", "arrival_date_day", "arrival_date_month", "arrival_date_year", "intended_arrival_date_day", "intended_arrival_date_month", "intended_arrival_date_year", "departure_date_day", "departure_date_month", "departure_date_year", "intended_length_of_stay_value", "intended_length_of_stay_unit"].includes(k)
  ).length}/18 travel fields (including derived date parts)`);
  console.log(`   Total hardcoded answers: ${Object.keys(hardcoded).length}`);
  console.log(`   Total dynamic answers:   ${Object.keys(SAMPLE_DYNAMIC).length}`);
  console.log(`   Combined answer set:     ${Object.keys(allAnswers).length}`);

  // Step 2: Verify against CEAC autofill mappings
  console.log("\n── Step 2: CEAC Autofill Mapping Coverage ──");
  const result = verify();
  console.log(`   CEAC-mapped keys:  ${result.totalMappedKeys}`);
  console.log(`   Covered by form:   ${result.coveredByAnswers}`);
  console.log(`   Missing:           ${result.missingKeys.length}`);
  console.log(`   Coverage:          ${result.coveragePercent}`);

  if (result.missingKeys.length > 0) {
    console.log("\n   Missing keys:");
    for (const key of result.missingKeys) {
      console.log(`     ❌ ${key}`);
    }
  }

  // Step 3: Coverage classification
  console.log("\n── Step 3: Field Source Classification ──");

  const ceacMappings = {
    ...ds160PersonalInfoMappings,
    ...ds160TravelMappings,
    ...ds160PassportMappings,
    ...ds160ContactMappings,
    ...ds160WorkMappings,
  };

  const ceacKeys = Object.keys(ceacMappings);
  let directCount = 0;
  let derivedCount = 0;
  let dynamicCount = 0;

  for (const key of ceacKeys) {
    if (hardcoded[key]) {
      // Check if it's a derived field (date parts, length of stay)
      if (key.includes("_day") || key.includes("_month") || key.includes("_year") || key.includes("length_of_stay")) {
        derivedCount++;
      } else {
        directCount++;
      }
    } else if (SAMPLE_DYNAMIC[key]) {
      dynamicCount++;
    }
  }

  console.log(`   Direct from hardcoded steps: ${directCount}`);
  console.log(`   Derived deterministically:   ${derivedCount}`);
  console.log(`   From dynamic form:           ${dynamicCount}`);

  // Final verdict
  console.log("\n═══════════════════════════════════════════════════════════════");
  if (result.allCovered) {
    console.log("  ✅ VERIFICATION PASSED");
    console.log("  A fully completed simplified form yields a DS-160-complete");
    console.log("  answer set that covers all CEAC autofill mappings.");
  } else {
    console.log("  ❌ VERIFICATION FAILED");
    console.log(`  ${result.missingKeys.length} CEAC-mapped keys are not covered.`);
  }
  console.log("═══════════════════════════════════════════════════════════════");

  return result;
}

// Run verification when executed directly
if (require.main === module) {
  const result = runVerification();
  process.exit(result.allCovered ? 0 : 1);
}

export type { VerificationResult };
