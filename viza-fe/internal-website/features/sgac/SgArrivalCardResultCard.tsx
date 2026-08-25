"use client";

import { useLocale } from "next-intl";
import { Warning as AlertTriangle, Download, ArrowSquareOut as ExternalLink, CheckCircle } from "@phosphor-icons/react";
import type { SgArrivalCardSubmissionResult } from "@/lib/submission-result";
import { isChineseLocale } from "@/lib/i18n/locale";
import { ActionButton } from "@/components/ui/action-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmissionConfirmationEvidence } from "@/app/client/application/_components/result-cards/SubmissionConfirmationEvidence";

export function SgArrivalCardResultCard({
  result,
  embedded = false,
}: {
  result: SgArrivalCardSubmissionResult;
  /** The application page supplies the surrounding Application status panel. */
  embedded?: boolean;
}) {
  const isZh = isChineseLocale(useLocale());
  const successful = result.submitted && result.status === "submitted";
  const confirmationNumber = result.confirmationNumber ?? result.referenceNumber;
  const pdfPath = result.confirmationPdfStoragePath ?? result.artifacts?.pdfs?.[0] ?? null;
  const pdfUrl = pdfPath
    ? `/api/applications/${encodeURIComponent(result.applicationId)}/submission-artifact?path=${encodeURIComponent(pdfPath)}&download=${encodeURIComponent(`sg-arrival-card-${confirmationNumber ?? result.applicationId}.pdf`)}`
    : null;

  const content = (
    <div className="space-y-3">
      <div role="status" className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {successful ? (
            <CheckCircle className="mt-0.5 size-5 shrink-0 text-emerald-600" weight="fill" />
          ) : (
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" weight="fill" />
          )}
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-foreground">
              {isZh ? "新加坡入境卡" : "SG Arrival Card"}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {successful
                ? (isZh ? "您的申报已提交至新加坡移民与关卡局（ICA）。" : "Your declaration has been submitted to Singapore's Immigration & Checkpoints Authority (ICA).")
                : (result.errorDetails?.message || (isZh ? "本次提交未完成，请检查资料后重试。" : "This submission was not completed. Review the information and try again."))}
            </p>
          </div>
        </div>
        <span
          className={successful
            ? "inline-flex w-fit shrink-0 items-center rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700"
            : "inline-flex w-fit shrink-0 items-center rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700"}
        >
          {successful
            ? (isZh ? "已提交" : "Submitted")
            : (isZh ? "未完成" : "Not completed")}
        </span>
      </div>

      {successful && (confirmationNumber || result.payloadSummary?.arrivalDate) ? (
        <dl className="grid gap-5 sm:grid-cols-2">
          {confirmationNumber ? (
            <div>
              <dt className="text-sm text-muted-foreground">
                {isZh ? "DE / 确认号" : "DE / confirmation number"}
              </dt>
              <dd className="mt-1 break-all font-mono text-base font-semibold text-foreground">
                {confirmationNumber}
              </dd>
            </div>
          ) : null}
          {result.payloadSummary?.arrivalDate ? (
            <div>
              <dt className="text-sm text-muted-foreground">
                {isZh ? "抵达日期" : "Arrival date"}
              </dt>
              <dd className="mt-1 text-base font-semibold text-foreground">
                {result.payloadSummary.arrivalDate}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {successful ? (
        <SubmissionConfirmationEvidence
          applicationId={result.applicationId}
          result={result}
          isZh={isZh}
          includePdfDownloads={false}
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {successful && pdfUrl ? (
          <ActionButton asChild variant="secondary" className="w-full">
            <a href={pdfUrl} download={`sg-arrival-card-${confirmationNumber ?? result.applicationId}.pdf`}>
              <Download className="mr-2 size-4" />
              {isZh ? "下载确认 PDF" : "Download confirmation PDF"}
            </a>
          </ActionButton>
        ) : null}
        <ActionButton asChild variant="secondary" className="w-full">
          <a href={result.portalUrl} target="_blank" rel="noopener noreferrer">
            {isZh ? "打开 ICA SGAC 官方网站" : "Open the official ICA SGAC website"}
            <ExternalLink className="size-4" />
          </a>
        </ActionButton>
      </div>

    </div>
  );

  if (embedded) return content;

  return (
    <Card className="rounded-xl border-input">
      <CardHeader>
        <CardTitle>{isZh ? "申请状态" : "Application status"}</CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
