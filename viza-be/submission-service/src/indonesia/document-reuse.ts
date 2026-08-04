export interface ReusableApplicantDocument {
  id: string;
}

export interface IndonesiaApplicantDocument extends ReusableApplicantDocument {
  document_type: string;
  storage_path: string | null;
  file_name: string | null;
}

const UNIVERSAL_DOCUMENT_TYPES = new Set([
  "passport_copy",
  "passport_bio_page",
  "photo",
  "applicant_photo",
]);

const OBVIOUS_FOREIGN_ARTIFACT =
  /arrival[-_\s]?card|\bsgac\b|\bmdac\b|\btdac\b|korea[-_\s]?annex|annex[-_\s]?17/i;

/** Passport and portrait files may be reused for the same applicant. */
export function isUniversalIndonesiaApplicantDocument(
  document: Pick<IndonesiaApplicantDocument, "document_type">,
): boolean {
  return UNIVERSAL_DOCUMENT_TYPES.has(document.document_type.trim().toLowerCase());
}

/**
 * Reject test placeholders and obviously foreign artifacts even when a row was
 * mislabeled as an Indonesia itinerary, return ticket, or bank statement.
 */
export function isPlausibleIndonesiaDocument(
  document: Pick<IndonesiaApplicantDocument, "document_type" | "storage_path" | "file_name">,
): boolean {
  const storagePath = document.storage_path?.trim() ?? "";
  if (!storagePath || /^test\//i.test(storagePath)) return false;

  const type = document.document_type.trim().toLowerCase();
  if (!["travel_itinerary", "return_ticket", "bank_statement"].includes(type)) return true;
  return !OBVIOUS_FOREIGN_ARTIFACT.test(`${document.file_name ?? ""} ${storagePath}`);
}

export function selectIndonesiaSubmissionDocuments<T extends IndonesiaApplicantDocument>(
  currentDocuments: readonly T[],
  siblingDocuments: readonly T[],
  options: { allowCurrentApplicationTestDocuments?: boolean } = {},
): T[] {
  const safeCurrent = options.allowCurrentApplicationTestDocuments
    ? currentDocuments.filter((document) => Boolean(document.storage_path?.trim()))
    : currentDocuments.filter(isPlausibleIndonesiaDocument);
  const safeUniversalSiblings = siblingDocuments.filter(
    (document) => isUniversalIndonesiaApplicantDocument(document) && isPlausibleIndonesiaDocument(document),
  );
  return prioritizeCurrentApplicationDocuments(safeCurrent, safeUniversalSiblings);
}

export function missingIndonesiaRequiredDocumentPaths(input: {
  isB1: boolean;
  passportImagePath?: string;
  photoImagePath?: string;
  returnTicketPath?: string;
  bankStatementPath?: string;
}): string[] {
  const missing: string[] = [];
  if (!input.passportImagePath) missing.push("passport_copy");
  if (!input.photoImagePath) missing.push("photo");
  if (!input.returnTicketPath || !/\.pdf$/i.test(input.returnTicketPath)) missing.push("return_ticket");
  if (!input.isB1 && (!input.bankStatementPath || !/\.pdf$/i.test(input.bankStatementPath))) {
    missing.push("bank_statement");
  }
  return missing;
}

/**
 * Order reusable documents so a successfully downloaded document from the
 * current application wins the later document-type fold. Sibling applications
 * remain earlier fallbacks when the current path is missing or unavailable.
 */
export function prioritizeCurrentApplicationDocuments<T extends ReusableApplicantDocument>(
  currentDocuments: readonly T[],
  siblingDocuments: readonly T[],
): T[] {
  const documentsById = new Map<string, T>();
  for (const document of siblingDocuments) {
    documentsById.set(document.id, document);
  }
  for (const document of currentDocuments) {
    // Reinsert duplicates so current-application records are always last.
    documentsById.delete(document.id);
    documentsById.set(document.id, document);
  }
  return Array.from(documentsById.values());
}
