type Ds160GuideHintKey =
  | "identity.firstNameHint"
  | "identity.lastNameHint"
  | "identity.dateOfBirthHint"
  | "identity.birthPlaceHint"
  | "identity.maritalStatusHint"
  | "identity.hasOtherNameTooltip"
  | "identity.hasNativeAlphabetTooltip"
  | "identity.hasTelecodeTooltip"
  | "contact.additionalPhonesHint"
  | "contact.additionalEmailsHint"
  | "contact.homeAddressHint"
  | "contact.mailingSameHint"
  | "contact.socialMediaHint"
  | "contact.otherPlatformsHint"
  | "passport.numberHint"
  | "passport.bookNumberHelp"
  | "passport.issuingPlaceHint"
  | "passport.extraOtherCitizenshipHint"
  | "passport.extraOtherCountryPermanentResidenceHint"
  | "passport.extraSsnHint"
  | "passport.extraItinHint"
  | "passport.nationalIdHelp"
  | "passport.lostPassportHint"
  | "passport.passportDatesHint"
  | "travel.usAccommodationTruthHint"
  | "travel.plansHint"
  | "travel.estimatedTripHint"
  | "travel.payerHint"
  | "travel.previousVisaHint"
  | "travel.previousRefusalHint"
  | "travel.petitionFiledHint"
  | "travel.hasCompanionsHint"
  | "travel.companionGroupTravelHint"
  | "travel.visitedCountriesHint"
  | "travel.hasBeenInUsHint"
  | "usContact.truthfulContactHint"
  | "family.parentSubtitle"
  | "family.spouseSubtitle"
  | "family.formerSpouseSubtitle"
  | "family.relativesInUsHint"
  | "family.hasOtherRelativesHint"
  | "family.clanTribeHint"
  | "family.languagesHint"
  | "workEducation.primaryOccupationHint"
  | "workEducation.employerNameHint"
  | "workEducation.employmentStartDateHint"
  | "workEducation.monthlySalaryHint"
  | "workEducation.monthlySalaryTruthHint"
  | "workEducation.employerPhoneHint"
  | "workEducation.jobDutiesHint"
  | "workEducation.previousEmployerSubtitle"
  | "workEducation.educationHistorySubtitle"
  | "workEducation.educationCourseHint"
  | "workEducation.organizationSubtitle"
  | "workEducation.militarySubtitle"
  | "workEducation.specializedSkillsSubtitle";

