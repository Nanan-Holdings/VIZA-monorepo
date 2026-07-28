"use client";

import { useEffect, useState } from "react";
import { ExternalLink, FileCheck2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AuSubmissionResult } from "@/lib/submission-result";

interface AuResultCardProps {
  applicationId: string;
  result: AuSubmissionResult;
}

/**
 * AU Subclass 600 result card. Renders the handoff state where the form
 * has been pre-filled all the way to the Review page, and the applicant
 * must log in to ImmiAccount and click Submit themselves — Subclass 600
 * lodgement legally requires the applicant's own action, so VIZA
 * intentionally stops short of the final submission click.
 */
export function AuResultCard({ applicationId, result }: AuResultCardProps) {
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [screenshotLoading, setScreenshotLoading] = useState(false);

  useEffect(() => {
    if (!result.reviewScreenshotStoragePath) return;
    let cancelled = false;
    setScreenshotLoading(true);
    fetch(
      `/api/applications/${applicationId}/artifact-url?path=${encodeURIComponent(result.reviewScreenshotStoragePath)}`,
    )
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("artifact url fetch failed"))))
      .then((body: { url?: string }) => {
        if (!cancelled && body.url) setScreenshotUrl(body.url);
      })
      .catch(() => {
        if (!cancelled) setScreenshotUrl(null);
      })
      .finally(() => {
        if (!cancelled) setScreenshotLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId, result.reviewScreenshotStoragePath]);

  return (
    <Card className="rounded-xl border-input">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-foreground">
            <FileCheck2 className="h-5 w-5 text-brand-500" />
            Australia Subclass 600 — ready for your submission
          </CardTitle>
          <Badge variant="secondary">Awaiting your submit</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-relaxed text-amber-900">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Australian law requires you, the applicant, to be the one who
              submits a Subclass 600 application. We&apos;ve filled every page
              for you up to the Review screen — please log in to ImmiAccount,
              check the answers, and click <span className="font-medium">Submit application</span>{" "}
              yourself.
            </p>
          </div>
        </div>

        <div className="rounded-md border border-input bg-background px-3 py-2">
          <div className="text-xs text-muted-foreground">Transaction Reference Number (TRN)</div>
          <div className="mt-0.5 font-mono text-sm text-foreground">
            {result.trn || "Pending — visible inside ImmiAccount"}
          </div>
        </div>

        <div className="rounded-md border border-input bg-background px-3 py-2">
          <div className="text-xs text-muted-foreground">ImmiAccount username</div>
          <div className="mt-0.5 break-all font-mono text-sm text-foreground">
            {result.portalUsername}
          </div>
        </div>

        {result.reviewScreenshotStoragePath && (
          <div className="rounded-md border border-input bg-background p-2">
            <div className="px-1 pb-2 text-xs text-muted-foreground">Review-page snapshot</div>
            {screenshotLoading && (
              <div className="h-40 animate-pulse rounded bg-muted" aria-hidden />
            )}
            {!screenshotLoading && screenshotUrl && (
              // Plain <img> — Next/Image needs domains config that the
              // signed URL host doesn't always satisfy.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={screenshotUrl}
                alt="ImmiAccount Review page snapshot"
                className="max-h-[480px] w-full rounded object-contain"
              />
            )}
            {!screenshotLoading && !screenshotUrl && (
              <p className="px-1 py-2 text-xs text-muted-foreground">
                Snapshot unavailable. You can still review everything inside ImmiAccount.
              </p>
            )}
          </div>
        )}

        <Button asChild className="w-full">
          <a href={result.portalUrl} target="_blank" rel="noopener noreferrer">
            Open ImmiAccount to submit
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
