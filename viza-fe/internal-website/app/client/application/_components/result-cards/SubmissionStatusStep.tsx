"use client";

import { useCallback } from "react";
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
import { WaitingCard } from "./WaitingCard";
import { FailureCard } from "./FailureCard";
import { UsResultCard } from "./UsResultCard";
import { FrResultCard } from "./FrResultCard";
import { UkResultCard } from "./UkResultCard";
import { VnResultCard } from "./VnResultCard";
import { AuResultCard } from "./AuResultCard";
import { JpResultCard } from "./JpResultCard";

interface SubmissionStatusStepProps {
  applicationId: string | null;
  status: SubmissionResultStatus | null;
  result: SubmissionResult | null;
}

function GenericResultCard({ result }: { result: GenericSubmissionResult }) {
  const isZh = isChineseLocale(useLocale());
  const unsupported = result.status === "unsupported";
  const actionRequired = result.status === "action_required";
  const Icon = unsupported ? AlertTriangle : FlaskConical;
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
 * Drives the final wizard step based on `applications.submission_result_status`
 * and `applications.submission_result`. The realtime subscription on
 * `applications` (page.tsx loadData) refreshes both whenever the runner
 * writes them, so this component re-renders without polling.
 */
export function SubmissionStatusStep({
  applicationId,
  status,
  result,
}: SubmissionStatusStepProps) {
  const handleRetry = useCallback(async () => {
    if (!applicationId) return;
    await fetch(`/api/applications/${applicationId}/retry-submission`, {
      method: "POST",
    });
  }, [applicationId]);

  if (status === "failed") {
    const errBag = result as unknown as Record<string, unknown> | null;
    const errMessage =
      errBag && typeof errBag.error === "string" ? errBag.error : undefined;
    return (
      <FailureCard
        applicationId={applicationId ?? undefined}
        errorMessage={errMessage}
        onRetry={handleRetry}
      />
    );
  }

  if (!result || status === "waiting" || status === "processing" || status === null) {
    return <WaitingCard status={status} />;
  }

  // Terminal status renders the per-country card or a generic dry-run card.
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
      return <WaitingCard status={status} />;
  }
}
