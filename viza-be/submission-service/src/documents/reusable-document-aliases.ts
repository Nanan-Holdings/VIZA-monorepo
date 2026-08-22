const REUSABLE_DOCUMENT_ALIASES: Record<string, readonly string[]> = {
  passport_bio_page: ["passport_bio_page", "passport_copy"],
  passport_copy: ["passport_bio_page", "passport_copy"],
  photo: ["photo", "personal_photo", "applicant_photo"],
  personal_photo: ["photo", "personal_photo", "applicant_photo"],
  applicant_photo: ["photo", "personal_photo", "applicant_photo"],
  bank_statement: ["bank_statement", "six_month_bank_statement", "proof_of_funds"],
  six_month_bank_statement: ["bank_statement", "six_month_bank_statement", "proof_of_funds"],
  proof_of_funds: ["bank_statement", "six_month_bank_statement", "proof_of_funds"],
  travel_insurance: [
    "travel_insurance",
    "health_insurance",
    "uae_health_insurance",
    "uae_health_coverage_evidence",
  ],
  health_insurance: [
    "travel_insurance",
    "health_insurance",
    "uae_health_insurance",
    "uae_health_coverage_evidence",
  ],
  uae_health_insurance: [
    "travel_insurance",
    "health_insurance",
    "uae_health_insurance",
    "uae_health_coverage_evidence",
  ],
  uae_health_coverage_evidence: [
    "travel_insurance",
    "health_insurance",
    "uae_health_insurance",
    "uae_health_coverage_evidence",
  ],
  electronic_signature: ["electronic_signature", "signature", "signature_image"],
  national_identity_card: ["national_identity_card", "identity_card"],
};

export function reusableDocumentAliases(documentType: string): readonly string[] {
  return REUSABLE_DOCUMENT_ALIASES[documentType] ?? [documentType];
}
