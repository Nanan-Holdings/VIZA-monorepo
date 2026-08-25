"use client";

import { Download } from "@phosphor-icons/react";
import { ActionButton } from "@/components/ui/action-button";

type ResultRecord = Record<string, unknown>;

export interface SubmissionConfirmationEvidenceValue {
  screenshotPath: string;
  pdfPaths: string[];
}

function isRecord(value: unknown): value is ResultRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function storagePath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\\/g, "/");
  if (
    !normalized ||
    normalized.startsWith("/") ||
    normalized.includes("..") ||
    /^https?:\/\//i.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

function storagePaths(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(storagePath).filter((path): path is string => Boolean(path));
}

function hasTerminalConfirmation(result: ResultRecord): boolean {
  const status = typeof result.status === "string" ? result.status.trim().toLowerCase() : "";
  const artifacts = isRecord(result.artifacts) ? result.artifacts : {};
  if (result.country === "PH") {
    const resultEvidence = isRecord(result.resultEvidence) ? result.resultEvidence : {};
    const authoritativeRead = isRecord(resultEvidence.authoritativeRead)
      ? resultEvidence.authoritativeRead
      : {};
    const qrRender = isRecord(resultEvidence.qrRender) ? resultEvidence.qrRender : {};
    return (
      status === "submitted" &&
      result.submitted === true &&
      authoritativeRead.postSubmitRead === true &&
      qrRender.rendered === true
    );
  }
  if (result.country === "VN" && result.visaType === "VN_PREARRIVAL_DECLARATION") {
    return (
      status === "submitted" &&
      result.submitted === true &&
      storagePaths(artifacts.qrCodes).length > 0
    );
  }
  return (
    result.submitted === true ||
    isRecord(result.officialReceipt) ||
    ["submitted", "approved", "qr_ready", "paid"].includes(status)
  );
}

/**
 * Selects only evidence from a terminal official result. Runner screenshot
 * arrays are chronological, so the final image is the confirmation/result
 * page; diagnostic screenshots from failed or in-progress runs stay hidden.
 */
export function getSubmissionConfirmationEvidence(
  result: unknown,
): SubmissionConfirmationEvidenceValue | null {
  if (!isRecord(result) || !hasTerminalConfirmation(result)) return null;

  const artifacts = isRecord(result.artifacts) ? result.artifacts : {};
  const evidence = isRecord(result.evidence) ? result.evidence : {};
  const screenshots = storagePaths(artifacts.screenshots);
  const screenshotPath =
    storagePath(result.confirmationScreenshotStoragePath) ??
    storagePath(result.officialConfirmationScreenshotStoragePath) ??
    storagePath(evidence.screenshotPath) ??
    screenshots.at(-1) ??
    null;
  if (!screenshotPath) return null;

  const pdfPaths = [
    storagePath(result.confirmationPdfStoragePath),
    storagePath(result.emailConfirmationPdfStoragePath),
    storagePath(result.approvalPdfStoragePath),
    storagePath(result.printablePdfStoragePath),
    storagePath(result.artifactStoragePath),
    ...storagePaths(artifacts.pdfs),
  ].filter((path): path is string => Boolean(path));

  return {
    screenshotPath,
    pdfPaths: [...new Set(pdfPaths)],
  };
}

function artifactUrl(
  applicationId: string,
  path: string,
  filename: string,
  inline = false,
): string {
  const params = new URLSearchParams({ path, download: filename });
  if (inline) params.set("inline", "1");
  return `/api/applications/${encodeURIComponent(applicationId)}/submission-artifact?${params.toString()}`;
}

export function SubmissionConfirmationEvidence({
  applicationId,
  result,
  isZh,
  includePdfDownloads = true,
}: {
  applicationId: string | null;
  result: unknown;
  isZh: boolean;
  includePdfDownloads?: boolean;
}) {
  const evidence = getSubmissionConfirmationEvidence(result);
  if (!applicationId || !evidence) return null;

  const imageFilename = `official-confirmation-${applicationId}.png`;
  const imageUrl = artifactUrl(applicationId, evidence.screenshotPath, imageFilename, true);

  return (
    <div className="space-y-3">
      <a
        href={imageUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={isZh ? "查看官网确认页原图" : "View the full official confirmation image"}
        className="block overflow-hidden rounded-md border border-input bg-white"
      >
        <img
          src={imageUrl}
          alt={isZh ? "官网确认页截图" : "Official confirmation page screenshot"}
          className="max-h-[34rem] w-full object-contain"
        />
      </a>

      {includePdfDownloads && evidence.pdfPaths.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {evidence.pdfPaths.map((path, index) => {
              const filename = evidence.pdfPaths.length === 1
                ? `official-confirmation-${applicationId}.pdf`
                : `official-confirmation-${applicationId}-${index + 1}.pdf`;
              return (
                <ActionButton key={path} asChild variant="secondary" className="w-full">
                  <a href={artifactUrl(applicationId, path, filename)} download={filename}>
                    <Download className="size-4" />
                    {evidence.pdfPaths.length === 1
                      ? (isZh ? "下载确认 PDF" : "Download confirmation PDF")
                      : (isZh ? `下载确认 PDF ${index + 1}` : `Download confirmation PDF ${index + 1}`)}
                  </a>
                </ActionButton>
              );
            })}
        </div>
      ) : null}
    </div>
  );
}
