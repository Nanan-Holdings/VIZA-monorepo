"use client";

import { useState } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandActionButton } from "@/components/client/brand-action-button";
import type { SubmissionMode } from "@/lib/submission-queue";

interface FailureCardProps {
  applicationId?: string;
  errorMessage?: string;
  retryModes?: Array<{ mode: SubmissionMode; label: string }>;
  onRetry?: (mode: SubmissionMode) => Promise<void> | void;
}

/**
 * FailureCard — renders when applications.submission_result_status === 'failed'.
 * Surfaces the error and offers a retry that requeues the application.
 */
export function FailureCard({ applicationId, errorMessage, retryModes, onRetry }: FailureCardProps) {
  const [retryingMode, setRetryingMode] = useState<SubmissionMode | null>(null);
  const modes = retryModes && retryModes.length > 0
    ? retryModes
    : [{ mode: "dry_run" as const, label: "Retry submission" }];

  const handleRetry = async (mode: SubmissionMode) => {
    if (!onRetry) return;
    setRetryingMode(mode);
    try {
      await onRetry(mode);
    } finally {
      setRetryingMode(null);
    }
  };

  return (
    <Card className="rounded-xl border-destructive/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-foreground">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          We couldn&apos;t complete your submission
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          The portal returned an error while we were filing your application.
          Your answers are saved — you can retry without re-entering anything.
        </p>
        {errorMessage && (
          <pre className="overflow-x-auto rounded-md border border-input bg-muted/50 p-3 text-xs leading-relaxed text-foreground">
            {errorMessage}
          </pre>
        )}
        {applicationId && onRetry && (
          <div className="grid gap-2 sm:grid-cols-2">
            {modes.map((item) => (
              <BrandActionButton
                key={item.mode}
                onClick={() => {
                  void handleRetry(item.mode).catch(() => undefined);
                }}
                loading={retryingMode === item.mode}
                loadingText="Retrying"
              >
                <RotateCw className="mr-2 h-4 w-4" />
                {item.label}
              </BrandActionButton>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
