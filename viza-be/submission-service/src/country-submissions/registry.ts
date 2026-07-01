import type { GenericSubmissionResult } from "../submission-result";
import type {
  CountrySubmissionApplication,
  CountrySubmissionProvider,
  FieldCategory,
  FieldRequirement,
  ImplementationStatus,
  SubmissionPayload,
  SubmitOptions,
  ValidationResult,
} from "./types";

interface ProviderConfig {
  countryCode: string;
  countryAliases: string[];
  displayName: string;
  supportedVisaTypes: string[];
  implementationStatus: ImplementationStatus;
  dryRunAvailable: boolean;
  sandboxAvailable: boolean;
  realSubmitAvailable: boolean;
  routeStatus: CountrySubmissionProvider["routeStatus"];
  serviceFiles?: string[];
  schemaFiles?: string[];
  mapperFiles?: string[];
  automationFiles?: string[];
  notes: string;
  requiredFields?: FieldRequirement[];
  extraRequiredFields?: FieldRequirement[];
  includeAllAnswersInPayload?: boolean;
  dryRunConfirmationPrefix?: string;
}

const SCHEMA_VERSION = "2026-06-05.base";

const COMMON_REQUIRED_FIELDS: FieldRequirement[] = [
  { key: "profile.fullName", label: "Full name", category: "personal", required: true },
  { key: "profile.dateOfBirth", label: "Date of birth", category: "personal", required: true },
  { key: "profile.gender", label: "Gender", category: "personal", required: true },
  { key: "profile.nationality", label: "Nationality", category: "personal", required: true },
  { key: "profile.passportNumber", label: "Passport number", category: "passport", required: true },
  { key: "profile.passportIssueDate", label: "Passport issue date", category: "passport", required: true },
  { key: "profile.passportExpiryDate", label: "Passport expiry date", category: "passport", required: true },
  { key: "profile.email", label: "Email", category: "contact", required: true },
  { key: "profile.phone", label: "Phone", category: "contact", required: true },
  { key: "profile.address", label: "Address", category: "contact", required: true },
  { key: "profile.occupation", label: "Occupation", category: "personal", required: true },
  { key: "trip.arrivalDate", label: "Arrival date", category: "trip", required: true },
  { key: "trip.departureDate", label: "Departure date", category: "trip", required: true },
  { key: "trip.purpose", label: "Purpose of travel", category: "trip", required: true },
  { key: "trip.accommodationName", label: "Accommodation", category: "trip", required: true },
];

const COMMON_OPTIONAL_FIELDS: FieldRequirement[] = [
  { key: "profile.employerOrSchool", label: "Employer or school", category: "personal", required: false },
  { key: "trip.destinationCity", label: "Destination city", category: "trip", required: false },
  { key: "trip.funding", label: "Funding", category: "trip", required: false },
  { key: "trip.budget", label: "Travel budget", category: "trip", required: false },
  { key: "has_criminal_record", label: "Criminal or security history", category: "security", required: false },
  { key: "previous_visa_refusal", label: "Previous visa refusal", category: "security", required: false },
  { key: "overstay_history", label: "Previous overstay", category: "security", required: false },
];

const US_DS160_REQUIRED_FIELDS: FieldRequirement[] = [
  ...COMMON_REQUIRED_FIELDS.filter((field) => !field.key.startsWith("trip.")),
  ...COMMON_OPTIONAL_FIELDS,
  { key: "answers.has_specific_travel_plans", label: "Specific travel plans", category: "trip", required: true },
  { key: "answers.purpose_of_trip", label: "Purpose of trip", category: "trip", required: true },
  {
    key: "answers.purpose_of_trip_specify",
    label: "Purpose of trip specify",
    category: "trip",
    required: true,
    condition: { key: "answers.purpose_of_trip", equals: "B" },
  },
  {
    key: "answers.arrival_date",
    label: "Arrival date",
    category: "trip",
    required: true,
    condition: { key: "answers.has_specific_travel_plans", equals: "yes" },
  },
  {
    key: "answers.intended_arrival_date",
    label: "Intended arrival date",
    category: "trip",
    required: true,
    condition: { key: "answers.has_specific_travel_plans", equals: "no" },
  },
  {
    key: "answers.intended_length_of_stay_value",
    label: "Intended length of stay",
    category: "trip",
    required: true,
    condition: { key: "answers.has_specific_travel_plans", equals: "no" },
  },
  {
    key: "answers.intended_length_of_stay_unit",
    label: "Intended length of stay unit",
    category: "trip",
    required: true,
    condition: { key: "answers.has_specific_travel_plans", equals: "no" },
  },
];

function vnField(
  key: string,
  label: string,
  category: FieldCategory,
  condition?: FieldRequirement["condition"],
): FieldRequirement {
  return { key: `answers.${key}`, label, category, required: true, condition };
}

const WHEN_MULTIPLE_NATIONALITIES = {
  key: "answers.has_multiple_nationalities",
  equals: "yes",
};
const WHEN_VIOLATED_VIETNAM_LAWS = {
  key: "answers.has_violated_vietnam_laws",
  equals: "yes",
};
const WHEN_VISITED_VIETNAM_LAST_YEAR = {
  key: "answers.visited_vietnam_in_last_year",
  equals: "yes",
};
const WHEN_HAS_RELATIVES_IN_VIETNAM = {
  key: "answers.has_relatives_in_vietnam",
  equals: "yes",
};

