"use client";

import { useState } from "react";
import { ExternalLink, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { UkSubmissionResult } from "@/lib/submission-result";

interface UkResultCardProps {
  applicationId: string;
  result: UkSubmissionResult;
}

export function UkResultCard({ applicationId, result }: UkResultCardProps) {
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);

  const togglePassword = async () => {
    if (revealedPassword) {
      setRevealedPassword(null);
      return;
    }
    setRevealing(true);
    try {
      const res = await fetch(`/api/applications/${applicationId}/uk-portal-credentials`);
      if (!res.ok) throw new Error("Failed to fetch credentials");
      const { password } = (await res.json()) as { password: string };
      setRevealedPassword(password);
    } finally {
      setRevealing(false);
    }
  };

  return (
    <Card className="rounded-xl border-input">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-foreground">
            <ShieldCheck className="h-5 w-5 text-brand-500" />
            UK visa portal account ready
          </CardTitle>
          <Badge variant={result.status === "stopped_at_pay" ? "secondary" : "default"}>
            {result.status === "stopped_at_pay" ? "Awaiting payment" : "Registered"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          We registered your UKVI account and pre-filled your whole application.
          Log back in with these credentials to review your answers, accept the
          declaration, and pay the £135 visa fee on apply-uk-visa.service.gov.uk —
          these final steps must be completed by you.
        </p>

        <div className="rounded-md border border-input bg-background px-3 py-2">
          <div className="text-xs text-muted-foreground">Username (email)</div>
          <div className="mt-0.5 break-all font-mono text-sm text-foreground">
            {result.portalUsername}
          </div>
        </div>

        <div className="rounded-md border border-input bg-background px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-xs text-muted-foreground">Password</div>
              <div className="mt-0.5 break-all font-mono text-sm text-foreground">
                {revealedPassword ?? "••••••••••"}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={togglePassword} disabled={revealing}>
              {revealedPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {result.applicationReference && (
          <div className="rounded-md border border-input bg-background px-3 py-2">
            <div className="text-xs text-muted-foreground">Application reference</div>
            <div className="mt-0.5 font-mono text-sm text-foreground">{result.applicationReference}</div>
          </div>
        )}

        <Button asChild className="w-full">
          <a href={result.portalUrl} target="_blank" rel="noopener noreferrer">
            Review &amp; pay on UKVI portal
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
