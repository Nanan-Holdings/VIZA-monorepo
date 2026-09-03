"use client";

import { useCallback, useState } from "react";
import { useLocale } from "next-intl";
import { Download, ArrowSquareOut as ExternalLink, Plus } from "@phosphor-icons/react";
import type { SgArrivalCardSubmissionResult } from "@/lib/submission-result";
import { isChineseLocale } from "@/lib/i18n/locale";
import { ActionButton } from "@/components/ui/action-button";
import { SubmissionStatePanel, TerminalSuccessPanel } from "@/components/ui/submission-result-panel";

export function SgArrivalCardResultCard({ result }: { result: SgArrivalCardSubmissionResult }) {
  const isZh = isChineseLocale(useLocale());
  const [startingAgain, setStartingAgain] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const authoritativeRead = result.resultEvidence?.authoritativeRead;
  const successful = result.submitted && result.status === "submitted" &&
    authoritativeRead?.postSubmitRead === true &&
    authoritativeRead.stableReference === true &&
    Boolean(authoritativeRead.referenceNumber?.trim());
  const confirmationNumber = result.confirmationNumber ?? result.referenceNumber ?? authoritativeRead?.referenceNumber;
  const pdfPath = result.confirmationPdfStoragePath ?? result.artifacts?.pdfs?.[0] ?? null;
  const pdfUrl = pdfPath
    ? `/api/applications/${encodeURIComponent(result.applicationId)}/submission-artifact?path=${encodeURIComponent(pdfPath)}&download=${encodeURIComponent(`sg-arrival-card-${confirmationNumber ?? result.applicationId}.pdf`)}`
    : null;

  const startAgain = useCallback(async () => {
    setStartingAgain(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/applications/${result.applicationId}/sgac-new-application`, {
        method: "POST",
      });
      const body = (await response.json().catch(() => null)) as { applicationId?: string; error?: string } | null;
      if (!response.ok || !body?.applicationId) {
        throw new Error(body?.error || `Could not create a new application (${response.status})`);
      }
      window.location.href = `/client/application/long-form?country=singapore&visaType=SG_ARRIVAL_CARD&applicationId=${encodeURIComponent(body.applicationId)}`;
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
      setStartingAgain(false);
    }
  }, [result.applicationId]);

  if (successful) {
    return (
      <TerminalSuccessPanel
        title={isZh ? "新加坡入境卡提交成功" : "SG Arrival Card submitted"}
        summary={result.portalResponseSummary}
        reference={confirmationNumber}
        referenceLabel={isZh ? "DE / 确认号" : "DE / confirmation number"}
        artifacts={result.payloadSummary?.arrivalDate ? (
          <p className="text-sm text-muted-foreground">
            {isZh ? "抵达日期：" : "Arrival date: "}{result.payloadSummary.arrivalDate}
          </p>
        ) : null}
        primaryAction={pdfUrl ? (
          <ActionButton asChild size="sm">
            <a href={pdfUrl} download={`sg-arrival-card-${confirmationNumber ?? result.applicationId}.pdf`}>
              <Download />
              {isZh ? "下载确认 PDF" : "Download confirmation PDF"}
            </a>
          </ActionButton>
        ) : undefined}
        secondaryActions={
          <>
            <ActionButton size="sm" variant={pdfUrl ? "outline" : "primary"} onClick={startAgain} loading={startingAgain} loadingText={isZh ? "正在创建" : "Creating"}>
              <Plus />
              {isZh ? "再次提交" : "Submit another SGAC"}
            </ActionButton>
            <ActionButton asChild size="sm" variant="ghost">
              <a href={result.portalUrl} target="_blank" rel="noopener noreferrer">
                {isZh ? "打开 ICA SGAC 官方网站" : "Open the official ICA SGAC website"}
                <ExternalLink />
              </a>
            </ActionButton>
          </>
        }
        nextStep={actionError ? <span className="text-destructive">{actionError}</span> : undefined}
      />
    );
  }

  return (
    <SubmissionStatePanel
      state={result.status === "submitted" ? "pending" : "action-required"}
      title={result.status === "submitted"
        ? (isZh ? "正在核验新加坡入境卡回执" : "Verifying the SG Arrival Card receipt")
        : (isZh ? "新加坡入境卡未完成" : "SG Arrival Card not completed")}
      summary={result.errorDetails?.message || (result.status === "submitted"
        ? (isZh ? "官网提交记录仍在核验中；核验完成前不会显示成功。" : "The official submission record is still being verified. Success will not appear until that verification finishes.")
        : (isZh ? "本次提交未完成，请检查资料后重试。" : "This submission was not completed. Review the information and try again."))}
    >
      <div className="space-y-5">

        <div className="grid gap-3 sm:grid-cols-2">
          <ActionButton size="sm" type="button" onClick={startAgain} loading={startingAgain} loadingText={isZh ? "正在创建" : "Creating"}>
            <Plus />
            {isZh ? "再次提交" : "Submit another SGAC"}
          </ActionButton>
        </div>

        {actionError ? <p className="text-sm text-red-700">{actionError}</p> : null}

        <ActionButton asChild size="sm" variant="ghost" className="w-full">
          <a href={result.portalUrl} target="_blank" rel="noopener noreferrer">
            {isZh ? "打开 ICA SGAC 官方网站" : "Open the official ICA SGAC website"}
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </ActionButton>
      </div>
    </SubmissionStatePanel>
  );
}