const VN_REQUIRED_FIELDS: FieldRequirement[] = [
  vnField("surname", "Surname", "personal"),
  vnField("given_name", "Middle and given name", "personal"),
  vnField("date_of_birth", "Date of birth", "personal"),
  vnField("sex", "Sex", "personal"),
  vnField("nationality", "Nationality", "personal"),
  vnField("email_address", "Email", "contact"),
  vnField("re_enter_email_address", "Re-enter email", "contact"),
  vnField("religion", "Religion", "personal"),
  vnField("place_of_birth", "Place of birth", "personal"),
  vnField("has_multiple_nationalities", "Other nationalities declaration", "security"),
  vnField("other_nationality", "Other nationality", "personal", WHEN_MULTIPLE_NATIONALITIES),
  vnField("has_violated_vietnam_laws", "Vietnam law violation declaration", "security"),
  vnField("violation_of_vietnam_laws_details", "Vietnam law violation details", "security", WHEN_VIOLATED_VIETNAM_LAWS),
  vnField("visa_type_requested", "Type of visa requested", "trip"),
  vnField("visa_valid_from", "E-visa valid from", "trip"),
  vnField("visa_valid_to", "E-visa valid to", "trip"),
  vnField("passport_number", "Passport number", "passport"),
  vnField("passport_type", "Passport type", "passport"),
  vnField("passport_issue_date", "Passport issue date", "passport"),
  vnField("passport_expiry_date", "Passport expiry date", "passport"),
  vnField("permanent_residential_address", "Permanent residential address", "contact"),
  vnField("contact_address", "Contact address", "contact"),
  vnField("telephone_number", "Telephone number", "contact"),
  vnField("emergency_contact_full_name", "Emergency contact full name", "contact"),
  vnField("emergency_contact_current_address", "Emergency contact address", "contact"),
  vnField("emergency_contact_telephone", "Emergency contact telephone", "contact"),
  vnField("emergency_contact_relationship", "Emergency contact relationship", "contact"),
  vnField("purpose_of_entry", "Purpose of entry", "trip"),
  vnField("intended_date_of_entry", "Intended date of entry", "trip"),
  vnField("intended_length_of_stay", "Intended length of stay", "trip"),
  vnField("residential_address_in_vietnam", "Residential address in Viet Nam", "trip"),
  vnField("intended_province_city", "Province/city", "trip"),
  vnField("intended_ward_commune", "Ward/commune", "trip"),
  vnField("intended_border_gate_of_entry", "Intended border gate of entry", "trip"),
  vnField("intended_border_gate_of_exit", "Intended border gate of exit", "trip"),
  vnField("declaration_temporary_residence", "Temporary residence declaration", "trip"),
  vnField("visited_vietnam_in_last_year", "Previous Viet Nam visit declaration", "trip"),
  vnField("visited_vietnam_purpose_detail", "Previous Viet Nam visit details", "trip", WHEN_VISITED_VIETNAM_LAST_YEAR),
  vnField("has_relatives_in_vietnam", "Relatives in Viet Nam declaration", "trip"),
  vnField("relative_full_name_in_vn", "Relative full name", "trip", WHEN_HAS_RELATIVES_IN_VIETNAM),
  vnField("relative_date_of_birth", "Relative date of birth", "trip", WHEN_HAS_RELATIVES_IN_VIETNAM),
  vnField("relative_nationality", "Relative nationality", "trip", WHEN_HAS_RELATIVES_IN_VIETNAM),
  vnField("relative_relationship", "Relative relationship", "trip", WHEN_HAS_RELATIVES_IN_VIETNAM),
  vnField("relative_address_in_vn", "Relative address", "trip", WHEN_HAS_RELATIVES_IN_VIETNAM),
  vnField("final_declaration", "Final declaration", "security"),
];

function sgacField(
  key: string,
  label: string,
  category: FieldCategory,
  condition?: FieldRequirement["condition"],
): FieldRequirement {
  return { key: `answers.${key}`, label, category, required: true, condition };
}

const WHEN_SGAC_HOTEL = {
  key: "answers.accommodation_type",
  equals: "hotel",
};
const WHEN_SGAC_AIR = {
  key: "answers.mode_of_travel",
  equals: "air",
};
const WHEN_SGAC_AIR_COMMERCIAL = {
  key: "answers.air_transport_type",
  equals: "commercial",
};
const WHEN_SGAC_OTHER_ACCOMMODATION = {
  key: "answers.accommodation_type",
  equals: "others",
};
const WHEN_SGAC_RESIDENTIAL = {
  key: "answers.accommodation_type",
  equals: "residential",
};
const WHEN_SGAC_LAND = {
  key: "answers.mode_of_travel",
  equals: "land",
};
const WHEN_SGAC_SEA = {
  key: "answers.mode_of_travel",
  equals: "sea",
};
const WHEN_SGAC_SEA_CRUISE = {
  key: "answers.sea_transport_type",
  equals: "cruise",
};

const SGAC_REQUIRED_FIELDS: FieldRequirement[] = [
  { key: "profile.fullName", label: "Full name", category: "personal", required: true },
  { key: "profile.dateOfBirth", label: "Date of birth", category: "personal", required: true },
  { key: "profile.gender", label: "Gender", category: "personal", required: true },
  { key: "profile.nationality", label: "Nationality", category: "personal", required: true },
  { key: "profile.passportNumber", label: "Passport number", category: "passport", required: true },
  { key: "profile.passportExpiryDate", label: "Passport expiry date", category: "passport", required: true },
  { key: "profile.email", label: "Email", category: "contact", required: true },
  { key: "profile.phone", label: "Phone", category: "contact", required: true },
  { key: "trip.arrivalDate", label: "Arrival date", category: "trip", required: true },
  { key: "trip.departureDate", label: "Departure date", category: "trip", required: true },
  sgacField("place_of_birth_country", "Country/place of birth", "personal"),
  sgacField("place_of_residence", "Place of residence", "personal"),
  sgacField("mobile_country_code", "Country/region code", "contact"),
  sgacField("has_used_different_name_to_enter_singapore", "Different-name passport declaration", "security"),
  sgacField("purpose_of_travel", "Purpose of travel", "trip"),
  sgacField("last_city_or_port_before_singapore", "Last city / port before Singapore", "trip"),
  sgacField("next_city_or_port_after_singapore", "Next city / port after Singapore", "trip"),
  sgacField("mode_of_travel", "Mode of travel", "trip"),
  sgacField("air_transport_type", "Type of air transport", "trip", WHEN_SGAC_AIR),
  sgacField("carrier_code", "Carrier code", "trip", WHEN_SGAC_AIR_COMMERCIAL),
  sgacField("transport_number", "Flight number", "trip", WHEN_SGAC_AIR),
  sgacField("land_transport_type", "Land transport type", "trip", WHEN_SGAC_LAND),
  sgacField("vehicle_number", "Vehicle number", "trip", WHEN_SGAC_LAND),
  sgacField("sea_transport_type", "Sea transport type", "trip", WHEN_SGAC_SEA),
  sgacField("cruise_name", "Cruise name", "trip", WHEN_SGAC_SEA_CRUISE),
  sgacField("accommodation_type", "Accommodation type", "trip"),
  sgacField("accommodation_name", "Hotel name", "trip", WHEN_SGAC_HOTEL),
  sgacField("accommodation_other_type", "Other accommodation type", "trip", WHEN_SGAC_OTHER_ACCOMMODATION),
  sgacField("accommodation_postcode", "Singapore postal code", "trip", WHEN_SGAC_RESIDENTIAL),
  sgacField("accommodation_block_number", "Block/house number", "trip", WHEN_SGAC_RESIDENTIAL),
  sgacField("accommodation_street_name", "Street name", "trip", WHEN_SGAC_RESIDENTIAL),
  sgacField("recent_country_visit_history", "Recent travel history declaration", "security"),
  sgacField("has_health_symptoms", "Health symptoms declaration", "security"),
];

function arrivalCardField(
  key: string,
  label: string,
  category: FieldCategory,
  condition?: FieldRequirement["condition"],
): FieldRequirement {
  return { key: `answers.${key}`, label, category, required: true, condition };
}

