"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { CircleNotch as Loader2, ArrowClockwise as RotateCw, ShieldCheck } from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClientErrorAlert } from "@/components/client/client-error-alert";
import { isChineseLocale } from "@/lib/i18n/locale";
import type { UkSubmissionResult } from "@/lib/submission-result";

type CustomerUkSubmissionResult = Omit<
  UkSubmissionResult,
  "generatedPasswordCipher" | "portalUrl" | "portalUsername"
>;

interface UkResultCardProps {
  applicationId: string;
  result: CustomerUkSubmissionResult;
  applicationCountry?: string | null;
  applicationVisaType?: string | null;
}

function isOfficialStepNeedsAttention(status: CustomerUkSubmissionResult["status"]): boolean {
  return [
    "stopped_at_pay",
    "funding_required",
    "payment_pending",
    "payment_review_required",
    "paid",
  ].includes(status);
}

export function UkResultCard({
  applicationId,
  result,
  applicationCountry = null,
  applicationVisaType = null,
}: UkResultCardProps) {
  const isZh = isChineseLocale(useLocale());
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const officialStepNeedsAttention = isOfficialStepNeedsAttention(result.status);
  const progress = result.prefillProgress;
  const needsPrefillRetry = result.status === "registered";

  const retryPrefill = async () => {
    if (retrying) return;
    const confirmed = window.confirm(
      isZh
        ? "这会在 gov.uk 上重新自动填写申请表（约 10–15 分钟）。官网需要进一步操作时，页面会提示你。确认继续？"
        : "This will re-run automated pre-fill on gov.uk (~10–15 minutes). This page will show any further official-portal step that needs attention. Continue?",
    );
    if (!confirmed) return;

    setRetrying(true);
    setRetryError(null);
    try {
      const response = await fetch(`/api/applications/${applicationId}/retry-submission`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "live_assisted",
          country: applicationCountry,
          visaType: applicationVisaType,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || `retry-submission returned ${response.status}`);
      }
      window.location.reload();
    } catch (error) {
      setRetryError(error instanceof Error ? error.message : String(error));
    } finally {
      setRetrying(false);
    }
  };

  return (
    <Card className="rounded-xl border-input">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-foreground">
            <ShieldCheck className="h-5 w-5 text-brand-500" />
            {officialStepNeedsAttention
              ? (isZh ? "英国签证申请需要处理" : "UK visa application needs attention")
              : needsPrefillRetry
                ? (isZh ? "英国签证账户已创建" : "Your UK visa account is ready")
                : (isZh ? "英国签证申请已填写完成" : "Your UK application is saved & pre-filled")}
          </CardTitle>
          <Badge variant={officialStepNeedsAttention ? "secondary" : "outline"}>
            {officialStepNeedsAttention
              ? (isZh ? "需要处理" : "Needs attention")
              : (isZh ? "填写进行中" : "Prefill in progress")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {officialStepNeedsAttention
            ? (isZh
                ? "需要处理，VIZA 自动付款已移除。请联系支持人员确认官方流程的下一步。"
                : "Needs attention. VIZA automated payment has been removed. Contact support to confirm the next official-portal step.")
            : (isZh
                ? "gov.uk 账户已创建，但自动填写尚未完成。请点击下方「重新提交到 gov.uk」启动自动填写；运行期间请保持 submission-service worker 运行。"
                : "Your gov.uk account is ready, but automated pre-fill has not finished yet. Click “Retry gov.uk prefill” below to start the fill — keep the submission-service worker running.")}
        </p>

        {needsPrefillRetry && (
          <div className="rounded-md border border-brand-100 bg-brand-50 p-3">
            <div className="flex items-start gap-2 text-sm leading-relaxed text-brand-900">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
              <span>
                {isZh
                  ? "自动填写会在后台用 Playwright 逐页保存答案，完成后页面会显示官方流程的最新状态。"
                  : "Pre-fill runs in the background via Playwright, saving each page. This page will show the latest official-portal status when it is available."}
              </span>
            </div>
            <Button
              type="button"
              className="mt-3 w-full"
              onClick={() => {
                void retryPrefill();
              }}
              disabled={retrying}
            >
              {retrying ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RotateCw className="mr-2 h-4 w-4" />
              )}
              {retrying
                ? (isZh ? "正在提交到 gov.uk" : "Submitting to gov.uk")
                : (isZh ? "重新提交到 gov.uk" : "Retry gov.uk prefill")}
            </Button>
            {retryError ? <ClientErrorAlert className="mt-2" message={retryError} /> : null}
          </div>
        )}

        {progress && needsPrefillRetry && (
          <p className="text-xs text-muted-foreground">
            {isZh
              ? `自动填写进度：约 ${progress.pagesFilled}/${progress.totalPages} 页已保存。`
              : `Prefill progress: about ${progress.pagesFilled}/${progress.totalPages} pages saved.`}
          </p>
        )}

        {result.applicationReference && (
          <div className="rounded-md border border-input bg-background px-3 py-2">
            <div className="text-xs text-muted-foreground">
              {isZh ? "申请参考号" : "Application reference"}
            </div>
            <div className="mt-0.5 font-mono text-sm text-foreground">{result.applicationReference}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
