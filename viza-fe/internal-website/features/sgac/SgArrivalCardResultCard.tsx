"use client";

import { useCallback, useState } from "react";
import { useLocale } from "next-intl";
import { AlertTriangle, Download, ExternalLink, Loader2, Plus, ShieldCheck } from "lucide-react";
import type { SgArrivalCardSubmissionResult } from "@/lib/submission-result";
import { isChineseLocale } from "@/lib/i18n/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SgArrivalCardResultCard({ result }: { result: SgArrivalCardSubmissionResult }) {
  const isZh = isChineseLocale(useLocale());
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [startingAgain, setStartingAgain] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const successful = result.submitted && result.status === "submitted";
  const confirmationNumber = result.confirmationNumber ?? result.referenceNumber;
  const pdfPath = result.confirmationPdfStoragePath ?? result.artifacts?.pdfs?.[0] ?? null;
  const pdfUrl = pdfPath
    ? `/api/applications/${encodeURIComponent(result.applicationId)}/submission-artifact?path=${encodeURIComponent(pdfPath)}&download=${encodeURIComponent(`sg-arrival-card-${confirmationNumber ?? result.applicationId}.pdf`)}`
    : null;

  const downloadPdf = useCallback(async () => {
    if (!pdfUrl) return;
    setDownloadingPdf(true);
    setActionError(null);
    try {
      const response = await fetch(pdfUrl, { credentials: "include" });
      if (!response.ok) throw new Error(`PDF download failed with ${response.status}`);
      const blob = await response.blob();
      if (blob.size < 10_000) throw new Error("Downloaded PDF is unexpectedly small.");
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `sg-arrival-card-${confirmationNumber ?? result.applicationId}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setDownloadingPdf(false);
    }
  }, [confirmationNumber, pdfUrl, result.applicationId]);

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

  return (
    <Card className="rounded-lg border-input">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          {successful ? (
            <ShieldCheck className="h-6 w-6 text-emerald-600" />
          ) : (
            <AlertTriangle className="h-6 w-6 text-amber-600" />
          )}
          {successful
            ? (isZh ? "SG Arrival Card 提交成功" : "SG Arrival Card submitted")
            : (isZh ? "SG Arrival Card 未完成" : "SG Arrival Card not completed")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {successful ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="border-l-2 border-emerald-600 pl-3">
              <div className="text-xs text-muted-foreground">{isZh ? "DE / 确认号" : "DE / confirmation number"}</div>
              <div className="mt-1 font-mono text-lg font-semibold">{confirmationNumber ?? (isZh ? "已提交" : "Submitted")}</div>
            </div>
            {result.payloadSummary?.arrivalDate ? (
              <div className="border-l-2 border-border pl-3">
                <div className="text-xs text-muted-foreground">{isZh ? "抵达日期" : "Arrival date"}</div>
                <div className="mt-1 text-base font-medium">{result.payloadSummary.arrivalDate}</div>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {result.errorDetails?.message || (isZh ? "本次提交未完成，请检查资料后重试。" : "This submission was not completed. Review the information and try again.")}
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {successful && pdfUrl ? (
            <Button type="button" onClick={downloadPdf} disabled={downloadingPdf}>
              {downloadingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {isZh ? "下载确认 PDF" : "Download confirmation PDF"}
            </Button>
          ) : null}
          <Button type="button" variant={successful && pdfUrl ? "outline" : "default"} onClick={startAgain} disabled={startingAgain}>
            {startingAgain ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            {isZh ? "再次提交" : "Submit another SGAC"}
          </Button>
        </div>

        {actionError ? <p className="text-sm text-red-700">{actionError}</p> : null}

        <Button asChild variant="ghost" className="w-full">
          <a href={result.portalUrl} target="_blank" rel="noopener noreferrer">
            {isZh ? "打开 ICA SGAC 官方网站" : "Open the official ICA SGAC website"}
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
