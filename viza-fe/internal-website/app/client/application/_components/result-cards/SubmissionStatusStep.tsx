"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { AlertTriangle, FlaskConical, Loader2, ShieldCheck } from "lucide-react";
import type {
  GenericSubmissionResult,
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
  isVietnamEVisaApplication,
  type SubmissionMode,
} from "@/lib/submission-queue";

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
    isVietnamEVisaApplication(country, visaType)
  );
}

function GenericResultCard({
  applicationId,
  applicationCountry,
  applicationVisaType,
  result,
}: {
  applicationId: string | null;
  applicationCountry: string | null;
  applicationVisaType: string | null;
  result: GenericSubmissionResult;
}) {
  const isZh = isChineseLocale(useLocale());
  const [startingLive, setStartingLive] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const unsupported = result.status === "unsupported";
  const actionRequired = result.status === "action_required";
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

  const startLiveAssisted = async () => {
    if (!applicationId || startingLive || !liveTarget) return;

    const confirmed = window.confirm(
      liveTarget === "ds160"
        ? (isZh
            ? "这会创建 live_assisted 队列任务并打开 CEAC 官方 DS-160 流程。地点选择、验证码、官网核对和最终 Sign/Submit 都必须由本人手动处理。确认继续？"
            : "This will create a live_assisted queue job and open the official CEAC DS-160 flow. Location selection, CAPTCHA, official review, and final Sign/Submit remain manual. Continue?")
        : (isZh
            ? "这会创建 live_assisted 队列任务并打开 France-Visas 官方流程。验证码、登录、邮箱验证、官网核对、最终验证、支付和预约都必须由本人手动处理。确认继续？"
            : "This will create a live_assisted queue job and open the official France-Visas flow. CAPTCHA, login, email verification, official review, final validation, payment, and appointment booking remain manual. Continue?"),
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
                      ? "这是旧的 dry-run 结果。可以从这里改为启动 France-Visas 官网辅助填写，真实流程会停在需要人工处理的官网检查点。"
                      : "This is the previous dry-run result. You can start the France-Visas live assisted fill from here; the real flow will stop at manual official-site checkpoints.")}
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

        {unsupported && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {result.message}
          </p>
        )}
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
    if (completedWithResult || actionWithResult || failed) return;

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
          result={result}
        />
      );
    default:
      return <WaitingCard status="running" />;
  }
}
