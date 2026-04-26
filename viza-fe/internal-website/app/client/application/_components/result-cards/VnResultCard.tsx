"use client";

import { ExternalLink, Mail, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { VnSubmissionResult } from "@/lib/submission-result";

export function VnResultCard({ result }: { result: VnSubmissionResult }) {
  return (
    <Card className="rounded-xl border-input">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-foreground">
            <ShieldCheck className="h-5 w-5 text-brand-500" />
            Vietnam e-Visa application captured
          </CardTitle>
          <Badge variant="secondary">Action required: payment</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          We pre-filled your e-Visa application on evisa.gov.vn. To finalize,
          complete the payment using the registration code below.
        </p>

        <div className="rounded-md border border-input bg-background px-3 py-2">
          <div className="text-xs text-muted-foreground">Registration code</div>
          <div className="mt-0.5 font-mono text-base font-medium text-foreground">
            {result.registrationCode}
          </div>
        </div>

        <div className="rounded-md border border-brand-100 bg-brand-50 p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-brand-500">
            <Mail className="h-4 w-4" />
            What happens next
          </div>
          <p className="mt-2 text-sm text-foreground">{result.noticeText}</p>
        </div>

        <Button asChild className="w-full">
          <a href="https://evisa.gov.vn" target="_blank" rel="noopener noreferrer">
            Open evisa.gov.vn to pay
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
