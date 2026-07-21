"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { AlertTriangle, CheckCircle2, CreditCard, ExternalLink, FileCheck2, Loader2, Mail, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [oneTimeCardLast4, setOneTimeCardLast4] = useState<string | null>(null);
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
  const paymentQueue = officialFeeStatus?.paymentQueue as Record<string, unknown> | null | undefined;
  const paymentQueuePaid = paymentQueue?.status === "vn_payment_paid" || paymentQueue?.payment_status === "paid";
  const quoteAmount = typeof quote?.official_fee_amount === "number"
    ? quote.official_fee_amount
    : typeof quote?.official_fee_amount === "string"
      ? Number(quote.official_fee_amount)
      : 25;
  const quoteCurrency = typeof quote?.official_fee_currency === "string" ? quote.official_fee_currency : "USD";
  const paymentPaid = result.paymentStatus === "paid" || intentStatus === "succeeded" || Boolean(receiptNumber) || paymentQueuePaid;
  const paymentQueued =
    paymentQueuedByAction ||
    intentStatus === "in_progress" ||
    intentStatus === "pending" ||
    intentStatus === "manual_review";
  const cardReady = cardNumber.replace(/\D/g, "").length >= 12 && cardExpiry.trim().length >= 4 && cardCvv.replace(/\D/g, "").length >= 3;
  const showPaymentForm = !paymentPaid && (!paymentQueued || paymentNeedsOperator);
  const isFormCheckpoint = result.status === "official_form_reached";
  const isManualCheckpoint = Boolean(result.manualAction);
  const manualInstruction = result.manualAction?.instructions ?? "";
  const needsBankConfirmation =
    result.manualAction?.type === "payment_required" &&
    (
      result.portalUrl?.includes("pay.vnpay.vn") ||
      /3ds|otp|bank-app|bank authentication/i.test(manualInstruction)
    );
  const title = paymentPaid
    ? (isZh ? "越南 e-Visa 已提交并完成官方付款" : "Vietnam e-Visa submitted and paid")
    : isPaymentCheckpoint
    ? paymentQueued && !paymentNeedsOperator
      ? (isZh ? "越南自动付款处理中" : "Vietnam automated payment in progress")
      : paymentNeedsOperator
        ? (isZh ? "官方付款未完成，可重新自动付款" : "Official payment incomplete; automated retry is available")
        : (isZh ? "等待官方费用授权" : "Waiting for official-fee authorization")
    : isFormCheckpoint
      ? (isZh ? "已进入越南 e-Visa 官网表单" : "Vietnam e-Visa form reached")
      : isManualCheckpoint
        ? (isZh ? "越南 e-Visa 需要人工操作" : "Vietnam e-Visa action required")
        : (isZh ? "已进入越南官网流程" : "Vietnam official portal reached");
  const badge = paymentPaid
    ? (isZh ? "已付款" : "Paid")
    : isPaymentCheckpoint
    ? (isZh ? "自动处理中" : "Automating")
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          card: {
            pan: cardNumber,
            expiry: cardExpiry,
            cvv: cardCvv,
          },
        }),
      });
      const payPayload = (await pay.json().catch(() => null)) as Record<string, unknown> | null;
      if (!pay.ok) {
        throw new Error(typeof payPayload?.error === "string" ? payPayload.error : `official-fee/pay returned ${pay.status}`);
      }
      const cardSession = payPayload?.cardSession as Record<string, unknown> | undefined;
      const redactedCard = cardSession?.redactedCard as Record<string, unknown> | undefined;
      setOneTimeCardLast4(typeof redactedCard?.last4 === "string" ? redactedCard.last4 : null);
      setCardNumber("");
      setCardCvv("");
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
              ? "VIZA 已完成本次越南 e-Visa 官网付款，申请已进入官网审核。"
              : "VIZA has completed the official Vietnam e-Visa payment for this application."
            : isPaymentCheckpoint
            ? isZh
              ? "VIZA 已完成官网表单。填写本次付款银行卡后，系统会自动支付官方费用；只有银行要求 3DS、OTP 或 App 验证时才会暂停。"
              : "VIZA completed the official form. Add a one-time card to pay automatically; the flow pauses only for bank 3DS, OTP, or app verification."
            : result.manualAction?.instructions ??
              (isZh
                ? "后台已进入越南 e-Visa 官网流程，并停在付款或最终确认前的安全检查点。"
                : "The worker reached the official Vietnam e-Visa portal and stopped at a safe checkpoint before payment or final submit.")}
        </p>

        {result.checkpoint && !isPaymentCheckpoint && (
          <div className="rounded-md border border-input bg-background px-3 py-2">
            <div className="text-xs text-muted-foreground">{isZh ? "官网检查点" : "Checkpoint"}</div>
            <div className="mt-0.5 text-sm font-medium text-foreground">
              {isZh ? "官网流程已暂停，等待下一步处理" : "The official flow is paused for the next step"}
            </div>
          </div>
        )}

        {hasRegistrationCode && paymentPaid && (
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
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-foreground">
                  {paymentPaid
                    ? (isZh ? "官方付款已完成" : "Official payment completed")
                    : paymentQueued && !paymentNeedsOperator
                      ? (isZh ? "正在自动付款" : "Automated payment in progress")
                      : paymentNeedsOperator
                        ? (isZh ? "重新自动付款" : "Restart automated payment")
                        : (isZh ? "自动支付官方费用" : "Pay the official fee automatically")}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {isZh
                    ? `越南 e-Visa 官方费用为 ${quoteCurrency} ${Number.isFinite(quoteAmount) ? quoteAmount.toFixed(2) : "25.00"}。银行卡只用于本次付款，不会保存卡号或 CVV。`
                    : `The Vietnam e-Visa official fee is ${quoteCurrency} ${Number.isFinite(quoteAmount) ? quoteAmount.toFixed(2) : "25.00"}. Card number and CVV are never stored.`}
                </p>
              </div>
            </div>

            {showPaymentForm && (
              <div className="space-y-3 rounded-md border border-brand-100 bg-white p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <CreditCard className="h-4 w-4 text-brand-500" />
                  {paymentNeedsOperator
                    ? (isZh ? "重新自动付款银行卡" : "Restart automated payment card")
                    : (isZh ? "本次付款银行卡" : "One-time payment card")}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 sm:col-span-2">
                    <span className="text-xs text-muted-foreground">{isZh ? "银行卡号" : "Card number"}</span>
                    <input
                      value={cardNumber}
                      onChange={(event) => setCardNumber(event.target.value)}
                      autoComplete="cc-number"
                      inputMode="numeric"
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-brand-500"
                      placeholder={isZh ? "请输入银行卡号" : "Enter card number"}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-muted-foreground">{isZh ? "有效期" : "Expiry"}</span>
                    <input
                      value={cardExpiry}
                      onChange={(event) => setCardExpiry(event.target.value)}
                      autoComplete="cc-exp"
                      inputMode="numeric"
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-brand-500"
                      placeholder="MM/YY"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-muted-foreground">CVV</span>
                    <input
                      value={cardCvv}
                      onChange={(event) => setCardCvv(event.target.value)}
                      autoComplete="cc-csc"
                      inputMode="numeric"
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-brand-500"
                      placeholder="CVV"
                    />
                  </label>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {isZh
                    ? "卡号和 CVV 只用于本次官方付款，并通过短时安全会话发送；不会保存到数据库、日志或个人资料。"
                    : "Card number and CVV are sent through a short-lived secure session for this payment only and are never stored."}
                </p>
                <Button
                  type="button"
                  className="w-full"
                  onClick={authorizeAndPay}
                  disabled={!applicationId || paymentBusy || !cardReady}
                >
                  {paymentBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                  {paymentNeedsOperator
                    ? (isZh ? "重新自动付款" : "Restart automated payment")
                    : (isZh ? "开始自动付款" : "Start automated payment")}
                </Button>
              </div>
            )}

            {!paymentPaid && paymentQueued && !paymentNeedsOperator && (
              <Button type="button" className="w-full" disabled>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isZh ? "正在自动付款" : "Automated payment in progress"}
              </Button>
            )}

            {oneTimeCardLast4 && !paymentPaid && (
              <p className="rounded-md border border-brand-100 bg-white px-3 py-2 text-xs text-muted-foreground">
                {isZh
                  ? `已安全接收尾号 ${oneTimeCardLast4} 的银行卡。`
                  : `Card ending ${oneTimeCardLast4} was received securely.`}
              </p>
            )}

            {paymentPaid && receiptNumber && (
              <div className="rounded-md border border-brand-100 bg-white px-3 py-2">
                <div className="text-xs text-brand-500">{isZh ? "付款凭证编号" : "Payment evidence"}</div>
                <div className="mt-0.5 break-all font-mono text-sm font-medium text-foreground">{receiptNumber}</div>
              </div>
            )}

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

        {result.manualAction && (!isPaymentCheckpoint || needsBankConfirmation) && (
          <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-3">
            <div className="text-xs font-medium text-amber-700">{isZh ? "需要人工操作" : "Manual action"}</div>
            {needsBankConfirmation && (
              <p className="rounded-md border border-amber-200 bg-white px-3 py-2 text-sm leading-relaxed text-amber-900">
                {isZh
                  ? "已到达 VNPAY / 银行 3DS 付款确认页。请在自动打开的官方付款浏览器窗口中完成 3DS、OTP 或银行 App 验证；不要使用下方旧链接重新打开，因为该付款页不能靠 URL 恢复。若官方付款窗口已关闭，请重新提交本次付款银行卡。"
                  : "The VNPAY / bank 3DS confirmation page is open in the official browser window. Complete 3DS, OTP, or bank-app authentication there. Do not reopen the saved payment URL; that page cannot be restored by URL alone. If the window was closed, resubmit the one-time card."}
              </p>
            )}
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

        {needsBankConfirmation ? (
          <Button type="button" className="w-full" disabled>
            {isZh ? "请在已打开的官方付款窗口完成验证" : "Complete verification in the open official payment window"}
          </Button>
        ) : !isPaymentCheckpoint ? (
          <Button asChild className="w-full">
            <a href={result.portalUrl ?? "https://evisa.gov.vn"} target="_blank" rel="noopener noreferrer">
              {isZh ? "打开越南 e-Visa 官网" : "Open official Vietnam e-Visa portal"}
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
