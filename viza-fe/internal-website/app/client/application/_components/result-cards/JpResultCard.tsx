"use client";

import { Download, FileCheck2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { JpSubmissionResult } from "@/lib/submission-result";

interface JpResultCardProps {
  applicationId: string;
  result: JpSubmissionResult;
}

/**
 * JP_TOURIST result card — terminal state for the paper-form-via-agency
 * journey. The applicant has finished the wizard; VIZA renders MOFA Form A
 * (Application for Visa) as a PDF on demand. The applicant downloads,
 * prints, and hands the form (with supporting documents) to a designated
 * travel agency in mainland China — the agency delivers it to the Japanese
 * Embassy / Consulate-General. evisa.mofa.go.jp self-service is not open
 * to PRC residents, so there is no portal to drive.
 */
export function JpResultCard({ applicationId, result }: JpResultCardProps) {
  const downloadUrl = result.formAPdfUrl || `/api/applications/${applicationId}/jp-form-a-pdf`;

  return (
    <Card className="rounded-xl border-input">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-foreground">
            <FileCheck2 className="h-5 w-5 text-brand-500" />
            Japan Tourist Visa — your form is ready
          </CardTitle>
          <Badge variant="secondary">Hand to agency</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-relaxed text-amber-900">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Mainland-China residents must submit Japan Tourist Visa
              applications through a Japanese-government-designated travel
              agency (JVAC China). Download the filled MOFA Application for
              Visa form (Form A), print it, sign it, and hand it to the
              agency along with the required supporting documents.
            </p>
          </div>
        </div>

        <div className="rounded-md border border-input bg-background px-3 py-2 text-sm">
          <div className="text-xs text-muted-foreground">What to do next</div>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-foreground">
            <li>Click the button below to download MOFA Form A.</li>
            <li>Print, sign and date the form.</li>
            <li>
              Affix a recent 45×35mm passport photo in the box on page 1.
            </li>
            <li>
              Bring the form plus your passport, employment certificate, bank
              statement, itinerary, and hotel booking to your designated
              travel agency.
            </li>
            <li>The agency lodges the application on your behalf.</li>
          </ol>
        </div>

        <Button asChild className="w-full">
          <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
            <Download className="mr-2 h-4 w-4" />
            Download MOFA Application for Visa (Form A)
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
