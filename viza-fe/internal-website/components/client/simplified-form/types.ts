export type TravelPlanState = "yes" | "idea" | "unsure";

export type SocialPlatform = "instagram" | "facebook" | "twitter" | "linkedin" | "youtube" | "tiktok" | "weibo";

export interface SimplifiedIdentity {
  firstName: string;
  lastName: string;
  dob: string;
  gender: "Male" | "Female" | "";
  countryOfBirth: string;
  cityOfBirth: string;
  nationality: string;
  maritalStatus: "Single" | "Married" | "Divorced" | "Widowed" | "";
  hasOtherName: boolean;
  otherFirstName: string;
  otherLastName: string;
  hasNativeAlphabetName: boolean;
  nativeAlphabetName: string;
  hasTelecode: boolean;
  telecodeFirstName: string;
  telecodeLastName: string;
  hasPermanentResidenceOther: boolean;
  permanentResidenceCountry: string;
  // Spouse — only shown when maritalStatus === "Married"
  spouseFirstName: string;
  spouseLastName: string;
  spouseDob: string;
  spouseNationality: string;
  spouseCityOfBirth: string;
  spouseCountryOfBirth: string;
}

export interface SimplifiedContact {
  email: string;
  phone: string;
  secondaryPhone: string;
  secondaryEmail: string;
  homeCountry: string;
  street1: string;
  city: string;
  state: string;
  postalCode: string;
  mailingSame: boolean;
  // If mailingSame === false, fill these with the mailing address.
  mailingCountry: string;
  mailingStreet1: string;
  mailingCity: string;
  mailingState: string;
  mailingPostalCode: string;
  socialPlatforms: SocialPlatform[];
  socialHandles: Partial<Record<SocialPlatform, string>>;
}

export interface SimplifiedPassport {
  number: string;
  bookNumber: string;
  issuingCountry: string;
  issueDate: string;
  expiryDate: string;
  type: "Regular" | "Official" | "Diplomatic" | "Other";
  hasAdditionalNationality: boolean;
  additionalNationality: string;
  hasNationalId: boolean;
  nationalId: string;
  hasLostPassport: boolean;
  lostPassportExplanation: string;
}

export interface SimplifiedTravel {
  plansState: TravelPlanState;
  arrivalDate: string;
  lengthValue: string;
  lengthUnit: "Days" | "Weeks" | "Months";
  accommodationType: "Hotel" | "Private Home" | "Other" | "";
  usStreet: string;
  usCity: string;
  usState: string;
  usZip: string;
  tripPayer: "Self" | "Family" | "Employer" | "Other" | "";
  embassyLocation: string;
  // Companions
  hasCompanions: "yes" | "no" | "";
  companionFirstName: string;
  companionLastName: string;
  companionRelationship: string;
  // Prior US presence
  hasBeenInUs: "yes" | "no" | "";
  previousVisitDate: string;
  previousVisitLengthValue: string;
  previousVisitLengthUnit: "Days" | "Weeks" | "Months";
  // US driver's license (only relevant if hasBeenInUs)
  hasUsDriversLicense: "yes" | "no" | "";
  driversLicenseNumber: string;
  driversLicenseState: string;
  // Previous US visa history
  previousVisa: "yes" | "no" | "";
  previousVisaNumber: string;
  previousVisaExpiry: string;
  previousRefusal: "yes" | "no" | "";
  refusalExplanation: string;
  estaDenied: "yes" | "no" | "";
  petitionFiled: "yes" | "no" | "";
}

export type OccupationKey =
  | "BUSINESS"
  | "EDUCATION"
  | "ENGINEERING"
  | "COMPUTER SCIENCE"
  | "MEDICAL/HEALTH"
  | "GOVERNMENT"
  | "ARTIST/PERFORMER"
  | "STUDENT"
  | "HOMEMAKER"
  | "RETIRED"
  | "NOT EMPLOYED"
  | "OTHER";