const MDAC_REQUIRED_FIELDS: FieldRequirement[] = [
  arrivalCardField("full_name", "Full name", "personal"),
  arrivalCardField("date_of_birth", "Date of birth", "personal"),
  arrivalCardField("sex", "Sex", "personal"),
  arrivalCardField("nationality", "Nationality", "personal"),
  arrivalCardField("place_of_birth", "Place of birth", "personal"),
  arrivalCardField("passport_number", "Passport number", "passport"),
  arrivalCardField("passport_expiry_date", "Passport expiry date", "passport"),
  arrivalCardField("email_address", "Email", "contact"),
  arrivalCardField("mobile_country_code", "Mobile country code", "contact"),
  arrivalCardField("mobile_number", "Phone", "contact"),
  arrivalCardField("arrival_date", "Arrival date", "trip"),
  arrivalCardField("departure_date", "Departure date", "trip"),
  arrivalCardField("mode_of_travel", "Mode of travel", "trip"),
  arrivalCardField("transport_number", "Flight / vehicle / vessel number", "trip"),
  arrivalCardField("last_embarkation_country", "Last embarkation country", "trip"),
  arrivalCardField("purpose_of_visit", "Purpose of visit", "trip"),
  arrivalCardField("accommodation_type", "Accommodation type", "trip"),
  arrivalCardField("address_in_malaysia", "Address in Malaysia", "trip"),
  arrivalCardField("city", "City", "trip"),
  arrivalCardField("state", "State", "trip"),
  arrivalCardField("postcode", "Postcode", "trip"),
];

const WHEN_TDAC_AIR = {
  key: "answers.arrival_mode_of_travel",
  equals: "air",
};
const WHEN_TDAC_LAND = {
  key: "answers.arrival_mode_of_travel",
  equals: "land",
};
const WHEN_TDAC_SEA = {
  key: "answers.arrival_mode_of_travel",
  equals: "sea",
};
const WHEN_TDAC_NOT_TRANSIT = {
  key: "answers.is_transit_traveler",
  notEquals: true,
};
const WHEN_TDAC_PURPOSE_OTHER = {
  key: "answers.purpose_of_travel",
  equals: "others",
};
const WHEN_TDAC_ARRIVAL_TRANSPORT_OTHER = {
  key: "answers.arrival_mode_of_transport",
  equals: "others",
};
const WHEN_TDAC_DEPARTURE_TRANSPORT_OTHER = {
  key: "answers.departure_mode_of_transport",
  equals: "others",
};
const WHEN_TDAC_ACCOMMODATION_OTHER = {
  key: "answers.accommodation_type",
  equals: "others",
};

const TDAC_REQUIRED_FIELDS: FieldRequirement[] = [
  arrivalCardField("family_name", "Family name", "personal"),
  arrivalCardField("first_name", "First name", "personal"),
  arrivalCardField("date_of_birth", "Date of birth", "personal"),
  arrivalCardField("gender", "Gender", "personal"),
  arrivalCardField("nationality", "Nationality", "personal"),
  arrivalCardField("country_territory_of_residence", "Country/territory of residence", "personal"),
  arrivalCardField("city_state_of_residence", "City/state of residence", "personal"),
  arrivalCardField("passport_number", "Passport number", "passport"),
  arrivalCardField("email_address", "Email", "contact"),
  arrivalCardField("phone_country_code", "Phone country code", "contact"),
  arrivalCardField("phone_number", "Phone", "contact"),
  arrivalCardField("occupation", "Occupation", "personal"),
  arrivalCardField("arrival_date", "Arrival date", "trip"),
  arrivalCardField("departure_date", "Departure date", "trip"),
  arrivalCardField("country_boarded", "Country/region where boarded", "trip"),
  arrivalCardField("purpose_of_travel", "Purpose of travel", "trip"),
  arrivalCardField("purpose_of_travel_other", "Other purpose of travel", "trip", WHEN_TDAC_PURPOSE_OTHER),
  arrivalCardField("arrival_mode_of_travel", "Arrival mode of travel", "trip"),
  arrivalCardField("arrival_mode_of_transport", "Arrival mode of transport", "trip"),
  arrivalCardField("arrival_transport_other", "Other arrival transport", "trip", WHEN_TDAC_ARRIVAL_TRANSPORT_OTHER),
  arrivalCardField("arrival_transport_number", "Arrival flight / vehicle / vessel number", "trip", WHEN_TDAC_AIR),
  arrivalCardField("arrival_transport_number", "Arrival flight / vehicle / vessel number", "trip", WHEN_TDAC_LAND),
  arrivalCardField("arrival_transport_number", "Arrival flight / vehicle / vessel number", "trip", WHEN_TDAC_SEA),
  arrivalCardField("departure_mode_of_travel", "Departure mode of travel", "trip"),
  arrivalCardField("departure_mode_of_transport", "Departure mode of transport", "trip"),
  arrivalCardField("departure_transport_other", "Other departure transport", "trip", WHEN_TDAC_DEPARTURE_TRANSPORT_OTHER),
  arrivalCardField("departure_transport_number", "Departure flight / vehicle / vessel number", "trip"),
  arrivalCardField("accommodation_type", "Accommodation type", "trip", WHEN_TDAC_NOT_TRANSIT),
  arrivalCardField("accommodation_type_other", "Other accommodation type", "trip", WHEN_TDAC_ACCOMMODATION_OTHER),
  arrivalCardField("address_in_thailand", "Address in Thailand", "trip", WHEN_TDAC_NOT_TRANSIT),
  arrivalCardField("province", "Province", "trip", WHEN_TDAC_NOT_TRANSIT),
  arrivalCardField("countries_visited_last_14_days", "Countries visited within 14 days", "security"),
];

