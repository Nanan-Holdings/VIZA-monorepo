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
  full_name_native_alphabet_na: {
    selector: 'input[id*="cbexAPP_FULL_NAME_NATIVE_NA"]',
    type: "checkbox",
    label: "Full Name in Native Alphabet Does Not Apply",
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
  date_of_birth_day: {
    selector: 'select[id*="ddlDOBDay"], select[id*="DOBDay"]',
    type: "select",
    label: "Date of Birth Day",
  },
  date_of_birth_month: {
    selector: 'select[id*="ddlDOBMonth"], select[id*="DOBMonth"]',
    type: "select",
    label: "Date of Birth Month",
  },
  date_of_birth_year: {
    selector: 'input[id*="tbxDOBYear"], input[id*="DOBYear"]',
    type: "text",
    label: "Date of Birth Year",
  },
  has_other_names: {
    selector: 'input[name*="rblOtherNames"], input[id*="rblOtherNames"]',
    type: "radio",
    label: "Has used other names",
  },
  has_telecode: {
    selector: 'input[name*="rblTelecodeQuestion"], input[id*="rblTelecodeQuestion"]',
    type: "radio",
    label: "Has telecode",
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
  // Note: nationality_country, national_id_number, us_social_security_number,
  // us_taxpayer_id live on Personal Information 2 (ds160PersonalInfo2Mappings),
  // NOT Personal Information 1. Including them here causes spurious
  // "Could not fill" warnings on PI1 and leaves PI2's versions unfilled if
  // the PAGE_FILL_MAP ever points this group at PI2.
};

export const ds160TravelMappings: Record<string, FormFieldMapping> = {
  // "Have you made specific travel plans?" — Yes/No radio. Gates the
  // remainder of the page: when "N", several fields (arrival date,
  // length of stay, US address) collapse into a simpler intended-stay
  // format. Answering this first is required.
  has_specific_travel_plans: {
    selector: 'input[name*="rblSpecificTravel"], input[id*="rblSpecificTravel"]',
    type: "radio",
    label: "Have specific travel plans",
  },
  purpose_of_trip: {
    // Live DOM: `dlPrincipalAppTravel$ctl00$ddlPurposeOfTrip`. The
    // `ddlTRAVEL_PURPOSE` pattern is from an older CEAC revision.
    selector: 'select[id*="ddlPurposeOfTrip"], select[id*="ddlTRAVEL_PURPOSE"]',
    type: "select",
    label: "Purpose of Trip",
  },
  purpose_of_trip_specify: {
    // Sub-purpose dropdown (e.g. B1-B2) that appears after `purpose_of_trip`
    // is selected. Named `ddlOtherPurpose` in live CEAC DOM.
    selector: 'select[id*="ddlOtherPurpose"]',
    type: "select",
    label: "Specify Purpose",
  },
  who_is_paying: {
    // Live DOM: `ddlWhoIsPaying`. Older mapping used `ddlTRAVEL_WHO_PAY`.
    selector: 'select[id*="ddlWhoIsPaying"], select[id*="ddlTRAVEL_WHO_PAY"]',
    type: "select",
    label: "Who is paying for your trip",
  },
  // Intended Arrival Date is three separate CEAC controls (live DOM):
  //   ddlTRAVEL_DTEDay (select), ddlTRAVEL_DTEMonth (select), tbxTRAVEL_DTEYear (text)
  intended_arrival_date_day: {
    selector: 'select[id*="ddlTRAVEL_DTEDay"]',
    type: "select",
    label: "Intended Arrival Day",
  },
  intended_arrival_date_month: {
    selector: 'select[id*="ddlTRAVEL_DTEMonth"]',
    type: "select",
    label: "Intended Arrival Month",
  },
  intended_arrival_date_year: {
    selector: 'input[id*="tbxTRAVEL_DTEYear"]',
    type: "text",
    label: "Intended Arrival Year",
  },
  intended_length_of_stay: {
    selector: 'input[id*="tbxTRAVEL_LOS"]',
    type: "text",
    label: "Length of Stay",
  },
  intended_length_of_stay_unit: {
    selector: 'select[id*="ddlTRAVEL_LOS_CD"]',
    type: "select",
    label: "Length of Stay Unit",
  },
  // Live CEAC (Travel Information) uses `tbxStreetAddress1`, `tbxCity`,
  // `ddlTravelState`, `tbZIPCode`. Older mapping names (`TRAVEL_ADDR_*`)
  // don't match current CEAC markup.
  us_address_street: {
    selector: 'input[id*="tbxStreetAddress1"], input[id*="tbxTRAVEL_ADDR_LN1"]',
    type: "text",
    label: "US Address Street",
  },
  us_address_city: {
    selector: 'input[id*="tbxCity"], input[id*="tbxTRAVEL_ADDR_CITY"]',
    type: "text",
    label: "US Address City",
  },
  us_address_state: {
    selector: 'select[id*="ddlTravelState"], select[id*="ddlTRAVEL_ADDR_STATE"]',
    type: "select",
    label: "US Address State",
  },
  us_address_zip: {
    selector: 'input[id*="tbZIPCode"], input[id*="tbxZIPCode"], input[id*="tbxTRAVEL_ADDR_ZIP"]',
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
  passport_book_number: {
    selector: 'input[id*="tbxPPT_BOOK_NUM"]',
    type: "text",
    label: "Passport Book Number",
  },
  passport_book_number_na: {
    selector: 'input[id*="cbexPPT_BOOK_NUM_NA"], input[id*="cbxPPT_BOOK_NUM_NA"]',
    type: "checkbox",
    label: "Passport Book Number Does Not Apply",
  },
  passport_issuing_country: {
    selector: 'select[id*="ddlPPT_ISSUED_CNTRY"]',
    type: "select",
    label: "Passport Issuing Country",
  },
  // Issued In — city / state / country are separate fields
  passport_issuance_city: {
    selector: 'input[id*="tbxPPT_ISSUED_IN_CITY"]',
    type: "text",
    label: "Passport Issuance City",
  },
  passport_issuance_state: {
    selector: 'input[id*="tbxPPT_ISSUED_IN_STATE"]',
    type: "text",
    label: "Passport Issuance State",
  },
  passport_issuance_country: {
    selector: 'select[id*="ddlPPT_ISSUED_IN_CNTRY"]',
    type: "select",
    label: "Passport Issuance Country",
  },
  // Issuance date: split into day (select), month (select), year (text)
  passport_issue_day: {
    selector: 'select[id*="ddlPPT_ISSUED_DTEDay"]',
    type: "select",
    label: "Passport Issue Day",
  },
  passport_issue_month: {
    selector: 'select[id*="ddlPPT_ISSUED_DTEMonth"]',
    type: "select",
    label: "Passport Issue Month",
  },
  passport_issue_year: {
    selector: 'input[id*="tbxPPT_ISSUEDYear"]',
    type: "text",
    label: "Passport Issue Year",
  },
  // Expiration date: split the same way
  passport_expiry_day: {
    selector: 'select[id*="ddlPPT_EXPIRE_DTEDay"]',
    type: "select",
    label: "Passport Expiry Day",
  },
  passport_expiry_month: {
    selector: 'select[id*="ddlPPT_EXPIRE_DTEMonth"]',
    type: "select",
    label: "Passport Expiry Month",
  },
  passport_expiry_year: {
    selector: 'input[id*="tbxPPT_EXPIREYear"]',
    type: "text",
    label: "Passport Expiry Year",
  },
  passport_has_expiry: {
    selector: 'input[id*="cbxPPT_EXPIRE_NA"]',
    type: "checkbox",
    label: "Passport No Expiration",
  },
  passport_lost_or_stolen: {
    selector: 'input[name*="rblLOST_PPT_IND"], input[id*="rblLOST_PPT_IND"]',
    type: "radio",
    label: "Passport ever lost or stolen",
  },
};

export const ds160ContactMappings: Record<string, FormFieldMapping> = {
  home_address_line1: {
    selector: 'input[id*="tbxAPP_ADDR_LN1"]',
    type: "text",
    label: "Home Address Line 1",
  },
  home_address_line2: {
    selector: 'input[id*="tbxAPP_ADDR_LN2"]',
    type: "text",
    label: "Home Address Line 2",
  },
  home_address_city: {
    selector: 'input[id*="tbxAPP_ADDR_CITY"]',
    type: "text",
    label: "Home City",
  },
  home_address_state: {
    selector: 'input[id*="tbxAPP_ADDR_STATE"]',
    type: "text",
    label: "Home State/Province",
  },
  home_address_state_na: {
    selector: 'input[id*="cbexAPP_ADDR_STATE_NA"]',
    type: "checkbox",
    label: "Home State Does Not Apply",
  },
  home_address_postal: {
    selector: 'input[id*="tbxAPP_ADDR_POSTAL_CD"]',
    type: "text",
    label: "Home Postal Code",
  },
  home_address_postal_na: {
    selector: 'input[id*="cbexAPP_ADDR_POSTAL_CD_NA"]',
    type: "checkbox",
    label: "Home Postal Does Not Apply",
  },
  home_address_country: {
    // Live CEAC uses `ddlCountry` for the home-address country on this
    // page, not the older `ddlAPP_ADDR_CNTRY` name.
    selector: 'select[id*="ddlCountry"], select[id*="ddlAPP_ADDR_CNTRY"]',
    type: "select",
    label: "Home Country",
  },
  mailing_same_as_home: {
    selector: 'input[name*="rblMailingAddrSame"], input[id*="rblMailingAddrSame"]',
    type: "radio",
    label: "Mailing address same as home",
  },
  primary_phone: {
    selector: 'input[id*="tbxAPP_HOME_TEL"]',
    type: "text",
    label: "Primary Phone",
  },
  mobile_phone: {
    selector: 'input[id*="tbxAPP_MOBILE_TEL"]',
    type: "text",
    label: "Mobile Phone",
  },
  mobile_phone_na: {
    selector: 'input[id*="cbexAPP_MOBILE_TEL_NA"]',
    type: "checkbox",
    label: "Mobile Phone Does Not Apply",
  },
  work_phone: {
    selector: 'input[id*="tbxAPP_BUS_TEL"]',
    type: "text",
    label: "Work Phone",
  },
  work_phone_na: {
    selector: 'input[id*="cbexAPP_BUS_TEL_NA"]',
    type: "checkbox",
    label: "Work Phone Does Not Apply",
  },
  has_other_phone: {
    selector: 'input[name*="rblAddPhone"], input[id*="rblAddPhone"]',
    type: "radio",
    label: "Has other phone numbers",
  },
  email_address: {
    selector: 'input[id*="tbxAPP_EMAIL_ADDR"]',
    type: "text",
    label: "Email",
  },
  has_other_email: {
    selector: 'input[name*="rblAddEmail"], input[id*="rblAddEmail"]',
    type: "radio",
    label: "Has other email addresses",
  },
  has_social_media: {
    selector: 'input[name*="rblAddSocial"], input[id*="rblAddSocial"]',
    type: "radio",
    label: "Has additional social media presence",
  },
  social_media_provider: {
    selector: 'select[id*="dtlSocial"][id*="ddlSocialMedia"]',
    type: "select",
    label: "Social Media Provider",
  },
  social_media_identifier: {
    selector: 'input[id*="dtlSocial"][id*="tbxSocialMediaIdent"]',
    type: "text",
    label: "Social Media Identifier",
  },
};

export const ds160WorkMappings: Record<string, FormFieldMapping> = {
  primary_occupation: {
    // Live CEAC: `ddlPresentOccupation`. Older `ddlWORK_EDUC_PRSNT_OCCP`
    // is kept as a fallback for legacy deployments.
    selector: 'select[id*="ddlPresentOccupation"], select[id*="ddlWORK_EDUC_PRSNT_OCCP"]',
    type: "select",
    label: "Occupation",
  },
  employer_name: {
    selector: 'input[id*="tbxEmpSchName"], input[id*="tbxWORK_EDUC_PRSNT_EMPL"]',
    type: "text",
    label: "Employer Name",
  },
  job_title: {
    selector: 'input[id*="tbxEmpSchJobTitle"], input[id*="tbxWORK_EDUC_PRSNT_JOB_TITLE"]',
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
  // Radios on CEAC — not dropdowns. RadioButtonList inputs have value="Y"/"N".
  other_nationality: {
    // CEAC names this `rblAPP_OTH_NATL_IND` (confirmed via live DOM dump).
    selector: 'input[name*="rblAPP_OTH_NATL_IND"], input[id*="rblAPP_OTH_NATL_IND"]',
    type: "radio",
    label: "Has other nationality",
  },
  permanent_resident_other_country: {
    selector: 'input[name*="rblPermResOtherCntryInd"], input[id*="rblPERM_RES"]',
    type: "radio",
    label: "Permanent resident of another country",
  },
  // "National ID Number" accepts A-Z, 0-9, spaces — NOT "N/A". For
  // applicants without one, CEAC pairs each field with a "Does Not
  // Apply" checkbox that greys out the text input. The checkbox
  // mapping is what should be toggled, not the text field.
  national_id_number: {
    selector: 'input[id*="tbxAPP_NATIONAL_ID"]',
    type: "text",
    label: "National ID Number",
  },
  national_id_number_na: {
    selector: 'input[id*="cbexAPP_NATIONAL_ID_NA"], input[id*="cbxAPP_NATIONAL_ID_NA"]',
    type: "checkbox",
    label: "National ID Does Not Apply",
  },
  us_social_security_number: {
    selector: 'input[id*="tbxAPP_SSN"]',
    type: "text",
    label: "US SSN",
  },
  us_social_security_number_na: {
    selector: 'input[id*="cbexAPP_SSN_NA"], input[id*="cbxAPP_SSN_NA"]',
    type: "checkbox",
    label: "US SSN Does Not Apply",
  },
  us_taxpayer_id: {
    selector: 'input[id*="tbxAPP_TAX_ID"]',
    type: "text",
    label: "US Taxpayer ID",
  },
  us_taxpayer_id_na: {
    selector: 'input[id*="cbexAPP_TAX_ID_NA"], input[id*="cbxAPP_TAX_ID_NA"]',
    type: "checkbox",
    label: "US Taxpayer ID Does Not Apply",
  },
};

// ---------------------------------------------------------------------------
// Travel Companions (step 4)
// Mostly conditional/repeatable fields. Minimal mapping for the initial
// radio and group name.
// ---------------------------------------------------------------------------
export const ds160TravelCompanionsMappings: Record<string, FormFieldMapping> = {
  // Live CEAC: `rblOtherPersonsTravelingWithYou`.
  has_companions: {
    selector: 'input[name*="rblOtherPersonsTravelingWithYou"], input[id*="rblOtherPersonsTravelingWithYou"]',
    type: "radio",
    label: "Has travel companions",
  },
  companion_group_travel: {
    selector: 'input[name*="rblGroupTravel"], input[id*="rblGroupTravel"], input[id*="rblGROUP_TRAVEL"]',
    type: "radio",
    label: "Traveling as part of a group",
  },
  companion_group_name: {
    selector: 'input[id*="tbxGroupName"], input[id*="tbxGROUP_NAME"]',
    type: "text",
    label: "Group Name",
  },
};

// ---------------------------------------------------------------------------
// Previous U.S. Travel (step 5)
// Complex conditional section. Minimal mapping for top-level yes/no gates.
// ---------------------------------------------------------------------------
export const ds160PreviousUsTravelMappings: Record<string, FormFieldMapping> = {
  // All radios on the live CEAC page; the older `ddl*` alternatives are
  // kept as fallbacks for any legacy CEAC deployments.
  has_been_in_us: {
    selector: 'input[name*="rblPREV_US_TRAVEL_IND"], input[id*="rblPREV_US_TRAVEL_IND"], input[id*="rblPREV_US_VISIT"]',
    type: "radio",
    label: "Has been in US",
  },
  has_us_visa: {
    selector: 'input[name*="rblPREV_VISA_IND"], input[id*="rblPREV_VISA_IND"]',
    type: "radio",
    label: "Has previous US visa",
  },
  visa_number: {
    selector: 'input[id*="tbxPREV_VISA_FOIL_NUMBER"]',
    type: "text",
    label: "Visa Number",
  },
  has_been_refused: {
    selector: 'input[name*="rblPREV_VISA_REFUSED_IND"], input[id*="rblPREV_VISA_REFUSED_IND"]',
    type: "radio",
    label: "Has been refused US visa",
  },
  vwp_denial: {
    selector: 'input[name*="rblVWP_DENIAL_IND"], input[id*="rblVWP_DENIAL_IND"]',
    type: "radio",
    label: "Denied ESTA / travel authorization",
  },
  immigrant_petition_filed: {
    selector: 'input[name*="rblIV_PETITION_IND"], input[id*="rblIV_PETITION_IND"]',
    type: "radio",
    label: "Immigrant petition filed for you",
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
    // CEAC's live ID is `tbxUS_POC_ADDR_POSTAL_CD` (matching the home
    // address postal field's pattern). Older builds used `_ZIP` — keep
    // it as a fallback.
    selector: 'input[id*="tbxUS_POC_ADDR_POSTAL_CD"], input[id*="tbxUS_POC_ADDR_ZIP"]',
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
  us_contact_organization_na: {
    selector: 'input[id*="cbxUS_POC_ORG_NA_IND"]',
    type: "checkbox",
    label: "US Contact Organization Does Not Apply",
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
  father_surname_unknown: {
    selector: 'input[id*="cbxFATHER_SURNAME_UNK_IND"]',
    type: "checkbox",
    label: "Father's Surname Unknown",
  },
  father_given_names: {
    selector: 'input[id*="tbxFATHER_GIVEN_NAME"]',
    type: "text",
    label: "Father's Given Names",
  },
  father_given_names_unknown: {
    selector: 'input[id*="cbxFATHER_GIVEN_NAME_UNK_IND"]',
    type: "checkbox",
    label: "Father's Given Unknown",
  },
  father_dob_day: {
    selector: 'select[id*="ddlFathersDOBDay"]',
    type: "select",
    label: "Father DOB Day",
  },
  father_dob_month: {
    selector: 'select[id*="ddlFathersDOBMonth"]',
    type: "select",
    label: "Father DOB Month",
  },
  father_dob_year: {
    selector: 'input[id*="tbxFathersDOBYear"]',
    type: "text",
    label: "Father DOB Year",
  },
  father_dob_unknown: {
    selector: 'input[id*="cbxFATHER_DOB_UNK_IND"]',
    type: "checkbox",
    label: "Father DOB Unknown",
  },
  father_in_us: {
    selector: 'input[name*="rblFATHER_LIVE_IN_US_IND"], input[id*="rblFATHER_LIVE_IN_US_IND"]',
    type: "radio",
    label: "Father in US",
  },
  mother_surname: {
    selector: 'input[id*="tbxMOTHER_SURNAME"]',
    type: "text",
    label: "Mother's Surname",
  },
  mother_surname_unknown: {
    selector: 'input[id*="cbxMOTHER_SURNAME_UNK_IND"]',
    type: "checkbox",
    label: "Mother's Surname Unknown",
  },
  mother_given_names: {
    selector: 'input[id*="tbxMOTHER_GIVEN_NAME"]',
    type: "text",
    label: "Mother's Given Names",
  },
  mother_given_names_unknown: {
    selector: 'input[id*="cbxMOTHER_GIVEN_NAME_UNK_IND"]',
    type: "checkbox",
    label: "Mother's Given Unknown",
  },
  mother_dob_day: {
    selector: 'select[id*="ddlMothersDOBDay"]',
    type: "select",
    label: "Mother DOB Day",
  },
  mother_dob_month: {
    selector: 'select[id*="ddlMothersDOBMonth"]',
    type: "select",
    label: "Mother DOB Month",
  },
  mother_dob_year: {
    selector: 'input[id*="tbxMothersDOBYear"]',
    type: "text",
    label: "Mother DOB Year",
  },
  mother_dob_unknown: {
    selector: 'input[id*="cbxMOTHER_DOB_UNK_IND"]',
    type: "checkbox",
    label: "Mother DOB Unknown",
  },
  mother_in_us: {
    selector: 'input[name*="rblMOTHER_LIVE_IN_US_IND"], input[id*="rblMOTHER_LIVE_IN_US_IND"]',
    type: "radio",
    label: "Mother in US",
  },
  has_immediate_us_relatives: {
    selector: 'input[name*="rblUS_IMMED_RELATIVE_IND"], input[id*="rblUS_IMMED_RELATIVE_IND"], input[id*="rblUS_RELS_IND"]',
    type: "radio",
    label: "Has immediate US relatives",
  },
  has_other_us_relatives: {
    selector: 'input[name*="rblUS_OTHER_RELATIVE_IND"], input[id*="rblUS_OTHER_RELATIVE_IND"]',
    type: "radio",
    label: "Has other US relatives",
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
    selector: 'input[name*="rblPreviouslyEmployed"], input[id*="rblPreviouslyEmployed"], input[id*="rblPREV_EMPL"]',
    type: "radio",
    label: "Previously employed",
  },
  has_other_education: {
    selector: 'input[name*="rblOtherEduc"], input[id*="rblOtherEduc"]',
    type: "radio",
    label: "Attended other educational institutions",
  },
  prev_employer_name: {
    selector: 'input[id*="tbxPREV_EMPL_NAME"], input[id*="tbEmployerName"]',
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
    selector: 'input[name*="rblCLAN_TRIBE_IND"], input[id*="rblCLAN_TRIBE_IND"]',
    type: "radio",
    label: "Belongs to clan/tribe",
  },
  language_name: {
    selector: 'input[id*="tbxLANGUAGE_NAME"]',
    type: "text",
    label: "Language Name",
  },
  has_countries_visited: {
    selector: 'input[name*="rblCOUNTRIES_VISITED_IND"], input[id*="rblCOUNTRIES_VISITED_IND"]',
    type: "radio",
    label: "Visited countries in last 5 years",
  },
  has_organization: {
    selector: 'input[name*="rblORGANIZATION_IND"], input[id*="rblORGANIZATION_IND"]',
    type: "radio",
    label: "Belonged to any organization",
  },
  has_specialized_skills: {
    selector: 'input[name*="rblSPECIALIZED_SKILLS_IND"], input[id*="rblSPECIALIZED_SKILLS_IND"]',
    type: "radio",
    label: "Specialized skills",
  },
  has_served_military: {
    selector: 'input[name*="rblMILITARY_SERVICE_IND"], input[id*="rblMILITARY_SERVICE_IND"]',
    type: "radio",
    label: "Served military",
  },
  has_served_insurgent: {
    selector: 'input[name*="rblINSURGENT_ORG_IND"], input[id*="rblINSURGENT_ORG_IND"]',
    type: "radio",
    label: "Served in insurgent org",
  },
};

// ---------------------------------------------------------------------------
// Security and Background Parts 1–5 (steps 17–21)
// All yes/no radio questions. Selectors target the ASP.NET RadioButtonList
// base ID; the orchestrator appends [value="…"] at fill time.
// ---------------------------------------------------------------------------

export const ds160SecurityBackground1Mappings: Record<string, FormFieldMapping> = {
  has_communicable_disease: {
    selector: 'input[name*="rblDisease"], input[id*="rblDisease"], input[id*="rblSECURITY_PART1_Q1"]',
    type: "radio",
    label: "Communicable Disease",
  },
  has_physical_mental_disorder: {
    selector: 'input[name*="rblDisorder"], input[id*="rblDisorder"], input[id*="rblSECURITY_PART1_Q2"]',
    type: "radio",
    label: "Physical/Mental Disorder",
  },
  is_drug_abuser: {
    selector: 'input[name*="rblDruguser"], input[id*="rblDruguser"], input[id*="rblSECURITY_PART1_Q3"]',
    type: "radio",
    label: "Drug Abuser",
  },
};

export const ds160SecurityBackground2Mappings: Record<string, FormFieldMapping> = {
  has_arrest_conviction: {
    selector: 'input[name*="rblArrested"], input[id*="rblArrested"], input[id*="rblSECURITY_PART2_Q1"]',
    type: "radio",
    label: "Arrest/Conviction",
  },
  has_violated_controlled_substance: {
    selector: 'input[name*="rblControlledSubstances"], input[id*="rblControlledSubstances"], input[id*="rblSECURITY_PART2_Q2"]',
    type: "radio",
    label: "Controlled Substance Violation",
  },
  has_prostitution: {
    selector: 'input[name*="rblProstitution"], input[id*="rblProstitution"], input[id*="rblSECURITY_PART2_Q3"]',
    type: "radio",
    label: "Prostitution",
  },
  has_money_laundering: {
    selector: 'input[name*="rblMoneyLaundering"], input[id*="rblMoneyLaundering"], input[id*="rblSECURITY_PART2_Q4"]',
    type: "radio",
    label: "Money Laundering",
  },
  has_human_trafficking: {
    selector: 'input[name*="rblHumanTrafficking_"], input[id*="rblHumanTrafficking_"], input[id*="rblSECURITY_PART2_Q5"]',
    type: "radio",
    label: "Human Trafficking",
  },
  has_aided_human_trafficking: {
    selector: 'input[name*="rblAssistedSevereTrafficking"], input[id*="rblAssistedSevereTrafficking"], input[id*="rblSECURITY_PART2_Q6"]',
    type: "radio",
    label: "Aided Human Trafficking",
  },
  has_trafficking_beneficiary: {
    selector: 'input[name*="rblHumanTraffickingRelated"], input[id*="rblHumanTraffickingRelated"], input[id*="rblSECURITY_PART2_Q7"]',
    type: "radio",
    label: "Trafficking Beneficiary",
  },
};

export const ds160SecurityBackground3Mappings: Record<string, FormFieldMapping> = {
  intend_illegal_activity: {
    selector: 'input[name*="rblIllegalActivity"], input[id*="rblIllegalActivity"], input[id*="rblSECURITY_PART3_Q1"]',
    type: "radio",
    label: "Illegal Activity",
  },
  intend_terrorist_activity: {
    selector: 'input[name*="rblTerroristActivity"], input[id*="rblTerroristActivity"], input[id*="rblSECURITY_PART3_Q2"]',
    type: "radio",
    label: "Terrorist Activity",
  },
  has_provided_terrorist_support: {
    selector: 'input[name*="rblTerroristSupport"], input[id*="rblTerroristSupport"], input[id*="rblSECURITY_PART3_Q3"]',
    type: "radio",
    label: "Terrorist Support",
  },
  is_terrorist_member: {
    selector: 'input[name*="rblTerroristOrg"], input[id*="rblTerroristOrg"], input[id*="rblSECURITY_PART3_Q4"]',
    type: "radio",
    label: "Terrorist Organization Member",
  },
  is_terrorist_family: {
    selector: 'input[name*="rblTerroristRel"], input[id*="rblTerroristRel"], input[id*="rblSECURITY_PART3_Q5"]',
    type: "radio",
    label: "Terrorist Family",
  },
  has_genocide: {
    selector: 'input[name*="rblGenocide"], input[id*="rblGenocide"], input[id*="rblSECURITY_PART3_Q6"]',
    type: "radio",
    label: "Genocide",
  },
  has_torture: {
    selector: 'input[name*="rblTorture"], input[id*="rblTorture"], input[id*="rblSECURITY_PART3_Q7"]',
    type: "radio",
    label: "Torture",
  },
  has_extrajudicial_killings: {
    selector: 'input[name*="rblExViolence"], input[id*="rblExViolence"], input[id*="rblSECURITY_PART3_Q8"]',
    type: "radio",
    label: "Extrajudicial Violence",
  },
  has_child_soldier: {
    selector: 'input[name*="rblChildSoldier"], input[id*="rblChildSoldier"], input[id*="rblSECURITY_PART3_Q9"]',
    type: "radio",
    label: "Child Soldier",
  },
  has_religious_freedom_violation: {
    selector: 'input[name*="rblReligiousFreedom"], input[id*="rblReligiousFreedom"], input[id*="rblSECURITY_PART3_Q10"]',
    type: "radio",
    label: "Religious Freedom Violation",
  },
  has_population_control: {
    selector: 'input[name*="rblPopulationControls"], input[id*="rblPopulationControls"], input[id*="rblSECURITY_PART3_Q11"]',
    type: "radio",
    label: "Population Control",
  },
  has_coercive_transplant: {
    selector: 'input[name*="rblTransplant"], input[id*="rblTransplant"], input[id*="rblSECURITY_PART3_Q12"]',
    type: "radio",
    label: "Coercive Transplant",
  },
};

export const ds160SecurityBackground4Mappings: Record<string, FormFieldMapping> = {
  has_immigration_fraud: {
    selector: 'input[name*="rblImmigrationFraud"], input[id*="rblImmigrationFraud"], input[id*="rblSECURITY_PART4_Q1"]',
    type: "radio",
    label: "Immigration Fraud",
  },
  has_removal_order: {
    selector: 'input[name*="rblDeport"], input[id*="rblDeport"], input[id*="rblSECURITY_PART4_Q2"]',
    type: "radio",
    label: "Deportation Order",
  },
};

export const ds160SecurityBackground5Mappings: Record<string, FormFieldMapping> = {
  has_withheld_child_custody: {
    selector: 'input[name*="rblChildCustody"], input[id*="rblChildCustody"], input[id*="rblSECURITY_PART5_Q1"]',
    type: "radio",
    label: "Withheld Child Custody",
  },
  has_voted_illegally: {
    selector: 'input[name*="rblVotingViolation"], input[id*="rblVotingViolation"], input[id*="rblSECURITY_PART5_Q2"]',
    type: "radio",
    label: "Voted Illegally",
  },
  has_renounced_citizenship: {
    selector: 'input[name*="rblRenounceExp"], input[id*="rblRenounceExp"], input[id*="rblSECURITY_PART5_Q3"]',
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
