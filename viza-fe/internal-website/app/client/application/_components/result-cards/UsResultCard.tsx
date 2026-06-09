"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { CalendarCheck, ExternalLink, Copy, Check, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isChineseLocale } from "@/lib/i18n/locale";
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

export function UsResultCard({
  applicationId,
  result,
}: {
  applicationId?: string;
  result: UsSubmissionResult;
}) {
  const t = useTranslations("usAppointment.ds160Card");
  const nextT = useTranslations("usAppointment.nextStepCard");
  const isZh = isChineseLocale(useLocale());
  const securityAnswer = result.securityAnswer && result.securityAnswer !== "[REDACTED]"
    ? result.securityAnswer
    : null;

  return (
    <Card className="rounded-xl border-input">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-foreground">
            <ShieldCheck className="h-5 w-5 text-brand-500" />
            {t("title")}
          </CardTitle>
          <Badge variant={result.status === "submitted" ? "default" : "secondary"}>
            {result.status === "submitted" ? t("submitted") : t("awaitingSignature")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t("body")}
        </p>

        <div className="grid gap-2">
          <CopyValue label={t("applicationId")} value={result.applicationId} />
          <CopyValue label={t("surnameFirst5")} value={result.surnameFirst5} />
          <CopyValue label={t("yearOfBirth")} value={String(result.yearOfBirth)} />
          <CopyValue label={t("embassyOrConsulate")} value={result.embassyOrConsulate} />
        </div>

        <div className="rounded-md border border-brand-100 bg-brand-50 p-3">
          <div className="text-xs font-medium text-brand-500">{t("securityQuestion")}</div>
          <div className="mt-1 text-sm text-foreground">{result.securityQuestion}</div>
          <div className="mt-2 text-xs font-medium text-brand-500">{t("securityAnswer")}</div>
          <div className="mt-1 text-sm text-foreground">
            {securityAnswer ? (
              <span className="font-mono">{securityAnswer}</span>
            ) : (
              <span>
                {isZh
                  ? "已加密保存。需要取回 DS-160 时，请通过安全揭示流程查看。"
                  : "Encrypted and hidden. Use secure reveal when retrieving the DS-160."}
              </span>
            )}
          </div>
        </div>

        {applicationId && (
          <div className="rounded-md border border-brand-100 bg-brand-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-heading text-base font-medium text-foreground">
                    {nextT("title")}
                  </h3>
                  <Badge variant="secondary">{nextT("badge")}</Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {nextT("body")}
                </p>
              </div>
              <CalendarCheck className="mt-1 h-5 w-5 shrink-0 text-brand-500" />
            </div>
            <Button asChild className="mt-4 w-full">
              <Link href={`/client/applications/${applicationId}/us-appointment`}>
                {nextT("button")}
                <CalendarCheck className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        )}

        <Button asChild className="w-full">
          <a href={result.retrievalUrl} target="_blank" rel="noopener noreferrer">
            {t("openCeac")}
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