const EMPLOYED_OCCUPATIONS: OccupationKey[] = [
  "BUSINESS",
  "EDUCATION",
  "ENGINEERING",
  "COMPUTER SCIENCE",
  "MEDICAL/HEALTH",
  "GOVERNMENT",
  "ARTIST/PERFORMER",
  "OTHER",
];

export function isEmployedOccupation(occ: OccupationKey | ""): boolean {
  return occ !== "" && EMPLOYED_OCCUPATIONS.includes(occ);
}

export interface SimplifiedWork {
  primaryOccupation: OccupationKey | "";
  occupationOtherExplain: string;
  // Current employer (shown when isEmployedOccupation || STUDENT)
  employerName: string;
  jobTitle: string;
  employmentStartDate: string;
  monthlySalary: string;
  jobDuties: string;
  employerPhone: string;
  employerStreet: string;
  employerCity: string;
  employerState: string;
  employerPostal: string;
  employerCountry: string;
  // Previous employer block
  hasPreviousEmployer: "yes" | "no" | "";
  prevEmployerName: string;
  prevJobTitle: string;
  prevEmploymentStart: string;
  prevEmploymentEnd: string;
  // Education block
  hasAttendedEducation: "yes" | "no" | "";
  educationInstitution: string;
  educationCourse: string;
  educationStart: string;
  educationEnd: string;
  educationCity: string;
  educationCountry: string;
  // Travel history
  hasTraveledLast5Years: "yes" | "no" | "";
  traveledCountry: string;
}

export interface SimplifiedUsContact {
  // Either a person or an organization
  isOrganization: boolean;
  organizationName: string;
  contactFirstName: string;
  contactLastName: string;
  relationship: "RELATIVE" | "SPOUSE" | "FRIEND" | "BUSINESS ASSOCIATE" | "EMPLOYER" | "SCHOOL OFFICIAL" | "OTHER" | "";
  phone: string;
  email: string;
  street1: string;
  street2: string;
  city: string;
  state: string;
  zip: string;
}

export interface SimplifiedFamily {
  fatherKnown: boolean;
  fatherFirstName: string;
  fatherLastName: string;
  fatherDob: string;
  motherKnown: boolean;
  motherFirstName: string;
  motherLastName: string;
  motherDob: string;
  relativesInUs: "yes" | "no" | "";
  relativeFirstName: string;
  relativeLastName: string;
  relativeRelationship: "spouse" | "fiance" | "child" | "sibling" | "";
  relativeStatus: "citizen" | "lpr" | "nonimmigrant" | "other_unknown" | "";
  hasOtherRelatives: "yes" | "no" | "";
  hasClanTribe: "yes" | "no" | "";
  clanTribeName: string;
  languages: string[];
}

export interface SimplifiedBackground {
  noneApply: boolean;
  // embassy-account questions — collected for UX but NOT persisted to visa_application_answers
  // (no canonical field_name in the DS-160 schema; the full form handles them elsewhere).
  birthCity: string;
  favoriteFood: string;
  childhoodHero: string;
}

export interface SimplifiedFormData {
  identity: SimplifiedIdentity;
  contact: SimplifiedContact;
  passport: SimplifiedPassport;
  travel: SimplifiedTravel;
  work: SimplifiedWork;
  usContact: SimplifiedUsContact;
  family: SimplifiedFamily;
  background: SimplifiedBackground;
}

