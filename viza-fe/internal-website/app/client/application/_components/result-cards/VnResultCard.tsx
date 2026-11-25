"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import {
  Warning as AlertTriangle,
  CheckCircle as CheckCircle2,
  ArrowSquareOut as ExternalLink,
  FileText as FileCheck2,
  CircleNotch as Loader2,
  Envelope as Mail,
} from "@phosphor-icons/react";
import {
  Alert,
  AlertAction,
  AlertActions,
  AlertDescription,
  AlertIcon,
  AlertTitle,
} from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClientErrorAlert } from "@/components/client/client-error-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isChineseLocale } from "@/lib/i18n/locale";
import type { VnSubmissionResult } from "@/lib/submission-result";
import { openOfficialHandoffWindow } from "./official-handoff-client";

type ManualAction = {
  id: string;
  actionType: string;
  status: string;
  instruction: string | null;
  screenshotUrl: string | null;
};

function isOfficialFeeAction(result: VnSubmissionResult): boolean {
  return (
    result.status === "stopped_at_pay" ||
    result.manualAction?.type === "payment_required" ||
    result.checkpoint === "payment_page_visible" ||
    /payment|official[_ -]?fee|bank|3ds|otp/i.test(
      `${result.checkpoint ?? ""} ${result.manualAction?.instructions ?? ""}`,
    )
  );
}

function titleForResult(result: VnSubmissionResult, isZh: boolean, needsAttention: boolean): string {
  if (needsAttention) {
    return isZh ? "需要处理" : "Needs attention";
  }
  if (result.status === "submitted_pending_email") {
    return isZh ? "越南 e-Visa 已提交，等待官方邮件" : "Vietnam e-Visa submitted, awaiting official email";
  }
  if (result.status === "official_form_reached") {
    return isZh ? "已进入越南 e-Visa 官网表单" : "Vietnam e-Visa form reached";
  }
  if (result.status === "needs_manual_verification") {
    return isZh ? "越南 e-Visa 需要核对" : "Vietnam e-Visa needs review";
  }
  return isZh ? "越南 e-Visa 官网流程需要处理" : "Vietnam e-Visa official flow needs attention";
}

function safeInstruction(result: VnSubmissionResult, isZh: boolean, needsAttention: boolean): string {
  if (needsAttention) {
    return isZh
      ? "接下来需要支付官方费用。VIZA 顾问会通过邮件把官方付款链接和下一步发给你。"
      : "The official fee is next. Your VIZA consultant will email you the official payment link and the next step.";
  }
  return (
    result.manualAction?.instructions ??
    (isZh
      ? "官网流程已暂停，系统会在确认后更新申请状态。"
      : "The official flow is paused. VIZA will update the application status after confirmation.")
  );
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
  // The applicant submitted on the official site (0211 handoff) and may still
  // need to pay there; the same official session stays open until it expires.
  const submittedByApplicant = result.submittedBy === "applicant_on_official_portal";
  const awaitingApplicantPayment = submittedByApplicant && result.paymentStatus !== "paid";
  const [handoffState, setHandoffState] = useState<"idle" | "opening" | "closed">("idle");
  const canReturnToPay =
    awaitingApplicantPayment &&
    Boolean(applicationId && result.handoffId) &&
    handoffState !== "closed" &&
    (!result.handoffExpiresAt || Date.parse(result.handoffExpiresAt) > Date.now());
  const [manualAction, setManualAction] = useState<ManualAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const officialFeeAction = isOfficialFeeAction(result);
  const needsAttention = officialFeeAction || result.status === "needs_manual_verification";
  const hasRegistrationCode = Boolean(result.registrationCode);
  const hasManualAction = Boolean(result.manualAction) && !needsAttention;

  useEffect(() => {
    if (!jobId || !hasManualAction) return;
    let cancelled = false;

    const loadManualActions = async () => {
      try {
        const response = await fetch(`/api/submissions/${jobId}/manual-actions`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as {
          manualActions?: ManualAction[];
        } | null;
        if (!response.ok) {
          throw new Error(`Manual actions returned ${response.status}`);
        }
        if (!cancelled) {
          setManualAction(payload?.manualActions?.find((action) => action.status === "pending") ?? null);
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
  }, [hasManualAction, jobId]);

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

  const Icon = needsAttention
    ? AlertTriangle
    : result.status === "submitted_pending_email"
      ? CheckCircle2
      : result.status === "official_form_reached"
        ? FileCheck2
        : AlertTriangle;
  const badge = needsAttention
    ? (isZh ? "需要处理" : "Needs attention")
    : result.status === "submitted_pending_email"
      ? (isZh ? "已提交" : "Submitted")
      : result.status === "official_form_reached"
        ? (isZh ? "官网表单" : "Official form")
        : (isZh ? "官网检查点" : "Official checkpoint");

  return (
    <Card className="rounded-xl border-input">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-3 text-foreground">
            <Icon className="h-5 w-5 text-brand-500" />
            {titleForResult(result, isZh, needsAttention)}
          </CardTitle>
          <Badge variant={needsAttention ? "secondary" : "outline"}>{badge}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {safeInstruction(result, isZh, needsAttention)}
        </p>

        {hasRegistrationCode && (
          <div className="rounded-md border border-input bg-background px-3 py-2">
            <div className="text-xs text-muted-foreground">
              {isZh ? "官网登记编号" : "Official registration code"}
            </div>
            <div className="mt-0.5 font-mono text-base font-medium text-foreground">
              {result.registrationCode}
            </div>
          </div>
        )}

        {awaitingApplicantPayment ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            {isZh
              ? "如果你还没有付款，请在越南官网缴纳官方费用；未付款的申请不会被审批。官网会话关闭后，也可以在越南 e-Visa 官网用上面的登记编号、邮箱和出生日期查询并付款。"
              : "If you haven't paid yet, pay the government fee on the Vietnam official site; unpaid applications are not processed. After this session closes you can still search the application on the official site with the registration code above, your email, and date of birth, and pay there."}
            {canReturnToPay ? (
              <Button
                type="button"
                variant="outline"
                className="mt-3 w-full bg-white"
                disabled={handoffState === "opening"}
                onClick={() => {
                  if (!applicationId) return;
                  setHandoffState("opening");
                  void openOfficialHandoffWindow(applicationId).then((outcome) => {
                    setHandoffState(outcome === "opened" ? "idle" : "closed");
                  });
                }}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                {isZh ? "回到越南官网付款" : "Return to the Vietnam official site to pay"}
              </Button>
            ) : null}
          </div>
        ) : null}

        {hasManualAction && (
          <Alert variant="warning">
            <AlertIcon variant="warning" />
            <AlertTitle>{isZh ? "需要人工操作" : "Manual action"}</AlertTitle>
            <AlertDescription>
              <p>{result.manualAction?.instructions}</p>
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
            </AlertDescription>
          </Alert>
        )}

        {actionError ? <ClientErrorAlert message={actionError} /> : null}

        {result.noticeText && (
          <div className="rounded-md border border-brand-100 bg-brand-50 p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-brand-500">
              <Mail className="h-4 w-4" />
              {isZh ? "下一步" : "What happens next"}
            </div>
            <p className="mt-2 text-sm text-foreground">
              {isZh
                ? "官方确认文件通常会通过邮件送达。"
                : "The official confirmation file is usually delivered by email."}
            </p>
          </div>
        )}

        {!needsAttention && result.portalUrl && (
          <Button asChild variant="ghost" className="w-full">
            <a href={result.portalUrl} target="_blank" rel="noopener noreferrer">
              {isZh ? "打开越南 e-Visa 官网" : "Open Vietnam e-Visa official site"}
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
