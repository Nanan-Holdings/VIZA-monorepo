/**
 * DS-160 Form Mappings
 *
 * Maps visa_application_answers field names to ceac.state.gov DS-160 form selectors.
 * The DS-160 form is multi-page; each page corresponds to a step_number in visa_form_fields.
 */

import { FormFieldMapping } from "./form-mappings";

// CEAC DS-160 portal URL
export const DS160_PORTAL_URL = "https://ceac.state.gov/GenNIV/Default.aspx";

// Selector for navigating between pages
export const DS160_NEXT_SELECTOR = 'input[type="submit"][value="Next"], input[id*="btnNext"], button:has-text("Next")';
export const DS160_SAVE_SELECTOR = 'input[type="submit"][value*="Save"], input[id*="btnSave"]';

// DS-160 field name → CSS selector mappings
// These correspond to the visa_application_answers.field_name values seeded in visa_form_fields

export const ds160PersonalInfoMappings: Record<string, FormFieldMapping> = {
  surname: {
    selector: 'input[id*="tbxAPP_SURNAME"], input[name*="Surname"]',
    type: "text",
    label: "Surname",
  },
  given_names: {
    selector: 'input[id*="tbxAPP_GIVEN_NAME"], input[name*="GivenName"]',
    type: "text",
    label: "Given Names",
  },
  full_name_native_alphabet: {
    selector: 'input[id*="tbxAPP_FULL_NAME_NATIVE"]',
    type: "text",
    label: "Full Name in Native Alphabet",
  },
  sex: {
    selector: 'select[id*="ddlAPP_GENDER"], input[name*="Gender"]',
    type: "select",
    label: "Sex",
  },
  marital_status: {
    selector: 'select[id*="ddlAPP_MARITAL_STATUS"]',
    type: "select",
    label: "Marital Status",
  },
  date_of_birth: {
    selector: 'input[id*="tbxAPP_DOB"]',
    type: "date",
    label: "Date of Birth",
  },
  city_of_birth: {
    selector: 'input[id*="tbxAPP_POB_CITY"]',
    type: "text",
    label: "City of Birth",
  },
  state_of_birth: {
    selector: 'input[id*="tbxAPP_POB_ST_PROVINCE"]',
    type: "text",
    label: "State/Province of Birth",
  },
  country_of_birth: {
    selector: 'select[id*="ddlAPP_POB_CNTRY"]',
    type: "select",
    label: "Country of Birth",
  },
  nationality_country: {
    selector: 'select[id*="ddlAPP_NATL"]',
    type: "select",
    label: "Nationality",
  },
  national_id_number: {
    selector: 'input[id*="tbxAPP_NATIONAL_ID"]',
    type: "text",
    label: "National ID Number",
  },
  us_social_security_number: {
    selector: 'input[id*="tbxAPP_SSN"]',
    type: "text",
    label: "US SSN",
  },
  us_taxpayer_id: {
    selector: 'input[id*="tbxAPP_TAX_ID"]',
    type: "text",
    label: "US Taxpayer ID",
  },
};