const PH_ETRAVEL_REQUIRED_FIELDS: FieldRequirement[] = [
  arrivalCardField("registration_for", "Travel registration owner", "trip"),
  arrivalCardField("first_name", "First name", "personal"),
  arrivalCardField("date_of_birth", "Date of birth", "personal"),
  arrivalCardField("sex", "Sex", "personal"),
  arrivalCardField("nationality", "Nationality", "personal"),
  arrivalCardField("country_of_birth", "Country of birth", "personal"),
  arrivalCardField("country_of_residence", "Country of residence", "personal"),
  arrivalCardField("residence_address_line1", "Permanent residence address", "personal"),
  arrivalCardField("occupation", "Occupation", "personal"),
  arrivalCardField("passport_number", "Passport number", "passport"),
  arrivalCardField("passport_issuing_authority", "Passport issuing authority", "passport"),
  arrivalCardField("passport_issue_date", "Passport issue date", "passport"),
  arrivalCardField("passport_expiry_date", "Passport expiry date", "passport"),
  arrivalCardField("email_address", "Email", "contact"),
  arrivalCardField("mobile_country_code", "Phone country code", "contact"),
  arrivalCardField("mobile_number", "Phone", "contact"),
  arrivalCardField("travel_type", "Travel type", "trip"),
  arrivalCardField("transport_type", "Transport type", "trip"),
  arrivalCardField("flight_arrival_date", "Flight arrival date", "trip"),
  arrivalCardField("flight_departure_date", "Flight departure date", "trip"),
  arrivalCardField("origin_country", "Origin country", "trip"),
  arrivalCardField("airport_of_origin", "Airport of origin", "trip"),
  arrivalCardField("port_of_entry", "Port of entry", "trip"),
  arrivalCardField("traveller_type", "Traveller type", "trip"),
  arrivalCardField("airline_name", "Airline", "trip"),
  arrivalCardField("flight_number", "Flight number", "trip"),
  arrivalCardField("purpose_of_travel", "Purpose of travel", "trip"),
  arrivalCardField("destination_type", "Destination type", "trip"),
  arrivalCardField("has_recent_travel_history_30d", "Recent travel history health declaration", "security"),
  arrivalCardField("has_exposure_to_sick_person_30d", "Exposure health declaration", "security"),
  arrivalCardField("has_been_sick_30d", "Sickness health declaration", "security"),
  arrivalCardField("has_accompanied_family_members", "Accompanied family members", "trip"),
  arrivalCardField("checked_baggage_count", "Checked baggage count", "security"),
  arrivalCardField("handcarry_baggage_count", "Hand-carried baggage count", "security"),
  arrivalCardField("first_time_visiting_philippines", "First time visiting Philippines", "trip"),
  arrivalCardField("customs_information_acknowledgement", "Customs information acknowledgement", "security"),
  arrivalCardField("has_baggage_or_currency_to_declare", "Baggage or currency declaration", "security"),
  arrivalCardField("customs_signature_file", "Customs declaration signature", "security"),
  arrivalCardField("customs_signature_declaration", "Customs signature declaration", "security"),
  arrivalCardField("final_declaration", "Final declaration", "security"),
];

