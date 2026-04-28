"use client";

import { useCallback } from "react";
import type {
  SubmissionResult,
  SubmissionResultStatus,
} from "@/lib/submission-result";
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

  // status is "submitted" | "stopped_at_pay" | "stopped_at_review" |
  // "form_ready_for_agency" → render the per-country card.
  switch (result.country) {
    case "US":
      return <UsResultCard result={result} />;
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
    default:
      return <WaitingCard status={status} />;
  }
}
