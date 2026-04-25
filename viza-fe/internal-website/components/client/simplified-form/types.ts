export type TravelPlanState = "yes" | "idea" | "unsure";
export type LengthUnit = "Days" | "Weeks" | "Months" | "Years" | "LessThan24Hours";

export type SocialPlatform =
  | "instagram"
  | "facebook"
  | "twitter"
  | "linkedin"
  | "youtube"
  | "tiktok"
  | "wechat"
  | "weibo"
  | "askfm"
  | "flickr"
  | "myspace"
  | "reddit"
  | "tumblr"
  | "vine"
  | "vkontakte"
  | "youku";

export interface CustomSocialEntry {
  platform: string;
  handle: string;
}
export interface AdditionalPhone {
  dialCode: string;
  number: string;
}

export interface AdditionalCitizenship {
  country: string;
  hasPassport: boolean;
  passportNumber: string;
}

export interface TravelCompanion {
  firstName: string;
  lastName: string;
  relationship: "child" | "parent" | "spouse" | "relative" | "friend" | "business_partner" | "other" | "";
}

export interface PreviousUsVisit {
  arrivalDate: string;
  lengthValue: string;
  lengthUnit: LengthUnit;
}

export interface UsDriversLicenseEntry {
  unknownNumber: boolean;
  number: string;
  state: string;
}

export type TripPayerType =
  | "Self"
  | "Other Person"
  | "Current Employer"
  | "US Employer"
  | "Other Company"
  | "";

export interface FormerSpouse {
  firstName: string;
  lastName: string;
  dob: string;
  nationality: string;
  cityOfBirth: string;
  countryOfBirth: string;
  marriageDate: string;
  divorceDate: string;
  howEnded: string;
  divorceCountry: string;
}

export interface SimplifiedIdentity {
  firstName: string;
  lastName: string;
  dob: string;
  gender: "Male" | "Female" | "";
  countryOfBirth: string;
  stateOfBirth: string;
  hasNoStateOfBirth: boolean;
  cityOfBirth: string;
  nationality: string;
  maritalStatus: "Single" | "Married" | "Common Law Marriage" | "Civil Union / Domestic Partnership" | "Legally Separated" | "Divorced" | "Widowed" | "Other" | "";
  maritalStatusOtherExplain: string;
  hasOtherName: boolean;
  otherFirstName: string;
  otherLastName: string;
  hasNativeAlphabetName: boolean;
  nativeAlphabetName: string;
  hasTelecode: boolean;
  telecodeFirstName: string;
  telecodeLastName: string;
}

export interface SimplifiedContact {
  email: string;
  phone: string;
  secondaryPhone: string;
  secondaryEmail: string;
  additionalPhones: AdditionalPhone[];
  additionalEmails: string[];
  homeCountry: string;
  street1: string;
  street2: string;
  city: string;
  state: string;
  postalCode: string;
  mailingSame: boolean;
  // If mailingSame === false, fill these with the mailing address.
  mailingCountry: string;
  mailingStreet1: string;
  mailingStreet2: string;
  mailingCity: string;
  mailingState: string;
  mailingPostalCode: string;
  socialPlatforms: SocialPlatform[];
  socialHandles: Partial<Record<SocialPlatform, string>>;
  otherSocialEntries: CustomSocialEntry[];
}

export interface SimplifiedPassport {
  number: string;
  hasBookNumber: boolean;
  bookNumber: string;
  issuingCountry: string;
  issuedInAnotherCountry: boolean;
  issuedInAnotherCountryValue: string;
  issuanceCity: string;
  issuanceProvince: string;
  issueDate: string;
  expiryDate: string;
  type: "Regular" | "Official" | "Diplomatic" | "Permit" | "Other";
  hasAdditionalNationality: boolean;
  additionalNationality: string;
  additionalCitizenships: AdditionalCitizenship[];
  hasOtherCountryPermanentResidence: boolean;
  permanentResidenceCountries: string[];
  hasUsSocialSecurityOrTaxId: boolean;
  hasSsn: boolean;
  ssn: string;
  hasItin: boolean;
  itin: string;
  hasNationalId: boolean;
  nationalId: string;
  hasLostPassport: boolean;
  lostPassportKnowsNumber: boolean;
  lostPassportNumber: string;
  lostPassportCountry: string;
  lostPassportExplanation: string;
}

