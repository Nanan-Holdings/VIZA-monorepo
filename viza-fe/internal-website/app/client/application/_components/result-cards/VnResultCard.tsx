"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { AlertTriangle, CheckCircle2, ExternalLink, FileCheck2, Loader2, Mail, Pencil, Receipt, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SmoothProgressBar } from "@/components/smooth-progress";
import { isChineseLocale } from "@/lib/i18n/locale";
import type { VnSubmissionResult } from "@/lib/submission-result";

type ManualAction = {
  id: string;
  actionType: string;
  status: string;
  instruction: string | null;
  screenshotUrl: string | null;
};

export function VnResultCard({
  applicationId,
  result,
  jobId,
}: {
  applicationId: string | null;
  result: VnSubmissionResult;
  jobId?: string | null;
}) {
  const isZh = isChineseLocale(useLocale());
  const [manualAction, setManualAction] = useState<ManualAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [officialFeeStatus, setOfficialFeeStatus] = useState<Record<string, unknown> | null>(null);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const hasRegistrationCode = Boolean(result.registrationCode);
  const isPaymentCheckpoint = result.status === "stopped_at_pay" || hasRegistrationCode;
  const receipt = officialFeeStatus?.receipt as Record<string, unknown> | null | undefined;
  const intent = officialFeeStatus?.intent as Record<string, unknown> | null | undefined;
  const quote = officialFeeStatus?.quote as Record<string, unknown> | null | undefined;
  const receiptNumber = typeof receipt?.receipt_number === "string" ? receipt.receipt_number : null;
  const receiptUrl = typeof receipt?.receipt_url === "string" ? receipt.receipt_url : null;
  const intentStatus = typeof intent?.status === "string" ? intent.status : null;
  const paymentQueuedByAction =
    officialFeeStatus?.paymentQueued === true ||
    typeof officialFeeStatus?.queueId === "string";
  const paymentNeedsOperator = officialFeeStatus?.paymentNeedsOperator === true;
  const quoteAmount = typeof quote?.official_fee_amount === "number"
    ? quote.official_fee_amount
    : typeof quote?.official_fee_amount === "string"
      ? Number(quote.official_fee_amount)
      : 25;
  const quoteCurrency = typeof quote?.official_fee_currency === "string" ? quote.official_fee_currency : "USD";
  const paymentPaid = result.paymentStatus === "paid" || intentStatus === "succeeded" || Boolean(receiptNumber);
  const paymentQueued =
    paymentQueuedByAction ||
    intentStatus === "in_progress" ||
    intentStatus === "pending" ||
    intentStatus === "manual_review";
  const paymentProgress = paymentPaid ? 100 : paymentQueued ? 82 : paymentNeedsOperator ? 72 : intentStatus ? 65 : hasRegistrationCode ? 48 : 30;
  const isFormCheckpoint = result.status === "official_form_reached";
  const isManualCheckpoint = Boolean(result.manualAction);
  const title = paymentPaid
    ? (isZh ? "越南 e-Visa 已提交并完成官方付款" : "Vietnam e-Visa submitted and paid")
    : isPaymentCheckpoint
    ? (isZh ? "越南 e-Visa 已提交到付款检查点" : "Vietnam e-Visa application captured")
    : isFormCheckpoint
      ? (isZh ? "已进入越南 e-Visa 官网表单" : "Vietnam e-Visa form reached")
      : isManualCheckpoint
        ? (isZh ? "越南 e-Visa 需要人工操作" : "Vietnam e-Visa action required")
        : (isZh ? "已进入越南官网流程" : "Vietnam official portal reached");
  const badge = paymentPaid
    ? (isZh ? "已付款" : "Paid")
    : isPaymentCheckpoint
    ? (isZh ? "等待付款" : "Action required: payment")
    : isManualCheckpoint
      ? (isZh ? "需要操作" : "Action required")
      : (isZh ? "官网检查点" : "Official checkpoint");
  const Icon = paymentPaid ? CheckCircle2 : isPaymentCheckpoint ? ShieldCheck : isFormCheckpoint ? FileCheck2 : AlertTriangle;

  useEffect(() => {
    if (!jobId || !result.manualAction) return;
    let cancelled = false;
    const loadManualActions = async () => {
      try {
        const response = await fetch(`/api/submissions/${jobId}/manual-actions`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as {
          error?: unknown;
          manualActions?: ManualAction[];
        } | null;
        if (!response.ok) {
          throw new Error(
            typeof payload?.error === "string"
              ? payload.error
              : `Manual actions returned ${response.status}`,
          );
        }
        const pending = payload?.manualActions?.find((action) => action.status === "pending") ?? null;
        if (!cancelled) {
          setManualAction(pending);
          setActionError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setActionError(error instanceof Error ? error.message : String(error));
        }
      }
    };

    void loadManualActions();
    return () => {
      cancelled = true;
    };
  }, [jobId, result.manualAction]);

  useEffect(() => {
    if (!applicationId || !isPaymentCheckpoint) return;
    let cancelled = false;
    const loadPaymentStatus = async () => {
      try {
        const response = await fetch(`/api/applications/${applicationId}/official-fee/status`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
        if (!response.ok) {
          throw new Error(typeof payload?.error === "string" ? payload.error : `official-fee/status returned ${response.status}`);
        }
        if (!cancelled) {
          setOfficialFeeStatus((current) => ({
            ...(payload ?? {}),
            paymentQueued: payload?.paymentQueued === true || current?.paymentQueued === true,
            queueId:
              typeof payload?.queueId === "string"
                ? payload.queueId
                : typeof current?.queueId === "string"
                  ? current.queueId
                  : null,
          }));
        }
      } catch (error) {
        if (!cancelled) setPaymentError(error instanceof Error ? error.message : String(error));
      }
    };

    void loadPaymentStatus();
    const timer = window.setInterval(loadPaymentStatus, paymentPaid ? 15000 : 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [applicationId, isPaymentCheckpoint, paymentPaid]);

  const completeManualAction = async () => {
    if (!jobId || !manualAction || completing) return;
    setCompleting(true);
    setActionError(null);
    try {
      const response = await fetch(
        `/api/submissions/${jobId}/manual-actions/${manualAction.id}/complete`,
        { method: "POST" },
      );
      const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : `Manual action completion returned ${response.status}`,
        );
      }
      window.location.reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setCompleting(false);
    }
  };

  const authorizeAndPay = async () => {
    if (!applicationId || paymentBusy) return;
    setPaymentBusy(true);
    setPaymentError(null);
    try {
      const authorize = await fetch(`/api/applications/${applicationId}/official-fee/authorize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted: true }),
      });
      const authorizePayload = (await authorize.json().catch(() => null)) as Record<string, unknown> | null;
      if (!authorize.ok) {
        throw new Error(typeof authorizePayload?.error === "string" ? authorizePayload.error : `official-fee/authorize returned ${authorize.status}`);
      }
      setOfficialFeeStatus((current) => ({ ...(current ?? {}), ...authorizePayload }));

      const pay = await fetch(`/api/applications/${applicationId}/official-fee/pay`, {
        method: "POST",
      });
      const payPayload = (await pay.json().catch(() => null)) as Record<string, unknown> | null;
      if (!pay.ok) {
        throw new Error(typeof payPayload?.error === "string" ? payPayload.error : `official-fee/pay returned ${pay.status}`);
      }
      setOfficialFeeStatus((current) => ({ ...(current ?? {}), paymentQueued: true, queueId: payPayload?.queueId ?? null }));
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : String(error));
    } finally {
      setPaymentBusy(false);
    }
  };

  return (
    <Card className="rounded-xl border-input">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-foreground">
            <Icon className="h-5 w-5 text-brand-500" />
            {title}
          </CardTitle>
          <Badge variant="secondary">{badge}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {paymentPaid
            ? isZh
              ? "VIZA 已完成本次越南 e-Visa 官网官方费用支付。你可以在下方查看官网登记编号、付款证据和后续状态查询入口。"
              : "VIZA has completed the official Vietnam e-Visa payment for this application."
            : isPaymentCheckpoint
            ? isZh
              ? "VIZA 已将申请推进到越南 e-Visa 官网付款检查点。点击下方“提交”后，系统会记录你的代付授权，并由 submission-service 继续处理官方付款。"
              : "We pre-filled your e-Visa application on the official Vietnam portal. Submit below to authorize official-fee payment handling."
            : result.manualAction?.instructions ??
              (isZh
                ? "后台已进入越南 e-Visa 官网流程，并停在付款或最终确认前的安全检查点。"
                : "The worker reached the official Vietnam e-Visa portal and stopped at a safe checkpoint before payment or final submit.")}
        </p>

        {result.checkpoint && (
          <div className="rounded-md border border-input bg-background px-3 py-2">
            <div className="text-xs text-muted-foreground">{isZh ? "官网检查点" : "Checkpoint"}</div>
            <div className="mt-0.5 font-mono text-sm font-medium text-foreground">
              {result.checkpoint}
            </div>
          </div>
        )}

        {hasRegistrationCode && (
          <div className="rounded-md border border-input bg-background px-3 py-2">
            <div className="text-xs text-muted-foreground">{isZh ? "官网登记编号" : "Registration code"}</div>
            <div className="mt-0.5 font-mono text-base font-medium text-foreground">
              {result.registrationCode}
            </div>
          </div>
        )}

        {isPaymentCheckpoint && (
          <div className="space-y-3 rounded-md border border-brand-100 bg-brand-50 p-3">
            <div className="flex items-start gap-2">
              <Receipt className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-foreground">
                  {paymentPaid ? (isZh ? "官方付款已完成" : "Official payment completed") : (isZh ? "官方费用代付" : "Official fee payment")}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {isZh
                    ? `本次越南 e-Visa 官方费用：${quoteCurrency} ${Number.isFinite(quoteAmount) ? quoteAmount.toFixed(2) : "25.00"}。不会保存银行卡号、CVV、验证码或 3DS 信息。`
                    : `Vietnam e-Visa official fee: ${quoteCurrency} ${Number.isFinite(quoteAmount) ? quoteAmount.toFixed(2) : "25.00"}. Card/CVV/OTP/3DS data is never stored.`}
                </p>
              </div>
            </div>

            <SmoothProgressBar
              displayedProgress={paymentProgress}
              label={
                paymentPaid
                  ? (isZh ? "付款成功，等待官网审核" : "Paid, waiting for official review")
                  : paymentQueued
                    ? (isZh ? "正在处理官方付款" : "Processing official payment")
                    : paymentNeedsOperator
                      ? (isZh ? "已提交，等待后台付款处理" : "Submitted, waiting for operator payment handling")
                    : (isZh ? "等待你的授权" : "Waiting for authorization")
              }
            />

            <div className="grid gap-2 sm:grid-cols-2">
              {receiptNumber && (
                <div className="rounded-md border border-brand-100 bg-white px-3 py-2">
                  <div className="text-xs text-brand-500">{isZh ? "付款证据编号" : "Payment evidence"}</div>
                  <div className="mt-0.5 break-all font-mono text-sm font-medium text-foreground">{receiptNumber}</div>
                </div>
              )}
              {intentStatus && (
                <div className="rounded-md border border-brand-100 bg-white px-3 py-2">
                  <div className="text-xs text-brand-500">{isZh ? "付款状态" : "Payment status"}</div>
                  <div className="mt-0.5 font-mono text-sm font-medium text-foreground">{intentStatus}</div>
                </div>
              )}
            </div>

            {!paymentPaid && !paymentQueued && !paymentNeedsOperator && (
              <Button
                type="button"
                className="w-full"
                onClick={authorizeAndPay}
                disabled={!applicationId || paymentBusy}
              >
                {paymentBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                {isZh ? "提交" : "Submit"}
              </Button>
            )}

            {!paymentPaid && paymentQueued && (
              <Button type="button" className="w-full" disabled>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isZh ? "已提交，等待后台付款" : "Submitted, waiting for payment worker"}
              </Button>
            )}

            {!paymentPaid && paymentNeedsOperator && (
              <Button type="button" className="w-full" disabled>
                {isZh ? "已提交，等待后台处理" : "Submitted, waiting for operator handling"}
              </Button>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              <Button asChild variant="outline" className="bg-white">
                <a href={applicationId ? `/client/application/long-form?country=vietnam&visaType=evisa_tourism&applicationId=${encodeURIComponent(applicationId)}` : "/client/application"} >
                  <Pencil className="mr-2 h-4 w-4" />
                  {isZh ? "修改" : "Edit"}
                </a>
              </Button>
              <Button asChild variant="outline" className="bg-white">
                <a href={applicationId ? `/client/status?applicationId=${encodeURIComponent(applicationId)}` : "/client/status"}>
                  {isZh ? "查看申请状态" : "View status"}
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>

            {receiptUrl && (
              <Button asChild variant="outline" className="w-full bg-white">
                <a href={receiptUrl} target="_blank" rel="noopener noreferrer">
                  {isZh ? "打开付款凭证" : "Open payment receipt"}
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            )}

            {paymentError && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {paymentError}
              </p>
            )}
          </div>
        )}

        {result.manualAction && (
          <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-3">
            <div className="text-xs font-medium text-amber-700">{isZh ? "需要人工操作" : "Manual action"}</div>
            <p className="mt-2 text-sm text-foreground">{result.manualAction.instructions}</p>
            {manualAction?.screenshotUrl && (
              <div className="rounded-md border border-amber-200 bg-white px-3 py-2">
                <div className="text-xs text-amber-700">{isZh ? "证据截图" : "Screenshot"}</div>
                <div className="mt-0.5 break-all font-mono text-xs text-foreground">
                  {manualAction.screenshotUrl}
                </div>
              </div>
            )}
            {manualAction && (
              <Button
                type="button"
                variant="outline"
                className="w-full bg-white"
                onClick={completeManualAction}
                disabled={completing}
              >
                {completing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isZh ? "我已在官网完成，继续" : "I completed this on the official page, continue"}
              </Button>
            )}
            {actionError && (
              <p className="text-sm text-red-700">{actionError}</p>
            )}
          </div>
        )}

        {result.noticeText && (
          <div className="rounded-md border border-brand-100 bg-brand-50 p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-brand-500">
              <Mail className="h-4 w-4" />
              {isZh ? "下一步" : "What happens next"}
            </div>
            <p className="mt-2 text-sm text-foreground">
              {isZh ? "e-Visa PDF 通常会在付款受理后约 3 个工作日通过邮件送达。" : result.noticeText}
            </p>
          </div>
        )}

        <Button asChild className="w-full">
          <a href={result.portalUrl ?? "https://evisa.gov.vn"} target="_blank" rel="noopener noreferrer">
            {isZh ? "打开越南 e-Visa 官网" : "Open official Vietnam e-Visa portal"}
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
