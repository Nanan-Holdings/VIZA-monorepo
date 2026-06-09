"use client";

import { useState } from "react";
import { AlertTriangle, CalendarCheck, FileDown, Loader2, MapPin, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { FrSubmissionResult } from "@/lib/submission-result";

interface FrResultCardProps {
  applicationId: string;
  result: FrSubmissionResult;
}

export function FrResultCard({ applicationId, result }: FrResultCardProps) {
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const liveAssisted = result.mode === "live_assisted" || result.status === "final_review_required";
  const badgeLabel = liveAssisted
    ? "Manual review required"
    : result.status === "appointment_held"
      ? "Appointment held"
      : "Dry-run prepared";

  const formatStatus = (value?: string) => {
    if (!value) return null;
    return value.replace(/_/g, " ");
  };

  const handlePdfDownload = async () => {
    if (!result.printablePdfStoragePath) return;
    setDownloadingPdf(true);
    try {
      const res = await fetch(
        `/api/applications/${applicationId}/artifact-url?path=${encodeURIComponent(result.printablePdfStoragePath)}`,
      );
      if (!res.ok) throw new Error("Failed to mint signed URL");
      const { url } = (await res.json()) as { url: string };
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <Card className="rounded-xl border-input">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-foreground">
            <ShieldCheck className="h-5 w-5 text-brand-500" />
            {liveAssisted ? "France-Visas live assisted checkpoint" : "France-Visas application prepared"}
          </CardTitle>
          <Badge variant={liveAssisted ? "secondary" : result.status === "appointment_held" ? "default" : "secondary"}>
            {badgeLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-input bg-background px-3 py-2">
          <div className="text-xs text-muted-foreground">
            {liveAssisted ? "Official reference (redacted)" : "Application reference"}
          </div>
          <div className="mt-0.5 font-mono text-sm text-foreground">{result.applicationReference}</div>
        </div>

        {liveAssisted && result.manualAction && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-amber-700">
              <AlertTriangle className="h-4 w-4" />
              Manual checkpoint: {formatStatus(result.manualAction.type)}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-amber-900">
              {result.manualAction.instructions}
            </p>
          </div>
        )}

        {(result.reviewDiffStatus || result.officialStatus || result.paymentStatus || result.appointmentStatus) && (
          <div className="grid gap-2 sm:grid-cols-2">
            {result.reviewDiffStatus && (
              <div className="rounded-md border border-input bg-background px-3 py-2">
                <div className="text-xs text-muted-foreground">Review diff</div>
                <div className="mt-0.5 text-sm font-medium text-foreground">
                  {formatStatus(result.reviewDiffStatus)}
                </div>
              </div>
            )}
            {result.officialStatus && (
              <div className="rounded-md border border-input bg-background px-3 py-2">
                <div className="text-xs text-muted-foreground">Official status</div>
                <div className="mt-0.5 text-sm font-medium text-foreground">
                  {formatStatus(result.officialStatus)}
                </div>
              </div>
            )}
            {result.paymentStatus && (
              <div className="rounded-md border border-input bg-background px-3 py-2">
                <div className="text-xs text-muted-foreground">Payment</div>
                <div className="mt-0.5 text-sm font-medium text-foreground">
                  {formatStatus(result.paymentStatus)}
                </div>
              </div>
            )}
            {result.appointmentStatus && (
              <div className="rounded-md border border-input bg-background px-3 py-2">
                <div className="text-xs text-muted-foreground">Appointment</div>
                <div className="mt-0.5 text-sm font-medium text-foreground">
                  {formatStatus(result.appointmentStatus)}
                </div>
              </div>
            )}
          </div>
        )}

        {result.appointment && (
          <div className="rounded-md border border-brand-100 bg-brand-50 p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-brand-500">
              <CalendarCheck className="h-4 w-4" />
              Appointment slot
            </div>
            <div className="mt-2 text-sm font-medium text-foreground">
              {new Date(result.appointment.atIso).toLocaleString()}
            </div>
            <div className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
              <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
              <span>
                {result.appointment.centerName}
                <br />
                {result.appointment.address}
              </span>
            </div>
          </div>
        )}

        {result.printablePdfStoragePath && (
          <Button onClick={handlePdfDownload} disabled={downloadingPdf} className="w-full">
            {downloadingPdf ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="mr-2 h-4 w-4" />
            )}
            Download printable summary (PDF)
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
