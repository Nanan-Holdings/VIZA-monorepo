"use client";

import { Download, ImageSquare } from "@phosphor-icons/react";
import { useLocale } from "next-intl";
import { ActionButton } from "@/components/ui/action-button";
import { isChineseLocale } from "@/lib/i18n/locale";

type ResultRecord = Record<string, unknown>;

function isRecord(value: unknown): value is ResultRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function addPath(paths: string[], value: unknown): void {
  if (typeof value !== "string") return;
  const normalized = value.trim().replace(/\\/g, "/");
  if (
    !normalized ||
    normalized.startsWith("/") ||
    normalized.split("/").includes("..") ||
    /^https?:\/\//i.test(normalized)
  ) return;
  if (!paths.includes(normalized)) paths.push(normalized);
}

/** Extract only durable storage object paths; external URLs never become image sources here. */
export function getSubmissionScreenshotPaths(result: unknown): string[] {
  if (!isRecord(result)) return [];
  const paths: string[] = [];

  const artifacts = isRecord(result.artifacts) ? result.artifacts : null;
  if (Array.isArray(artifacts?.screenshots)) {
    for (const path of artifacts.screenshots) addPath(paths, path);
  }

  if (Array.isArray(result.checkpointEvidence)) {
    for (const item of result.checkpointEvidence) {
      if (!isRecord(item)) continue;
      addPath(paths, item.screenshotStoragePath);
    }
  }

  addPath(paths, result.reviewScreenshotStoragePath);
  const evidence = isRecord(result.evidence) ? result.evidence : null;
  addPath(paths, evidence?.screenshotPath);

  const paymentBoundary = isRecord(result.paymentBoundary) ? result.paymentBoundary : null;
  addPath(paths, paymentBoundary?.screenshotStoragePath);

  const manualAction = isRecord(result.manualAction) ? result.manualAction : null;
  addPath(paths, manualAction?.screenshotPath);
  addPath(paths, manualAction?.screenshotUrl);
  const manualEvidence = isRecord(manualAction?.evidence) ? manualAction.evidence : null;
  addPath(paths, manualEvidence?.screenshotPath);

  return paths;
}

export function SubmissionEvidenceGallery({
  applicationId,
  result,
}: {
  applicationId: string | null;
  result: unknown;
}) {
  const isZh = isChineseLocale(useLocale());
  const paths = getSubmissionScreenshotPaths(result);
  if (!applicationId || paths.length === 0) return null;

  const record = isRecord(result) ? result : {};
  const hasTypedPrePaymentEvidence = Array.isArray(record.checkpointEvidence) &&
    record.checkpointEvidence.some((item) => isRecord(item) && item.kind === "pre_payment");
  const paymentBoundaryRecord = isRecord(record.paymentBoundary)
    ? record.paymentBoundary
    : null;
  const paymentBoundary = hasTypedPrePaymentEvidence ||
    typeof paymentBoundaryRecord?.screenshotStoragePath === "string" ||
    record.checkpoint === "payment_page_visible";

  return (
    <section className="space-y-3 rounded-xl border border-input bg-background p-4" aria-label={isZh ? "官网凭证" : "Official portal evidence"}>
      <div className="flex items-start gap-2">
        <ImageSquare className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" aria-hidden="true" />
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {paymentBoundary
              ? isZh ? "官网付款页（已在付款前停止）" : "Official payment page — stopped before payment"
              : isZh ? "官网凭证截图" : "Official portal evidence"}
          </h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {paymentBoundary
              ? isZh ? "此截图记录付款边界；未输入、签发或提交银行卡。" : "This screenshot records the payment boundary. No card was entered, issued, or submitted."
              : isZh ? "截图来自本申请保存的官方流程记录。" : "These screenshots are stored evidence for this application’s official workflow."}
          </p>
        </div>
      </div>

      <div className="grid gap-3">
        {paths.map((path, index) => {
          const inlineUrl = `/api/applications/${applicationId}/submission-artifact?path=${encodeURIComponent(path)}&inline=1`;
          const downloadUrl = `/api/applications/${applicationId}/submission-artifact?path=${encodeURIComponent(path)}&download=official-portal-evidence-${index + 1}.png`;
          return (
            <div key={path} className="space-y-2 overflow-hidden rounded-lg border border-input bg-muted/20 p-2">
              <a href={inlineUrl} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-md bg-white">
                <img
                  src={inlineUrl}
                  alt={paymentBoundary
                    ? isZh ? "官网付款页截图" : "Official payment page screenshot"
                    : isZh ? "官网流程凭证截图" : "Official portal evidence screenshot"}
                  className="max-h-[34rem] w-full object-contain"
                />
              </a>
              <ActionButton asChild size="sm" variant="outline">
                <a href={downloadUrl}>
                  <Download />
                  {isZh ? "下载截图" : "Download screenshot"}
                </a>
              </ActionButton>
            </div>
          );
        })}
      </div>
    </section>
  );
}