export const DS160_LONG_FORM_GUIDE_HINT_KEYS: Record<string, Ds160GuideHintKey[]> = {
  surname: ["identity.lastNameHint"],
  given_names: ["identity.firstNameHint"],
  full_name_native_alphabet: ["identity.hasNativeAlphabetTooltip"],
  other_names_used: ["identity.hasOtherNameTooltip"],
  other_surname: ["identity.hasOtherNameTooltip"],
  other_given_names: ["identity.hasOtherNameTooltip"],
  has_telecode: ["identity.hasTelecodeTooltip"],
  telecode_surname: ["identity.hasTelecodeTooltip"],
  telecode_given_names: ["identity.hasTelecodeTooltip"],
  marital_status: ["identity.maritalStatusHint"],
  marital_status_other_explain: ["identity.maritalStatusHint"],
  date_of_birth: ["identity.dateOfBirthHint"],
  city_of_birth: ["identity.birthPlaceHint"],
  state_of_birth: ["identity.birthPlaceHint"],
  country_of_birth: ["identity.birthPlaceHint"],

  other_nationality: ["passport.extraOtherCitizenshipHint"],
  other_nationality_country: ["passport.extraOtherCitizenshipHint"],
  other_nationality_has_passport: ["passport.extraOtherCitizenshipHint"],
  other_nationality_passport_number: ["passport.extraOtherCitizenshipHint"],
  permanent_resident_other_country: ["passport.extraOtherCountryPermanentResidenceHint"],
  other_permanent_resident_country: ["passport.extraOtherCountryPermanentResidenceHint"],
  national_id_number: ["passport.nationalIdHelp"],
  us_social_security_number: ["passport.extraSsnHint"],
  us_taxpayer_id: ["passport.extraItinHint"],

  has_specific_plans: ["travel.plansHint"],
  arrival_date: ["travel.plansHint"],
  arrival_flight: ["travel.plansHint"],
  arrival_city: ["travel.plansHint"],
  departure_date: ["travel.plansHint"],
  departure_flight: ["travel.plansHint"],
  departure_city: ["travel.plansHint"],
  planned_location: ["travel.usAccommodationTruthHint"],
  intended_arrival_date: ["travel.estimatedTripHint"],
  intended_length_of_stay_value: ["travel.estimatedTripHint"],
  intended_length_of_stay_unit: ["travel.estimatedTripHint"],
  us_address_street1: ["travel.usAccommodationTruthHint"],
  us_address_street2: ["travel.usAccommodationTruthHint"],
  us_address_city: ["travel.usAccommodationTruthHint"],
  us_address_state: ["travel.usAccommodationTruthHint"],
  us_address_zip: ["travel.usAccommodationTruthHint"],
  trip_payer_type: ["travel.payerHint"],
  payer_surname: ["travel.payerHint"],
  payer_given_names: ["travel.payerHint"],
  payer_phone: ["travel.payerHint"],
  payer_email: ["travel.payerHint"],
  payer_relationship: ["travel.payerHint"],
  payer_address_same_as_home: ["travel.payerHint"],
  payer_address_street1: ["travel.payerHint"],
  payer_address_street2: ["travel.payerHint"],
  payer_address_city: ["travel.payerHint"],
  payer_address_state: ["travel.payerHint"],
  payer_address_postal: ["travel.payerHint"],
  payer_address_country: ["travel.payerHint"],
  payer_org_name: ["travel.payerHint"],
  payer_org_phone: ["travel.payerHint"],
  payer_org_relationship: ["travel.payerHint"],
  payer_org_address_street1: ["travel.payerHint"],
  payer_org_address_street2: ["travel.payerHint"],
  payer_org_address_city: ["travel.payerHint"],
  payer_org_address_state: ["travel.payerHint"],
  payer_org_address_postal: ["travel.payerHint"],
  payer_org_address_country: ["travel.payerHint"],

  has_companions: ["travel.hasCompanionsHint"],
  companion_group_travel: ["travel.companionGroupTravelHint"],
  companion_group_name: ["travel.companionGroupTravelHint"],
  companion_surname: ["travel.hasCompanionsHint"],
  companion_given_names: ["travel.hasCompanionsHint"],
  companion_relationship: ["travel.hasCompanionsHint"],

  has_been_in_us: ["travel.hasBeenInUsHint"],
  previous_visit_date_arrived: ["travel.hasBeenInUsHint"],
  previous_visit_length_of_stay: ["travel.hasBeenInUsHint"],
  previous_visit_length_of_stay_unit: ["travel.hasBeenInUsHint"],
  has_us_drivers_license: ["travel.hasBeenInUsHint"],
  us_drivers_license_number: ["travel.hasBeenInUsHint"],
  us_drivers_license_state: ["travel.hasBeenInUsHint"],
  has_us_visa: ["travel.previousVisaHint"],
  last_visa_issue_day: ["travel.previousVisaHint"],
  last_visa_issue_month: ["travel.previousVisaHint"],
  last_visa_issue_year: ["travel.previousVisaHint"],
  visa_number: ["travel.previousVisaHint"],
  visa_number_unknown: ["travel.previousVisaHint"],
  applying_same_visa_type: ["travel.previousVisaHint"],
  applying_same_country_of_issue_and_residence: ["travel.previousVisaHint"],
  has_been_ten_printed: ["travel.previousVisaHint"],
  visa_lost_or_stolen: ["travel.previousVisaHint"],
  year_visa_lost_or_stolen: ["travel.previousVisaHint"],
  visa_lost_or_stolen_explain: ["travel.previousVisaHint"],
  visa_cancelled_or_revoked: ["travel.previousVisaHint"],
  visa_cancelled_or_revoked_explain: ["travel.previousVisaHint"],
  has_been_refused: ["travel.previousRefusalHint"],
  refusal_explain: ["travel.previousRefusalHint"],
  immigrant_petition_filed: ["travel.petitionFiledHint"],
  immigrant_petition_explain: ["travel.petitionFiledHint"],

  home_address_line1: ["contact.homeAddressHint"],
  home_address_line2: ["contact.homeAddressHint"],
  home_address_city: ["contact.homeAddressHint"],
  home_address_state_province: ["contact.homeAddressHint"],
  home_address_postal_code: ["contact.homeAddressHint"],
  home_address_country: ["contact.homeAddressHint"],
  mailing_same_as_home: ["contact.mailingSameHint"],
  mailing_address_line1: ["contact.mailingSameHint"],
  mailing_address_line2: ["contact.mailingSameHint"],
  mailing_address_city: ["contact.mailingSameHint"],
  mailing_address_state: ["contact.mailingSameHint"],
  mailing_address_postal: ["contact.mailingSameHint"],
  mailing_address_country: ["contact.mailingSameHint"],
  primary_phone: ["contact.additionalPhonesHint"],
  secondary_phone: ["contact.additionalPhonesHint"],
  work_phone: ["contact.additionalPhonesHint"],
  has_other_phones: ["contact.additionalPhonesHint"],
  additional_phone: ["contact.additionalPhonesHint"],
  email_address: ["contact.additionalEmailsHint"],
  has_other_emails: ["contact.additionalEmailsHint"],
  additional_email: ["contact.additionalEmailsHint"],
  social_media_platform: ["contact.socialMediaHint"],
  social_media_handle: ["contact.socialMediaHint"],
  has_other_social_media: ["contact.otherPlatformsHint"],
  other_social_media_name: ["contact.otherPlatformsHint"],
  other_social_media_identifier: ["contact.otherPlatformsHint"],

  passport_number: ["passport.numberHint"],
  passport_book_number: ["passport.bookNumberHelp"],
  passport_issuing_country: ["passport.issuingPlaceHint"],
  passport_issuance_city: ["passport.issuingPlaceHint"],
  passport_issuance_state: ["passport.issuingPlaceHint"],
  passport_issuance_country: ["passport.issuingPlaceHint"],
  passport_issuance_date: ["passport.passportDatesHint"],
  passport_expiration_date: ["passport.passportDatesHint"],
  lost_passport: ["passport.lostPassportHint"],
  lost_passport_number: ["passport.lostPassportHint"],
  lost_passport_country: ["passport.lostPassportHint"],
  lost_passport_explain: ["passport.lostPassportHint"],

  father_surname: ["family.parentSubtitle"],
  father_given_names: ["family.parentSubtitle"],
  father_date_of_birth: ["family.parentSubtitle"],
  mother_surname: ["family.parentSubtitle"],
  mother_given_names: ["family.parentSubtitle"],
  mother_date_of_birth: ["family.parentSubtitle"],
  has_immediate_us_relatives: ["family.relativesInUsHint"],
  us_relative_surname: ["family.relativesInUsHint"],
  us_relative_given_names: ["family.relativesInUsHint"],
  us_relative_relationship: ["family.relativesInUsHint"],
  us_relative_status: ["family.relativesInUsHint"],
  has_other_us_relatives: ["family.hasOtherRelativesHint"],
  spouse_surname: ["family.spouseSubtitle"],
  spouse_given_names: ["family.spouseSubtitle"],
  spouse_date_of_birth: ["family.spouseSubtitle"],
  spouse_nationality: ["family.spouseSubtitle"],
  spouse_city_of_birth: ["family.spouseSubtitle"],
  spouse_country_of_birth: ["family.spouseSubtitle"],
  spouse_address_type: ["family.spouseSubtitle"],
  spouse_address_street1: ["family.spouseSubtitle"],
  spouse_address_street2: ["family.spouseSubtitle"],
  spouse_address_city: ["family.spouseSubtitle"],
  spouse_address_state: ["family.spouseSubtitle"],
  spouse_address_zip: ["family.spouseSubtitle"],
  spouse_address_country: ["family.spouseSubtitle"],
  partner_surname: ["family.spouseSubtitle"],
  partner_given_names: ["family.spouseSubtitle"],
  partner_date_of_birth: ["family.spouseSubtitle"],
  partner_nationality: ["family.spouseSubtitle"],
  partner_city_of_birth: ["family.spouseSubtitle"],
  partner_country_of_birth: ["family.spouseSubtitle"],
  partner_address_type: ["family.spouseSubtitle"],
  partner_address_street1: ["family.spouseSubtitle"],
  partner_address_street2: ["family.spouseSubtitle"],
  partner_address_city: ["family.spouseSubtitle"],
  partner_address_state: ["family.spouseSubtitle"],
  partner_address_zip: ["family.spouseSubtitle"],
  partner_address_country: ["family.spouseSubtitle"],
  deceased_spouse_surname: ["family.formerSpouseSubtitle"],
  deceased_spouse_given_names: ["family.formerSpouseSubtitle"],
  deceased_spouse_date_of_birth: ["family.formerSpouseSubtitle"],
  deceased_spouse_nationality: ["family.formerSpouseSubtitle"],
  deceased_spouse_city_of_birth: ["family.formerSpouseSubtitle"],
  deceased_spouse_country_of_birth: ["family.formerSpouseSubtitle"],
  number_of_former_spouses: ["family.formerSpouseSubtitle"],
  former_spouse_surname: ["family.formerSpouseSubtitle"],
  former_spouse_given_names: ["family.formerSpouseSubtitle"],
  former_spouse_date_of_birth: ["family.formerSpouseSubtitle"],
  former_spouse_nationality: ["family.formerSpouseSubtitle"],
  former_spouse_city_of_birth: ["family.formerSpouseSubtitle"],
  former_spouse_country_of_birth: ["family.formerSpouseSubtitle"],
  former_spouse_date_of_marriage: ["family.formerSpouseSubtitle"],
  former_spouse_date_marriage_ended: ["family.formerSpouseSubtitle"],
  former_spouse_how_marriage_ended: ["family.formerSpouseSubtitle"],
  former_spouse_country_marriage_terminated: ["family.formerSpouseSubtitle"],

  us_contact_surname: ["usContact.truthfulContactHint"],
  us_contact_given_names: ["usContact.truthfulContactHint"],
  us_contact_organization: ["usContact.truthfulContactHint"],
  us_contact_relationship: ["usContact.truthfulContactHint"],
  us_contact_address_street1: ["usContact.truthfulContactHint"],
  us_contact_address_street2: ["usContact.truthfulContactHint"],
  us_contact_city: ["usContact.truthfulContactHint"],
  us_contact_state: ["usContact.truthfulContactHint"],
  us_contact_zip: ["usContact.truthfulContactHint"],
  us_contact_phone: ["usContact.truthfulContactHint"],
  us_contact_email: ["usContact.truthfulContactHint"],

  primary_occupation: ["workEducation.primaryOccupationHint"],
  occupation_other_explain: ["workEducation.primaryOccupationHint"],
  employer_name: ["workEducation.employerNameHint"],
  employer_address_line1: ["workEducation.employerNameHint"],
  employer_address_line2: ["workEducation.employerNameHint"],
  employer_city: ["workEducation.employerNameHint"],
  employer_state_province: ["workEducation.employerNameHint"],
  employer_postal_code: ["workEducation.employerNameHint"],
  employer_country: ["workEducation.employerNameHint"],
  employer_phone: ["workEducation.employerPhoneHint"],
  job_title: ["workEducation.primaryOccupationHint"],
  employment_start_date: ["workEducation.employmentStartDateHint"],
  monthly_salary: ["workEducation.monthlySalaryHint", "workEducation.monthlySalaryTruthHint"],
  job_duties: ["workEducation.jobDutiesHint"],
  has_previous_employer: ["workEducation.previousEmployerSubtitle"],
  prev_employer_name: ["workEducation.previousEmployerSubtitle"],
  prev_employer_address_street1: ["workEducation.previousEmployerSubtitle"],
  prev_employer_address_street2: ["workEducation.previousEmployerSubtitle"],
  prev_employer_city: ["workEducation.previousEmployerSubtitle"],
  prev_employer_state: ["workEducation.previousEmployerSubtitle"],
  prev_employer_postal: ["workEducation.previousEmployerSubtitle"],
  prev_employer_country: ["workEducation.previousEmployerSubtitle"],
  prev_employer_phone: ["workEducation.previousEmployerSubtitle"],
  prev_job_title: ["workEducation.previousEmployerSubtitle"],
  prev_supervisor_surname: ["workEducation.previousEmployerSubtitle"],
  prev_supervisor_given_names: ["workEducation.previousEmployerSubtitle"],
  prev_employment_start_date: ["workEducation.previousEmployerSubtitle"],
  prev_employment_end_date: ["workEducation.previousEmployerSubtitle"],
  prev_job_duties: ["workEducation.previousEmployerSubtitle"],
  has_attended_education: ["workEducation.educationHistorySubtitle"],
  education_institution_name: ["workEducation.educationHistorySubtitle"],
  education_address_line1: ["workEducation.educationHistorySubtitle"],
  education_address_line2: ["workEducation.educationHistorySubtitle"],
  education_city: ["workEducation.educationHistorySubtitle"],
  education_state_province: ["workEducation.educationHistorySubtitle"],
  education_postal_code: ["workEducation.educationHistorySubtitle"],
  education_country: ["workEducation.educationHistorySubtitle"],
  education_course_of_study: ["workEducation.educationCourseHint"],
  education_start_date: ["workEducation.educationHistorySubtitle"],
  education_end_date: ["workEducation.educationHistorySubtitle"],
  has_clan_tribe: ["family.clanTribeHint"],
  clan_tribe_name: ["family.clanTribeHint"],
  language_name: ["family.languagesHint"],
  has_traveled_last_five_years: ["travel.visitedCountriesHint"],
  traveled_country: ["travel.visitedCountriesHint"],
  has_belonged_to_organization: ["workEducation.organizationSubtitle"],
  organization_name: ["workEducation.organizationSubtitle"],
  has_specialized_skills: ["workEducation.specializedSkillsSubtitle"],
  specialized_skills_explain: ["workEducation.specializedSkillsSubtitle"],
  has_served_military: ["workEducation.militarySubtitle"],
  military_country: ["workEducation.militarySubtitle"],
  military_branch: ["workEducation.militarySubtitle"],
  military_rank: ["workEducation.militarySubtitle"],
  military_specialty: ["workEducation.militarySubtitle"],
  military_date_from: ["workEducation.militarySubtitle"],
  military_date_to: ["workEducation.militarySubtitle"],
  has_served_paramilitary: ["workEducation.militarySubtitle"],
  paramilitary_explain: ["workEducation.militarySubtitle"],
};

const DS160_VISA_TYPE_ALIASES = new Set(["DS160", "US_DS160", "B1_B2", "B1/B2"]);
const US_COUNTRY_ALIASES = new Set(["", "us", "usa", "united_states", "united states"]);

function normalizeToken(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase().replace(/[-\s]+/g, "_");
}

export function normalizeDs160GuideHintFieldName(fieldName: string): string {
  return fieldName
    .replace(/-(zh|en)$/u, "")
    .replace(/__\d+$/u, "");
}

export function isDs160LongFormGuideHintContext(
  country: string | null | undefined,
  visaType: string | null | undefined,
  fieldVisaType?: string | null,
): boolean {
  const normalizedVisaType = String(visaType ?? fieldVisaType ?? "").trim().toUpperCase();
  if (!DS160_VISA_TYPE_ALIASES.has(normalizedVisaType)) return false;
  return US_COUNTRY_ALIASES.has(normalizeToken(country));
}

export function getDs160LongFormGuideHintKeys(fieldName: string): Ds160GuideHintKey[] {
  return DS160_LONG_FORM_GUIDE_HINT_KEYS[normalizeDs160GuideHintFieldName(fieldName)] ?? [];
}
