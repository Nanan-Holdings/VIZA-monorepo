"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import type { LiveSubmissionSummary } from "@/lib/submission-live-status";

type Copy = {
  title: string;
  description: string;
  actionType: string;
  checkpoint: string;
  openOfficial: string;
  continue: string;
  continuing: string;
  completed: string;
  failed: string;
};

export function LiveManualActionCard({
  liveSubmission,
  copy,
}: {
  liveSubmission: LiveSubmissionSummary;
  copy: Copy;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const action = liveSubmission.pendingManualAction;

  if (!action) return null;

  async function completeAction() {
    setMessage(null);
    setIsSubmitting(true);
    const response = await fetch(
      `/api/submissions/${encodeURIComponent(liveSubmission.jobId)}/manual-actions/${encodeURIComponent(action.id)}/complete`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed: true }),
      },
    );

    if (!response.ok) {
      setMessage(copy.failed);
      setIsSubmitting(false);
      return;
    }

    setMessage(copy.completed);
    setIsSubmitting(false);
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <section id="live-action" className="rounded-[8px] border border-amber-200 bg-amber-50 p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-amber-900">
            <AlertTriangle className="h-5 w-5" />
            <h2 className="font-heading text-[22px] font-medium">{copy.title}</h2>
          </div>
          <p className="mt-2 text-[14px] leading-6 text-amber-900/80">{copy.description}</p>
          <div className="mt-4 grid grid-cols-1 gap-2 text-[13px] text-amber-950 sm:grid-cols-2">
            <p>
              <span className="font-semibold">{copy.actionType}:</span> {action.actionType.replaceAll("_", " ")}
            </p>
            <p>
              <span className="font-semibold">{copy.checkpoint}:</span>{" "}
              {(liveSubmission.liveCheckpoint ?? liveSubmission.currentStage ?? "-").replaceAll("_", " ")}
            </p>
          </div>
          {action.instruction && (
            <p className="mt-3 rounded-[8px] border border-amber-200 bg-white/70 p-3 text-[14px] leading-6 text-amber-950">
              {action.instruction}
            </p>
          )}
          {message && (
            <p className="mt-3 flex items-center gap-2 text-[13px] font-semibold text-amber-950">
              <CheckCircle2 className="h-4 w-4" />
              {message}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          {liveSubmission.officialPortalUrl && (
            <a
              href={liveSubmission.officialPortalUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-amber-300 bg-white px-4 py-2 text-[14px] font-semibold text-amber-900 transition hover:border-amber-500"
            >
              {copy.openOfficial}
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
          <button
            type="button"
            disabled={isSubmitting || isPending}
            onClick={() => void completeAction()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand-500 px-4 py-2 text-[14px] font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting || isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {isSubmitting || isPending ? copy.continuing : copy.continue}
          </button>
        </div>
      </div>
    </section>
  );
}
