"use client";

import { useCallback } from "react";
import { AlertTriangle, FlaskConical } from "lucide-react";
import type {
  GenericSubmissionResult,
  SubmissionResult,
  SubmissionResultStatus,
} from "@/lib/submission-result";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const unsupported = result.status === "unsupported";
  const Icon = unsupported ? AlertTriangle : FlaskConical;

  return (
    <Card className="rounded-xl border-input">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-3 text-foreground">
            <Icon className="h-5 w-5 text-brand-500" />
            {unsupported ? "Automated submission unavailable" : "Dry-run submission complete"}
          </CardTitle>
          <Badge variant={unsupported ? "secondary" : "default"}>
            {unsupported ? "Unsupported" : "Dry run"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {unsupported
            ? "自动提交暂未支持该国家，我们可以先帮你整理材料和生成申请草稿。"
            : result.message}
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