export interface SimplifiedTravel {
  plansState: TravelPlanState;
  arrivalDate: string;
  departureDate: string;
  arrivalCity: string;
  arrivalFlight: string;
  departureCity: string;
  departureFlight: string;
  placesToVisit: string[];
  lengthValue: string;
  lengthUnit: LengthUnit;
  accommodationType: "Hotel" | "Private Home" | "Short-term Rental" | "Other" | "";
  hotelName: string;
  usStreet: string;
  usStreet2: string;
  usCity: string;
  usState: string;
  usZip: string;
  usAccommodationType: "hotel" | "airbnb" | "friends_family" | "business" | "school" | "other" | "";
  usHostFirstName: string;
  usHostLastName: string;
  usFriendsFirstName: string;
  usFriendsLastName: string;
  usFriendsRelationship: "relative" | "friend" | "";
  usOrgName: string;
  usSchoolName: string;
  usOtherFirstName: string;
  usOtherLastName: string;
  usContactPhoneDialCode: string;
  usContactPhone: string;
  usContactEmail: string;
  usContactEmailUnknown: boolean;
  tripPayer: TripPayerType;
  payerFirstName: string;
  payerLastName: string;
  payerPhoneDialCode: string;
  payerPhone: string;
  payerEmail: string;
  payerEmailUnknown: boolean;
  payerRelationship:
    | "child"
    | "parent"
    | "spouse"
    | "relative"
    | "friend"
    | "business_partner"
    | "other"
    | "";
  payerAddressSameAsYou: "yes" | "no" | "";
  payerStreet1: string;
  payerStreet2: string;
  payerCity: string;
  payerState: string;
  payerNoState: boolean;
  payerPostalCode: string;
  payerNoPostalCode: boolean;
  payerCountry: string;
  payerOrgName: string;
  payerOrgPhoneDialCode: string;
  payerOrgPhone: string;
  payerOrgRelationship: string;
  embassyLocation: string;
  // Companions
  hasCompanions: "yes" | "no" | "";
  companionGroupTravel: "yes" | "no" | "";
  companionGroupName: string;
  companions: TravelCompanion[];
  companionFirstName: string;
  companionLastName: string;
  companionRelationship: string;
  hasVisitedOtherCountriesLast5Years: "yes" | "no" | "";
  visitedCountries: string[];
  // Prior US presence
  hasBeenInUs: "yes" | "no" | "";
  previousVisits: PreviousUsVisit[];
  previousVisitDate: string;
  previousVisitLengthValue: string;
  previousVisitLengthUnit: LengthUnit;
  // US driver's license (only relevant if hasBeenInUs)
  hasUsDriversLicense: "yes" | "no" | "";
  usDriversLicenses: UsDriversLicenseEntry[];
  driversLicenseNumber: string;
  driversLicenseState: string;
  // Previous US visa history
  previousVisa: "yes" | "no" | "";
  previousVisaIssueCountry: string;
  previousVisaIssueDate: string;
  previousVisaValidUntil: string;
  previousVisaUnknownNumber: boolean;
  previousVisaNumber: string;
  previousVisaExpiry: string; // legacy alias; kept for compatibility
  sameVisaType: "yes" | "no" | "";
  sameCountryApply: "yes" | "no" | "";
  tenPrinted: "yes" | "no" | "";
  visaLostStolen: "yes" | "no" | "";
  visaLostStolenYear: string;
  visaLostStolenExplanation: string;
  visaCancelledRevoked: "yes" | "no" | "";
  visaCancelledRevokedExplanation: string;
  received221g: "yes" | "no" | "";
  previousRefusal: "yes" | "no" | "";
  refusalExplanation: string;
  previousRefusalDate: string;
  previousRefusalExplanation: string;
  estaDenied: "yes" | "no" | "";
  estaDeniedExplanation: string;
  petitionFiled: "yes" | "no" | "";
  petitionFiledExplanation: string;
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
  // Parents
  fatherKnown: boolean;
  fatherFirstName: string;
  fatherFirstNameUnknown: boolean;
  fatherLastName: string;
  fatherLastNameUnknown: boolean;
  fatherDob: string;
  motherKnown: boolean;
  motherFirstName: string;
  motherFirstNameUnknown: boolean;
  motherLastName: string;
  motherLastNameUnknown: boolean;
  motherDob: string;
  // Spouse (shown for Married / Common Law / Civil Union / Legally Separated)
  spouseFirstName: string;
  spouseLastName: string;
  spouseDob: string;
  spouseNationality: string;
  spouseCityOfBirth: string;
  spouseCountryOfBirth: string;
  spouseAddressType: "home" | "work" | "other" | "";
  // Deceased spouse (shown for Widowed)
  deceasedSpouseFirstName: string;
  deceasedSpouseLastName: string;
  deceasedSpouseDob: string;
  deceasedSpouseNationality: string;
  deceasedSpouseCityOfBirth: string;
  deceasedSpouseCountryOfBirth: string;
  // Former spouses (shown for Divorced) — max 5
  formerSpouses: FormerSpouse[];
  // Legacy DS-160 fields (kept for buildAnswerPayload compatibility)
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
    stateOfBirth: "",
    hasNoStateOfBirth: false,
    cityOfBirth: "",
    nationality: "",
    maritalStatus: "",
    maritalStatusOtherExplain: "",
    hasOtherName: false,
    otherFirstName: "",
    otherLastName: "",
    hasNativeAlphabetName: false,
    nativeAlphabetName: "",
    hasTelecode: false,
    telecodeFirstName: "",
    telecodeLastName: "",
  },
  contact: {
    email: "",
    phone: "",
    secondaryPhone: "",
    secondaryEmail: "",
    additionalPhones: [],
    additionalEmails: [],
    homeCountry: "",
    street1: "",
    street2: "",
    city: "",
    state: "",
    postalCode: "",
    mailingSame: true,
    mailingCountry: "",
    mailingStreet1: "",
    mailingStreet2: "",
    mailingCity: "",
    mailingState: "",
    mailingPostalCode: "",
    socialPlatforms: [],
    socialHandles: {},
    otherSocialEntries: [],
  },
  passport: {
    number: "",
    hasBookNumber: false,
    bookNumber: "",
    issuingCountry: "",
    issuedInAnotherCountry: false,
    issuedInAnotherCountryValue: "",
    issuanceCity: "",
    issuanceProvince: "",
    issueDate: "",
    expiryDate: "",
    type: "Regular",
    hasAdditionalNationality: false,
    additionalNationality: "",
    additionalCitizenships: [{ country: "", hasPassport: false, passportNumber: "" }],
    hasOtherCountryPermanentResidence: false,
    permanentResidenceCountries: [""],
    hasUsSocialSecurityOrTaxId: false,
    hasSsn: false,
    ssn: "",
    hasItin: false,
    itin: "",
    hasNationalId: false,
    nationalId: "",
    hasLostPassport: false,
    lostPassportKnowsNumber: false,
    lostPassportNumber: "",
    lostPassportCountry: "",
    lostPassportExplanation: "",
  },
  travel: {
    plansState: "unsure",
    arrivalDate: "",
    departureDate: "",
    arrivalCity: "",
    arrivalFlight: "",
    departureCity: "",
    departureFlight: "",
    placesToVisit: [""],
    lengthValue: "",
    lengthUnit: "Days",
    accommodationType: "",
    hotelName: "",
    usStreet: "",
    usStreet2: "",
    usCity: "",
    usState: "",
    usZip: "",
    usAccommodationType: "",
    usHostFirstName: "",
    usHostLastName: "",
    usFriendsFirstName: "",
    usFriendsLastName: "",
    usFriendsRelationship: "",
    usOrgName: "",
    usSchoolName: "",
    usOtherFirstName: "",
    usOtherLastName: "",
    usContactPhoneDialCode: "+1",
    usContactPhone: "",
    usContactEmail: "",
    usContactEmailUnknown: false,
    tripPayer: "Self",
    payerFirstName: "",
    payerLastName: "",
    payerPhoneDialCode: "+86",
    payerPhone: "",
    payerEmail: "",
    payerEmailUnknown: false,
    payerRelationship: "",
    payerAddressSameAsYou: "yes",
    payerStreet1: "",
    payerStreet2: "",
    payerCity: "",
    payerState: "",
    payerNoState: false,
    payerPostalCode: "",
    payerNoPostalCode: false,
    payerCountry: "",
    payerOrgName: "",
    payerOrgPhoneDialCode: "+86",
    payerOrgPhone: "",
    payerOrgRelationship: "",
    embassyLocation: "",
    hasCompanions: "no",
    companionGroupTravel: "no",
    companionGroupName: "",
    companions: [{ firstName: "", lastName: "", relationship: "" }],
    companionFirstName: "",
    companionLastName: "",
    companionRelationship: "",
    hasVisitedOtherCountriesLast5Years: "no",
    visitedCountries: [""],
    hasBeenInUs: "no",
    previousVisits: [{ arrivalDate: "", lengthValue: "", lengthUnit: "Days" }],
    previousVisitDate: "",
    previousVisitLengthValue: "",
    previousVisitLengthUnit: "Days",
    hasUsDriversLicense: "no",
    usDriversLicenses: [{ unknownNumber: false, number: "", state: "" }],
    driversLicenseNumber: "",
    driversLicenseState: "",
    previousVisa: "no",
    previousVisaIssueCountry: "",
    previousVisaIssueDate: "",
    previousVisaValidUntil: "",
    previousVisaUnknownNumber: false,
    previousVisaNumber: "",
    previousVisaExpiry: "",
    sameVisaType: "yes",
    sameCountryApply: "yes",
    tenPrinted: "no",
    visaLostStolen: "no",
    visaLostStolenYear: "",
    visaLostStolenExplanation: "",
    visaCancelledRevoked: "no",
    visaCancelledRevokedExplanation: "",
    received221g: "no",
    previousRefusal: "no",
    refusalExplanation: "",
    previousRefusalDate: "",
    previousRefusalExplanation: "",
    estaDenied: "no",
    estaDeniedExplanation: "",
    petitionFiled: "no",
    petitionFiledExplanation: "",
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
    fatherKnown: true,
    fatherFirstName: "",
    fatherFirstNameUnknown: false,
    fatherLastName: "",
    fatherLastNameUnknown: false,
    fatherDob: "",
    motherKnown: true,
    motherFirstName: "",
    motherFirstNameUnknown: false,
    motherLastName: "",
    motherLastNameUnknown: false,
    motherDob: "",
    spouseFirstName: "",
    spouseLastName: "",
    spouseDob: "",
    spouseNationality: "",
    spouseCityOfBirth: "",
    spouseCountryOfBirth: "",
    spouseAddressType: "",
    deceasedSpouseFirstName: "",
    deceasedSpouseLastName: "",
    deceasedSpouseDob: "",
    deceasedSpouseNationality: "",
    deceasedSpouseCityOfBirth: "",
    deceasedSpouseCountryOfBirth: "",
    formerSpouses: [],
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

const OTHER_SOCIAL_LABEL: Partial<Record<SocialPlatform, string>> = {
  tiktok: "TikTok",
  wechat: "WeChat",
  askfm: "ASK.FM",
  flickr: "Flickr",
  myspace: "Myspace",
  reddit: "Reddit",
  tumblr: "Tumblr",
  vine: "Vine",
  vkontakte: "VKontakte",
  youku: "Youku",
};

const GENDER_MAP: Record<"Male" | "Female", string> = {
  Male: "male",
  Female: "female",
};

const MARITAL_MAP: Record<"Single" | "Married" | "Common Law Marriage" | "Civil Union / Domestic Partnership" | "Legally Separated" | "Divorced" | "Widowed" | "Other", string> = {
  Single: "single",
  Married: "married",
  "Common Law Marriage": "common law marriage",
  "Civil Union / Domestic Partnership": "civil union / domestic partnership",
  "Legally Separated": "legally separated",
  Divorced: "divorced",
  Widowed: "widowed",
  Other: "other",
};

const PASSPORT_TYPE_MAP: Record<"Regular" | "Official" | "Diplomatic" | "Permit" | "Other", string> = {
  Regular: "regular",
  Official: "official",
  Diplomatic: "diplomatic",
  Permit: "other",
  Other: "other",
};

const LENGTH_UNIT_MAP: Record<LengthUnit, string> = {
  Days: "DAY(S)",
  Weeks: "WEEK(S)",
  Months: "MONTH(S)",
  Years: "YEAR(S)",
  LessThan24Hours: "LESS THAN 24 HOURS",
};

const TRIP_PAYER_MAP: Record<Exclude<TripPayerType, "">, string> = {
  Self: "self",
  "Other Person": "other_person",
  "Current Employer": "employer_in_home_country",
  "US Employer": "employer_in_us",
  "Other Company": "other_company",
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
  if (identity.stateOfBirth) {
    p.state_of_birth = identity.stateOfBirth;
  }
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
  const firstAdditionalCitizenship = passport.additionalCitizenships.find((item) => item.country);
  p.other_nationality =
    passport.hasAdditionalNationality && (firstAdditionalCitizenship || passport.additionalNationality)
      ? "yes"
      : "no";
  if (passport.hasAdditionalNationality && (firstAdditionalCitizenship || passport.additionalNationality)) {
    p.other_nationality_country = firstAdditionalCitizenship?.country || passport.additionalNationality;
    p.other_nationality_has_passport = firstAdditionalCitizenship?.hasPassport ? "yes" : "no";
    p.other_nationality_passport_number =
      firstAdditionalCitizenship?.hasPassport && firstAdditionalCitizenship.passportNumber.trim()
        ? firstAdditionalCitizenship.passportNumber.trim()
        : "does_not_apply";
  }
  p.national_id_number =
    passport.hasNationalId && passport.nationalId.trim() ? passport.nationalId.trim() : "does_not_apply";
  p.us_social_security_number = passport.hasSsn && passport.ssn.trim() ? passport.ssn.trim() : "does_not_apply";
  p.us_taxpayer_id = passport.hasItin && passport.itin.trim() ? passport.itin.trim() : "does_not_apply";

  // ------------------------------------------------------------
  // Address and Phone
  // ------------------------------------------------------------
  p.home_address_line1 = contact.street1;
  if (contact.street2.trim()) p.home_address_line2 = contact.street2.trim();
  p.home_address_city = contact.city;
  p.home_address_state_province = contact.state.trim() || "does_not_apply";
  p.home_address_postal_code = contact.postalCode.trim() || "does_not_apply";
  p.home_address_country = contact.homeCountry;

  p.mailing_same_as_home = contact.mailingSame ? "yes" : "no";
  if (!contact.mailingSame) {
    p.mailing_address_line1 = contact.mailingStreet1;
    if (contact.mailingStreet2.trim()) p.mailing_address_line2 = contact.mailingStreet2.trim();
    p.mailing_address_city = contact.mailingCity;
    p.mailing_address_state = contact.mailingState.trim() || "does_not_apply";
    p.mailing_address_postal = contact.mailingPostalCode.trim() || "does_not_apply";
    p.mailing_address_country = contact.mailingCountry;
  }

  p.primary_phone = contact.phone;
  const normalizedAdditionalPhones = (contact.additionalPhones ?? [])
    .map((item) => `${item.dialCode} ${item.number}`.trim())
    .filter(Boolean);
  const legacySecondaryPhone = contact.secondaryPhone.trim();
  const allOtherPhones = normalizedAdditionalPhones.length
    ? normalizedAdditionalPhones
    : legacySecondaryPhone
      ? [legacySecondaryPhone]
      : [];
  p.secondary_phone = allOtherPhones[0] || "does_not_apply";
  p.work_phone = "does_not_apply";
  p.has_other_phones = allOtherPhones.length ? "yes" : "no";
  if (allOtherPhones.length > 1) {
    p.additional_phone = allOtherPhones[1];
  } else if (allOtherPhones.length === 1) {
    p.additional_phone = allOtherPhones[0];
  }

  p.email_address = contact.email;
  const normalizedAdditionalEmails = (contact.additionalEmails ?? []).map((item) => item.trim()).filter(Boolean);
  const legacySecondaryEmail = contact.secondaryEmail.trim();
  const allOtherEmails = normalizedAdditionalEmails.length
    ? normalizedAdditionalEmails
    : legacySecondaryEmail
      ? [legacySecondaryEmail]
      : [];
  if (allOtherEmails.length) {
    p.has_other_emails = "yes";
    p.additional_email = allOtherEmails.length > 1 ? allOtherEmails[1] : allOtherEmails[0];
  } else {
    p.has_other_emails = "no";
  }

  // Social media — schema platforms mapped as repeatable instances.
  const schemaPlatforms = contact.socialPlatforms.filter((pl) => pl in SCHEMA_SOCIAL_PLATFORM);
  schemaPlatforms.forEach((platform, i) => {
    const suffix = i === 0 ? "" : `__${i + 1}`;
    p[`social_media_platform${suffix}`] = SCHEMA_SOCIAL_PLATFORM[platform]!;
    const handle = contact.socialHandles[platform];
    if (handle) p[`social_media_handle${suffix}`] = handle;
  });

  const predefinedOtherSocial = contact.socialPlatforms
    .map((platform) => {
      if (platform in SCHEMA_SOCIAL_PLATFORM) return null;
      const label = OTHER_SOCIAL_LABEL[platform];
      const handle = contact.socialHandles[platform]?.trim();
      if (!label || !handle) return null;
      return { platform: label, handle };
    })
    .filter((item): item is { platform: string; handle: string } => !!item);

  const customOtherSocial = (contact.otherSocialEntries ?? [])
    .map((item) => ({
      platform: item.platform.trim(),
      handle: item.handle.trim(),
    }))
    .filter((item) => item.platform && item.handle);

  const firstOtherSocial = [...predefinedOtherSocial, ...customOtherSocial][0];
  if (firstOtherSocial) {
    p.has_other_social_media = "yes";
    p.other_social_media_name = firstOtherSocial.platform;
    p.other_social_media_identifier = firstOtherSocial.handle;
  } else {
    p.has_other_social_media = "no";
  }

  // ------------------------------------------------------------
  // Passport Information
  // ------------------------------------------------------------
  p.passport_document_type = PASSPORT_TYPE_MAP[passport.type];
  p.passport_number = passport.number;
  p.passport_book_number =
    passport.hasBookNumber && passport.bookNumber.trim()
      ? passport.bookNumber.trim()
      : "does_not_apply";
  p.passport_issuing_country = passport.issuingCountry;
  p.passport_issuance_country =
    passport.issuedInAnotherCountry && passport.issuedInAnotherCountryValue
      ? passport.issuedInAnotherCountryValue
      : passport.issuingCountry;
  p.passport_issuance_city = passport.issuanceCity.trim() || "does_not_apply";
  p.passport_issuance_state = passport.issuanceProvince.trim() || "does_not_apply";
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
    p.companion_group_travel = travel.companionGroupTravel || "no";
    if (travel.companionGroupTravel === "yes") {
      if (travel.companionGroupName.trim()) {
        p.companion_group_name = travel.companionGroupName.trim();
      }
    } else {
      const primaryCompanion = travel.companions?.[0];
      p.companion_given_names = primaryCompanion?.firstName || travel.companionFirstName;
      p.companion_surname = primaryCompanion?.lastName || travel.companionLastName;
      p.companion_relationship = (
        primaryCompanion?.relationship || travel.companionRelationship || "OTHER"
      ).toUpperCase();
    }
  }

  // ------------------------------------------------------------
  // Previous U.S. Travel
  // ------------------------------------------------------------
  p.has_been_in_us = travel.hasBeenInUs || "no";
  if (travel.hasBeenInUs === "yes") {
    const primaryVisit = travel.previousVisits?.[0];
    if (primaryVisit?.arrivalDate || travel.previousVisitDate) {
      p.previous_visit_date_arrived = primaryVisit?.arrivalDate || travel.previousVisitDate;
    }
    const visitLength = primaryVisit?.lengthValue?.trim() || travel.previousVisitLengthValue.trim();
    if (visitLength) {
      p.previous_visit_length_of_stay = visitLength;
      p.previous_visit_length_of_stay_unit = LENGTH_UNIT_MAP[
        primaryVisit?.lengthUnit || travel.previousVisitLengthUnit
      ];
    }
  }

  p.has_us_drivers_license = travel.hasUsDriversLicense || "no";
  if (travel.hasUsDriversLicense === "yes") {
    const primaryLicense = travel.usDriversLicenses?.[0];
    const licenseNumber = primaryLicense?.unknownNumber
      ? "does_not_apply"
      : (primaryLicense?.number?.trim() || travel.driversLicenseNumber.trim());
    const licenseState = primaryLicense?.state?.trim() || travel.driversLicenseState.trim();
    if (licenseNumber) p.us_drivers_license_number = licenseNumber;
    if (licenseState) p.us_drivers_license_state = licenseState;
  }

  p.has_us_visa = travel.previousVisa || "no";
  if (travel.previousVisa === "yes") {
    if (travel.previousVisaUnknownNumber) {
      p.visa_number = "does_not_apply";
      p.visa_number_unknown = "true";
    } else if (travel.previousVisaNumber.trim()) {
      p.visa_number = travel.previousVisaNumber.trim();
    } else {
      p.visa_number = "does_not_apply";
      p.visa_number_unknown = "true";
    }
    const issueDate = travel.previousVisaIssueDate || travel.previousVisaExpiry;
    if (issueDate) {
      const [yyyy, mm, dd] = issueDate.split("-");
      if (yyyy && mm && dd) {
        p.last_visa_issue_year = yyyy;
        p.last_visa_issue_month = mm;
        p.last_visa_issue_day = dd;
      }
    }
  }
  p.has_been_refused = travel.previousRefusal || "no";
  if (travel.previousRefusal === "yes") {
    const refusalExplanation = travel.previousRefusalExplanation.trim() || travel.refusalExplanation.trim();
    if (refusalExplanation) {
      p.refusal_explain = refusalExplanation;
    }
    if (travel.previousRefusalDate) {
      p.refusal_date = travel.previousRefusalDate;
    }
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

  const hasRecentIntlTravel =
    travel.hasVisitedOtherCountriesLast5Years || work.hasTraveledLast5Years || "no";
  p.has_traveled_last_five_years = hasRecentIntlTravel;
  const firstVisitedCountry = (travel.visitedCountries ?? []).find((country) => country.trim());
  if (hasRecentIntlTravel === "yes" && (firstVisitedCountry || work.traveledCountry)) {
    p.traveled_country = firstVisitedCountry || work.traveledCountry;
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
  // Spouse / Deceased Spouse / Former Spouses
  // ------------------------------------------------------------
  const SPOUSE_STATUSES = ["Married", "Common Law Marriage", "Civil Union / Domestic Partnership", "Legally Separated"] as const;
  if (SPOUSE_STATUSES.includes(identity.maritalStatus as typeof SPOUSE_STATUSES[number])) {
    if (family.spouseFirstName) p.spouse_given_names = family.spouseFirstName;
    if (family.spouseLastName) p.spouse_surname = family.spouseLastName;
    if (family.spouseDob) p.spouse_date_of_birth = family.spouseDob;
    if (family.spouseNationality) p.spouse_nationality = family.spouseNationality;
    if (family.spouseCityOfBirth) p.spouse_city_of_birth = family.spouseCityOfBirth;
    if (family.spouseCountryOfBirth) p.spouse_country_of_birth = family.spouseCountryOfBirth;
    const addressTypeMap: Record<string, string> = { home: "same_as_home", work: "same_as_work", other: "other" };
    p.spouse_address_type = addressTypeMap[family.spouseAddressType] ?? "same_as_home";
  }
  if (identity.maritalStatus === "Widowed") {
    if (family.deceasedSpouseFirstName) p.spouse_given_names = family.deceasedSpouseFirstName;
    if (family.deceasedSpouseLastName) p.spouse_surname = family.deceasedSpouseLastName;
    if (family.deceasedSpouseDob) p.spouse_date_of_birth = family.deceasedSpouseDob;
    if (family.deceasedSpouseNationality) p.spouse_nationality = family.deceasedSpouseNationality;
    if (family.deceasedSpouseCityOfBirth) p.spouse_city_of_birth = family.deceasedSpouseCityOfBirth;
    if (family.deceasedSpouseCountryOfBirth) p.spouse_country_of_birth = family.deceasedSpouseCountryOfBirth;
  }
  if (identity.maritalStatus === "Divorced" && family.formerSpouses.length > 0) {
    const fs = family.formerSpouses[0];
    if (fs.firstName) p.spouse_given_names = fs.firstName;
    if (fs.lastName) p.spouse_surname = fs.lastName;
    if (fs.dob) p.spouse_date_of_birth = fs.dob;
    if (fs.nationality) p.spouse_nationality = fs.nationality;
    if (fs.cityOfBirth) p.spouse_city_of_birth = fs.cityOfBirth;
    if (fs.countryOfBirth) p.spouse_country_of_birth = fs.countryOfBirth;
  }

  // ------------------------------------------------------------
  // Family — Relatives
  // ------------------------------------------------------------
  p.father_given_names = family.fatherKnown
    ? (family.fatherFirstNameUnknown ? "DOES NOT APPLY" : (family.fatherFirstName.trim() || "UNKNOWN"))
    : "UNKNOWN";
  p.father_surname = family.fatherKnown
    ? (family.fatherLastNameUnknown ? "DOES NOT APPLY" : (family.fatherLastName.trim() || "UNKNOWN"))
    : "UNKNOWN";
  if (family.fatherKnown && family.fatherDob) p.father_date_of_birth = family.fatherDob;
  p.mother_given_names = family.motherKnown
    ? (family.motherFirstNameUnknown ? "DOES NOT APPLY" : (family.motherFirstName.trim() || "UNKNOWN"))
    : "UNKNOWN";
  p.mother_surname = family.motherKnown
    ? (family.motherLastNameUnknown ? "DOES NOT APPLY" : (family.motherLastName.trim() || "UNKNOWN"))
    : "UNKNOWN";
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