export const ds160TravelMappings: Record<string, FormFieldMapping> = {
  purpose_of_trip: {
    selector: 'select[id*="ddlTRAVEL_PURPOSE"]',
    type: "select",
    label: "Purpose of Trip",
  },
  intended_arrival_date: {
    selector: 'input[id*="tbxTRAVEL_ARRIVAL_DATE"]',
    type: "date",
    label: "Intended Arrival Date",
  },
  intended_length_of_stay: {
    selector: 'input[id*="tbxTRAVEL_LOS"]',
    type: "text",
    label: "Length of Stay",
  },
  us_address_street: {
    selector: 'input[id*="tbxTRAVEL_ADDR_LN1"]',
    type: "text",
    label: "US Address Street",
  },
  us_address_city: {
    selector: 'input[id*="tbxTRAVEL_ADDR_CITY"]',
    type: "text",
    label: "US Address City",
  },
  us_address_state: {
    selector: 'select[id*="ddlTRAVEL_ADDR_STATE"]',
    type: "select",
    label: "US Address State",
  },
  us_address_zip: {
    selector: 'input[id*="tbxTRAVEL_ADDR_ZIP"]',
    type: "text",
    label: "US Address ZIP",
  },
  // Travel Paying — payer questions appear on the Travel Information page
  travel_payer: {
    selector: 'select[id*="ddlTRAVEL_WHO_PAY"]',
    type: "select",
    label: "Who is paying for your trip?",
  },
  payer_surname: {
    selector: 'input[id*="tbxPAYER_SURNAME"]',
    type: "text",
    label: "Payer Surname",
  },
  payer_given_names: {
    selector: 'input[id*="tbxPAYER_GIVEN_NAME"]',
    type: "text",
    label: "Payer Given Names",
  },
  payer_phone: {
    selector: 'input[id*="tbxPAYER_TEL"]',
    type: "text",
    label: "Payer Phone",
  },
  payer_email: {
    selector: 'input[id*="tbxPAYER_EMAIL"]',
    type: "text",
    label: "Payer Email",
  },
  payer_relationship: {
    selector: 'select[id*="ddlPAYER_REL"]',
    type: "select",
    label: "Payer Relationship to You",
  },
};

export const ds160PassportMappings: Record<string, FormFieldMapping> = {
  passport_document_type: {
    selector: 'select[id*="ddlPPT_TYPE"]',
    type: "select",
    label: "Passport Type",
  },
  passport_number: {
    selector: 'input[id*="tbxPPT_NUM"]',
    type: "text",
    label: "Passport Number",
  },
  passport_issuing_country: {
    selector: 'select[id*="ddlPPT_ISSUED_CNTRY"]',
    type: "select",
    label: "Passport Issuing Country",
  },
  passport_issuance_date: {
    selector: 'input[id*="tbxPPT_ISSUED_DTH"]',
    type: "date",
    label: "Passport Issuance Date",
  },
  passport_expiration_date: {
    selector: 'input[id*="tbxPPT_EXPIRE_DTH"]',
    type: "date",
    label: "Passport Expiration Date",
  },
};

export const ds160ContactMappings: Record<string, FormFieldMapping> = {
  home_address_line1: {
    selector: 'input[id*="tbxAPP_ADDR_LN1"]',
    type: "text",
    label: "Home Address Line 1",
  },
  home_address_city: {
    selector: 'input[id*="tbxAPP_ADDR_CITY"]',
    type: "text",
    label: "Home City",
  },
  home_address_country: {
    selector: 'select[id*="ddlAPP_ADDR_CNTRY"]',
    type: "select",
    label: "Home Country",
  },
  primary_phone: {
    selector: 'input[id*="tbxAPP_HOME_TEL"]',
    type: "text",
    label: "Primary Phone",
  },
  email_address: {
    selector: 'input[id*="tbxAPP_EMAIL_ADDR"]',
    type: "text",
    label: "Email",
  },
};

export const ds160WorkMappings: Record<string, FormFieldMapping> = {
  primary_occupation: {
    selector: 'select[id*="ddlWORK_EDUC_PRSNT_OCCP"]',
    type: "select",
    label: "Occupation",
  },
  employer_name: {
    selector: 'input[id*="tbxWORK_EDUC_PRSNT_EMPL"]',
    type: "text",
    label: "Employer Name",
  },
  job_title: {
    selector: 'input[id*="tbxWORK_EDUC_PRSNT_JOB_TITLE"]',
    type: "text",
    label: "Job Title",
  },
};

