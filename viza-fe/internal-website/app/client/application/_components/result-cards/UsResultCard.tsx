"use client";

import { useState } from "react";
import { ExternalLink, Copy, Check, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { UsSubmissionResult } from "@/lib/submission-result";

function CopyValue({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-input bg-background px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-0.5 break-all font-mono text-sm text-foreground">{value}</div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="shrink-0"
        onClick={() => {
          void navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
}

export function UsResultCard({ result }: { result: UsSubmissionResult }) {
  return (
    <Card className="rounded-xl border-input">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-foreground">
            <ShieldCheck className="h-5 w-5 text-brand-500" />
            DS-160 application captured
          </CardTitle>
          <Badge variant={result.status === "submitted" ? "default" : "secondary"}>
            {result.status === "submitted" ? "Submitted" : "Awaiting your signature"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Save these details — you&apos;ll need them to retrieve your DS-160 from
          ceac.state.gov when you&apos;re ready to sign and submit.
        </p>

        <div className="grid gap-2">
          <CopyValue label="Application ID" value={result.applicationId} />
          <CopyValue label="Surname (first 5 letters)" value={result.surnameFirst5} />
          <CopyValue label="Year of birth" value={String(result.yearOfBirth)} />
          <CopyValue label="Embassy / Consulate" value={result.embassyOrConsulate} />
        </div>

        <div className="rounded-md border border-brand-100 bg-brand-50 p-3">
          <div className="text-xs font-medium text-brand-500">Security question</div>
          <div className="mt-1 text-sm text-foreground">{result.securityQuestion}</div>
          <div className="mt-2 text-xs font-medium text-brand-500">Your answer</div>
          <div className="mt-1 font-mono text-sm text-foreground">{result.securityAnswer}</div>
        </div>

        <Button asChild className="w-full">
          <a href={result.retrievalUrl} target="_blank" rel="noopener noreferrer">
            Open ceac.state.gov to retrieve
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