const CONFIGS: ProviderConfig[] = [
  {
    countryCode: "US",
    countryAliases: ["us", "usa", "united_states", "united states", "united_states_of_america"],
    displayName: "United States DS-160",
    supportedVisaTypes: ["DS160", "B1_B2", "US_B1_B2"],
    implementationStatus: "implemented",
    dryRunAvailable: true,
    sandboxAvailable: false,
    realSubmitAvailable: true,
    routeStatus: "submission_queue_dispatched",
    serviceFiles: ["src/ceac/**"],
    schemaFiles: ["src/ds160-form-mappings.ts", "../agent-backend/scripts/seed-ds160-form-fields.ts"],
    mapperFiles: ["src/ds160-derive-answers.ts"],
    automationFiles: ["src/ceac/orchestrator.ts", "src/index.ts"],
    requiredFields: US_DS160_REQUIRED_FIELDS,
    includeAllAnswersInPayload: true,
    dryRunConfirmationPrefix: "DRYRUN-DS160",
    notes: "Primary reference flow. Runner stops at CEAC sign-and-submit handoff.",
  },
  {
    countryCode: "SCHENGEN",
    countryAliases: [
      "fr",
      "france",
      "european_union",
      "schengen",
      "germany",
      "italy",
      "spain",
      "netherlands",
      "switzerland",
    ],
    displayName: "Schengen short-stay / France-Visas",
    supportedVisaTypes: ["EU_SCHENGEN_C_SHORT_STAY", "SCHENGEN_C"],
    implementationStatus: "implemented",
    dryRunAvailable: true,
    sandboxAvailable: false,
    realSubmitAvailable: true,
    routeStatus: "submission_queue_dispatched",
    serviceFiles: ["src/france-visas/**"],
    schemaFiles: ["../agent-backend/scripts/seed-eu-schengen-c-short-stay-form-fields.ts"],
    mapperFiles: ["src/france-visas/field-mappings.ts", "src/france-visas/normalize.ts"],
    automationFiles: ["src/france-visas/run.ts", "src/index.ts"],
    notes: "Primary reference flow for France. Other Schengen destinations currently share the visa type but not a destination-specific VFS runner.",
  },
  {
    countryCode: "AU",
    countryAliases: ["au", "australia"],
    displayName: "Australia Visitor 600",
    supportedVisaTypes: ["AU_VISITOR_600"],
    implementationStatus: "partial",
    dryRunAvailable: true,
    sandboxAvailable: false,
    realSubmitAvailable: false,
    routeStatus: "submission_queue_dispatched",
    serviceFiles: ["src/au-visitor/**"],
    schemaFiles: ["../agent-backend/scripts/seed-au-visitor-600-form-fields.ts"],
    mapperFiles: ["src/au-visitor/normalize.ts", "src/au-visitor/selectors.ts"],
    automationFiles: ["src/au-visitor/run.ts", "src/au-visitor/orchestrator.ts"],
    notes: "Walks ImmiAccount to Review and stops before applicant-controlled submit.",
  },
  {
    countryCode: "VN",
    countryAliases: ["vn", "vietnam"],
    displayName: "Vietnam e-Visa",
    supportedVisaTypes: ["VN_E_VISA", "EVISA_TOURISM", "E_VISA_TOURISM", "TOURIST_E_VISA"],
    implementationStatus: "partial",
    dryRunAvailable: true,
    sandboxAvailable: false,
    realSubmitAvailable: false,
    routeStatus: "submission_queue_dispatched",
    serviceFiles: ["src/vietnam/**"],
    schemaFiles: ["../agent-backend/scripts/seed-vn-e-visa-form-fields.ts"],
    mapperFiles: ["src/vietnam/field-mappings.ts"],
    automationFiles: ["src/vietnam/run.ts"],
    requiredFields: [
      ...COMMON_REQUIRED_FIELDS,
      ...COMMON_OPTIONAL_FIELDS,
      ...VN_REQUIRED_FIELDS,
    ],
    includeAllAnswersInPayload: true,
    dryRunConfirmationPrefix: "DRYRUN-VN",
    notes: "Dry-run validates the VN_E_VISA answer schema and runner is designed to halt before pay/submit; email-PDF capture remains deferred.",
  },
  {
    countryCode: "UK",
    countryAliases: ["uk", "gb", "united_kingdom", "united kingdom"],
    displayName: "UK Standard Visitor",
    supportedVisaTypes: ["UK_STANDARD_VISITOR"],
    implementationStatus: "partial",
    dryRunAvailable: true,
    sandboxAvailable: false,
    realSubmitAvailable: false,
    routeStatus: "submission_queue_dispatched",
    serviceFiles: ["src/uk/**"],
    schemaFiles: ["../agent-backend/scripts/seed-uk-standard-visitor-form-fields.ts"],
    mapperFiles: ["src/uk/field-mappings.ts", "src/uk/normalize.ts"],
    automationFiles: ["src/uk/orchestrator.ts", "src/uk/resume.ts"],
    notes: "Resume flow fills all 44 post-auth pages and halts at the declaration/£135 pay boundary; wizard answers are translated by normalizeUkAnswers before fill.",
  },
  {
    countryCode: "ID",
    countryAliases: ["id", "indonesia"],
    displayName: "Indonesia e-Visa",
    supportedVisaTypes: ["B211A", "ID_C1_TOURIST", "ID_B1_EVOA"],
    implementationStatus: "partial",
    dryRunAvailable: true,
    sandboxAvailable: false,
    realSubmitAvailable: true,
    routeStatus: "submission_queue_dispatched",
    serviceFiles: ["src/indonesia/**", "src/index.ts"],
    schemaFiles: [
      "../agent-backend/scripts/seed-id-c1-tourist-form-fields.ts",
      "../agent-backend/scripts/seed-id-b1-evoa-form-fields.ts",
    ],
    mapperFiles: ["src/indonesia/index.ts"],
    automationFiles: ["src/indonesia/**"],
    notes: "Live assisted queue dispatch exists for C1 official eVisa and B1 official e-VoA through evisa.imigrasi.go.id. The worker prepares the VIZA-managed alias email automatically and stops only for payment authorization or portal recon/action gates; VFS e-VoA is fallback recon only.",
  },
  {
    countryCode: "EG",
    countryAliases: ["eg", "egypt"],
    displayName: "Egypt e-Visa",
    supportedVisaTypes: ["EG_E_VISA"],
    implementationStatus: "blocked",
    dryRunAvailable: true,
    sandboxAvailable: false,
    realSubmitAvailable: false,
    routeStatus: "frontend_only",
    serviceFiles: ["src/egypt/form-recon.ts"],
    schemaFiles: ["../agent-backend/scripts/seed-eg-e-visa-form-fields.ts"],
    mapperFiles: [],
    automationFiles: ["src/egypt/form-recon.ts"],
    notes: "Wizard exists; authenticated automation is blocked on preregistered portal account/recon.",
  },
  {
    countryCode: "JP",
    countryAliases: ["jp", "japan"],
    displayName: "Japan tourist paper form",
    supportedVisaTypes: ["JP_TOURIST"],
    implementationStatus: "dry_run_only",
    dryRunAvailable: true,
    sandboxAvailable: false,
    realSubmitAvailable: false,
    routeStatus: "frontend_only",
    serviceFiles: [],
    schemaFiles: ["../agent-backend/scripts/seed-jp-tourist-form-fields.ts"],
    mapperFiles: [],
    automationFiles: [],
    notes: "No online submission portal in scope; frontend renders MOFA Form A PDF.",
  },
  {
    countryCode: "IT_VFS_CN",
    countryAliases: ["it_vfs_cn", "italy-vfs-cn"],
    displayName: "Italy VFS China corridor",
    supportedVisaTypes: ["EU_SCHENGEN_C_SHORT_STAY"],
    implementationStatus: "blocked",
    dryRunAvailable: true,
    sandboxAvailable: false,
    realSubmitAvailable: false,
    routeStatus: "module_only",
    serviceFiles: ["src/italy-vfs-cn/**"],
    schemaFiles: ["../agent-backend/scripts/seed-eu-schengen-c-short-stay-form-fields.ts"],
    mapperFiles: ["src/italy-vfs-cn/selectors.ts", "src/italy-vfs-cn/normalize.ts"],
    automationFiles: ["scripts/walk-italy-vfs-cn.ts"],
    notes: "Selector and normalization layer exists; orchestrator blocked on credentials and PDF source.",
  },
  {
    countryCode: "CA",
    countryAliases: ["ca", "canada"],
    displayName: "Canada TRV",
    supportedVisaTypes: ["CA_TRV"],
    implementationStatus: "not_started",
    dryRunAvailable: true,
    sandboxAvailable: false,
    realSubmitAvailable: false,
    routeStatus: "package_catalog_only",
    schemaFiles: ["../agent-backend/scripts/seed-ca-trv-form-fields.ts"],
    notes: "Package and schema seed exist; no submission-service runner.",
  },
  {
    countryCode: "KR",
    countryAliases: ["kr", "south_korea", "korea"],
    displayName: "Korea C-3-9",
    supportedVisaTypes: ["KR_C39_SHORT_TERM_VISIT"],
    implementationStatus: "partial",
    dryRunAvailable: true,
    sandboxAvailable: false,
    realSubmitAvailable: false,
    routeStatus: "module_only",
    serviceFiles: ["src/korea-kvac/**"],
    schemaFiles: ["../agent-backend/scripts/seed-kr-c39-short-term-visit-form-fields.ts"],
    automationFiles: ["src/korea-kvac/runner.ts"],
    notes: "Package and schema seed exist. PDF/KVAC appointment dry-run scaffold exists; live KVAC booking remains gated pending per-center selector and CAPTCHA/SMS validation.",
  },
  {
    countryCode: "AE",
    countryAliases: ["ae", "uae", "united_arab_emirates"],
    displayName: "UAE tourist visa",
    supportedVisaTypes: ["AE_TOURIST_VISA"],
    implementationStatus: "not_started",
    dryRunAvailable: true,
    sandboxAvailable: false,
    realSubmitAvailable: false,
    routeStatus: "package_catalog_only",
    schemaFiles: ["../agent-backend/scripts/seed-ae-tourist-visa-form-fields.ts"],
    notes: "Package and schema seed exist; no submission-service runner.",
  },
  {
    countryCode: "SG",
    countryAliases: ["sg", "singapore"],
    displayName: "Singapore SG Arrival Card",
    supportedVisaTypes: ["SG_ARRIVAL_CARD"],
    implementationStatus: "implemented",
    dryRunAvailable: true,
    sandboxAvailable: false,
    realSubmitAvailable: true,
    routeStatus: "submission_queue_dispatched",
    serviceFiles: ["src/country-submissions/**", "src/index.ts", "src/sgac/**"],
    schemaFiles: ["../agent-backend/scripts/seed-sg-arrival-card-form-fields.ts"],
    mapperFiles: ["src/country-submissions/from-records.ts", "src/sgac/normalize.ts"],
    automationFiles: ["src/sgac/runner.ts", "scripts/run-sgac-smoke.ts"],
    requiredFields: SGAC_REQUIRED_FIELDS,
    includeAllAnswersInPayload: true,
    dryRunConfirmationPrefix: "DRYRUN-SGAC",
    notes: "Dry-run validates SGAC traveller, trip, contact, and health declaration data. Live assisted submission uses the ICA SGAC portal runner and stays separate from SG_VISITOR_VISA.",
  },
  {
    countryCode: "MY",
    countryAliases: ["my", "malaysia"],
    displayName: "Malaysia MDAC",
    supportedVisaTypes: ["MY_MDAC_ARRIVAL_CARD"],
    implementationStatus: "implemented",
    dryRunAvailable: true,
    sandboxAvailable: false,
    realSubmitAvailable: true,
    routeStatus: "submission_queue_dispatched",
    serviceFiles: ["src/country-submissions/**", "src/index.ts", "src/mdac/**"],
    schemaFiles: ["../agent-backend/scripts/seed-my-mdac-arrival-card-form-fields.ts", "../agent-backend/scripts/my-mdac/**"],
    mapperFiles: ["src/country-submissions/from-records.ts", "src/mdac/normalize.ts"],
    automationFiles: ["src/mdac/runner.ts"],
    requiredFields: MDAC_REQUIRED_FIELDS,
    includeAllAnswersInPayload: true,
    dryRunConfirmationPrefix: "DRYRUN-MDAC",
    notes: "Dry-run validates Malaysia MDAC traveller, trip, contact, and accommodation data. Live assisted submission uses only the official Malaysian Immigration MDAC portal and stays separate from MY_TOURIST_E_VISA.",
  },
  {
    countryCode: "TH",
    countryAliases: ["th", "thailand"],
    displayName: "Thailand TDAC",
    supportedVisaTypes: ["TH_TDAC_ARRIVAL_CARD"],
    implementationStatus: "implemented",
    dryRunAvailable: true,
    sandboxAvailable: false,
    realSubmitAvailable: true,
    routeStatus: "submission_queue_dispatched",
    serviceFiles: ["src/country-submissions/**", "src/index.ts", "src/tdac/**"],
    schemaFiles: ["../agent-backend/scripts/seed-th-tdac-arrival-card-form-fields.ts", "../agent-backend/scripts/th-tdac/**"],
    mapperFiles: ["src/country-submissions/from-records.ts", "src/tdac/normalize.ts"],
    automationFiles: ["src/tdac/runner.ts"],
    requiredFields: TDAC_REQUIRED_FIELDS,
    includeAllAnswersInPayload: true,
    dryRunConfirmationPrefix: "DRYRUN-TDAC",
    notes: "Dry-run validates Thailand TDAC traveller, trip, accommodation, and health declaration data. Live assisted submission uses only the official Thai Immigration TDAC portal and stays separate from TH_TOURIST_E_VISA.",
  },
  {
    countryCode: "PH",
    countryAliases: ["ph", "philippines"],
    displayName: "Philippines eTravel",
    supportedVisaTypes: ["PH_ETRAVEL_ARRIVAL_CARD"],
    implementationStatus: "partial",
    dryRunAvailable: true,
    sandboxAvailable: false,
    realSubmitAvailable: true,
    routeStatus: "submission_queue_dispatched",
    serviceFiles: ["src/country-submissions/**", "src/index.ts", "src/ph-etravel/**"],
    schemaFiles: ["../agent-backend/scripts/seed-ph-etravel-arrival-card-form-fields.ts", "../agent-backend/scripts/ph-etravel/**"],
    mapperFiles: ["src/country-submissions/from-records.ts", "src/ph-etravel/normalize.ts"],
    automationFiles: ["src/ph-etravel/runner.ts", "scripts/run-ph-etravel-smoke.ts"],
    requiredFields: PH_ETRAVEL_REQUIRED_FIELDS,
    includeAllAnswersInPayload: true,
    dryRunConfirmationPrefix: "DRYRUN-PHETRAVEL",
    notes: "Dry-run validates Philippines eTravel traveller, trip, health, customs, currency, and declaration data. Live assisted submission uses only etravel.gov.ph and stays separate from PH_TEMPORARY_VISITOR_VISA.",
  },
  {
    countryCode: "SG",
    countryAliases: ["sg", "singapore"],
    displayName: "Singapore visitor visa",
    supportedVisaTypes: ["SG_VISITOR_VISA"],
    implementationStatus: "not_started",
    dryRunAvailable: true,
    sandboxAvailable: false,
    realSubmitAvailable: false,
    routeStatus: "package_catalog_only",
    schemaFiles: ["../agent-backend/scripts/seed-sg-visitor-visa-form-fields.ts"],
    notes: "Package and schema seed exist; no submission-service runner.",
  },
  {
    countryCode: "IN",
    countryAliases: ["in", "india"],
    displayName: "India e-Visa",
    supportedVisaTypes: ["IN_E_VISA"],
    implementationStatus: "partial",
    dryRunAvailable: true,
    sandboxAvailable: false,
    realSubmitAvailable: false,
    routeStatus: "module_only",
    serviceFiles: ["src/in/**"],
    schemaFiles: ["../agent-backend/scripts/seed-in-e-visa-form-fields.ts"],
    mapperFiles: ["src/in/selectors.ts"],
    automationFiles: ["src/in/runner.ts", "scripts/in-smoke.ts"],
    notes: "Scaffold/smoke module exists but is not dispatched by the main worker.",
  },
  {
    countryCode: "LK",
    countryAliases: ["lk", "sri_lanka"],
    displayName: "Sri Lanka ETA",
    supportedVisaTypes: ["LK_ETA"],
    implementationStatus: "partial",
    dryRunAvailable: true,
    sandboxAvailable: false,
    realSubmitAvailable: false,
    routeStatus: "module_only",
    serviceFiles: ["src/lk/**"],
    schemaFiles: ["../agent-backend/scripts/seed-lk-eta-form-fields.ts"],
    mapperFiles: ["src/lk/selectors.ts"],
    automationFiles: ["src/lk/runner.ts", "scripts/lk-smoke.ts"],
    notes: "Scaffold/smoke module exists but is not dispatched by the main worker.",
  },
  {
    countryCode: "KH",
    countryAliases: ["kh", "cambodia"],
    displayName: "Cambodia e-Visa",
    supportedVisaTypes: ["KH_TOURIST_E_VISA"],
    implementationStatus: "partial",
    dryRunAvailable: true,
    sandboxAvailable: false,
    realSubmitAvailable: false,
    routeStatus: "module_only",
    serviceFiles: ["src/kh/**"],
    schemaFiles: ["../agent-backend/scripts/seed-kh-e-visa-form-fields.ts"],
    mapperFiles: ["src/kh/selectors.ts"],
    automationFiles: ["src/kh/runner.ts", "scripts/kh-smoke.ts"],
    notes: "Scaffold/smoke module exists but is not dispatched by the main worker.",
  },
  {
    countryCode: "LA",
    countryAliases: ["la", "laos"],
    displayName: "Laos e-Visa",
    supportedVisaTypes: ["LA_TOURIST_E_VISA"],
    implementationStatus: "partial",
    dryRunAvailable: true,
    sandboxAvailable: false,
    realSubmitAvailable: false,
    routeStatus: "module_only",
    serviceFiles: ["src/la/**"],
    schemaFiles: ["../agent-backend/scripts/seed-la-e-visa-form-fields.ts"],
    mapperFiles: ["src/la/selectors.ts"],
    automationFiles: ["src/la/runner.ts", "scripts/la-smoke.ts"],
    notes: "Scaffold/smoke module exists but is not dispatched by the main worker.",
  },
  {
    countryCode: "ZA",
    countryAliases: ["za", "south_africa"],
    displayName: "South Africa visitor visa",
    supportedVisaTypes: ["ZA_VISITOR_VISA"],
    implementationStatus: "partial",
    dryRunAvailable: true,
    sandboxAvailable: false,
    realSubmitAvailable: false,
    routeStatus: "module_only",
    serviceFiles: ["src/za/**"],
    schemaFiles: ["../agent-backend/scripts/seed-za-visitor-visa-form-fields.ts"],
    mapperFiles: ["src/za/selectors.ts"],
    automationFiles: ["src/za/runner.ts", "scripts/za-smoke.ts"],
    notes: "Scaffold/smoke module exists but is not dispatched by the main worker.",
  },
  ...[
    ["TH", "Thailand tourist e-Visa", "TH_TOURIST_E_VISA", "thailand", "seed-th-tourist-e-visa-form-fields.ts"],
    ["MY", "Malaysia tourist eVisa", "MY_TOURIST_E_VISA", "malaysia", "seed-my-tourist-e-visa-form-fields.ts"],
    ["HK", "Hong Kong visit visa", "HK_VISIT_VISA", "hong_kong", "seed-hk-visit-visa-form-fields.ts"],
    ["MO", "Macau visit visa", "MO_VISIT_VISA", "macau", "seed-mo-visit-visa-form-fields.ts"],
    ["NZ", "New Zealand visitor visa", "NZ_VISITOR_VISA", "new_zealand", "seed-nz-visitor-visa-form-fields.ts"],
    ["RU", "Russia unified e-Visa", "RU_E_VISA", "russia", "seed-ru-e-visa-form-fields.ts"],
    ["TR", "Turkiye tourist e-Visa", "TR_E_VISA", "turkey", "seed-tr-e-visa-form-fields.ts"],
    ["MV", "Maldives IMUGA", "MV_IMUGA", "maldives", "seed-mv-imuga-form-fields.ts"],
    ["PH", "Philippines temporary visitor visa", "PH_TEMPORARY_VISITOR_VISA", "philippines", "seed-ph-temporary-visitor-visa-form-fields.ts"],
  ].map(([countryCode, displayName, visaType, alias, seedFile]) => ({
    countryCode,
    countryAliases: [countryCode.toLowerCase(), alias],
    displayName,
    supportedVisaTypes: [visaType],
    implementationStatus: "not_started" as ImplementationStatus,
    dryRunAvailable: true,
    sandboxAvailable: false,
    realSubmitAvailable: false,
    routeStatus: "package_catalog_only" as const,
    schemaFiles: [`../agent-backend/scripts/${seedFile}`],
    notes: "Package and schema seed exist; no submission-service runner.",
  })),
];

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function readAnswer(application: CountrySubmissionApplication, key: string): string | null {
  const value = application.answers?.[key];
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function normalizeRequirementValue(value: string | boolean): string {
  const normalized = normalizeToken(String(value));
  if (["1", "true", "on", "agree", "i_agree", "y"].includes(normalized)) return "yes";
  if (["0", "false", "off", "disagree", "n"].includes(normalized)) return "no";
  return normalized;
}

function readStringValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function readValueByKey(application: CountrySubmissionApplication, key: string): string | null {
  if (key === "answers.is_transit_traveler") {
    const explicit = readAnswer(application, "is_transit_traveler");
    if (explicit) return explicit;
    const arrivalDate = readAnswer(application, "arrival_date") ?? readStringValue(application.trip?.arrivalDate);
    const departureDate = readAnswer(application, "departure_date") ?? readStringValue(application.trip?.departureDate);
    if (arrivalDate && departureDate && arrivalDate === departureDate) return "true";
  }

  const [scope, ...path] = key.split(".");
  const field = path.join(".");
  if (scope === "profile" && field) {
    const profile = application.profile as Record<string, unknown>;
    return readStringValue(profile[field]);
  }
  if (scope === "trip" && field) {
    const trip = application.trip as Record<string, unknown>;
    return readStringValue(trip[field]);
  }
  if ((scope === "answers" || scope === "answer") && field) {
    return readAnswer(application, field);
  }
  if (scope === "metadata" && path.length > 0) {
    let current: unknown = application.metadata;
    for (const segment of path) {
      if (!current || typeof current !== "object") return null;
      current = (current as Record<string, unknown>)[segment];
    }
    return readStringValue(current);
  }
  return readAnswer(application, key);
}

function readRequirementValue(
  application: CountrySubmissionApplication,
  requirement: FieldRequirement,
): string | null {
  return readValueByKey(application, requirement.key);
}

function shouldValidateRequirement(
  application: CountrySubmissionApplication,
  requirement: FieldRequirement,
): boolean {
  if (!requirement.condition) return true;
  const actual = readValueByKey(application, requirement.condition.key);
  if (requirement.condition.equals !== undefined) {
    return actual
      ? normalizeRequirementValue(actual) === normalizeRequirementValue(requirement.condition.equals)
      : false;
  }
  if (requirement.condition.notEquals !== undefined) {
    return actual
      ? normalizeRequirementValue(actual) !== normalizeRequirementValue(requirement.condition.notEquals)
      : true;
  }
  return true;
}

function validateRequiredFields(
  application: CountrySubmissionApplication,
  requiredFields: FieldRequirement[],
): ValidationResult {
  const issues = requiredFields
    .filter((field) => field.required && shouldValidateRequirement(application, field))
    .filter((field) => !readRequirementValue(application, field))
    .map((field) => ({
      field: field.key,
      category: field.category as FieldCategory,
      message: `${field.label} is required for ${application.visaType}`,
    }));

  return {
    ok: issues.length === 0,
    issues,
    missingRequiredFields: issues.map((issue) => issue.field),
  };
}

function buildCountrySpecificPayload(
  application: CountrySubmissionApplication,
  includeAllAnswers = false,
): Record<string, string> {
  const answers = application.answers ?? {};
  const countryPrefix = normalizeToken(application.countryCode);
  const visaPrefix = normalizeToken(application.visaType);
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(answers)) {
    if (!value) continue;
    const normalizedKey = normalizeToken(key);
    if (
      includeAllAnswers ||
      normalizedKey.startsWith(`${countryPrefix}_`) ||
      normalizedKey.startsWith(`${visaPrefix}_`) ||
      normalizedKey.includes("criminal") ||
      normalizedKey.includes("overstay") ||
      normalizedKey.includes("refused_visa")
    ) {
      output[key] = String(value);
    }
  }
  return output;
}

