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

/** Passport and portrait files may be reused for the same applicant. */
export function isUniversalIndonesiaApplicantDocument(
  document: Pick<IndonesiaApplicantDocument, "document_type">,
): boolean {
  return UNIVERSAL_DOCUMENT_TYPES.has(document.document_type.trim().toLowerCase());
}

/**
 * Indonesia preflight only checks that a document has a stored object. File
 * names and storage-path names are not official eligibility requirements and
 * must not cause a required-document failure before the official portal sees
 * the upload.
 */
export function isPlausibleIndonesiaDocument(
  document: Pick<IndonesiaApplicantDocument, "document_type" | "storage_path" | "file_name">,
): boolean {
  return Boolean(document.storage_path?.trim());
}

export function selectIndonesiaSubmissionDocuments<T extends IndonesiaApplicantDocument>(
  currentDocuments: readonly T[],
  siblingDocuments: readonly T[],
): T[] {
  const safeCurrent = currentDocuments.filter(isPlausibleIndonesiaDocument);
  const safeUniversalSiblings = siblingDocuments.filter(
    (document) => isUniversalIndonesiaApplicantDocument(document) && isPlausibleIndonesiaDocument(document),
  );
  return prioritizeCurrentApplicationDocuments(safeCurrent, safeUniversalSiblings);
}

export function missingIndonesiaRequiredDocumentPaths(input: {
  isB1: boolean;
  documentTravelType?: string | null;
  passportImagePath?: string;
  photoImagePath?: string;
  returnTicketPath?: string;
  bankStatementPath?: string;
}): string[] {
  const missing: string[] = [];
  if (!input.passportImagePath) missing.push("passport_copy");
  if (!input.photoImagePath) missing.push("photo");
  if (requiresIndonesiaReturnTicket(input.isB1, input.documentTravelType) && !input.returnTicketPath) {
    missing.push("return_ticket");
  }
  if (!input.isB1 && !input.bankStatementPath) {
    missing.push("bank_statement");
  }
  return missing;
}

/**
 * B1 e-VOA always requires a return/onward ticket. For C1, the Immigration
 * Directorate lists that ticket only for stateless applicants and holders of
 * non-national travel documents; ordinary, diplomatic, and service passports
 * do not inherit the B1 requirement.
 */
export function requiresIndonesiaReturnTicket(
  isB1: boolean,
  documentTravelType?: string | null,
): boolean {
  if (isB1) return true;
  const normalized = documentTravelType?.trim().toLowerCase() ?? "";
  return /temporary|emergency|titre|certificate of identity|laissez|travel document|non[-\s]?national|refugee|stateless/.test(
    normalized,
  );
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
