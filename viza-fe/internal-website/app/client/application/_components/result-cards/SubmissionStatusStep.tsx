"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { AlertTriangle, FlaskConical } from "lucide-react";
import type {
  GenericSubmissionResult,
  SubmissionResult,
  SubmissionResultStatus,
} from "@/lib/submission-result";
import { Badge } from "@/components/ui/badge";
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
import type { SubmissionMode } from "@/lib/submission-queue";

interface SubmissionStatusStepProps {
  applicationId: string | null;
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

function GenericResultCard({ result }: { result: GenericSubmissionResult }) {
  const isZh = isChineseLocale(useLocale());
  const unsupported = result.status === "unsupported";
  const actionRequired = result.status === "action_required";
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

        {result.confirmationNumber && (
          <div className="rounded-md border border-brand-100 bg-brand-50 px-3 py-2">
            <div className="text-xs text-brand-500">Mock confirmation</div>
            <div className="mt-0.5 font-mono text-sm font-medium text-foreground">
              {result.confirmationNumber}
            </div>
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
  status,
  result,
}: SubmissionStatusStepProps) {
  const [snapshot, setSnapshot] = useState<SubmissionStatusSnapshot | null>(null);
  const [showCompletedResult, setShowCompletedResult] = useState(false);

  const handleRetry = useCallback(async () => {
    if (!applicationId) return;
    const retrySource = snapshot?.result ?? result;
    const retryMode: SubmissionMode =
      retrySource && "mode" in retrySource && retrySource.mode === "live_assisted"
        ? "live_assisted"
        : "dry_run";
    await fetch(`/api/applications/${applicationId}/retry-submission`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: retryMode }),
    });
    setSnapshot(null);
    setShowCompletedResult(false);
  }, [applicationId, result, snapshot?.result]);

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

  useEffect(() => {
    setSnapshot(null);
    setShowCompletedResult(false);
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
    result,
    status,
  ]);

  if (failed) {
    return (
      <FailureCard
        applicationId={applicationId ?? undefined}
        errorMessage={effectiveError}
        onRetry={handleRetry}
      />
    );
  }

  if (actionWithResult || (completedWithResult && showCompletedResult)) {
    return renderSubmissionResultCard(applicationId, effectiveResult);
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
  result: SubmissionResult | null,
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
      return <VnResultCard result={result} />;
    case "AU":
      return applicationId ? (
        <AuResultCard applicationId={applicationId} result={result} />
      ) : null;
    case "JP":
      return applicationId ? (
        <JpResultCard applicationId={applicationId} result={result} />
      ) : null;
    case "GENERIC":
      return <GenericResultCard result={result} />;
    default:
      return <WaitingCard status="running" />;
  }
}