function idempotencyKeyFor(
  application: CountrySubmissionApplication,
  provider: Pick<CountrySubmissionProvider, "countryCode">,
  explicitKey?: string,
): string {
  if (explicitKey?.trim()) return explicitKey.trim();
  return [
    "dry-run",
    provider.countryCode,
    application.visaType,
    application.applicationId,
  ].join(":");
}

function buildDryRunConfirmation(
  countryCode: string,
  applicationId: string,
  prefix?: string,
): string {
  const compactId = applicationId.replace(/[^a-z0-9]/gi, "").slice(0, 12).toUpperCase();
  const timestampedPrefixes = new Set(["DRYRUN-DS160", "DRYRUN-VN"]);
  const timestamp = prefix && timestampedPrefixes.has(prefix)
    ? `-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`
    : "";
  return `${prefix ?? `MOCK-${countryCode}`}-${compactId || "APPLICATION"}${timestamp}`;
}

function createProvider(config: ProviderConfig): CountrySubmissionProvider {
  const requiredFields = config.requiredFields ?? [
    ...COMMON_REQUIRED_FIELDS,
    ...COMMON_OPTIONAL_FIELDS,
    ...(config.extraRequiredFields ?? []),
  ];

  return {
    countryCode: config.countryCode,
    displayName: config.displayName,
    supportedVisaTypes: config.supportedVisaTypes,
    requiredFields,
    schemaVersion: SCHEMA_VERSION,
    implementationStatus: config.implementationStatus,
    dryRunAvailable: config.dryRunAvailable,
    sandboxAvailable: config.sandboxAvailable,
    realSubmitAvailable: config.realSubmitAvailable,
    routeStatus: config.routeStatus,
    serviceFiles: config.serviceFiles ?? [],
    schemaFiles: config.schemaFiles ?? [],
    mapperFiles: config.mapperFiles ?? [],
    automationFiles: config.automationFiles ?? [],
    notes: config.notes,
    validate(application) {
      return validateRequiredFields(application, requiredFields);
    },
    mapToSubmissionPayload(application, options = { dryRun: true }) {
      return {
        payloadVersion: SCHEMA_VERSION,
        countryCode: config.countryCode,
        visaType: application.visaType,
        applicationId: application.applicationId,
        dryRun: options.dryRun,
        idempotencyKey: idempotencyKeyFor(application, { countryCode: config.countryCode }, options.idempotencyKey),
        personal: application.profile,
        trip: {
          ...application.trip,
          destinationCountry: application.trip.destinationCountry ?? config.displayName,
          purpose: application.trip.purpose ?? readAnswer(application, "purpose_of_travel"),
        },
        countrySpecific: buildCountrySpecificPayload(application, config.includeAllAnswersInPayload),
        metadata: {
          ...(application.metadata ?? {}),
          implementationStatus: config.implementationStatus,
          routeStatus: config.routeStatus,
        },
      };
    },
    async submit(payload, options) {
      if (!options.dryRun || !config.dryRunAvailable) {
        return buildUnsupportedSubmissionResult(
          payload.applicationId,
          config.countryCode,
          payload.visaType,
          config.implementationStatus,
        );
      }
      return {
        country: "GENERIC",
        targetCountry: config.countryCode,
        visaType: payload.visaType,
        status: "submitted_mock",
        mode: "dry_run",
        applicationId: payload.applicationId,
        confirmationNumber: buildDryRunConfirmation(
          config.countryCode,
          payload.applicationId,
          config.dryRunConfirmationPrefix,
        ),
        implementationStatus: config.implementationStatus,
        message: `Dry-run submission completed for ${config.displayName}. Real external submission was not performed.`,
      };
    },
  };
}

