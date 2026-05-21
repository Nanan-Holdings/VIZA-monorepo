"use client";

import { useState } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandActionButton } from "@/components/client/brand-action-button";

interface FailureCardProps {
  applicationId?: string;
  errorMessage?: string;
  onRetry?: () => Promise<void> | void;
}

/**
 * FailureCard — renders when applications.submission_result_status === 'failed'.
 * Surfaces the error and offers a retry that requeues the application.
 */
export function FailureCard({ applicationId, errorMessage, onRetry }: FailureCardProps) {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    if (!onRetry) return;
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
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
          <BrandActionButton
            onClick={handleRetry}
            loading={retrying}
            loadingText="Retrying"
          >
            <RotateCw className="mr-2 h-4 w-4" />
            Retry submission
          </BrandActionButton>
        )}
      </CardContent>
    </Card>
  );
}
