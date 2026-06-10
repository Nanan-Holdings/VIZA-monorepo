"use client";

import { Download, Mail, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { GenericEvisaSubmissionResult } from "@/lib/submission-result";

/**
 * POR-006: generic result card for the standard e-Visa launch countries
 * (ID/EG/SA/MY/TH/AE/CA/TR/IT/IN). Handles the submitted, halted-before-pay,
 * and paper/VFS-ready states, and surfaces the e-visa artifact download when
 * the runner stored one (POR-007).
 */
const COUNTRY_LABEL: Record<GenericEvisaSubmissionResult["country"], string> = {
  ID: "Indonesia", EG: "Egypt", SA: "Saudi Arabia", MY: "Malaysia", TH: "Thailand",
  AE: "United Arab Emirates", CA: "Canada", TR: "Türkiye", IT: "Italy", IN: "India",
};

export function GenericEvisaResultCard({
  applicationId,
  result,
}: {
  applicationId: string | null;
  result: GenericEvisaSubmissionResult;
}) {
  const country = COUNTRY_LABEL[result.country] ?? result.country;
  const hasArtifact = Boolean(result.artifactStoragePath);

  const heading =
    result.status === "submitted"
      ? `${country} application submitted`
      : result.status === "form_ready_for_agency"
        ? `${country} application pack ready`
        : `${country} application prepared`;

  const badge =
    result.status === "stopped_at_pay"
      ? "Action required: payment"
      : result.status === "form_ready_for_agency"
        ? "Download & submit"
        : "Submitted";

  return (
    <Card className="rounded-xl border-input">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-foreground">
            <ShieldCheck className="h-5 w-5 text-brand-500" />
            {heading}
          </CardTitle>
          <Badge variant="secondary">{badge}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {result.status === "stopped_at_pay"
            ? `We prepared your ${country} application and stopped at the government payment step. Complete the payment to finalize — we monitor the outcome and store your approved visa here.`
            : result.status === "form_ready_for_agency"
              ? `Your ${country} application pack is ready to download, print, and submit at the visa centre.`
              : `Your ${country} application has been filed. We're tracking the decision and will store your approved visa here.`}
        </p>

        {result.reference ? (
          <div className="rounded-md border border-input bg-background px-3 py-2">
            <div className="text-xs text-muted-foreground">Reference</div>
            <div className="mt-0.5 font-mono text-base font-medium text-foreground">{result.reference}</div>
          </div>
        ) : null}

        {hasArtifact && applicationId ? (
          <Button asChild className="w-full">
            <a href={`/api/applications/${applicationId}/evisa-artifact`}>
              <Download className="mr-2 h-4 w-4" /> Download document
            </a>
          </Button>
        ) : (
          <div className="rounded-md border border-brand-100 bg-brand-50 p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-brand-500">
              <Mail className="h-4 w-4" /> What happens next
            </div>
            <p className="mt-2 text-sm text-foreground">
              Your approved visa will appear here for download as soon as it is issued.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
