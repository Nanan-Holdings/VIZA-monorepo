"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { AlertTriangle, ExternalLink, FlaskConical, Loader2, ShieldCheck } from "lucide-react";
import type {
  GenericSubmissionResult,
  SgArrivalCardSubmissionResult,
  SubmissionResult,
  SubmissionResultStatus,
} from "@/lib/submission-result";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isChineseLocale } from "@/lib/i18n/locale";
import {
  WaitingCard,
  type SubmissionVisualStage,
  type SubmissionVisualStatus,
} from "./WaitingCard";
import { FailureCard } from "./FailureCard";
import { UsResultCard } from "./UsResultCard";
import { FrResultCard } from "./FrResultCard";
import { UkResultCard } from "./UkResultCard";
import { VnResultCard } from "./VnResultCard";
import { AuResultCard } from "./AuResultCard";
import { JpResultCard } from "./JpResultCard";
import {
  isDs160VisaType,
  isFranceVisasVisaType,
  isSgArrivalCardApplication,
  isVietnamEVisaApplication,
  type SubmissionMode,
} from "@/lib/submission-queue";
import { GenericEvisaResultCard } from "./GenericEvisaResultCard";

interface SubmissionStatusStepProps {
  applicationId: string | null;
  country: string | null;
  visaType: string | null;
  status: SubmissionResultStatus | null;
  result: SubmissionResult | null;
}

interface SubmissionStatusSnapshot {
  status: SubmissionVisualStatus;
  stage: SubmissionVisualStage;
  progress: number;
  message: string | null;
  result: SubmissionResult | null;
  error: string | null;
  updatedAt: string | null;
  applicationStatus: SubmissionResultStatus | null;
  country: string | null;
  visaType: string | null;
  queue: {
    id: string;
    status: string;
    mode: string | null;
    provider: string | null;
    currentStage?: string | null;
    heartbeatAt?: string | null;
  } | null;
}

