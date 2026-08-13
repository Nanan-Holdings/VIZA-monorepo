"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { Warning as AlertTriangle, CheckCircle as CheckCircle2, CreditCard, ArrowSquareOut as ExternalLink, FileText as FileCheck2, CircleNotch as Loader2, Envelope as Mail, ShieldCheck } from "@phosphor-icons/react";
import {
  Alert,
  AlertAction,
  AlertActions,
  AlertDescription,
  AlertIcon,
  AlertTitle,
} from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isChineseLocale } from "@/lib/i18n/locale";
import { isIgnorableRuntimeAbortError } from "@/lib/runtime-abort-errors";
import type { VnSubmissionResult } from "@/lib/submission-result";
import { WaitingCard } from "./WaitingCard";

type ManualAction = {
  id: string;
  actionType: string;
  status: string;
  instruction: string | null;
  screenshotUrl: string | null;
};

export function mergeOfficialFeeStatus(
  current: Record<string, unknown> | null,
  payload: Record<string, unknown> | null,
): Record<string, unknown> {
  const payloadHasPaymentQueued = typeof payload?.paymentQueued === "boolean";
  return {
    ...(current ?? {}),
    ...(payload ?? {}),
    // A terminal queue response must be allowed to clear the optimistic
    // `true` written immediately after POST /pay. Keeping it sticky made the
    // payment card remain at 99% after vn_blocked/manual_review was persisted.
    paymentQueued: payloadHasPaymentQueued
      ? payload?.paymentQueued === true
      : current?.paymentQueued === true,
    queueId:
      typeof payload?.queueId === "string"
        ? payload.queueId
        : typeof current?.queueId === "string"
          ? current.queueId
          : null,
    paymentQueue: payload?.paymentQueue ?? current?.paymentQueue ?? null,
  };
}

