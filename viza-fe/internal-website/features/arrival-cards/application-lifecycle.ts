import {
  isDigitalArrivalCardApplication,
  isKoreaEArrivalCardApplication,
} from "@/lib/submission-queue";

export interface ArrivalCardApplicationLifecycleInput {
  country: string | null | undefined;
  visaType: string | null | undefined;
  submissionResult: unknown;
}

/**
 * A successful official submission closes the current arrival-card form.
 * Starting another declaration must happen on a new application record so the
 * previous official confirmation and evidence remain immutable.
 */
export function hasSuccessfulArrivalCardSubmission(
  input: ArrivalCardApplicationLifecycleInput,
): boolean {
  if (!isDigitalArrivalCardApplication(input.country, input.visaType)) return false;
  const result = input.submissionResult;
  if (!result || typeof result !== "object" || Array.isArray(result)) return false;
  const record = result as Record<string, unknown>;
  if (record.status !== "submitted" || record.submitted !== true) return false;

  if (!isKoreaEArrivalCardApplication(input.country, input.visaType)) return true;
  const issueNumber = typeof record.issueNumber === "string" ? record.issueNumber.trim() : "";
  if (!issueNumber) return false;
  const portalUrl = typeof record.portalUrl === "string" ? record.portalUrl.trim() : "";
  let officialPortal = false;
  try {
    const parsed = new URL(portalUrl);
    officialPortal = parsed.protocol === "https:" &&
      parsed.hostname === "www.e-arrivalcard.go.kr" &&
      parsed.pathname.startsWith("/portal/");
  } catch {
    officialPortal = false;
  }
  if (!officialPortal) return false;

  const confirmationPdfStoragePath = typeof record.confirmationPdfStoragePath === "string"
    ? record.confirmationPdfStoragePath.trim()
    : "";
  const artifacts = record.artifacts;
  const pdfs = artifacts && typeof artifacts === "object" && !Array.isArray(artifacts)
    ? (artifacts as Record<string, unknown>).pdfs
    : null;
  const hasPdfArtifact = Array.isArray(pdfs) && pdfs.some(
    (pdf) => typeof pdf === "string" && pdf.trim().length > 0,
  );
  return Boolean(confirmationPdfStoragePath || hasPdfArtifact);
}