// ---------------------------------------------------------------------------
// Personal Information 2 — nationality, other nationalities, IDs
// Already partially covered by ds160PersonalInfoMappings (fields
// nationality_country, national_id_number, us_social_security_number,
// us_taxpayer_id appear on this CEAC page). Extracted here for the
// orchestrator PAGE_FILL_MAP to map the correct page ID.
// ---------------------------------------------------------------------------
export const ds160PersonalInfo2Mappings: Record<string, FormFieldMapping> = {
  nationality_country: {
    selector: 'select[id*="ddlAPP_NATL"]',
    type: "select",
    label: "Nationality",
  },
  other_nationality: {
    selector: 'select[id*="ddlOTHER_NATL"], input[id*="rblOTHER_NATL"]',
    type: "select",
    label: "Other Nationality (Yes/No)",
  },
  permanent_resident_other_country: {
    selector: 'select[id*="ddlPERM_RES_CNTRY"], input[id*="rblPERM_RES"]',
    type: "select",
    label: "Permanent Resident of Another Country (Yes/No)",
  },
  national_id_number: {
    selector: 'input[id*="tbxAPP_NATIONAL_ID"]',
    type: "text",
    label: "National ID Number",
  },
  us_social_security_number: {
    selector: 'input[id*="tbxAPP_SSN"]',
    type: "text",
    label: "US SSN",
  },
  us_taxpayer_id: {
    selector: 'input[id*="tbxAPP_TAX_ID"]',
    type: "text",
    label: "US Taxpayer ID",
  },
};

// ---------------------------------------------------------------------------
// Travel Companions (step 4)
// Mostly conditional/repeatable fields. Minimal mapping for the initial
// radio and group name.
// ---------------------------------------------------------------------------
export const ds160TravelCompanionsMappings: Record<string, FormFieldMapping> = {
  has_companions: {
    selector: 'select[id*="ddlTRAVEL_COMPANION"], input[id*="rblTRAVEL_COMPANION"]',
    type: "select",
    label: "Are there other persons traveling with you?",
  },
  companion_group_travel: {
    selector: 'select[id*="ddlGROUP_TRAVEL"], input[id*="rblGROUP_TRAVEL"]',
    type: "select",
    label: "Traveling as part of a group?",
  },
  companion_group_name: {
    selector: 'input[id*="tbxGROUP_NAME"]',
    type: "text",
    label: "Group Name",
  },
};

// ---------------------------------------------------------------------------
// Previous U.S. Travel (step 5)
// Complex conditional section. Minimal mapping for top-level yes/no gates.
// ---------------------------------------------------------------------------
export const ds160PreviousUsTravelMappings: Record<string, FormFieldMapping> = {
  has_been_in_us: {
    selector: 'select[id*="ddlPREV_US_VISIT"], input[id*="rblPREV_US_VISIT"]',
    type: "select",
    label: "Have you ever been in the U.S.?",
  },
  has_us_visa: {
    selector: 'select[id*="ddlPREV_VISA_IND"], input[id*="rblPREV_VISA_IND"]',
    type: "select",
    label: "Have you ever been issued a U.S. Visa?",
  },
  visa_number: {
    selector: 'input[id*="tbxPREV_VISA_FOIL_NUMBER"]',
    type: "text",
    label: "Visa Number",
  },
  has_been_refused: {
    selector: 'select[id*="ddlPREV_VISA_REFUSED"], input[id*="rblPREV_VISA_REFUSED"]',
    type: "select",
    label: "Have you ever been refused a U.S. Visa?",
  },
  immigrant_petition_filed: {
    selector: 'select[id*="ddlIV_PETITION"], input[id*="rblIV_PETITION"]',
    type: "select",
    label: "Has anyone filed an immigrant petition on your behalf?",
  },
};

