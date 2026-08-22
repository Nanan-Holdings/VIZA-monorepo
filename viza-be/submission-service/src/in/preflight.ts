import type { SubmissionDocumentEvidence } from "../tr/preflight.js";

export interface InPreflightInput {
  answers: Record<string, string>;
  managedEmailAlias: string | null;
  documents: SubmissionDocumentEvidence[];
  captchaConfigured: boolean;
}

export interface InRegistrationAnswers {
  nationality: string;
  passportTypeId: string;
  arrivalPortId: string;
  dateOfBirth: string;
  emailAddress: string;
  touristServiceId: string;
  touristPurposeId: string;
  expectedArrivalDate: string;
}

export interface InPreflightResult {
  registration: InRegistrationAnswers;
  normalizedAnswers: Record<string, string>;
  missingAnswers: string[];
  missingDocuments: string[];
  missingCredentials: string[];
  ready: boolean;
}

export const IN_TOURIST_SERVICE_IDS = {
  "30_days": "31",
  "1_year": "3",
  "5_years": "32",
} as const;

export const IN_TOURIST_PURPOSE_IDS = {
  "30_days": {
    recreation_sightseeing: "251",
    meeting_friends_relatives: "252",
    short_term_yoga: "253",
    short_term_course: "259",
    voluntary_work: "260",
  },
  "1_year": {
    recreation_sightseeing: "21",
    meeting_friends_relatives: "22",
    short_term_yoga: "23",
    short_term_course: "257",
    voluntary_work: "258",
  },
  "5_years": {
    recreation_sightseeing: "254",
    meeting_friends_relatives: "255",
    short_term_yoga: "256",
    short_term_course: "261",
    voluntary_work: "262",
  },
} as const;

export interface InPortalServiceEligibilityInput {
  allowedServiceIds: readonly string[];
  requestedServiceId: string;
}

export type InPortalServiceEligibility =
  | { allowed: true }
  | { allowed: false; reason: "requested_service_not_allowed" };

/**
 * Applies the official registration endpoint's nationality-specific service
 * allowlist to the requested e-Tourist service. Keep this policy dynamic: the
 * portal owns the allowlist and may change it without a code deployment.
 */
export function evaluateInPortalServiceEligibility(
  input: InPortalServiceEligibilityInput,
): InPortalServiceEligibility {
  const requested = input.requestedServiceId.trim();
  const allowed = new Set(input.allowedServiceIds.map((value) => value.trim()).filter(Boolean));
  return requested && allowed.has(requested)
    ? { allowed: true }
    : { allowed: false, reason: "requested_service_not_allowed" };
}

export const IN_UNCONDITIONAL_REQUIRED_FIELDS = [
  "visited_drc_uganda_south_sudan_last_21_days",
  "nationality",
  "passport_type",
  "port_of_arrival",
  "date_of_birth",
  "email_address",
  "tourist_validity",
  "tourist_purpose",
  "expected_arrival_date",
  "surname",
  "given_names",
  "has_changed_name",
  "gender",
  "birth_town_city",
  "birth_country",
  "national_id_number",
  "religion",
  "visible_identification_marks",
  "educational_qualification",
  "nationality_acquisition",
  "lived_two_years_in_application_country",
  "passport_number",
  "passport_place_of_issue",
  "passport_issue_date",
  "passport_expiry_date",
  "has_other_valid_travel_document",
  "present_house_street",
  "present_village_town_city",
  "present_country",
  "present_state_province_district",
  "present_postal_code",
  "phone_number",
  "permanent_address_same_as_present",
  "father_name",
  "father_nationality",
  "father_place_of_birth",
  "father_country_of_birth",
  "mother_name",
  "mother_nationality",
  "mother_place_of_birth",
  "mother_country_of_birth",
  "marital_status",
  "has_pakistan_parent_or_grandparent_history",
  "place_to_visit_1",
  "hotel_booked_through_tour_operator",
  "expected_port_of_exit",
  "visited_india_before",
  "india_permission_previously_refused",
  "visited_saarc_last_three_years",
  "india_reference_name",
  "india_reference_address",
  "india_reference_phone",
  "home_country_reference_name",
  "home_country_reference_address",
  "home_country_reference_phone",
  "arrested_prosecuted_or_convicted",
  "refused_entry_or_deported",
  "trafficking_abuse_or_financial_offence",
  "cybercrime_terrorism_or_violence",
  "expressed_support_for_terrorist_violence",
  "sought_asylum",
  "final_declaration",
] as const;