const PROVIDERS = CONFIGS.map(createProvider);

export function listCountrySubmissionProviders(): CountrySubmissionProvider[] {
  return [...PROVIDERS];
}

export function getCountrySubmissionProvider(
  countryOrCode: string | null | undefined,
  visaType?: string | null,
): CountrySubmissionProvider | null {
  const normalizedCountry = countryOrCode ? normalizeToken(countryOrCode) : null;
  const normalizedVisa = visaType ? normalizeToken(visaType) : null;

  if (normalizedCountry && normalizedVisa) {
    const match = CONFIGS.find(
      (config) =>
        config.countryAliases.map(normalizeToken).includes(normalizedCountry) &&
        config.supportedVisaTypes.map(normalizeToken).includes(normalizedVisa),
    );
    if (match) return PROVIDERS[CONFIGS.indexOf(match)] ?? null;
  }

  if (normalizedVisa) {
    const match = CONFIGS.find((config) =>
      config.supportedVisaTypes.map(normalizeToken).includes(normalizedVisa),
    );
    if (match) return PROVIDERS[CONFIGS.indexOf(match)] ?? null;
  }

  if (normalizedCountry) {
    const match = CONFIGS.find((config) =>
      config.countryAliases.map(normalizeToken).includes(normalizedCountry),
    );
    if (match) return PROVIDERS[CONFIGS.indexOf(match)] ?? null;
  }

  return null;
}