export const emptySimplifiedForm = (): SimplifiedFormData => ({
  identity: {
    firstName: "",
    lastName: "",
    dob: "",
    gender: "",
    countryOfBirth: "",
    cityOfBirth: "",
    nationality: "",
    maritalStatus: "",
    hasOtherName: false,
    otherFirstName: "",
    otherLastName: "",
    hasNativeAlphabetName: false,
    nativeAlphabetName: "",
    hasTelecode: false,
    telecodeFirstName: "",
    telecodeLastName: "",
    hasPermanentResidenceOther: false,
    permanentResidenceCountry: "",
    spouseFirstName: "",
    spouseLastName: "",
    spouseDob: "",
    spouseNationality: "",
    spouseCityOfBirth: "",
    spouseCountryOfBirth: "",
  },
  contact: {
    email: "",
    phone: "",
    secondaryPhone: "",
    secondaryEmail: "",
    homeCountry: "",
    street1: "",
    city: "",
    state: "",
    postalCode: "",
    mailingSame: true,
    mailingCountry: "",
    mailingStreet1: "",
    mailingCity: "",
    mailingState: "",
    mailingPostalCode: "",
    socialPlatforms: [],
    socialHandles: {},
  },
  passport: {
    number: "",
    bookNumber: "",
    issuingCountry: "",
    issueDate: "",
    expiryDate: "",
    type: "Regular",
    hasAdditionalNationality: false,
    additionalNationality: "",
    hasNationalId: false,
    nationalId: "",
    hasLostPassport: false,
    lostPassportExplanation: "",
  },
  travel: {
    plansState: "unsure",
    arrivalDate: "",
    lengthValue: "",
    lengthUnit: "Days",
    accommodationType: "",
    usStreet: "",
    usCity: "",
    usState: "",
    usZip: "",
    tripPayer: "Self",
    embassyLocation: "",
    hasCompanions: "no",
    companionFirstName: "",
    companionLastName: "",
    companionRelationship: "",
    hasBeenInUs: "no",
    previousVisitDate: "",
    previousVisitLengthValue: "",
    previousVisitLengthUnit: "Days",
    hasUsDriversLicense: "no",
    driversLicenseNumber: "",
    driversLicenseState: "",
    previousVisa: "no",
    previousVisaNumber: "",
    previousVisaExpiry: "",
    previousRefusal: "no",
    refusalExplanation: "",
    estaDenied: "no",
    petitionFiled: "no",
  },
  work: {
    primaryOccupation: "",
    occupationOtherExplain: "",
    employerName: "",
    jobTitle: "",
    employmentStartDate: "",
    monthlySalary: "",
    jobDuties: "",
    employerPhone: "",
    employerStreet: "",
    employerCity: "",
    employerState: "",
    employerPostal: "",
    employerCountry: "",
    hasPreviousEmployer: "no",
    prevEmployerName: "",
    prevJobTitle: "",
    prevEmploymentStart: "",
    prevEmploymentEnd: "",
    hasAttendedEducation: "no",
    educationInstitution: "",
    educationCourse: "",
    educationStart: "",
    educationEnd: "",
    educationCity: "",
    educationCountry: "",
    hasTraveledLast5Years: "no",
    traveledCountry: "",
  },
  usContact: {
    isOrganization: false,
    organizationName: "",
    contactFirstName: "",
    contactLastName: "",
    relationship: "",
    phone: "",
    email: "",
    street1: "",
    street2: "",
    city: "",
    state: "",
    zip: "",
  },
  family: {
    fatherKnown: false,
    fatherFirstName: "",
    fatherLastName: "",
    fatherDob: "",
    motherKnown: false,
    motherFirstName: "",
    motherLastName: "",
    motherDob: "",
    relativesInUs: "no",
    relativeFirstName: "",
    relativeLastName: "",
    relativeRelationship: "",
    relativeStatus: "",
    hasOtherRelatives: "no",
    hasClanTribe: "no",
    clanTribeName: "",
    languages: [],
  },
  background: {
    noneApply: true,
    birthCity: "",
    favoriteFood: "",
    childhoodHero: "",
  },
});

/**
 * DS-160 yes/no fields that default to "no" when the user selects
 * "none of these apply" on the background step. Keys match the canonical
 * schema in `viza-be/agent-backend/scripts/seed-ds160-form-fields.ts`.
 */
