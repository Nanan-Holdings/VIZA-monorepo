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

export function UkResultCard({
  applicationId,
  result,
  applicationCountry = null,
  applicationVisaType = null,
}: UkResultCardProps) {
  const isZh = isChineseLocale(useLocale());
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const canStartPayment = ["stopped_at_pay", "funding_required"].includes(result.status);
  const paymentPending = result.status === "payment_pending";
  const paymentReviewRequired = result.status === "payment_review_required";
  const paid = result.status === "paid";
  const progress = result.prefillProgress;
  const needsPrefillRetry = result.status === "registered";

  const retryPrefill = async () => {
    if (retrying) return;
    const confirmed = window.confirm(
      isZh
        ? "这会在 gov.uk 上重新自动填写申请表（约 10–15 分钟），并在到达官方付款页后由 VIZA 继续处理。确认继续？"
        : "This will re-run automated pre-fill on gov.uk (~10–15 minutes). VIZA will continue when the official payment page is reached. Continue?",
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

  const payOfficialFee = async () => {
    if (paying) return;
    setPaying(true);
    setPaymentError(null);
    try {
      const response = await fetch(`/api/applications/${applicationId}/official-fee/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod: "viza_managed_virtual_card" }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: unknown;
        code?: unknown;
        checkoutUrl?: unknown;
      } | null;
      if (!response.ok) {
        if (
          payload?.code === "official_fee_funding_required" &&
          typeof payload.checkoutUrl === "string"
        ) {
          window.location.assign(payload.checkoutUrl);
          return;
        }
        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : isZh
              ? "无法启动官方费用自动支付，请稍后重试。"
              : "Could not start the automated official-fee payment. Please try again.",
        );
      }
      window.location.reload();
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : String(error));
    } finally {
      setPaying(false);
    }
  };

  return (
    <Card className="rounded-xl border-input">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-foreground">
            <ShieldCheck className="h-5 w-5 text-brand-500" />
            {paid
              ? (isZh ? "英国签证官网费用已支付" : "UK official fee paid")
              : needsPrefillRetry
                ? (isZh ? "英国签证账户已创建" : "Your UK visa account is ready")
                : (isZh ? "英国签证申请已填写完成" : "Your UK application is saved & pre-filled")}
          </CardTitle>
          <Badge variant={paid ? "default" : canStartPayment || paymentPending ? "secondary" : "outline"}>
            {paid
              ? (isZh ? "已支付" : "Paid")
              : paymentPending
                ? (isZh ? "付款处理中" : "Payment processing")
                : paymentReviewRequired
                  ? (isZh ? "VIZA 正在复核" : "VIZA review")
                  : canStartPayment
                    ? (isZh ? "待 VIZA 自动支付" : "VIZA payment pending")
                    : (isZh ? "填写进行中" : "Prefill in progress")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {paid
            ? (isZh
                ? "VIZA 已使用本申请专属虚拟卡完成官网费用支付，并保存官方回执。"
                : "VIZA paid the official fee with this application's dedicated virtual card and saved the official receipt.")
            : paymentPending
              ? (isZh
                  ? "VIZA 正在使用本申请专属虚拟卡完成官网付款并核对官方结果。本页会自动更新。"
                  : "VIZA is paying with this application's dedicated virtual card and confirming the official result. This page will update automatically.")
              : paymentReviewRequired
                ? (isZh
                    ? "官网付款结果或银行验证需要 VIZA 工作人员复核。你的申请和资金分配已安全保留；请勿前往 gov.uk 重复付款。"
                    : "The portal result or bank authentication requires VIZA staff review. Your application and funding allocation are safely preserved; do not make a duplicate payment on gov.uk.")
            : canStartPayment
            ? (isZh
                ? "我们已在 gov.uk 上保存并填写你的英国签证申请，并到达官方付款阶段。VIZA 将为本申请开立限额虚拟卡并自动支付官方费用；你无需登录 gov.uk 或自行付款。"
                : "We saved and pre-filled your UK visa application and reached the official payment stage. VIZA will open a limited virtual card for this application and pay the official fee automatically; you do not need to sign in to gov.uk or pay it yourself.")
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
                  ? "自动填写会在后台用 Playwright 逐页保存答案，完成后 VIZA 会继续处理官方付款。"
                  : "Pre-fill runs in the background via Playwright, saving each page. Once complete, VIZA will continue with the official payment."}
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

        {canStartPayment ? (
          <>
            <Button
              type="button"
              className="w-full"
              disabled={paying}
              onClick={() => {
                void payOfficialFee();
              }}
            >
              {paying ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="mr-2 h-4 w-4" />
              )}
              {paying
                ? (isZh ? "正在启动自动支付" : "Starting automated payment")
                : (isZh ? "由 VIZA 自动支付官方费用" : "Pay the official fee with VIZA")}
            </Button>
            {paymentError ? <ClientErrorAlert message={paymentError} /> : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