export function buildUnsupportedSubmissionResult(
  applicationId: string,
  targetCountry: string,
  visaType: string,
  implementationStatus: ImplementationStatus = "not_started",
  message = "Submission for this country is not implemented yet.",
): GenericSubmissionResult {
  return {
    country: "GENERIC",
    targetCountry,
    visaType,
    status: "unsupported",
    mode: "dry_run",
    applicationId,
    implementationStatus,
    message,
  };
}

export async function runDryRunSubmission(
  application: CountrySubmissionApplication,
  options: SubmitOptions = { dryRun: true },
): Promise<GenericSubmissionResult> {
  const provider = getCountrySubmissionProvider(application.countryCode, application.visaType);
  if (!provider) {
    return buildUnsupportedSubmissionResult(
      application.applicationId,
      application.countryCode,
      application.visaType,
    );
  }

  const validation = provider.validate(application);
  if (!validation.ok) {
    return {
      country: "GENERIC",
      targetCountry: provider.countryCode,
      visaType: application.visaType,
      status: "unsupported",
      mode: "dry_run",
      applicationId: application.applicationId,
      implementationStatus: provider.implementationStatus,
      message: `Dry-run validation failed: ${validation.missingRequiredFields.join(", ")}`,
    };
  }

  const payload: SubmissionPayload = provider.mapToSubmissionPayload(application, options);
  return provider.submit(payload, options);
}
