type ResultRecord = Record<string, unknown>;

export interface AutomatedOnlineSubmissionEvidence {
  reference: string | null;
  qrPaths: string[];
  pdfPaths: string[];
  submitted: boolean;
  qrReady: boolean;
  approved: boolean;
  needsAttention: boolean;
}

function isRecord(value: unknown): value is ResultRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(record: ResultRecord, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function getStringArray(record: ResultRecord, key: string): string[] {
  const value = record[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export function isAutomatedOnlineVisaType(visaType: string | null | undefined): boolean {
  const normalized = (visaType ?? "").trim().toUpperCase();
  return normalized === "JP_VISIT_JAPAN_WEB" || normalized === "KE_ETA";
}

/**
 * Converts a durable automated-entry result into evidence that is safe for
 * customer status surfaces. A status string alone never counts as success:
 * Japan needs a QR artifact, while Kenya approval needs the official PDF.
 */
export function getAutomatedOnlineSubmissionEvidence(
  result: unknown,
  visaType?: string | null,
): AutomatedOnlineSubmissionEvidence {
  if (!isRecord(result)) {
    return {
      reference: null,
      qrPaths: [],
      pdfPaths: [],
      submitted: false,
      qrReady: false,
      approved: false,
      needsAttention: false,
    };
  }

  const resolvedVisaType =
    typeof result.visaType === "string" ? result.visaType : visaType;
  const normalizedVisaType = (resolvedVisaType ?? "").trim().toUpperCase();
  if (!isAutomatedOnlineVisaType(normalizedVisaType)) {
    return {
      reference: null,
      qrPaths: [],
      pdfPaths: [],
      submitted: false,
      qrReady: false,
      approved: false,
      needsAttention: false,
    };
  }

  const status = getString(result, ["status"])?.toLowerCase() ?? "";
  const reference = getString(result, [
    "officialReference",
    "referenceNumber",
    "confirmationNumber",
    "applicationReference",
    "reference",
  ]);
  const artifacts = isRecord(result.artifacts) ? result.artifacts : {};
  const qrPaths = getStringArray(artifacts, "qrCodes");
  const pdfPaths = [
    getString(result, ["approvalPdfStoragePath", "confirmationPdfStoragePath", "artifactStoragePath"]),
    ...getStringArray(artifacts, "pdfs"),
  ].filter((path): path is string => Boolean(path));

  if (normalizedVisaType === "JP_VISIT_JAPAN_WEB") {
    const qrReady = status === "qr_ready" && result.qrReady === true && qrPaths.length > 0;
    return {
      reference,
      qrPaths: qrReady ? qrPaths : [],
      pdfPaths: [],
      submitted: qrReady,
      qrReady,
      approved: false,
      needsAttention: status === "qr_ready" && !qrReady,
    };
  }

  const approved = status === "approved" && pdfPaths.length > 0;
  const submitted = approved || (status === "submitted" && Boolean(reference));
  return {
    reference,
    qrPaths: [],
    pdfPaths: approved ? [...new Set(pdfPaths)] : [],
    submitted,
    qrReady: false,
    approved,
    needsAttention: status === "approved" && !approved,
  };
}
