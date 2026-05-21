"use client";

import { useState } from "react";
import { CalendarCheck, FileDown, Loader2, MapPin, ShieldCheck } from "lucide-react";
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
            France-Visas application filed
          </CardTitle>
          <Badge variant={result.status === "appointment_held" ? "default" : "secondary"}>
            {result.status === "appointment_held" ? "Appointment held" : "Awaiting payment"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-input bg-background px-3 py-2">
          <div className="text-xs text-muted-foreground">Application reference</div>
          <div className="mt-0.5 font-mono text-sm text-foreground">{result.applicationReference}</div>
        </div>

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