export function localizeVietnamPaymentError(
  error: string | null | undefined,
  isZh: boolean,
): string | null {
  const normalized = error?.trim();
  if (!normalized) return null;
  const phaseMessages: Record<string, { zh: string; en: string }> = {
    worker_start_failed: {
      zh: "云端付款机器暂时无法启动，请稍后重新提交。",
      en: "The cloud payment worker could not start. Please resubmit shortly.",
    },
    worker_readiness_timeout: {
      zh: "云端付款服务启动超时，本次未创建付款任务，请重新提交。",
      en: "The cloud payment service timed out while starting. No payment job was created; please resubmit.",
    },
    card_handoff_failed: {
      zh: "银行卡安全会话未能送达云端，本次未创建付款任务，请重新提交。",
      en: "The secure card session did not reach the cloud worker. No payment job was created; please resubmit.",
    },
    queue_enqueue_failed: {
      zh: "云端付款任务未能创建，本次银行卡会话已取消，请重新提交。",
      en: "The cloud payment job could not be created. This card session was cancelled; please resubmit.",
    },
    card_session_not_configured: {
      zh: "云端付款服务尚未配置，请联系 VIZA 支持。",
      en: "The cloud payment service is not configured. Please contact VIZA support.",
    },
  };
  const phaseMessage = phaseMessages[normalized];
  if (phaseMessage) return isZh ? phaseMessage.zh : phaseMessage.en;
  if (!isZh || /\p{Script=Han}/u.test(normalized)) return normalized;
  if (isIgnorableRuntimeAbortError(new Error(normalized))) {
    return "状态查询暂时超时，系统会自动重新连接。";
  }
  if (/network|fetch|connection|timeout|timed out/i.test(normalized)) {
    return "网络连接暂时不稳定，系统会自动重新连接。";
  }
  return "官网处理暂时未完成，系统会自动更新；如果长时间没有变化，请联系支持。";
}

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
  const [activePaymentQueueId, setActivePaymentQueueId] = useState<string | null>(null);
  const [paymentProgressCycleKey, setPaymentProgressCycleKey] = useState<string | null>(null);
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
  const polledPaymentQueueId =
    typeof paymentQueue?.id === "string"
      ? paymentQueue.id
      : typeof officialFeeStatus?.queueId === "string"
        ? officialFeeStatus.queueId
        : null;
  const paymentQueueStatus = typeof paymentQueue?.status === "string" ? paymentQueue.status : null;
  const paymentQueueStage = typeof paymentQueue?.current_stage === "string" ? paymentQueue.current_stage : null;
  const paymentQueuePaymentStatus =
    typeof paymentQueue?.payment_status === "string" ? paymentQueue.payment_status : null;
  const paymentQueueOfficialStatus =
    typeof paymentQueue?.official_status === "string" ? paymentQueue.official_status : null;
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
  const cloudPaymentActive =
    paymentBusy || (paymentQueued && !paymentNeedsOperator && !paymentPaid);
  const cloudPaymentAtOfficialPayment =
    paymentQueueStatus === "vn_payment_pending" ||
    paymentQueueStatus === "vn_payment_processing" ||
    paymentQueuePaymentStatus === "authorized" ||
    /payment[_ -]?authorized|official[_ -]?payment[_ -]?approved/i.test(paymentQueueOfficialStatus ?? "") ||
    /payment|bank_authentication|3ds|otp/i.test(paymentQueueStage ?? "");
  const cloudPaymentWorkerRunning =
    paymentQueueStatus === "vn_live_assisted_processing" ||
    paymentQueueStatus === "vn_live_assisted_pending";
  const cloudPaymentVisualStage: "preparing" | "filling_form" | "payment_handoff" =
    cloudPaymentAtOfficialPayment
      ? "payment_handoff"
      : cloudPaymentWorkerRunning
        ? "filling_form"
        : "preparing";
  const cloudPaymentProgress =
    cloudPaymentVisualStage === "payment_handoff"
      ? 88
      : cloudPaymentVisualStage === "filling_form"
        ? 55
        : 9;
  const cloudPaymentRunId = activePaymentQueueId ?? polledPaymentQueueId ?? jobId ?? null;
  const cloudPaymentPersistenceKey = cloudPaymentRunId
    ? `submission-run:${cloudPaymentRunId}`
    : null;
  const cloudPaymentProgressCycleKey = paymentProgressCycleKey ?? cloudPaymentRunId;
  const cardReady = cardNumber.replace(/\D/g, "").length >= 12 && cardExpiry.trim().length >= 4 && cardCvv.replace(/\D/g, "").length >= 3;
  const showPaymentForm =
    !paymentPaid &&
    !paymentBusy &&
    (!paymentQueued || paymentNeedsOperator);
  const isFormCheckpoint = result.status === "official_form_reached";
  const isManualCheckpoint = Boolean(result.manualAction);
  const manualInstruction = result.manualAction?.instructions ?? "";
  const needsBankConfirmation =
    result.manualAction?.type === "payment_required" &&
    (
      result.portalUrl?.includes("pay.vnpay.vn") ||
      /3ds|otp|bank-app|bank authentication/i.test(manualInstruction)
    );
  const isBankConfirmationRetry = paymentNeedsOperator && needsBankConfirmation;
  const title = paymentPaid
    ? (isZh ? "越南 e-Visa 已提交并完成官方付款" : "Vietnam e-Visa submitted and paid")
    : isPaymentCheckpoint
    ? paymentQueued && !paymentNeedsOperator
      ? (isZh ? "越南自动付款处理中" : "Vietnam automated payment in progress")
      : paymentNeedsOperator
        ? isBankConfirmationRetry
          ? (isZh
              ? "付款失败，请在手机银行里确认。现在可重新提交。"
              : "Payment failed. Confirm it in your banking app. You can resubmit now.")
          : (isZh ? "官方付款未完成，可重新自动付款" : "Official payment incomplete; automated retry is available")
        : (isZh ? "等待官方费用授权" : "Waiting for official-fee authorization")
    : isFormCheckpoint
      ? (isZh ? "已进入越南 e-Visa 官网表单" : "Vietnam e-Visa form reached")
      : isManualCheckpoint
        ? (isZh ? "越南 e-Visa 需要人工操作" : "Vietnam e-Visa action required")
        : (isZh ? "已进入越南官网流程" : "Vietnam official portal reached");
  const badge = isBankConfirmationRetry
    ? null
    : paymentPaid
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
    if (!applicationId || !isPaymentCheckpoint || paymentPaid) return;
    let cancelled = false;
    let timer: number | undefined;
    let controller: AbortController | null = null;

    const schedule = (delayMs: number) => {
      if (cancelled) return;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => void loadPaymentStatus(), delayMs);
    };

    const loadPaymentStatus = async () => {
      if (cancelled) return;
      if (document.visibilityState !== "visible") {
        schedule(15_000);
        return;
      }

      controller = new AbortController();
      const deadline = window.setTimeout(() => controller?.abort(), 5_000);
      try {
        const response = await fetch(`/api/applications/${applicationId}/official-fee/status`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
        if (!response.ok) {
          throw new Error(typeof payload?.error === "string" ? payload.error : `official-fee/status returned ${response.status}`);
        }
        if (!cancelled) {
          setOfficialFeeStatus((current) => mergeOfficialFeeStatus(current, payload));
          setPaymentError(null);
        }
      } catch (error) {
        if (!cancelled && !isIgnorableRuntimeAbortError(error)) {
          setPaymentError(error instanceof Error ? error.message : String(error));
        }
      } finally {
        window.clearTimeout(deadline);
        controller = null;
        schedule(5_000);
      }
    };

    const pollWhenVisible = () => {
      if (document.visibilityState === "visible") schedule(0);
    };

    void loadPaymentStatus();
    document.addEventListener("visibilitychange", pollWhenVisible);
    return () => {
      cancelled = true;
      controller?.abort();
      if (timer) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", pollWhenVisible);
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
    setPaymentProgressCycleKey(`payment:${applicationId}:${Date.now()}`);
    setActivePaymentQueueId(null);
    setPaymentBusy(true);
    setPaymentError(null);
    // Never let a previous successful handoff imply that the card from this
    // new click reached the worker. Only set the last four digits again after
    // POST /pay confirms both the short-lived card session and queue job.
    setOneTimeCardLast4(null);
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
        throw new Error(
          typeof payPayload?.errorCode === "string"
            ? payPayload.errorCode
            : typeof payPayload?.error === "string"
              ? payPayload.error
              : `official-fee/pay returned ${pay.status}`,
        );
      }
      const cardSession = payPayload?.cardSession as Record<string, unknown> | undefined;
      const redactedCard = cardSession?.redactedCard as Record<string, unknown> | undefined;
      setOneTimeCardLast4(typeof redactedCard?.last4 === "string" ? redactedCard.last4 : null);
      setCardNumber("");
      setCardCvv("");
      const queuedStatus =
        typeof payPayload?.queueStatus === "string"
          ? payPayload.queueStatus
          : "vn_cloud_live_pending";
      const newPaymentQueueId =
        typeof payPayload?.queueId === "string" ? payPayload.queueId : null;
      setActivePaymentQueueId(newPaymentQueueId);
      setOfficialFeeStatus((current) => ({
        ...(current ?? {}),
        paymentQueued: true,
        paymentNeedsOperator: false,
        queueId: newPaymentQueueId,
        paymentQueue: {
          id: newPaymentQueueId,
          status: queuedStatus,
          current_stage: "payment_authorized",
          payment_status: "authorized",
        },
      }));
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : String(error));
    } finally {
      setPaymentBusy(false);
    }
  };

  if (cloudPaymentActive) {
    const cloudPaymentMessage =
      cloudPaymentVisualStage === "payment_handoff"
        ? isZh
          ? "Fly 云端已到达官方付款阶段，正在等待支付结果或银行验证。"
          : "The Fly cloud run reached official payment and is waiting for the payment result or bank verification."
        : cloudPaymentVisualStage === "filling_form"
          ? isZh
            ? "Fly 云端正在填写越南 e-Visa 官网表单。"
            : "The Fly cloud run is filling the official Vietnam e-Visa form."
          : isZh
            ? "正在安全发送银行卡并启动 Fly 云端任务。"
            : "Securely sending the card and starting the Fly cloud job.";

    return (
      <WaitingCard
        status="running"
        stage={cloudPaymentVisualStage}
        serverProgress={cloudPaymentProgress}
        message={cloudPaymentMessage}
        applicationId={applicationId}
        persistenceKey={cloudPaymentPersistenceKey}
        progressCycleKey={cloudPaymentProgressCycleKey}
        resetProgressOnMount={Boolean(paymentProgressCycleKey)}
        country="vietnam"
        visaType="evisa_tourism"
      />
    );
  }

  const localizedPaymentError = localizeVietnamPaymentError(paymentError, isZh);
  const localizedActionError = localizeVietnamPaymentError(actionError, isZh);

  return (
    <Card className="rounded-xl border-input">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-foreground">
            <Icon className="h-5 w-5 text-brand-500" />
            {title}
          </CardTitle>
          {badge ? <Badge variant="secondary">{badge}</Badge> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isBankConfirmationRetry && (
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
        )}

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

            {localizedPaymentError && (
              <Alert variant="destructive">
                <AlertIcon variant="destructive" />
                <AlertTitle>{isZh ? "付款未完成" : "Payment did not complete"}</AlertTitle>
                <AlertDescription>
                  <p>{localizedPaymentError}</p>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {result.manualAction && !isPaymentCheckpoint && (
          <Alert variant="warning">
            <AlertIcon variant="warning" />
            <AlertTitle>{isZh ? "需要人工操作" : "Manual action"}</AlertTitle>
            <AlertDescription>
              <p>{result.manualAction.instructions}</p>
              {manualAction?.screenshotUrl && (
                <p className="mt-2 break-all font-mono text-xs">
                  {isZh ? "证据截图：" : "Screenshot: "}
                  {manualAction.screenshotUrl}
                </p>
              )}
              {manualAction && (
                <AlertActions>
                  <AlertAction onClick={completeManualAction} disabled={completing}>
                    {completing && <Loader2 className="animate-spin" />}
                    {isZh ? "我已在官网完成，继续" : "I completed this on the official page, continue"}
                  </AlertAction>
                </AlertActions>
              )}
              {localizedActionError && (
                <p className="mt-2 font-medium !text-[hsl(0_72%_35%)]">{localizedActionError}</p>
              )}
            </AlertDescription>
          </Alert>
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

      </CardContent>
    </Card>
  );
}