type ManualAction = {
  id: string;
  actionType: string;
  status: string;
  instruction: string | null;
  screenshotUrl: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeStatus(status: string | null | undefined): string {
  return (status ?? "").trim().toLowerCase();
}

function visualStatusFromApplication(status: SubmissionResultStatus | null): SubmissionVisualStatus {
  const normalized = normalizeStatus(status);
  if (!normalized || normalized === "waiting") return "queued";
  if (normalized === "processing") return "running";
  if (normalized === "failed") return "failed";
  if (normalized === "stalled") return "stalled";
  if (
    normalized === "needs_user_action" ||
    normalized === "action_required" ||
    normalized === "stopped_at_sign" ||
    normalized === "stopped_at_pay" ||
    normalized === "stopped_at_review" ||
    normalized === "unsupported"
  ) {
    return "needs_user_action";
  }
  return "completed";
}

function fallbackProgressForStatus(status: SubmissionVisualStatus): number {
  switch (status) {
    case "completed":
      return 100;
    case "needs_user_action":
    case "stalled":
      return 99;
    case "running":
      return 67;
    case "queued":
      return 12;
    case "failed":
      return 0;
    default:
      return 0;
  }
}

function extractError(result: SubmissionResult | null, fallback?: string | null): string | undefined {
  if (isRecord(result) && typeof result.error === "string" && result.error.trim()) {
    return result.error.trim();
  }
  return fallback?.trim() || undefined;
}

function isSnapshot(value: unknown): value is SubmissionStatusSnapshot {
  if (!isRecord(value)) return false;
  return (
    typeof value.status === "string" &&
    typeof value.stage === "string" &&
    typeof value.progress === "number"
  );
}

function isFranceCountry(country: string | null | undefined): boolean {
  const normalized = (country ?? "").trim().toLowerCase();
  return normalized === "france" || normalized === "fr" || normalized === "法国";
}

function supportsLiveRetry(country: string | null | undefined, visaType: string | null | undefined): boolean {
  return (
    isDs160VisaType(visaType) ||
    (isFranceCountry(country) && isFranceVisasVisaType(visaType)) ||
    isVietnamEVisaApplication(country, visaType) ||
    isSgArrivalCardApplication(country, visaType)
  );
}

function GenericResultCard({
  applicationId,
  applicationCountry,
  applicationVisaType,
  jobId,
  result,
}: {
  applicationId: string | null;
  applicationCountry: string | null;
  applicationVisaType: string | null;
  jobId: string | null;
  result: GenericSubmissionResult;
}) {
  const isZh = isChineseLocale(useLocale());
  const [startingLive, setStartingLive] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [manualAction, setManualAction] = useState<ManualAction | null>(null);
  const [manualActionError, setManualActionError] = useState<string | null>(null);
  const [completingManualAction, setCompletingManualAction] = useState(false);
  const unsupported = result.status === "unsupported";
  const actionRequired = result.status === "action_required";
  const isDs160Action =
    actionRequired &&
    result.mode === "live_assisted" &&
    isDs160VisaType(applicationVisaType ?? result.visaType);
  const isFranceAction =
    actionRequired &&
    result.mode === "live_assisted" &&
    isFranceCountry(applicationCountry ?? result.targetCountry) &&
    isFranceVisasVisaType(applicationVisaType ?? result.visaType);
  const officialManualAction = isDs160Action || isFranceAction;
  const ds160LiveEnabled =
    process.env.NEXT_PUBLIC_DS160_LIVE_ASSISTED_ENABLED === "true" &&
    process.env.NEXT_PUBLIC_DS160_SUBMISSION_MODE === "live_assisted";
  const franceLiveEnabled =
    process.env.NEXT_PUBLIC_FRANCE_LIVE_SUBMISSION_ENABLED === "true" &&
    process.env.NEXT_PUBLIC_FRANCE_SUBMISSION_MODE === "live_assisted";
  const canStartDs160Live =
    Boolean(applicationId) &&
    result.status === "submitted_mock" &&
    result.mode === "dry_run" &&
    ds160LiveEnabled &&
    isDs160VisaType(applicationVisaType ?? result.visaType);
  const canStartFranceLive =
    Boolean(applicationId) &&
    result.status === "submitted_mock" &&
    result.mode === "dry_run" &&
    franceLiveEnabled &&
    isFranceCountry(applicationCountry) &&
    isFranceVisasVisaType(applicationVisaType ?? result.visaType);
  const liveTarget = canStartDs160Live ? "ds160" : canStartFranceLive ? "france" : null;
  const Icon = unsupported || actionRequired ? AlertTriangle : FlaskConical;
  const title = actionRequired
    ? (isZh ? "需要人工操作" : "Manual action required")
    : unsupported
      ? (isZh ? "暂不支持自动提交" : "Automated submission unavailable")
      : (isZh ? "Dry-run 已完成" : "Dry-run submission complete");
  const badge = actionRequired
    ? (isZh ? "需操作" : "Action required")
    : unsupported
      ? (isZh ? "暂不支持" : "Unsupported")
      : "Dry run";
  const body = unsupported
    ? (isZh
        ? "自动提交暂未支持该国家，我们可以先帮你整理材料和生成申请草稿。"
        : "Automated submission is not available for this country yet. We can still organize documents and prepare the draft.")
    : actionRequired
      ? (result.actionInstructions ?? result.message)
      : result.message;

  useEffect(() => {
    if (!jobId || !officialManualAction) return;
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
          setManualActionError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setManualActionError(error instanceof Error ? error.message : String(error));
        }
      }
    };

    void loadManualActions();
    return () => {
      cancelled = true;
    };
  }, [jobId, officialManualAction]);

  const startLiveAssisted = async () => {
    if (!applicationId || startingLive || !liveTarget) return;

    const confirmed = window.confirm(
      liveTarget === "ds160"
        ? (isZh
            ? "这会创建 live_assisted 队列任务并打开 CEAC 官方 DS-160 流程。地点选择、验证码、官网核对和最终 Sign/Submit 都必须由本人手动处理。确认继续？"
            : "This will create a live_assisted queue job and open the official CEAC DS-160 flow. Location selection, CAPTCHA, official review, and final Sign/Submit remain manual. Continue?")
        : (isZh
            ? "这会创建 live_assisted 队列任务，并可用 VIZA 邮箱 alias 注册 France-Visas 账号；注册页图片验证码会经你授权使用 2captcha 处理。登录风控、官网核对、最终验证、支付和预约仍需人工处理。确认继续？"
            : "This will create a live_assisted queue job and may register a France-Visas account with a VIZA email alias; the registration image CAPTCHA may be solved with 2captcha with your authorization. Login risk checks, official review, final validation, payment, and appointment booking remain manual. Continue?"),
    );
    if (!confirmed) return;

    setStartingLive(true);
    setLiveError(null);
    try {
      const response = await fetch(`/api/applications/${applicationId}/retry-submission`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "live_assisted",
          country: applicationCountry,
          visaType: applicationVisaType ?? result.visaType,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || `retry-submission returned ${response.status}`);
      }
      window.location.reload();
    } catch (error) {
      setLiveError(error instanceof Error ? error.message : String(error));
    } finally {
      setStartingLive(false);
    }
  };

  const completeManualAction = async () => {
    if (!jobId || !manualAction || completingManualAction) return;
    setCompletingManualAction(true);
    setManualActionError(null);
    try {
      const response = await fetch(
        `/api/submissions/${jobId}/manual-actions/${manualAction.id}/complete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmed: true }),
        },
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
      setManualActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setCompletingManualAction(false);
    }
  };

  return (
    <Card className="rounded-xl border-input">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-3 text-foreground">
            <Icon className="h-5 w-5 text-brand-500" />
            {title}
          </CardTitle>
          <Badge variant={unsupported || actionRequired ? "secondary" : "default"}>
            {badge}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {body}
        </p>

        <div className="rounded-md border border-input bg-background px-3 py-2">
          <div className="text-xs text-muted-foreground">Country / visa type</div>
          <div className="mt-0.5 font-mono text-sm text-foreground">
            {result.targetCountry} / {result.visaType}
          </div>
        </div>

        {result.mode === "dry_run" && result.confirmationNumber && (
          <div className="rounded-md border border-brand-100 bg-brand-50 px-3 py-2">
            <div className="text-xs text-brand-500">Mock confirmation</div>
            <div className="mt-0.5 font-mono text-sm font-medium text-foreground">
              {result.confirmationNumber}
            </div>
          </div>
        )}

        {liveTarget && (
          <div className="rounded-md border border-brand-100 bg-brand-50 p-3">
            <div className="flex items-start gap-2 text-sm leading-relaxed text-brand-900">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
              <span>
                {liveTarget === "ds160"
                  ? (isZh
                      ? "这是旧的 dry-run 结果。可以从这里启动 CEAC 官网辅助填写，真实流程会停在地点选择、验证码、官网核对或最终 Sign/Submit 等人工检查点。"
                      : "This is the previous dry-run result. You can start the CEAC live assisted fill from here; the real flow will stop at location, CAPTCHA, official review, or final Sign/Submit checkpoints.")
                  : (isZh
                      ? "这是旧的 dry-run 结果。可以从这里启动 France-Visas 官网辅助填写；如需新账号，VIZA 会用专属邮箱 alias 注册并用 2captcha 处理注册页图片验证码。"
                      : "This is the previous dry-run result. You can start the France-Visas live assisted fill from here; if a new account is needed, VIZA will use a dedicated email alias and 2captcha for the registration image CAPTCHA.")}
              </span>
            </div>
            <Button
              type="button"
              className="mt-3 w-full"
              onClick={startLiveAssisted}
              disabled={startingLive}
            >
              {startingLive ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="mr-2 h-4 w-4" />
              )}
              {startingLive
                ? (isZh ? "正在启动" : "Starting")
                : liveTarget === "ds160"
                  ? (isZh ? "启动真实官网辅助填写" : "Start live assisted CEAC run")
                  : (isZh ? "启动 France-Visas 官网辅助填写" : "Start France-Visas live assisted fill")}
            </Button>
          </div>
        )}

        {liveError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {liveError}
          </div>
        )}

        {actionRequired && result.actionType && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
            <div className="text-xs text-amber-700">{isZh ? "检查点" : "Checkpoint"}</div>
            <div className="mt-0.5 font-mono text-sm font-medium text-foreground">
              {result.actionType}
            </div>
          </div>
        )}

        {officialManualAction && (
          <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <div>
                <div className="text-sm font-medium text-amber-900">
                  {isFranceAction
                    ? (isZh ? "需要你完成 France-Visas 官网操作" : "France-Visas official action required")
                    : (isZh ? "需要你完成 CEAC 官网验证" : "CEAC official verification required")}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-amber-900">
                  {manualAction?.instruction ??
                    result.actionInstructions ??
                    (isFranceAction
                      ? (isZh
                          ? "请在 France-Visas 官方页面完成登录、验证码或邮箱验证，然后回到这里继续。"
                          : "Complete login, CAPTCHA, or email verification on the official France-Visas page, then return here to continue.")
                      : (isZh
                          ? "请在打开的 CEAC 官方页面完成地点选择或 CAPTCHA，然后回到这里继续。"
                          : "Complete the location or CAPTCHA checkpoint on the official CEAC page, then return here to continue."))}
                </p>
              </div>
            </div>

            {manualAction?.screenshotUrl && (
              <div className="rounded-md border border-amber-200 bg-white px-3 py-2">
                <div className="text-xs text-amber-700">{isZh ? "安全截图" : "Safe screenshot"}</div>
                <div className="mt-0.5 break-all font-mono text-xs text-foreground">
                  {manualAction.screenshotUrl}
                </div>
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              <Button asChild variant="outline" className="bg-white">
                <a
                  href={
                    isFranceAction
                      ? "https://application-form.france-visas.gouv.fr/fv-fo-dde/"
                      : "https://ceac.state.gov/genniv/"
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {isFranceAction
                    ? (isZh ? "打开 France-Visas 官网" : "Open France-Visas")
                    : (isZh ? "打开 CEAC 官网" : "Open CEAC")}
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button
                type="button"
                onClick={completeManualAction}
                disabled={!manualAction || completingManualAction}
              >
                {completingManualAction ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="mr-2 h-4 w-4" />
                )}
                {isZh ? "我已完成，继续" : "I completed it, continue"}
              </Button>
            </div>

            {!jobId && (
              <p className="text-xs text-amber-800">
                {isZh
                  ? "正在同步当前 live job，请稍后刷新状态。"
                  : "The current live job is still syncing. Refresh this status shortly."}
              </p>
            )}
            {manualActionError && (
              <p className="text-sm text-red-700">{manualActionError}</p>
            )}
          </div>
        )}

        {unsupported && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {result.message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SgArrivalCardResultCard({ result }: { result: SgArrivalCardSubmissionResult }) {
  const isZh = isChineseLocale(useLocale());
  const successful = result.submitted && result.status === "submitted";
  const artifactLines = [
    ...(result.artifacts?.screenshots ?? []),
    ...(result.artifacts?.logs ?? []),
    ...(result.artifacts?.traces ?? []),
  ];

  return (
    <Card className="rounded-xl border-input">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-3 text-foreground">
            {successful ? (
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            )}
            {successful
              ? (isZh ? "SG Arrival Card 已提交" : "SG Arrival Card submitted")
              : (isZh ? "SG Arrival Card 未完成提交" : "SG Arrival Card submission not completed")}
          </CardTitle>
          <Badge variant={successful ? "default" : "secondary"}>
            {result.submitted ? (isZh ? "已提交" : "Submitted") : "submitted=false"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {result.portalResponseSummary}
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-input bg-background px-3 py-2">
            <div className="text-xs text-muted-foreground">{isZh ? "状态" : "Status"}</div>
            <div className="mt-0.5 font-mono text-sm text-foreground">{result.status}</div>
          </div>
          <div className="rounded-md border border-input bg-background px-3 py-2">
            <div className="text-xs text-muted-foreground">{isZh ? "确认/参考号" : "Confirmation / reference"}</div>
            <div className="mt-0.5 font-mono text-sm text-foreground">
              {result.confirmationNumber ?? result.referenceNumber ?? (isZh ? "暂无" : "None")}
            </div>
          </div>
        </div>

        {result.payloadSummary && (
          <div className="rounded-md border border-input bg-background px-3 py-2">
            <div className="text-xs text-muted-foreground">{isZh ? "提交 payload 摘要" : "Submission payload summary"}</div>
            <div className="mt-1 grid gap-1 font-mono text-xs text-foreground">
              <span>purpose_of_travel={result.payloadSummary.purposeOfTravel ?? "(missing)"}</span>
              <span>arrival_date={result.payloadSummary.arrivalDate ?? "(missing)"}</span>
              <span>mode_of_travel={result.payloadSummary.modeOfTravel ?? "(missing)"}</span>
              <span>transport_number={result.payloadSummary.transportNumber ?? "(missing)"}</span>
            </div>
          </div>
        )}

        {result.errorDetails && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <div className="font-medium">{result.errorDetails.code}</div>
            <p className="mt-1 leading-relaxed">{result.errorDetails.message}</p>
            {result.errorDetails.missingFields?.length ? (
              <p className="mt-1 font-mono text-xs">
                {result.errorDetails.missingFields.join(", ")}
              </p>
            ) : null}
          </div>
        )}

        {artifactLines.length > 0 && (
          <div className="rounded-md border border-input bg-background px-3 py-2">
            <div className="text-xs text-muted-foreground">{isZh ? "Artifacts" : "Artifacts"}</div>
            <div className="mt-1 space-y-1">
              {artifactLines.map((line) => (
                <div key={line} className="break-all font-mono text-xs text-foreground">
                  {line}
                </div>
              ))}
            </div>
          </div>
        )}

        <Button asChild variant="outline" className="w-full">
          <a href={result.portalUrl} target="_blank" rel="noopener noreferrer">
            {isZh ? "打开 ICA SGAC 官方入口" : "Open ICA SGAC official portal"}
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * Drives the final wizard step from the same-origin submission-status API,
 * with the parent application's realtime props as a terminal-state fallback.
 * Completed results wait until the visual progress reaches 100; failed and
 * needs_user_action states stop immediately.
 */
export function SubmissionStatusStep({
  applicationId,
  country,
  visaType,
  status,
  result,
}: SubmissionStatusStepProps) {
  const [snapshot, setSnapshot] = useState<SubmissionStatusSnapshot | null>(null);
  const [showCompletedResult, setShowCompletedResult] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  const handleRetry = useCallback(async (mode: SubmissionMode) => {
    if (!applicationId) return;
    setRetryError(null);
    const response = await fetch(`/api/applications/${applicationId}/retry-submission`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode,
        country: snapshot?.country ?? country,
        visaType: snapshot?.visaType ?? visaType,
      }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
      const message = typeof body?.error === "string" ? body.error : `Retry failed with ${response.status}`;
      setRetryError(message);
      throw new Error(message);
    }
    setSnapshot(null);
    setShowCompletedResult(false);
  }, [applicationId, country, snapshot?.country, snapshot?.visaType, visaType]);

  const fallbackVisualStatus = useMemo(
    () => visualStatusFromApplication(status),
    [status],
  );
  const terminalPropsAvailable =
    Boolean(result) && fallbackVisualStatus !== "queued" && fallbackVisualStatus !== "running";
  const effectiveStatus = terminalPropsAvailable
    ? fallbackVisualStatus
    : snapshot?.status ?? fallbackVisualStatus;
  const effectiveStage =
    snapshot?.stage ??
    (effectiveStatus === "queued"
      ? "preparing"
      : effectiveStatus === "running"
        ? "filling_form"
        : effectiveStatus === "failed"
          ? "failed"
          : effectiveStatus === "completed"
            ? "completed"
            : "confirming_result");
  const effectiveProgress =
    snapshot?.progress ?? fallbackProgressForStatus(effectiveStatus);
  const effectiveResult = terminalPropsAvailable ? result : snapshot?.result ?? result;
  const effectiveError = extractError(effectiveResult, snapshot?.error);
  const effectiveApplicationStatus = terminalPropsAvailable
    ? status
    : snapshot?.applicationStatus ?? status;
  const completedWithResult = effectiveStatus === "completed" && Boolean(effectiveResult);
  const actionWithResult = effectiveStatus === "needs_user_action" && Boolean(effectiveResult);
  const failed = effectiveStatus === "failed" || effectiveApplicationStatus === "failed";
  const stalled = effectiveStatus === "stalled" || effectiveApplicationStatus === "stalled";
  const retryModes = supportsLiveRetry(snapshot?.country ?? country, snapshot?.visaType ?? visaType)
    ? [
        { mode: "dry_run" as const, label: "Dry-run test" },
        { mode: "live_assisted" as const, label: "Live assisted" },
      ]
    : [{ mode: "dry_run" as const, label: "Retry dry-run" }];

  useEffect(() => {
    setSnapshot(null);
    setShowCompletedResult(false);
    setRetryError(null);
  }, [applicationId]);

  useEffect(() => {
    if (effectiveStatus !== "completed") {
      setShowCompletedResult(false);
    }
  }, [effectiveStatus]);

  useEffect(() => {
    if (!applicationId) return;
    if (completedWithResult || failed) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const response = await fetch(`/api/applications/${applicationId}/submission-status`, {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`submission-status returned ${response.status}`);
        }
        const body: unknown = await response.json();
        if (!isSnapshot(body)) return;
        if (!cancelled) {
          setSnapshot({
            status: body.status,
            stage: body.stage,
            progress: body.progress,
            message: typeof body.message === "string" ? body.message : null,
            result: (body.result as SubmissionResult | null) ?? null,
            error: typeof body.error === "string" ? body.error : null,
            updatedAt: typeof body.updatedAt === "string" ? body.updatedAt : null,
            applicationStatus:
              typeof body.applicationStatus === "string"
                ? (body.applicationStatus as SubmissionResultStatus)
                : null,
            country: typeof body.country === "string" ? body.country : null,
            visaType: typeof body.visaType === "string" ? body.visaType : null,
            queue: isRecord(body.queue)
              ? {
                  id: typeof body.queue.id === "string" ? body.queue.id : "",
                  status: typeof body.queue.status === "string" ? body.queue.status : "",
                  mode: typeof body.queue.mode === "string" ? body.queue.mode : null,
                  provider: typeof body.queue.provider === "string" ? body.queue.provider : null,
                  currentStage:
                    typeof body.queue.currentStage === "string" ? body.queue.currentStage : null,
                  heartbeatAt:
                    typeof body.queue.heartbeatAt === "string" ? body.queue.heartbeatAt : null,
                }
              : null,
          });
        }
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setSnapshot((current) => ({
          status: "stalled",
          stage: "confirming_result",
          progress: Math.max(current?.progress ?? 0, 99),
          message: "Still confirming the submission result.",
          result: current?.result ?? result,
          error: message,
          updatedAt: current?.updatedAt ?? null,
          applicationStatus: current?.applicationStatus ?? status,
          country: current?.country ?? country,
          visaType: current?.visaType ?? visaType,
          queue: current?.queue ?? null,
        }));
      }
    };

    void poll();
    const timer = window.setInterval(poll, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [
    actionWithResult,
    applicationId,
    completedWithResult,
    failed,
    country,
    visaType,
    result,
    status,
  ]);

  if (failed) {
    return (
      <FailureCard
        applicationId={applicationId ?? undefined}
        errorMessage={retryError ?? effectiveError}
        retryModes={retryModes}
        onRetry={handleRetry}
      />
    );
  }

  if (stalled) {
    return (
      <FailureCard
        applicationId={applicationId ?? undefined}
        errorMessage={
          retryError ??
          effectiveError ??
          "Submission job stalled because the worker did not pick it up in time."
        }
        retryModes={retryModes}
        onRetry={handleRetry}
      />
    );
  }

  if (actionWithResult || (completedWithResult && showCompletedResult)) {
    return renderSubmissionResultCard(
      applicationId,
      country,
      visaType,
      effectiveResult,
      snapshot?.queue?.id ?? null,
    );
  }

  return (
    <WaitingCard
      status={effectiveStatus}
      stage={effectiveStage}
      serverProgress={effectiveProgress}
      message={snapshot?.message}
      error={effectiveError}
      applicationId={applicationId}
      country={country}
      visaType={visaType}
      onVisualComplete={() => setShowCompletedResult(true)}
    />
  );
}

function renderSubmissionResultCard(
  applicationId: string | null,
  country: string | null,
  visaType: string | null,
  result: SubmissionResult | null,
  jobId: string | null = null,
) {
  if (!result) return <WaitingCard status="running" />;

  switch (result.country) {
    case "US":
      return <UsResultCard applicationId={applicationId ?? undefined} result={result} />;
    case "FR":
      return applicationId ? (
        <FrResultCard applicationId={applicationId} result={result} />
      ) : null;
    case "UK":
      return applicationId ? (
        <UkResultCard applicationId={applicationId} result={result} />
      ) : null;
    case "VN":
      return <VnResultCard result={result} jobId={jobId} />;
    case "SG":
      return <SgArrivalCardResultCard result={result} />;
    case "AU":
      return applicationId ? (
        <AuResultCard applicationId={applicationId} result={result} />
      ) : null;
    case "JP":
      return applicationId ? (
        <JpResultCard applicationId={applicationId} result={result} />
      ) : null;
    case "GENERIC":
      return (
        <GenericResultCard
          applicationId={applicationId}
          applicationCountry={country}
          applicationVisaType={visaType}
          jobId={jobId}
          result={result}
        />
      );
    // POR-006: standard e-Visa launch countries share one generic card.
    case "ID":
    case "EG":
    case "SA":
    case "MY":
    case "TH":
    case "AE":
    case "CA":
    case "TR":
    case "IT":
    case "IN":
      return <GenericEvisaResultCard applicationId={applicationId} result={result} />;
    default:
      return <WaitingCard status="running" />;
  }
}
