/**
 * The document extraction policy is deliberately data-only. It is the safety
 * boundary between OCR/multimodal candidates and application fields: a
 * document may only propose fields that are appropriate for its document
 * type. It does not read storage, call an LLM, or persist extracted values.
 */

export type DocumentFieldCategory =
  | "identity"
  | "passport"
  | "travel"
  | "accommodation"
  | "financial"
  | "invitation"
  | "photo"
  | "signature";

export interface DocumentExtractionPolicy {
  documentTypes: readonly string[];
  allowedFieldCategories: readonly DocumentFieldCategory[];
  allowedFieldNames: readonly string[];
}

export interface DocumentRequirement {
  requirementKey: string;
  documentType: string;
  required: boolean;
}

const PASSPORT_FIELD_NAMES = [
  "full_name",
  "full_name_en",
  "full_name_zh",
  "given_names",
  "surname",
  "passport_number",
  "travel_document_number",
  "passport_name",
  "passport_country",
  "date_of_birth",
  "birth_date",
  "nationality",
  "nationality_code",
  "issuing_country",
  "passport_issuing_country",
  "issue_date",
  "passport_issue_date",
  "travel_document_issue_date",
  "expiry_date",
  "passport_expiry_date",
  "travel_document_expiry_date",
  "gender",
  "place_of_birth",
  "place_of_birth_country",
  "city_of_birth",
] as const;

const TRAVEL_FIELD_NAMES = [
  "arrival_date",
  "departure_date",
  "date_of_arrival",
  "date_of_departure",
  "intended_arrival_date",
  "intended_departure_date",
  "flight_number",
  "transport_number",
  "custom_flight_number",
  "arrival_flight_number",
  "departure_flight_number",
  "origin",
  "departure_country",
  "departure_city",
  "destination",
  "arrival_country",
  "arrival_city",
  "arrival_port",
  "departure_port",
  "mode_of_travel",
  "transport_mode",
] as const;

const ACCOMMODATION_FIELD_NAMES = [
  "accommodation_type",
  "hotel_name",
  "accommodation_name",
  "hotel_address",
  "accommodation_address",
  "hotel_accommodation_address",
  "province_city_of_hotel",
  "ward_commune_of_hotel",
  "hotel_confirmation_number",
  "hotel_phone",
  "host_name",
  "host_address",
] as const;

const FINANCIAL_FIELD_NAMES = [
  "bank_name",
  "account_holder_name",
  "account_number_last_four",
  "statement_date",
  "available_balance",
  "account_balance",
  "currency",
  "monthly_income",
] as const;

const INVITATION_FIELD_NAMES = [
  "inviter_name",
  "inviter_address",
  "inviter_phone",
  "invitation_purpose",
  "relationship_to_inviter",
] as const;

const PHOTO_FIELD_NAMES = ["photo_url", "portrait_url", "applicant_photo"] as const;
const SIGNATURE_FIELD_NAMES = ["signature_url", "electronic_signature"] as const;

const POLICY_BY_TYPE: Record<string, DocumentExtractionPolicy> = {
  passport: {
    documentTypes: ["passport", "passport_copy", "passport_scan", "passport_bio_page"],
    allowedFieldCategories: ["identity", "passport"],
    allowedFieldNames: PASSPORT_FIELD_NAMES,
  },
  itinerary: {
    documentTypes: ["itinerary", "flight_itinerary", "travel_itinerary", "flight_ticket", "air_ticket"],
    allowedFieldCategories: ["travel"],
    allowedFieldNames: TRAVEL_FIELD_NAMES,
  },
  accommodation: {
    documentTypes: ["hotel_booking", "hotel_reservation", "accommodation", "accommodation_booking"],
    allowedFieldCategories: ["accommodation"],
    allowedFieldNames: ACCOMMODATION_FIELD_NAMES,
  },
  bank_statement: {
    documentTypes: ["bank_statement", "financial_statement", "proof_of_funds"],
    allowedFieldCategories: ["financial"],
    allowedFieldNames: FINANCIAL_FIELD_NAMES,
  },
  invitation_letter: {
    documentTypes: ["invitation_letter", "sponsor_letter", "letter_of_invitation"],
    allowedFieldCategories: ["invitation"],
    allowedFieldNames: INVITATION_FIELD_NAMES,
  },
  photo: {
    documentTypes: ["applicant_photo", "portrait", "photo", "passport_photo"],
    allowedFieldCategories: ["photo"],
    allowedFieldNames: PHOTO_FIELD_NAMES,
  },
  signature: {
    documentTypes: ["signature", "electronic_signature"],
    allowedFieldCategories: ["signature"],
    allowedFieldNames: SIGNATURE_FIELD_NAMES,
  },
};

