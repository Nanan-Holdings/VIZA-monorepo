import { evaluateShowIf, isRequiredUnlessSatisfied } from "@/lib/form-utils";
import type { VisaFormFieldOption, VisaFormFieldRow, WizardStep } from "@/types/visa-form-fields";

export const MOCK_RESIDENTIAL_ADDRESS = "123 Test Street, Mock District, Singapore 119077";

const DESTINATION_COUNTRY: Record<string, string> = {
  AE_TOURIST_VISA: "ARE",
  CA_TRV: "CAN",
  IN_E_VISA: "IND",
  SA_E_VISA: "SAU",
  TR_E_VISA: "TUR",
};

function optionValue(option: VisaFormFieldOption): string {
  return typeof option === "string" ? option : option.value;
}

function firstMatchingOption(options: string[], preferences: string[]): string | null {
  for (const preference of preferences) {
    const exact = options.find((option) => option.toLowerCase() === preference.toLowerCase());
    if (exact) return exact;
  }
  return null;
}

function chooseOption(field: VisaFormFieldRow): string {
  const options = field.options?.map(optionValue) ?? [];
  if (options.length === 0) return "";
  const name = field.fieldName.toLowerCase();
  const normalized = new Set(options.map((option) => option.toLowerCase()));

  if (normalized.has("yes") && normalized.has("no")) {
    if (/(declaration|consent|terms|privacy|same_as|applying_from_current)/.test(name)) {
      return options.find((option) => option.toLowerCase() === "yes") ?? options[0];
    }
    return options.find((option) => option.toLowerCase() === "no") ?? options[0];
  }

  return firstMatchingOption(options, [
    "ordinary",
    "regular",
    "tourism",
    "tourist",
    "single",
    "self",
    "hotel",
    "student",
    "english",
    "none",
  ]) ?? options[0];
}

function countryValue(fieldName: string, visaType: string): string {
  const name = fieldName.toLowerCase();
  if (/(destination|arrival|visit|host|hotel|accommodation|issuing_the_identity)/.test(name)) {
    return DESTINATION_COUNTRY[visaType] ?? "SGP";
  }
  if (/(residen|present|mailing|application_country)/.test(name)) return "SGP";
  return "CHN";
}

function dateValue(fieldName: string): string {
  const name = fieldName.toLowerCase();
  if (/(birth|dob)/.test(name)) return name.includes("applicant") ? "1990-01-15" : "1965-06-15";
  if (/(arrival|entry|stay_from|valid_from)/.test(name)) return "2026-10-10";
  if (/(departure|exit|stay_to|valid_to)/.test(name)) return "2026-10-20";
  if (/(current_residence_from|activity_from|employment_from|education_from)/.test(name)) return "2020-01-01";
  if (/(activity_to|employment_to|education_to)/.test(name)) return "2026-08-01";
  if (/(issue|signature|declaration|application)/.test(name)) return "2026-08-16";
  if (/(expiry|expiration)/.test(name)) return "2035-12-31";
  return "2026-08-16";
}

function textValue(field: VisaFormFieldRow): string {
  const name = field.fieldName.toLowerCase();
  if (/(email)/.test(name)) return "edward.preview@viza.test";
  if (/(phone|mobile|telephone)/.test(name)) return "+6581234567";
  if (/(postal|postcode|zip)/.test(name)) return "119077";
  if (/(address|street)/.test(name)) return MOCK_RESIDENTIAL_ADDRESS;
  if (/(city|town|village|place_of_birth)/.test(name)) return "Singapore";
  if (/(state|province|district|area|emirate)/.test(name)) return "Singapore";
  if (/(father.*name|parent_1.*name)/.test(name)) return "Michael Test";
  if (/(mother.*name|parent_2.*name)/.test(name)) return "Linda Test";
  if (/(family_name|surname|last_name)/.test(name)) return "Zhang";
  if (/(given_name|first_name)/.test(name)) return "Edward";
  if (/(full_name|applicant_name|reference_name|contact_name)/.test(name)) return "Edward Test Zhang";
  if (/(passport|travel_document).*number/.test(name)) return "TST123456";
  if (/(national.*id|identity.*number)/.test(name)) return "TEST-NID-001";
  if (/(religion)/.test(name)) return "None";
  if (/(marital|civil_status|relationship_status)/.test(name)) return "Single";
  if (/(education|qualification)/.test(name)) return "Bachelor degree";
  if (/(occupation|profession|position|job_title)/.test(name)) return "Student";
  if (/(hotel|accommodation_name)/.test(name)) return "Test Harbour Hotel";
  if (/(company|employer|school|facility)/.test(name)) return "VIZA Test Lab";
  if (/(purpose|reason|visit_details)/.test(name)) return "Tourism testing preview";
  if (/(funds|amount|budget|cost|expense)/.test(name)) return "5000";
  if (/(duration|length|count|number_of)/.test(name)) return "1";
  if (/(details|explain|description|remarks|mark)/.test(name)) return "None";
  if (field.fieldType === "number") return "1";
  return `${field.label || field.fieldName} test answer`;
}

function fixtureValue(field: VisaFormFieldRow, visaType: string): string {
  if (field.options && field.options.length > 0) return chooseOption(field);
  if (field.fieldType === "checkbox") return "true";
  if (field.fieldType === "country") return countryValue(field.fieldName, visaType);
  if (field.fieldType === "date") return dateValue(field.fieldName);
  if (field.fieldType === "file") return "";
  return textValue(field);
}

export function buildSchemaQaPreviewAnswers(
  steps: WizardStep[],
  visaType: string,
): Record<string, string> {
  const fields = steps.flatMap((step) => step.fields);
  const answers: Record<string, string> = {
    full_name: "Edward Test Zhang",
    surname: "Zhang",
    family_name: "Zhang",
    given_name: "Edward",
    given_names: "Edward",
    date_of_birth: "1990-01-15",
    gender: "male",
    sex: "male",
    nationality: "CHN",
    email: "edward.preview@viza.test",
    email_address: "edward.preview@viza.test",
    phone: "+6581234567",
    phone_number: "+6581234567",
    address: MOCK_RESIDENTIAL_ADDRESS,
    residence_address: MOCK_RESIDENTIAL_ADDRESS,
    residential_address: MOCK_RESIDENTIAL_ADDRESS,
    residential_address_outside_uae: MOCK_RESIDENTIAL_ADDRESS,
    passport_number: "TST123456",
    passport_issue_date: "2025-01-01",
    passport_expiry_date: "2035-01-01",
    passport_issuing_country: "CHN",
  };

  for (let iteration = 0; iteration < 12; iteration += 1) {
    let changed = false;
    for (const field of fields) {
      if (!evaluateShowIf(field, answers, fields)) continue;
      if (answers[field.fieldName]?.trim()) continue;
      const value = fixtureValue(field, visaType);
      if (!value) continue;
      answers[field.fieldName] = value;
      changed = true;
    }
    if (!changed) break;
  }

  return answers;
}

export function getSchemaQaMissingRequiredFields(
  steps: WizardStep[],
  answers: Record<string, string>,
): VisaFormFieldRow[] {
  const fields = steps.flatMap((step) => step.fields);
  return fields.filter((field) =>
    field.required &&
    !isRequiredUnlessSatisfied(field, answers) &&
    evaluateShowIf(field, answers, fields) &&
    !answers[field.fieldName]?.trim(),
  );
}