// ---------------------------------------------------------------------------
// U.S. Contact Information (step 13)
// ---------------------------------------------------------------------------
export const ds160UsContactMappings: Record<string, FormFieldMapping> = {
  us_contact_surname: {
    selector: 'input[id*="tbxUS_POC_SURNAME"]',
    type: "text",
    label: "US Contact Surname",
  },
  us_contact_given_names: {
    selector: 'input[id*="tbxUS_POC_GIVEN_NAME"]',
    type: "text",
    label: "US Contact Given Names",
  },
  us_contact_organization: {
    selector: 'input[id*="tbxUS_POC_ORG"]',
    type: "text",
    label: "US Contact Organization",
  },
  us_contact_relationship: {
    selector: 'select[id*="ddlUS_POC_REL"]',
    type: "select",
    label: "US Contact Relationship",
  },
  us_contact_address_street1: {
    selector: 'input[id*="tbxUS_POC_ADDR_LN1"]',
    type: "text",
    label: "US Contact Street Address",
  },
  us_contact_city: {
    selector: 'input[id*="tbxUS_POC_ADDR_CITY"]',
    type: "text",
    label: "US Contact City",
  },
  us_contact_state: {
    selector: 'select[id*="ddlUS_POC_ADDR_STATE"]',
    type: "select",
    label: "US Contact State",
  },
  us_contact_zip: {
    selector: 'input[id*="tbxUS_POC_ADDR_ZIP"]',
    type: "text",
    label: "US Contact ZIP",
  },
  us_contact_phone: {
    selector: 'input[id*="tbxUS_POC_HOME_TEL"]',
    type: "text",
    label: "US Contact Phone",
  },
  us_contact_email: {
    selector: 'input[id*="tbxUS_POC_EMAIL"]',
    type: "text",
    label: "US Contact Email",
  },
};

// ---------------------------------------------------------------------------
// Family: Relatives (step 8)
// ---------------------------------------------------------------------------
export const ds160FamilyRelativesMappings: Record<string, FormFieldMapping> = {
  father_surname: {
    selector: 'input[id*="tbxFATHER_SURNAME"]',
    type: "text",
    label: "Father's Surname",
  },
  father_given_names: {
    selector: 'input[id*="tbxFATHER_GIVEN_NAME"]',
    type: "text",
    label: "Father's Given Names",
  },
  mother_surname: {
    selector: 'input[id*="tbxMOTHER_SURNAME"]',
    type: "text",
    label: "Mother's Surname",
  },
  mother_given_names: {
    selector: 'input[id*="tbxMOTHER_GIVEN_NAME"]',
    type: "text",
    label: "Mother's Given Names",
  },
  has_immediate_us_relatives: {
    selector: 'select[id*="ddlUS_RELS_IND"], input[id*="rblUS_RELS_IND"]',
    type: "select",
    label: "Immediate relatives in the U.S.?",
  },
};

// ---------------------------------------------------------------------------
// Family: Spouse (step 9) — conditional on marital status
// ---------------------------------------------------------------------------
export const ds160FamilySpouseMappings: Record<string, FormFieldMapping> = {
  spouse_surname: {
    selector: 'input[id*="tbxSPOUSE_SURNAME"]',
    type: "text",
    label: "Spouse Surname",
  },
  spouse_given_names: {
    selector: 'input[id*="tbxSPOUSE_GIVEN_NAME"]',
    type: "text",
    label: "Spouse Given Names",
  },
  spouse_date_of_birth: {
    selector: 'input[id*="tbxSPOUSE_DOB"]',
    type: "date",
    label: "Spouse Date of Birth",
  },
  spouse_nationality: {
    selector: 'select[id*="ddlSPOUSE_NATL"]',
    type: "select",
    label: "Spouse Nationality",
  },
  spouse_city_of_birth: {
    selector: 'input[id*="tbxSPOUSE_POB_CITY"]',
    type: "text",
    label: "Spouse City of Birth",
  },
};

// ---------------------------------------------------------------------------
// Work/Education: Previous (step 15)
// Mostly conditional on has_previous_employer. Minimal mapping.
// ---------------------------------------------------------------------------
export const ds160WorkPreviousMappings: Record<string, FormFieldMapping> = {
  has_previous_employer: {
    selector: 'select[id*="ddlPREV_EMPL_IND"], input[id*="rblPREV_EMPL"]',
    type: "select",
    label: "Were you previously employed?",
  },
  prev_employer_name: {
    selector: 'input[id*="tbxPREV_EMPL_NAME"]',
    type: "text",
    label: "Previous Employer Name",
  },
};