const REQUIREMENTS_BY_PRODUCT: Record<string, readonly DocumentRequirement[]> = {
  // Test-only contract proving product-specific manifests without assigning
  // unreviewed requirements to a real visa or arrival-card package.
  test_form_assistant_documents: [
    { requirementKey: "passport", documentType: "passport", required: true },
    { requirementKey: "itinerary", documentType: "travel_itinerary", required: true },
    { requirementKey: "hotel", documentType: "hotel_booking", required: false },
  ],
};

const POLICY_ALIASES: Record<string, keyof typeof POLICY_BY_TYPE> = Object.entries(POLICY_BY_TYPE).reduce(
  (aliases, [key, policy]) => {
    aliases[key] = key as keyof typeof POLICY_BY_TYPE;
    for (const documentType of policy.documentTypes) aliases[documentType] = key as keyof typeof POLICY_BY_TYPE;
    return aliases;
  },
  {} as Record<string, keyof typeof POLICY_BY_TYPE>,
);

const FIELD_CATEGORY_BY_NAME: Record<string, DocumentFieldCategory> = {
  ...Object.fromEntries(PASSPORT_FIELD_NAMES.map((name) => [name, name === "full_name" || name.endsWith("_name") ? "identity" : "passport"])),
  ...Object.fromEntries(TRAVEL_FIELD_NAMES.map((name) => [name, "travel"])),
  ...Object.fromEntries(ACCOMMODATION_FIELD_NAMES.map((name) => [name, "accommodation"])),
  ...Object.fromEntries(FINANCIAL_FIELD_NAMES.map((name) => [name, "financial"])),
  ...Object.fromEntries(INVITATION_FIELD_NAMES.map((name) => [name, "invitation"])),
  ...Object.fromEntries(PHOTO_FIELD_NAMES.map((name) => [name, "photo"])),
  ...Object.fromEntries(SIGNATURE_FIELD_NAMES.map((name) => [name, "signature"])),
};

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[\s/-]+/g, "_");
}

function policyKey(documentType: string): keyof typeof POLICY_BY_TYPE | null {
  return POLICY_ALIASES[normalize(documentType)] ?? null;
}

/** Returns a defensive empty policy for unknown document types. */
export function getDocumentExtractionPolicy(documentType: string): DocumentExtractionPolicy {
  const key = policyKey(documentType);
  if (!key) {
    return {
      documentTypes: [],
      allowedFieldCategories: [],
      allowedFieldNames: [],
    };
  }
  return POLICY_BY_TYPE[key];
}

/**
 * Returns whether a candidate field is permitted for a document type. Unknown
 * field names and unknown document types are denied by default.
 */
export function canDocumentProposeField(documentType: string, fieldName: string): boolean {
  const policy = getDocumentExtractionPolicy(documentType);
  const normalizedField = normalize(fieldName);
  const category = FIELD_CATEGORY_BY_NAME[normalizedField];
  return Boolean(category && policy.allowedFieldCategories.includes(category) && policy.allowedFieldNames.includes(normalizedField));
}

export function allowedFieldCategoriesForDocument(documentType: string): readonly DocumentFieldCategory[] {
  return getDocumentExtractionPolicy(documentType).allowedFieldCategories;
}

/**
 * Product document requirements are intentionally explicit. SG Arrival Card
 * has no document requirements, so the assistant must not ask for uploads for
 * this product. Additional products can be added here only with a reviewed,
 * product-owned requirement row; an unknown product returns no requirements.
 */
export function getDocumentRequirements(
  countryOrProduct: string | { country: string; visaType: string },
  visaType?: string,
): readonly DocumentRequirement[] {
  const country = typeof countryOrProduct === "string" ? countryOrProduct : countryOrProduct.country;
  const product = typeof countryOrProduct === "string" ? visaType ?? "" : countryOrProduct.visaType;
  const normalizedCountry = normalize(country);
  const normalizedProduct = normalize(product);

  if (
    (normalizedCountry === "singapore" || normalizedCountry === "sg") &&
    (normalizedProduct === "sg_arrival_card" || normalizedProduct === "sgac")
  ) {
    return [];
  }

  if (REQUIREMENTS_BY_PRODUCT[normalizedProduct]) {
    return REQUIREMENTS_BY_PRODUCT[normalizedProduct];
  }

  // No unreviewed requirement may be invented by the assistant. Until a
  // product-specific manifest is registered, return an immutable empty list.
  return [];
}

/** Alias for callers that prefer a product-oriented name. */
export const getDocumentRequirementsForProduct = getDocumentRequirements;

export const DOCUMENT_EXTRACTION_POLICIES = POLICY_BY_TYPE;
