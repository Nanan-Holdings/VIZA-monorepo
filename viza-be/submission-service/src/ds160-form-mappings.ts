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

// All DS-160 mapping groups in page order
export const DS160_MAPPING_GROUPS = [
  { name: "Personal Info", mappings: ds160PersonalInfoMappings },
  { name: "Travel", mappings: ds160TravelMappings },
  { name: "Passport", mappings: ds160PassportMappings },
  { name: "Contact", mappings: ds160ContactMappings },
  { name: "Work/Education", mappings: ds160WorkMappings },
];