// ---------------------------------------------------------------------------
// Work/Education: Additional (step 16)
// Mostly yes/no + conditional explainers. Minimal mapping.
// ---------------------------------------------------------------------------
export const ds160WorkAdditionalMappings: Record<string, FormFieldMapping> = {
  has_clan_tribe: {
    selector: 'select[id*="ddlCLAN_TRIBE_IND"], input[id*="rblCLAN_TRIBE"]',
    type: "select",
    label: "Do you belong to a clan or tribe?",
  },
  language_name: {
    selector: 'input[id*="tbxLANGUAGE_NAME"]',
    type: "text",
    label: "Language Name",
  },
  has_traveled_last_five_years: {
    selector: 'select[id*="ddlTRAVELED_IND"], input[id*="rblTRAVELED"]',
    type: "select",
    label: "Traveled in last 5 years?",
  },
  has_specialized_skills: {
    selector: 'select[id*="ddlSPECIALIZED_SKILLS_IND"], input[id*="rblSPECIALIZED_SKILLS"]',
    type: "select",
    label: "Specialized skills (firearms, explosives, etc.)?",
  },
  has_served_military: {
    selector: 'select[id*="ddlMILITARY_SERVICE_IND"], input[id*="rblMILITARY_SERVICE"]',
    type: "select",
    label: "Have you ever served in the military?",
  },
};

// ---------------------------------------------------------------------------
// Security and Background Parts 1–5 (steps 17–21)
// All yes/no radio questions. Selectors target the ASP.NET RadioButtonList
// base ID; the orchestrator appends [value="…"] at fill time.
// ---------------------------------------------------------------------------

export const ds160SecurityBackground1Mappings: Record<string, FormFieldMapping> = {
  has_communicable_disease: {
    selector: 'input[id*="rblSECURITY_PART1_Q1"]',
    type: "radio",
    label: "Communicable Disease",
  },
  has_physical_mental_disorder: {
    selector: 'input[id*="rblSECURITY_PART1_Q2"]',
    type: "radio",
    label: "Physical/Mental Disorder",
  },
  is_drug_abuser: {
    selector: 'input[id*="rblSECURITY_PART1_Q3"]',
    type: "radio",
    label: "Drug Abuser",
  },
};

export const ds160SecurityBackground2Mappings: Record<string, FormFieldMapping> = {
  has_arrest_conviction: {
    selector: 'input[id*="rblSECURITY_PART2_Q1"]',
    type: "radio",
    label: "Arrest/Conviction",
  },
  has_violated_controlled_substance: {
    selector: 'input[id*="rblSECURITY_PART2_Q2"]',
    type: "radio",
    label: "Controlled Substance Violation",
  },
  has_prostitution: {
    selector: 'input[id*="rblSECURITY_PART2_Q3"]',
    type: "radio",
    label: "Prostitution",
  },
  has_money_laundering: {
    selector: 'input[id*="rblSECURITY_PART2_Q4"]',
    type: "radio",
    label: "Money Laundering",
  },
  has_human_trafficking: {
    selector: 'input[id*="rblSECURITY_PART2_Q5"]',
    type: "radio",
    label: "Human Trafficking",
  },
  has_aided_human_trafficking: {
    selector: 'input[id*="rblSECURITY_PART2_Q6"]',
    type: "radio",
    label: "Aided Human Trafficking",
  },
  has_trafficking_beneficiary: {
    selector: 'input[id*="rblSECURITY_PART2_Q7"]',
    type: "radio",
    label: "Trafficking Beneficiary",
  },
};

