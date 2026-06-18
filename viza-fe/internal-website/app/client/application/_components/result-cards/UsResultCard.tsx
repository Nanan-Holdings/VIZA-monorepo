"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  CalendarCheck,
  ExternalLink,
  Copy,
  Check,
  ShieldCheck,
  Printer,
  Files,
  Mail,
  RotateCcw,
  Loader2,
} from "lucide-react";
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

function artifactDownloadUrl(
  applicationId: string | undefined,
  artifactPath: string | null | undefined,
  fileName: string,
): string | null {
  if (!applicationId || !artifactPath) return null;
  return `/api/applications/${encodeURIComponent(applicationId)}/submission-artifact?path=${encodeURIComponent(artifactPath)}&download=${encodeURIComponent(fileName)}`;
}

function ProofActionButton({
  href,
  label,
  unavailableLabel,
  children,
}: {
  href: string | null;
  label: string;
  unavailableLabel: string;
  children: ReactNode;
}) {
  if (!href) {
    return (
      <Button type="button" variant="outline" disabled title={unavailableLabel} className="justify-start">
        {children}
        <span className="ml-2 truncate">{label}</span>
      </Button>
    );
  }

  return (
    <Button asChild variant="outline" className="justify-start">
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
        <span className="ml-2 truncate">{label}</span>
      </a>
    </Button>
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
  const submitted = result.status === "submitted";
  const [startingNewApplication, setStartingNewApplication] = useState(false);
  const [newApplicationError, setNewApplicationError] = useState<string | null>(null);
  const submittedAt = result.submittedAt ?? result.evidence?.submittedAt ?? null;
  const submittedAtText = submittedAt
    ? new Intl.DateTimeFormat(isZh ? "zh-CN" : "en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(submittedAt))
    : null;
  const confirmationPdfUrl = artifactDownloadUrl(
    applicationId,
    result.confirmationPdfStoragePath,
    `ds160-confirmation-${result.confirmationNumber ?? result.applicationId}.pdf`,
  );
  const applicationPdfUrl = artifactDownloadUrl(
    applicationId,
    result.applicationPdfStoragePath,
    `ds160-application-${result.applicationId}.pdf`,
  );
  const emailConfirmationPdfUrl = artifactDownloadUrl(
    applicationId,
    result.emailConfirmationPdfStoragePath ?? result.confirmationPdfStoragePath,
    `ds160-email-confirmation-${result.confirmationNumber ?? result.applicationId}.pdf`,
  );

  const startNewApplication = async () => {
    if (!applicationId || startingNewApplication) return;
    setStartingNewApplication(true);
    setNewApplicationError(null);
    try {
      const response = await fetch(`/api/applications/${applicationId}/retry-submission`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "live_assisted" }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string" ? payload.error : `${t("newApplicationError")} (${response.status})`,
        );
      }
      window.location.reload();
    } catch (error) {
      setNewApplicationError(error instanceof Error ? error.message : String(error));
    } finally {
      setStartingNewApplication(false);
    }
  };

  return (
    <Card className="rounded-xl border-input">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-foreground">
            <ShieldCheck className="h-5 w-5 text-brand-500" />
            {t("title")}
          </CardTitle>
          <Badge variant={submitted ? "default" : "secondary"}>
            {submitted ? t("submitted") : t("awaitingSignature")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {submitted ? t("submittedBody") : t("body")}
        </p>

        <div className="grid gap-2">
          {result.confirmationNumber && (
            <CopyValue label={t("confirmationNumber")} value={result.confirmationNumber} />
          )}
          {submittedAtText && (
            <CopyValue label={t("submittedAt")} value={submittedAtText} />
          )}
          <CopyValue label={t("applicationId")} value={result.applicationId} />
          <CopyValue label={t("surnameFirst5")} value={result.surnameFirst5} />
          <CopyValue label={t("yearOfBirth")} value={String(result.yearOfBirth)} />
          <CopyValue label={t("embassyOrConsulate")} value={result.embassyOrConsulate} />
        </div>

        {submitted && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
            <div className="text-xs font-medium text-emerald-700">
              {t("successEvidence")}
            </div>
            <p className="mt-1 text-sm leading-relaxed text-emerald-950">
              {t("successEvidenceBody")}
            </p>
            {result.evidence?.confirmationText && (
              <div className="mt-2 break-words font-mono text-xs text-emerald-950">
                {result.evidence.confirmationText}
              </div>
            )}
          </div>
        )}

        {submitted && (
          <div className="rounded-md border border-input bg-background p-3">
            <div className="text-xs font-medium text-muted-foreground">
              {t("officialActions")}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <ProofActionButton
                href={confirmationPdfUrl}
                label={t("printConfirmation")}
                unavailableLabel={t("artifactUnavailable")}
              >
                <Printer className="h-4 w-4 shrink-0" />
              </ProofActionButton>
              <ProofActionButton
                href={applicationPdfUrl}
                label={t("printApplication")}
                unavailableLabel={t("artifactUnavailable")}
              >
                <Files className="h-4 w-4 shrink-0" />
              </ProofActionButton>
              <ProofActionButton
                href={emailConfirmationPdfUrl}
                label={t("emailConfirmation")}
                unavailableLabel={t("artifactUnavailable")}
              >
                <Mail className="h-4 w-4 shrink-0" />
              </ProofActionButton>
            </div>
          </div>
        )}

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

        {submitted && (
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={startNewApplication}
              disabled={!applicationId || startingNewApplication}
            >
              {startingNewApplication ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="mr-2 h-4 w-4" />
              )}
              {startingNewApplication ? t("startingNewApplication") : t("newApplication")}
            </Button>
            {newApplicationError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {newApplicationError}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
