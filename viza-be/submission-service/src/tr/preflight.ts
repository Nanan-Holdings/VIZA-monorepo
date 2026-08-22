export interface SubmissionDocumentEvidence {
  documentType: string;
  storagePath: string | null;
  status?: string | null;
}

export interface TrPreflightInput {
  answers: Record<string, string>;
  managedEmailAlias: string | null;
  documents: SubmissionDocumentEvidence[];
  captchaConfigured: boolean;
}

export interface TrPreflightResult {
  normalizedAnswers: Record<string, string>;
  eligibilityMissingAnswers: string[];
  missingAnswers: string[];
  missingDocuments: string[];
  missingCredentials: string[];
  readyForEligibility: boolean;
  ready: boolean;
}

export const TR_ELIGIBILITY_REQUIRED_FIELDS = [
  "travel_document_country",
  "travel_document_type",
  "intended_arrival_date",
] as const;

export const TR_UNCONDITIONAL_REQUIRED_FIELDS = [
  "travel_document_country",
  "travel_document_type",
  "intended_arrival_date",
  "given_names",
  "date_of_birth",
  "place_of_birth",
  "travel_document_number",
  "travel_document_issue_date",
  "travel_document_expiry_date",
  "email_address",
  "phone_number",
  "residence_address",
  "supporting_document_type",
  "confirm_passport_covers_stay",
  "confirm_return_ticket_accommodation_funds",
  "confirm_tourism_or_business",
  "confirm_all_official_prerequisites",
] as const;

export const TR_AFFIRMATIVE_CONFIRMATIONS = [
  "confirm_passport_covers_stay",
  "confirm_return_ticket_accommodation_funds",
  "confirm_tourism_or_business",
  "confirm_all_official_prerequisites",
] as const;

export const TR_CONDITIONAL_REQUIRED_FIELDS = {
  visa: [
    "supporting_visa_issued_by",
    "supporting_document_number",
    "supporting_visa_expiry_date",
    "confirm_supporting_document_valid",
  ],
  residence_permit: [
    "supporting_residence_permit_issued_by",
    "supporting_document_number",
    "confirm_supporting_document_valid",
  ],
} as const;

function affirmative(value: string | undefined): boolean {
  return ["yes", "true", "1", "confirmed"].includes(value?.trim().toLowerCase() ?? "");
}

function firstValue(answers: Record<string, string>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = answers[key]?.trim();
    if (value) return value;
  }
  return "";
}

function usableDocument(document: SubmissionDocumentEvidence): boolean {
  const status = document.status?.trim().toLowerCase() ?? "";
  return Boolean(document.storagePath?.trim()) &&
    ["uploaded", "validated", "accepted", "approved"].includes(status);
}

export function normalizeTrSubmissionAnswers(
  answers: Record<string, string>,
  managedEmailAlias: string | null,
): Record<string, string> {
  return {
    ...answers,
    travel_document_country: firstValue(answers, [
      "travel_document_country",
      "passport_issuing_country",
      "passport_country_of_issue",
      "nationality",
    ]),
    travel_document_type: firstValue(answers, ["travel_document_type", "passport_type"]),
    intended_arrival_date: firstValue(answers, ["intended_arrival_date", "arrival_date"]),
    given_names: firstValue(answers, ["given_names", "given_name", "first_name"]),
    surname: firstValue(answers, ["surname", "family_name", "last_name"]),
    date_of_birth: firstValue(answers, ["date_of_birth", "birth_date", "dob"]),
    place_of_birth: firstValue(answers, ["place_of_birth", "birth_place", "birth_city"]),
    mother_name: firstValue(answers, ["mother_name", "mother_full_name"]),
    father_name: firstValue(answers, ["father_name", "father_full_name"]),
    travel_document_number: firstValue(answers, ["travel_document_number", "passport_number"]),
    travel_document_issue_date: firstValue(answers, [
      "travel_document_issue_date",
      "passport_issue_date",
    ]),
    travel_document_expiry_date: firstValue(answers, [
      "travel_document_expiry_date",
      "passport_expiry_date",
    ]),
    // Official correspondence must stay on the VIZA-managed alias. The
    // applicant's personal email remains only the forwarding destination.
    email_address: managedEmailAlias?.trim().toLowerCase() ?? "",
    phone_number: firstValue(answers, ["phone_number", "phone", "telephone_number"]),
    residence_address: firstValue(answers, ["residence_address", "address", "residential_address"]),
    supporting_document_type: firstValue(answers, ["supporting_document_type"]),
    supporting_visa_issued_by: firstValue(answers, ["supporting_visa_issued_by"]),
    supporting_residence_permit_issued_by: firstValue(answers, [
      "supporting_residence_permit_issued_by",
    ]),
    supporting_visa_expiry_date: firstValue(answers, ["supporting_visa_expiry_date"]),
    supporting_residence_permit_expiry_date: firstValue(answers, [
      "supporting_residence_permit_expiry_date",
    ]),
  };
}

export function validateTrSubmissionPreflight(input: TrPreflightInput): TrPreflightResult {
  const normalizedAnswers = normalizeTrSubmissionAnswers(input.answers, input.managedEmailAlias);
  const eligibilityMissingAnswers = TR_ELIGIBILITY_REQUIRED_FIELDS.filter(
    (field) => !normalizedAnswers[field],
  );
  const missingAnswers: string[] = TR_UNCONDITIONAL_REQUIRED_FIELDS.filter(
    (field) => !normalizedAnswers[field],
  );
  for (const field of TR_AFFIRMATIVE_CONFIRMATIONS) {
    if (!affirmative(normalizedAnswers[field])) missingAnswers.push(field);
  }

  if (normalizedAnswers.supporting_document_type === "visa") {
    for (const field of TR_CONDITIONAL_REQUIRED_FIELDS.visa) {
      const complete = field === "confirm_supporting_document_valid"
        ? affirmative(normalizedAnswers[field])
        : Boolean(normalizedAnswers[field]);
      if (!complete) missingAnswers.push(field);
    }
  }
  if (normalizedAnswers.supporting_document_type === "residence_permit") {
    for (const field of TR_CONDITIONAL_REQUIRED_FIELDS.residence_permit) {
      const complete = field === "confirm_supporting_document_valid"
        ? affirmative(normalizedAnswers[field])
        : Boolean(normalizedAnswers[field]);
      if (!complete) missingAnswers.push(field);
    }
  }

  const hasPassportCopy = input.documents.some(
    (document) =>
      ["passport_copy", "passport_bio_page"].includes(document.documentType) &&
      usableDocument(document),
  );
  const missingDocuments = hasPassportCopy ? [] : ["passport_copy"];
  const missingCredentials = [
    ...(input.managedEmailAlias ? [] : ["viza_inbox_alias"]),
    ...(input.captchaConfigured ? [] : ["TWOCAPTCHA_API_KEY"]),
  ];

  return {
    normalizedAnswers,
    eligibilityMissingAnswers,
    missingAnswers: [...new Set(missingAnswers)],
    missingDocuments,
    missingCredentials,
    readyForEligibility:
      eligibilityMissingAnswers.length === 0 && input.captchaConfigured,
    ready:
      missingAnswers.length === 0 &&
      missingDocuments.length === 0 &&
      missingCredentials.length === 0,
  };
}

export function formatTrPreflightFailure(result: TrPreflightResult): string {
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