export const ds160SecurityBackground3Mappings: Record<string, FormFieldMapping> = {
  intend_espionage: {
    selector: 'input[id*="rblSECURITY_PART3_Q1"]',
    type: "radio",
    label: "Intend Espionage",
  },
  intend_terrorist_activity: {
    selector: 'input[id*="rblSECURITY_PART3_Q2"]',
    type: "radio",
    label: "Intend Terrorist Activity",
  },
  has_provided_terrorist_support: {
    selector: 'input[id*="rblSECURITY_PART3_Q3"]',
    type: "radio",
    label: "Provided Terrorist Support",
  },
  is_terrorist_member: {
    selector: 'input[id*="rblSECURITY_PART3_Q4"]',
    type: "radio",
    label: "Terrorist Organization Member",
  },
  is_terrorist_family: {
    selector: 'input[id*="rblSECURITY_PART3_Q5"]',
    type: "radio",
    label: "Terrorist Family Member",
  },
  has_genocide: {
    selector: 'input[id*="rblSECURITY_PART3_Q6"]',
    type: "radio",
    label: "Genocide",
  },
  has_torture: {
    selector: 'input[id*="rblSECURITY_PART3_Q7"]',
    type: "radio",
    label: "Torture",
  },
  has_extrajudicial_killings: {
    selector: 'input[id*="rblSECURITY_PART3_Q8"]',
    type: "radio",
    label: "Extrajudicial Killings",
  },
  has_child_soldier: {
    selector: 'input[id*="rblSECURITY_PART3_Q9"]',
    type: "radio",
    label: "Child Soldier",
  },
  has_religious_freedom_violation: {
    selector: 'input[id*="rblSECURITY_PART3_Q10"]',
    type: "radio",
    label: "Religious Freedom Violation",
  },
  has_population_control: {
    selector: 'input[id*="rblSECURITY_PART3_Q11"]',
    type: "radio",
    label: "Population Control",
  },
  has_coercive_transplant: {
    selector: 'input[id*="rblSECURITY_PART3_Q12"]',
    type: "radio",
    label: "Coercive Transplant",
  },
};

export const ds160SecurityBackground4Mappings: Record<string, FormFieldMapping> = {
  has_immigration_fraud: {
    selector: 'input[id*="rblSECURITY_PART4_Q1"]',
    type: "radio",
    label: "Immigration Fraud",
  },
  has_removal_order: {
    selector: 'input[id*="rblSECURITY_PART4_Q2"]',
    type: "radio",
    label: "Removal/Deportation Order",
  },
};

export const ds160SecurityBackground5Mappings: Record<string, FormFieldMapping> = {
  has_withheld_child_custody: {
    selector: 'input[id*="rblSECURITY_PART5_Q1"]',
    type: "radio",
    label: "Withheld Child Custody",
  },
  has_voted_illegally: {
    selector: 'input[id*="rblSECURITY_PART5_Q2"]',
    type: "radio",
    label: "Voted Illegally",
  },
  has_renounced_citizenship: {
    selector: 'input[id*="rblSECURITY_PART5_Q3"]',
    type: "radio",
    label: "Renounced Citizenship",
  },
};

// All DS-160 mapping groups in page order
export const DS160_MAPPING_GROUPS = [
  { name: "Personal Info", mappings: ds160PersonalInfoMappings },
  { name: "Personal Info 2", mappings: ds160PersonalInfo2Mappings },
  { name: "Travel", mappings: ds160TravelMappings },
  { name: "Travel Companions", mappings: ds160TravelCompanionsMappings },
  { name: "Previous US Travel", mappings: ds160PreviousUsTravelMappings },
  { name: "Passport", mappings: ds160PassportMappings },
  { name: "Contact", mappings: ds160ContactMappings },
  { name: "US Contact", mappings: ds160UsContactMappings },
  { name: "Family Relatives", mappings: ds160FamilyRelativesMappings },
  { name: "Family Spouse", mappings: ds160FamilySpouseMappings },
  { name: "Work/Education Present", mappings: ds160WorkMappings },
  { name: "Work/Education Previous", mappings: ds160WorkPreviousMappings },
  { name: "Work/Education Additional", mappings: ds160WorkAdditionalMappings },
  { name: "Security Background 1", mappings: ds160SecurityBackground1Mappings },
  { name: "Security Background 2", mappings: ds160SecurityBackground2Mappings },
  { name: "Security Background 3", mappings: ds160SecurityBackground3Mappings },
  { name: "Security Background 4", mappings: ds160SecurityBackground4Mappings },
  { name: "Security Background 5", mappings: ds160SecurityBackground5Mappings },
];