export const DEFAULT_NO_FIELDS: readonly string[] = [
  // Health & Criminal
  "has_communicable_disease",
  "has_physical_mental_disorder",
  "has_drug_abuse",
  "has_been_arrested",
  "has_violated_substance_law",
  "has_prostitution_involvement",
  "has_money_laundering",
  "has_human_trafficking",
  "has_supported_trafficking",
  "is_trafficking_relative",
  "has_been_detained",
  // Terrorism & Security
  "intends_espionage",
  "intends_terrorism",
  "will_support_terrorists",
  "is_terrorist_organization_member",
  "is_terrorist_relative",
  // Human Rights
  "has_committed_genocide",
  "has_committed_torture",
  "has_committed_extrajudicial_killings",
  "has_used_child_soldiers",
  "violated_religious_freedom",
  "involved_population_control",
  "involved_organ_trafficking",
  // Immigration / Removal
  "obtained_visa_by_fraud",
  "has_been_removed",
  "subject_to_removal_order",
  "failed_removal_hearing",
  "has_overstayed",
  // Citizenship / Custody
  "withheld_child_custody",
  "voted_illegally",
  "renounced_citizenship",
  "practicing_polygamy",
  // Employment / training toggles the long form uses as gates
  "has_specialized_skills",
  "has_served_military",
  "has_served_paramilitary",
  "has_previous_employer",
  "has_attended_education",
  "has_clan_tribe",
  "has_traveled_last_five_years",
  "has_belonged_to_organization",
];

/** Schema option value (uppercase) for each social platform in the DS-160 seed. */
const SCHEMA_SOCIAL_PLATFORM: Partial<Record<SocialPlatform, string>> = {
  instagram: "INSTAGRAM",
  facebook: "FACEBOOK",
  twitter: "TWITTER",
  linkedin: "LINKEDIN",
  youtube: "YOUTUBE",
  weibo: "SINA WEIBO",
  // TikTok is NOT in the schema's social_media_platform enum — routed
  // through `has_other_social_media` + `other_social_media_*` below.
};

const GENDER_MAP: Record<"Male" | "Female", string> = {
  Male: "male",
  Female: "female",
};

const MARITAL_MAP: Record<"Single" | "Married" | "Divorced" | "Widowed", string> = {
  Single: "single",
  Married: "married",
  Divorced: "divorced",
  Widowed: "widowed",
};

const PASSPORT_TYPE_MAP: Record<"Regular" | "Official" | "Diplomatic" | "Other", string> = {
  Regular: "regular",
  Official: "official",
  Diplomatic: "diplomatic",
  Other: "other",
};

const LENGTH_UNIT_MAP: Record<"Days" | "Weeks" | "Months", string> = {
  Days: "DAY(S)",
  Weeks: "WEEK(S)",
  Months: "MONTH(S)",
};

const TRIP_PAYER_MAP: Record<"Self" | "Family" | "Employer" | "Other", string> = {
  Self: "self",
  Family: "other_person",
  Employer: "employer_in_us",
  Other: "other_company",
};

/** Best-effort normalization of free-text relationship → DS-160 enum. */
function normalizeRelativeRelationship(value: string): string {
  const v = value.trim().toLowerCase();
  if (!v) return "sibling";
  if (v.includes("spouse") || v.includes("husband") || v.includes("wife")) return "spouse";
  if (v.includes("fianc")) return "fiance";
  if (v.includes("child") || v.includes("son") || v.includes("daughter")) return "child";
  if (v.includes("sibling") || v.includes("brother") || v.includes("sister")) return "sibling";
  return "sibling";
}

/** Split "First Middle Last" → { given: "First Middle", surname: "Last" }. */
function splitName(full: string): { given: string; surname: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return { given: "", surname: "" };
  if (parts.length === 1) return { given: parts[0], surname: "" };
  const surname = parts[parts.length - 1];
  const given = parts.slice(0, -1).join(" ");
  return { given, surname };
}

/**
 * Flatten the simplified form into the flat `field_name` → `value_text` map
 * that `visa_application_answers` stores. Keys and option values are the
 * canonical DS-160 schema (see seed-ds160-form-fields.ts).
 */