export const IN_CONDITIONAL_REQUIRED_FIELDS = [
  [
    "visited_drc_uganda_south_sudan_last_21_days",
    "yes",
    ["completed_21_days_after_exit"],
  ],
  ["has_changed_name", "yes", ["previous_name_details"]],
  ["religion", "other", ["religion_other"]],
  [
    "has_other_valid_travel_document",
    "yes",
    [
      "other_document_country_of_issue",
      "other_document_number",
      "other_document_issue_date",
      "other_document_place_of_issue",
      "other_document_nationality",
    ],
  ],
  [
    "permanent_address_same_as_present",
    "no",
    [
      "permanent_house_street",
      "permanent_village_town_city",
      "permanent_state_province_district",
    ],
  ],
  [
    "has_pakistan_parent_or_grandparent_history",
    "yes",
    ["pakistan_parent_or_grandparent_details"],
  ],
  [
    "visited_india_before",
    "yes",
    [
      "previous_india_stay_address",
      "cities_previously_visited_in_india",
      "previous_indian_visa_number",
      "previous_indian_visa_type",
      "previous_indian_visa_place_of_issue",
      "previous_indian_visa_issue_date",
    ],
  ],
  [
    "india_permission_previously_refused",
    "yes",
    ["india_permission_refusal_details"],
  ],
  [
    "visited_saarc_last_three_years",
    "yes",
    ["saarc_country", "saarc_visit_year", "saarc_number_of_visits"],
  ],
  [
    "arrested_prosecuted_or_convicted",
    "yes",
    ["arrested_prosecuted_or_convicted_details"],
  ],
  ["refused_entry_or_deported", "yes", ["refused_entry_or_deported_details"]],
  [
    "trafficking_abuse_or_financial_offence",
    "yes",
    ["trafficking_abuse_or_financial_offence_details"],
  ],
  [
    "cybercrime_terrorism_or_violence",
    "yes",
    ["cybercrime_terrorism_or_violence_details"],
  ],
  [
    "expressed_support_for_terrorist_violence",
    "yes",
    ["expressed_support_for_terrorist_violence_details"],
  ],
  ["sought_asylum", "yes", ["sought_asylum_details"]],
] as const;

export const IN_AFFIRMATIVE_CONFIRMATIONS = ["final_declaration"] as const;

function affirmative(value: string | undefined): boolean {
  return ["yes", "true", "1", "on", "confirmed"].includes(
    value?.trim().toLowerCase() ?? "",
  );
}

function firstValue(answers: Record<string, string>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = answers[key]?.trim();
    if (value) return value;
  }
  return "";
}

export function normalizeInPortalDate(value: string): string {
  const trimmed = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return /^(\d{2})\/(\d{2})\/(\d{4})$/.test(trimmed) ? trimmed : "";
}

function usableDocument(document: SubmissionDocumentEvidence): boolean {
  const status = document.status?.trim().toLowerCase() ?? "";
  return Boolean(document.storagePath?.trim()) &&
    ["uploaded", "validated", "accepted", "approved"].includes(status);
}

function purposeId(validity: string, purpose: string): string {
  const table = IN_TOURIST_PURPOSE_IDS[validity as keyof typeof IN_TOURIST_PURPOSE_IDS];
  return table?.[purpose as keyof typeof table] ?? "";
}

export function normalizeInSubmissionAnswers(
  answers: Record<string, string>,
  managedEmailAlias: string | null,
): { normalizedAnswers: Record<string, string>; registration: InRegistrationAnswers } {
  const normalizedAnswers = {
    ...answers,
    nationality: firstValue(answers, ["nationality", "current_nationality"]),
    passport_type: firstValue(answers, ["passport_type"]),
    port_of_arrival: firstValue(answers, ["port_of_arrival"]),
    date_of_birth: normalizeInPortalDate(
      firstValue(answers, ["date_of_birth", "birth_date", "dob"]),
    ),
    email_address: managedEmailAlias?.trim().toLowerCase() ?? "",
    tourist_validity: firstValue(answers, ["tourist_validity"]),
    tourist_purpose: firstValue(answers, ["tourist_purpose"]),
    expected_arrival_date: normalizeInPortalDate(
      firstValue(answers, ["expected_arrival_date", "intended_arrival_date"]),
    ),
    surname: firstValue(answers, ["surname", "family_name", "last_name"]),
    given_names: firstValue(answers, ["given_names", "given_name", "first_name"]),
    gender: firstValue(answers, ["gender", "sex"]),
    birth_town_city: firstValue(answers, ["birth_town_city", "birth_city", "place_of_birth"]),
    birth_country: firstValue(answers, ["birth_country", "country_of_birth"]),
    passport_number: firstValue(answers, ["passport_number", "travel_document_number"]),
    passport_place_of_issue: firstValue(answers, ["passport_place_of_issue", "place_of_issue"]),
    passport_issue_date: normalizeInPortalDate(
      firstValue(answers, ["passport_issue_date", "travel_document_issue_date"]),
    ),
    passport_expiry_date: normalizeInPortalDate(
      firstValue(answers, ["passport_expiry_date", "travel_document_expiry_date"]),
    ),
    passport_issuing_country: firstValue(answers, [
      "passport_issuing_country",
      "passport_country_of_issue",
      "travel_document_country",
      "nationality",
    ]),
    phone_number: firstValue(answers, ["phone_number", "phone", "telephone_number"]),
    occupation: firstValue(answers, ["occupation", "current_occupation"]),
    father_name: firstValue(answers, ["father_name", "father_full_name"]),
    mother_name: firstValue(answers, ["mother_name", "mother_full_name"]),
  };

  const touristServiceId =
    IN_TOURIST_SERVICE_IDS[
      normalizedAnswers.tourist_validity as keyof typeof IN_TOURIST_SERVICE_IDS
    ] ?? "";
  return {
    normalizedAnswers,
    registration: {
      nationality: normalizedAnswers.nationality,
      passportTypeId: normalizedAnswers.passport_type,
      arrivalPortId: normalizedAnswers.port_of_arrival,
      dateOfBirth: normalizedAnswers.date_of_birth,
      emailAddress: normalizedAnswers.email_address,
      touristServiceId,
      touristPurposeId: purposeId(
        normalizedAnswers.tourist_validity,
        normalizedAnswers.tourist_purpose,
      ),
      expectedArrivalDate: normalizedAnswers.expected_arrival_date,
    },
  };
}