export function buildAnswerPayload(form: SimplifiedFormData): Record<string, string> {
  const p: Record<string, string> = {};
  const { identity, contact, passport, travel, work, usContact, family, background } = form;

  // ------------------------------------------------------------
  // Personal Information 1
  // ------------------------------------------------------------
  p.given_names = identity.firstName;
  p.surname = identity.lastName;
  p.date_of_birth = identity.dob;
  if (identity.gender) p.sex = GENDER_MAP[identity.gender];
  p.country_of_birth = identity.countryOfBirth;
  p.city_of_birth = identity.cityOfBirth;
  p.state_of_birth = "does_not_apply";
  if (identity.maritalStatus) p.marital_status = MARITAL_MAP[identity.maritalStatus];

  p.other_names_used = identity.hasOtherName ? "yes" : "no";
  if (identity.hasOtherName) {
    p.other_given_names = identity.otherFirstName;
    p.other_surname = identity.otherLastName;
  }

  p.has_telecode = identity.hasTelecode ? "yes" : "no";
  if (identity.hasTelecode) {
    p.telecode_given_names = identity.telecodeFirstName;
    p.telecode_surname = identity.telecodeLastName;
  }

  p.full_name_native_alphabet =
    identity.hasNativeAlphabetName && identity.nativeAlphabetName.trim()
      ? identity.nativeAlphabetName.trim()
      : "does_not_apply";

  // ------------------------------------------------------------
  // Personal Information 2
  // ------------------------------------------------------------
  p.nationality_country = identity.nationality;
  p.other_nationality = passport.hasAdditionalNationality ? "yes" : "no";
  if (passport.hasAdditionalNationality && passport.additionalNationality) {
    p.other_nationality_country = passport.additionalNationality;
    p.other_nationality_has_passport = "no";
  }
  p.permanent_resident_other_country = identity.hasPermanentResidenceOther ? "yes" : "no";
  if (identity.hasPermanentResidenceOther && identity.permanentResidenceCountry) {
    p.other_permanent_resident_country = identity.permanentResidenceCountry;
  }
  p.national_id_number =
    passport.hasNationalId && passport.nationalId.trim() ? passport.nationalId.trim() : "does_not_apply";
  p.us_social_security_number = "does_not_apply";
  p.us_taxpayer_id = "does_not_apply";

  // ------------------------------------------------------------
  // Address and Phone
  // ------------------------------------------------------------
  p.home_address_line1 = contact.street1;
  p.home_address_city = contact.city;
  p.home_address_state_province = contact.state.trim() || "does_not_apply";
  p.home_address_postal_code = contact.postalCode.trim() || "does_not_apply";
  p.home_address_country = contact.homeCountry;

  p.mailing_same_as_home = contact.mailingSame ? "yes" : "no";
  if (!contact.mailingSame) {
    p.mailing_address_line1 = contact.mailingStreet1;
    p.mailing_address_city = contact.mailingCity;
    p.mailing_address_state = contact.mailingState.trim() || "does_not_apply";
    p.mailing_address_postal = contact.mailingPostalCode.trim() || "does_not_apply";
    p.mailing_address_country = contact.mailingCountry;
  }

  p.primary_phone = contact.phone;
  p.secondary_phone = contact.secondaryPhone.trim() || "does_not_apply";
  p.work_phone = "does_not_apply";
  p.has_other_phones = contact.secondaryPhone.trim() ? "yes" : "no";
  if (contact.secondaryPhone.trim()) {
    p.additional_phone = contact.secondaryPhone.trim();
  }

  p.email_address = contact.email;
  if (contact.secondaryEmail.trim()) {
    p.has_other_emails = "yes";
    p.additional_email = contact.secondaryEmail.trim();
  } else {
    p.has_other_emails = "no";
  }

  // Social media — schema platforms mapped as repeatable instances,
  // TikTok (unsupported) routed through `other_social_media`.
  const schemaPlatforms = contact.socialPlatforms.filter((pl) => pl in SCHEMA_SOCIAL_PLATFORM);
  schemaPlatforms.forEach((platform, i) => {
    const suffix = i === 0 ? "" : `__${i + 1}`;
    p[`social_media_platform${suffix}`] = SCHEMA_SOCIAL_PLATFORM[platform]!;
    const handle = contact.socialHandles[platform];
    if (handle) p[`social_media_handle${suffix}`] = handle;
  });

  const tiktokHandle = contact.socialPlatforms.includes("tiktok") ? contact.socialHandles.tiktok : undefined;
  if (tiktokHandle) {
    p.has_other_social_media = "yes";
    p.other_social_media_name = "TikTok";
    p.other_social_media_identifier = tiktokHandle;
  } else {
    p.has_other_social_media = "no";
  }

  // ------------------------------------------------------------
  // Passport Information
  // ------------------------------------------------------------
  p.passport_document_type = PASSPORT_TYPE_MAP[passport.type];
  p.passport_number = passport.number;
  p.passport_book_number = passport.bookNumber.trim() || "does_not_apply";
  p.passport_issuing_country = passport.issuingCountry;
  p.passport_issuance_country = passport.issuingCountry;
  p.passport_issuance_state = "does_not_apply";
  p.passport_issuance_date = passport.issueDate;
  p.passport_expiration_date = passport.expiryDate;

  p.lost_passport = passport.hasLostPassport ? "yes" : "no";
  if (passport.hasLostPassport && passport.lostPassportExplanation.trim()) {
    p.lost_passport_explain = passport.lostPassportExplanation.trim();
  }

  // ------------------------------------------------------------
  // Travel Information
  // ------------------------------------------------------------
  p.purpose_of_trip = "B";
  p.purpose_of_trip_specify = "B1/B2";

  const hasSpecific = travel.plansState === "yes";
  p.has_specific_plans = hasSpecific ? "yes" : "no";

  if (hasSpecific) {
    p.arrival_date = travel.arrivalDate;
  } else {
    p.intended_arrival_date = travel.arrivalDate;
    p.intended_length_of_stay_value = travel.lengthValue;
    p.intended_length_of_stay_unit = LENGTH_UNIT_MAP[travel.lengthUnit];
  }

  p.us_address_street1 = travel.usStreet;
  p.us_address_city = travel.usCity;
  p.us_address_state = travel.usState;
  p.us_address_zip = travel.usZip;

  if (travel.tripPayer) p.trip_payer_type = TRIP_PAYER_MAP[travel.tripPayer];

  // ------------------------------------------------------------
  // Travel Companions
  // ------------------------------------------------------------
  p.has_companions = travel.hasCompanions || "no";
  if (travel.hasCompanions === "yes") {
    p.companion_group_travel = "no";
    p.companion_given_names = travel.companionFirstName;
    p.companion_surname = travel.companionLastName;
    p.companion_relationship = (travel.companionRelationship || "OTHER").toUpperCase();
  }

  // ------------------------------------------------------------
  // Previous U.S. Travel
  // ------------------------------------------------------------
  p.has_been_in_us = travel.hasBeenInUs || "no";
  if (travel.hasBeenInUs === "yes") {
    if (travel.previousVisitDate) p.previous_visit_date_arrived = travel.previousVisitDate;
    if (travel.previousVisitLengthValue.trim()) {
      p.previous_visit_length_of_stay = travel.previousVisitLengthValue.trim();
      p.previous_visit_length_of_stay_unit = LENGTH_UNIT_MAP[travel.previousVisitLengthUnit];
    }
  }

  p.has_us_drivers_license = travel.hasUsDriversLicense || "no";
  if (travel.hasUsDriversLicense === "yes") {
    if (travel.driversLicenseNumber.trim()) p.us_drivers_license_number = travel.driversLicenseNumber.trim();
    if (travel.driversLicenseState.trim()) p.us_drivers_license_state = travel.driversLicenseState.trim();
  }

  p.has_us_visa = travel.previousVisa || "no";
  if (travel.previousVisa === "yes") {
    if (travel.previousVisaNumber.trim()) {
      p.visa_number = travel.previousVisaNumber.trim();
    } else {
      p.visa_number = "does_not_apply";
      p.visa_number_unknown = "true";
    }
    if (travel.previousVisaExpiry) {
      const [yyyy, mm, dd] = travel.previousVisaExpiry.split("-");
      if (yyyy && mm && dd) {
        p.last_visa_issue_year = yyyy;
        p.last_visa_issue_month = mm;
        p.last_visa_issue_day = dd;
      }
    }
  }
  p.has_been_refused = travel.previousRefusal || "no";
  if (travel.previousRefusal === "yes" && travel.refusalExplanation.trim()) {
    p.refusal_explain = travel.refusalExplanation.trim();
  }
  p.immigrant_petition_filed = travel.petitionFiled || "no";

  // ------------------------------------------------------------
  // Work / Education
  // ------------------------------------------------------------
  if (work.primaryOccupation) {
    p.primary_occupation = work.primaryOccupation;
    if (work.primaryOccupation === "OTHER" && work.occupationOtherExplain.trim()) {
      p.occupation_other_explain = work.occupationOtherExplain.trim();
    }
  }
  if (isEmployedOccupation(work.primaryOccupation) || work.primaryOccupation === "STUDENT") {
    if (work.employerName) p.employer_name = work.employerName;
    if (work.jobTitle) p.job_title = work.jobTitle;
    if (work.employmentStartDate) p.employment_start_date = work.employmentStartDate;
    if (work.monthlySalary) p.monthly_salary = work.monthlySalary;
    if (work.jobDuties) p.job_duties = work.jobDuties;
    // The schema uses employer_phone under current employer block — some seeds call it differently.
    // Safe to also include as generic keys; the review renderer only shows what exists in the schema.
    if (work.employerPhone) p.employer_phone = work.employerPhone;
    if (work.employerStreet) p.employer_address_line1 = work.employerStreet;
    if (work.employerCity) p.employer_city = work.employerCity;
    if (work.employerState) p.employer_state = work.employerState;
    if (work.employerPostal) p.employer_postal = work.employerPostal;
    if (work.employerCountry) p.employer_country = work.employerCountry;
  }

  p.has_previous_employer = work.hasPreviousEmployer || "no";
  if (work.hasPreviousEmployer === "yes") {
    if (work.prevEmployerName) p.prev_employer_name = work.prevEmployerName;
    if (work.prevJobTitle) p.prev_job_title = work.prevJobTitle;
    if (work.prevEmploymentStart) p.prev_employment_start_date = work.prevEmploymentStart;
    if (work.prevEmploymentEnd) p.prev_employment_end_date = work.prevEmploymentEnd;
  }

  p.has_attended_education = work.hasAttendedEducation || "no";
  if (work.hasAttendedEducation === "yes") {
    if (work.educationInstitution) p.education_institution_name = work.educationInstitution;
    if (work.educationCourse) p.education_course_of_study = work.educationCourse;
    if (work.educationStart) p.education_start_date = work.educationStart;
    if (work.educationEnd) p.education_end_date = work.educationEnd;
    if (work.educationCity) p.education_city = work.educationCity;
    if (work.educationCountry) p.education_country = work.educationCountry;
  }

  p.has_traveled_last_five_years = work.hasTraveledLast5Years || "no";
  if (work.hasTraveledLast5Years === "yes" && work.traveledCountry) {
    p.traveled_country = work.traveledCountry;
  }

  // ------------------------------------------------------------
  // U.S. Contact Information
  // ------------------------------------------------------------
  if (usContact.isOrganization) {
    if (usContact.organizationName) p.us_contact_organization = usContact.organizationName;
  } else {
    if (usContact.contactFirstName) p.us_contact_given_names = usContact.contactFirstName;
    if (usContact.contactLastName) p.us_contact_surname = usContact.contactLastName;
  }
  if (usContact.relationship) p.us_contact_relationship = usContact.relationship;
  if (usContact.street1) p.us_contact_address_street1 = usContact.street1;
  if (usContact.street2) p.us_contact_address_street2 = usContact.street2;
  if (usContact.city) p.us_contact_city = usContact.city;
  if (usContact.state) p.us_contact_state = usContact.state;
  if (usContact.zip) p.us_contact_zip = usContact.zip;
  if (usContact.phone) p.us_contact_phone = usContact.phone;
  if (usContact.email) p.us_contact_email = usContact.email;

  // ------------------------------------------------------------
  // Spouse (when married)
  // ------------------------------------------------------------
  if (identity.maritalStatus === "Married") {
    if (identity.spouseFirstName) p.spouse_given_names = identity.spouseFirstName;
    if (identity.spouseLastName) p.spouse_surname = identity.spouseLastName;
    if (identity.spouseDob) p.spouse_date_of_birth = identity.spouseDob;
    if (identity.spouseNationality) p.spouse_nationality = identity.spouseNationality;
    if (identity.spouseCityOfBirth) p.spouse_city_of_birth = identity.spouseCityOfBirth;
    if (identity.spouseCountryOfBirth) p.spouse_country_of_birth = identity.spouseCountryOfBirth;
    p.spouse_address_type = "same_as_home";
  }

  // ------------------------------------------------------------
  // Family — Relatives
  // ------------------------------------------------------------
  p.father_given_names = family.fatherKnown && family.fatherFirstName.trim() ? family.fatherFirstName.trim() : "UNKNOWN";
  p.father_surname = family.fatherKnown && family.fatherLastName.trim() ? family.fatherLastName.trim() : "UNKNOWN";
  if (family.fatherKnown && family.fatherDob) p.father_date_of_birth = family.fatherDob;
  p.mother_given_names = family.motherKnown && family.motherFirstName.trim() ? family.motherFirstName.trim() : "UNKNOWN";
  p.mother_surname = family.motherKnown && family.motherLastName.trim() ? family.motherLastName.trim() : "UNKNOWN";
  if (family.motherKnown && family.motherDob) p.mother_date_of_birth = family.motherDob;

  p.has_immediate_us_relatives = family.relativesInUs || "no";
  if (family.relativesInUs === "yes") {
    if (family.relativeFirstName) p.us_relative_given_names = family.relativeFirstName;
    if (family.relativeLastName) p.us_relative_surname = family.relativeLastName;
    if (family.relativeRelationship) p.us_relative_relationship = family.relativeRelationship;
    p.us_relative_status = family.relativeStatus || "other_unknown";
  }
  p.has_other_us_relatives = family.hasOtherRelatives || "no";

  p.has_clan_tribe = family.hasClanTribe || "no";
  if (family.hasClanTribe === "yes" && family.clanTribeName) {
    p.clan_tribe_name = family.clanTribeName;
  }

  // ------------------------------------------------------------
  // Security & Background — default-no
  // ------------------------------------------------------------
  for (const key of DEFAULT_NO_FIELDS) {
    // Don't overwrite keys we've already set (e.g., has_previous_employer when user said yes).
    if (!(key in p)) p[key] = "no";
  }

  // Mark background choice explicitly so the long form can detect the path.
  p.simplified_background_none_apply = background.noneApply ? "yes" : "no";

  // Embassy-account security answers are intentionally NOT persisted here —
  // they have no DS-160 field_name and belong to a separate flow.

  // ------------------------------------------------------------
  // Cleanup — strip empty values so the long form treats missing keys
  // as unanswered instead of storing a blank row.
  // ------------------------------------------------------------
  for (const key of Object.keys(p)) {
    if (p[key] === "" || p[key] == null) {
      delete p[key];
    }
  }

  return p;
}