export function validateInSubmissionPreflight(input: InPreflightInput): InPreflightResult {
  const { normalizedAnswers, registration } = normalizeInSubmissionAnswers(
    input.answers,
    input.managedEmailAlias,
  );
  const missingAnswers: string[] = IN_UNCONDITIONAL_REQUIRED_FIELDS.filter(
    (field) => !normalizedAnswers[field],
  );
  for (const field of IN_AFFIRMATIVE_CONFIRMATIONS) {
    if (!affirmative(normalizedAnswers[field])) missingAnswers.push(field);
  }
  for (const [root, expected, fields] of IN_CONDITIONAL_REQUIRED_FIELDS) {
    if (normalizedAnswers[root] !== expected) continue;
    for (const field of fields) {
      if (!normalizedAnswers[field]) missingAnswers.push(field);
    }
  }
  if (
    normalizedAnswers.visited_drc_uganda_south_sudan_last_21_days === "yes" &&
    normalizedAnswers.completed_21_days_after_exit === "yes"
  ) {
    if (!normalizedAnswers.ebola_symptoms_last_21_days) {
      missingAnswers.push("ebola_symptoms_last_21_days");
    } else if (
      normalizedAnswers.ebola_symptoms_last_21_days === "yes" &&
      !normalizedAnswers.ebola_symptom
    ) {
      missingAnswers.push("ebola_symptom");
    }
  }
  if (normalizedAnswers.tourist_validity && !registration.touristServiceId) {
    missingAnswers.push("tourist_validity");
  }
  if (
    normalizedAnswers.tourist_validity &&
    normalizedAnswers.tourist_purpose &&
    !registration.touristPurposeId
  ) {
    missingAnswers.push("tourist_purpose");
  }

  const usableTypes = new Set(
    input.documents.filter(usableDocument).map((document) => document.documentType),
  );
  const missingDocuments: string[] = [];
  if (!["applicant_photo", "photo", "personal_photo"].some((type) => usableTypes.has(type))) {
    missingDocuments.push("applicant_photo");
  }
  if (!["passport_bio_page", "passport_copy"].some((type) => usableTypes.has(type))) {
    missingDocuments.push("passport_bio_page");
  }
  if (
    normalizedAnswers.tourist_purpose === "short_term_course" &&
    !usableTypes.has("short_course_letter")
  ) {
    missingDocuments.push("short_course_letter");
  }
  if (
    normalizedAnswers.tourist_purpose === "voluntary_work" &&
    !usableTypes.has("voluntary_work_letter")
  ) {
    missingDocuments.push("voluntary_work_letter");
  }

  const missingCredentials = [
    ...(input.managedEmailAlias ? [] : ["viza_inbox_alias"]),
    ...(input.captchaConfigured ? [] : ["TWOCAPTCHA_API_KEY"]),
  ];
  const uniqueMissingAnswers = [...new Set(missingAnswers)];
  return {
    registration,
    normalizedAnswers,
    missingAnswers: uniqueMissingAnswers,
    missingDocuments,
    missingCredentials,
    ready:
      uniqueMissingAnswers.length === 0 &&
      missingDocuments.length === 0 &&
      missingCredentials.length === 0,
  };
}

export function formatInPreflightFailure(result: InPreflightResult): string {
  return [
    result.missingAnswers.length > 0
      ? `missing answers: ${result.missingAnswers.join(", ")}`
      : "",
    result.missingDocuments.length > 0
      ? `missing documents: ${result.missingDocuments.join(", ")}`
      : "",
    result.missingCredentials.length > 0
      ? `missing credentials: ${result.missingCredentials.join(", ")}`
      : "",
  ]
    .filter(Boolean)
    .join("; ");
}
