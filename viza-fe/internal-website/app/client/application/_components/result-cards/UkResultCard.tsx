"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowSquareOut as ExternalLink,
  CalendarCheck,
  Check,
  CircleNotch as Loader2,
  Copy,
  Eye,
  EyeSlash,
  ArrowClockwise as RotateCw,
  ShieldCheck,
} from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClientErrorAlert } from "@/components/client/client-error-alert";
import type { UkSubmissionResult } from "@/lib/submission-result";
import { isAllowedUkResumeUrl, UK_VISA_LINKS } from "@/lib/client/uk-visa-links";

type CustomerUkSubmissionResult = Omit<
  UkSubmissionResult,
  "generatedPasswordCipher" | "portalUrl" | "portalUsername"
>;

type UkCheckpoint = NonNullable<CustomerUkSubmissionResult["checkpoint"]>;

type UkPortalCredentials = {
  email: string;
  password: string;
  resumeUrl: string;
  revealedAt: string | null;
};

interface UkResultCardProps {
  applicationId: string;
  result: CustomerUkSubmissionResult;
  applicationCountry?: string | null;
  applicationVisaType?: string | null;
  /** Parent-owned submission flows can provide a save/validate-aware retry. */
  onContinue?: () => Promise<void> | void;
}

const UK_CREDENTIAL_REQUEST_TIMEOUT_MS = 12_000;

function getCheckpoint(result: CustomerUkSubmissionResult): UkCheckpoint {
  if (result.checkpoint && ["registration", "form_incomplete", "review", "declaration", "payment"].includes(result.checkpoint)) {
    return result.checkpoint;
  }
  if (result.status === "registered") return "registration";
  if (
    result.status === "stopped_at_pay" ||
    result.status === "funding_required" ||
    result.status === "payment_pending" ||
    result.status === "payment_review_required" ||
    result.status === "paid"
  ) {
    return "payment";
  }
  return "form_incomplete";
}

function parsePortalCredentials(payload: unknown): UkPortalCredentials | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (
    typeof record.email !== "string" ||
    !record.email ||
    typeof record.password !== "string" ||
    !record.password ||
    typeof record.resumeUrl !== "string" ||
    !isAllowedUkResumeUrl(record.resumeUrl)
  ) {
    return null;
  }

  return {
    email: record.email,
    password: record.password,
    resumeUrl: record.resumeUrl,
    revealedAt: typeof record.revealedAt === "string" ? record.revealedAt : null,
  };
}

function ExternalOfficialLink({
  href,
  label,
  description,
}: {
  href: string;
  label: string;
  description: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-h-11 items-center gap-3 rounded-md border border-input bg-background px-3 py-2 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{description}</span>
      </span>
      <ExternalLink className="h-4 w-4 shrink-0 text-brand-500" aria-hidden="true" />
    </a>
  );
}

function CredentialValue({
  label,
  value,
  copied,
  copyLabel,
  copiedLabel,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  copyLabel: string;
  copiedLabel: string;
  onCopy: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-brand-100 bg-white px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="text-xs text-brand-700">{label}</div>
        <div className="mt-0.5 break-all font-mono text-sm text-foreground">{value}</div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0"
        aria-label={copied ? copiedLabel : copyLabel}
        onClick={onCopy}
      >
        {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
      </Button>
    </div>
  );
}

export function UkResultCard({
  applicationId,
  result,
  applicationCountry = null,
  applicationVisaType = null,
  onContinue,
}: UkResultCardProps) {
  const t = useTranslations("ukVisaResult");
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<UkPortalCredentials | null>(null);
  const [revealingCredentials, setRevealingCredentials] = useState(false);
  const [credentialError, setCredentialError] = useState<string | null>(null);
  const [copiedCredential, setCopiedCredential] = useState<"email" | "password" | "resumeUrl" | null>(null);
  const credentialRequestRef = useRef<AbortController | null>(null);
  const copyResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkpoint = getCheckpoint(result);
  const checkpointMessageKey =
    checkpoint === "registration" && result.status === "registered"
      ? "registration_ready"
      : checkpoint;
  const officialStepNeedsAttention = checkpoint === "payment" || result.status === "needs_attention";
  const needsPrefillRetry =
    result.status === "registered" ||
    (result.status === "needs_attention" && checkpoint === "form_incomplete");
  const progress = result.prefillProgress;

  useEffect(() => {
    const clearCredentialState = () => {
      credentialRequestRef.current?.abort();
      credentialRequestRef.current = null;
      if (copyResetTimerRef.current) {
        clearTimeout(copyResetTimerRef.current);
        copyResetTimerRef.current = null;
      }
      setCredentials(null);
      setRevealingCredentials(false);
      setCredentialError(null);
      setCopiedCredential(null);
    };

    window.addEventListener("pagehide", clearCredentialState);
    return () => {
      window.removeEventListener("pagehide", clearCredentialState);
      clearCredentialState();
    };
  }, [applicationId]);

  const revealCredentials = async () => {
    if (revealingCredentials) return;

    const controller = new AbortController();
    let timedOut = false;
    credentialRequestRef.current = controller;
    setRevealingCredentials(true);
    setCredentialError(null);
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, UK_CREDENTIAL_REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`/api/applications/${applicationId}/uk-portal-credentials`, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null);
      if (credentialRequestRef.current !== controller || controller.signal.aborted) return;
      if (!response.ok) {
        throw new Error(response.status === 404 || response.status === 410 ? "not_bound" : "request_failed");
      }
      const nextCredentials = parsePortalCredentials(payload);
      if (!nextCredentials) throw new Error("invalid_response");
      setCredentials(nextCredentials);
    } catch (error) {
      if (credentialRequestRef.current !== controller || controller.signal.aborted) {
        if (credentialRequestRef.current === controller && timedOut) {
          setCredentialError(t("credentials.timeout"));
        }
        return;
      }
      setCredentialError(
        error instanceof Error && error.message === "not_bound"
          ? t("credentials.notBound")
          : timedOut
            ? t("credentials.timeout")
            : t("credentials.error"),
      );
    } finally {
      clearTimeout(timeoutId);
      if (credentialRequestRef.current === controller) {
        credentialRequestRef.current = null;
        setRevealingCredentials(false);
      }
    }
  };

  const clearCredentials = () => {
    credentialRequestRef.current?.abort();
    credentialRequestRef.current = null;
    if (copyResetTimerRef.current) {
      clearTimeout(copyResetTimerRef.current);
      copyResetTimerRef.current = null;
    }
    setCredentials(null);
    setRevealingCredentials(false);
    setCredentialError(null);
    setCopiedCredential(null);
  };

  const copyCredential = async (field: "email" | "password" | "resumeUrl", value: string) => {
    if (!navigator.clipboard) {
      setCredentialError(t("credentials.copyUnavailable"));
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setCopiedCredential(field);
      if (copyResetTimerRef.current) clearTimeout(copyResetTimerRef.current);
      copyResetTimerRef.current = setTimeout(() => {
        setCopiedCredential(null);
        copyResetTimerRef.current = null;
      }, 1500);
    } catch {
      setCredentialError(t("credentials.copyError"));
    }
  };

  const retryPrefill = async () => {
    if (retrying) return;
    const confirmed = window.confirm(t("retry.confirm"));
    if (!confirmed) return;

    setRetrying(true);
    setRetryError(null);
    try {
      if (onContinue) {
        await onContinue();
        return;
      }
      const response = await fetch(`/api/applications/${applicationId}/retry-submission`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "live_assisted",
          country: applicationCountry,
          visaType: applicationVisaType,
        }),
      });
      if (!response.ok) throw new Error("retry_failed");
      window.location.reload();
    } catch {
      setRetryError(t("retry.error"));
    } finally {
      setRetrying(false);
    }
  };

  return (
    <Card className="rounded-xl border-input">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="flex items-center gap-3 text-foreground">
            <ShieldCheck className="h-5 w-5 shrink-0 text-brand-500" />
            {t(`status.title.${checkpointMessageKey}`)}
          </CardTitle>
          <Badge variant={officialStepNeedsAttention ? "secondary" : "outline"}>
            {t(`status.badge.${checkpointMessageKey}`)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t(`status.description.${checkpointMessageKey}`)}
        </p>

        {needsPrefillRetry && (
          <div className="rounded-md border border-brand-100 bg-brand-50 p-3">
            <div className="flex items-start gap-2 text-sm leading-relaxed text-brand-900">
              <RotateCw className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" aria-hidden="true" />
              <span>{t("retry.body")}</span>
            </div>
            <Button
              type="button"
              className="mt-3 w-full"
              onClick={() => void retryPrefill()}
              disabled={retrying}
            >
              {retrying ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <RotateCw className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              {retrying ? t("retry.loading") : t("retry.button")}
            </Button>
            {retryError ? <ClientErrorAlert className="mt-2" message={retryError} /> : null}
          </div>
        )}

        {progress && needsPrefillRetry && (
          <p className="text-xs text-muted-foreground">
            {t("progress", {
              pagesFilled: progress.pagesFilled,
              totalPages: progress.totalPages,
            })}
          </p>
        )}

        {result.applicationReference && (
          <div className="rounded-md border border-input bg-background px-3 py-2">
            <div className="text-xs text-muted-foreground">{t("reference.label")}</div>
            <div className="mt-0.5 break-all font-mono text-sm text-foreground">
              {result.applicationReference}
            </div>
          </div>
        )}

        <div
          className="ph-no-capture space-y-3 rounded-md border border-brand-100 bg-brand-50 p-3"
          data-testid="uk-account-credentials"
          data-private="true"
          data-ph-no-capture="true"
        >
          <div className="flex items-center gap-2 text-xs font-medium text-brand-700">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            {t("credentials.title")}
          </div>
          <p className="text-sm leading-relaxed text-brand-950">{t("credentials.body")}</p>

          {credentials ? (
            <div className="ph-no-capture" data-private="true" data-ph-no-capture="true">
              <div className="grid gap-2">
                <CredentialValue
                  label={t("credentials.email")}
                  value={credentials.email}
                  copied={copiedCredential === "email"}
                  copyLabel={t("credentials.copy")}
                  copiedLabel={t("credentials.copied")}
                  onCopy={() => void copyCredential("email", credentials.email)}
                />
                <CredentialValue
                  label={t("credentials.password")}
                  value={credentials.password}
                  copied={copiedCredential === "password"}
                  copyLabel={t("credentials.copy")}
                  copiedLabel={t("credentials.copied")}
                  onCopy={() => void copyCredential("password", credentials.password)}
                />
              </div>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <Button type="button" variant="outline" className="w-full bg-white sm:flex-1" onClick={clearCredentials}>
                  <EyeSlash className="h-4 w-4" aria-hidden="true" />
                  {t("credentials.hide")}
                </Button>
                <Button asChild variant="outline" className="w-full bg-white sm:flex-1">
                  <a href={credentials.resumeUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    {t("credentials.resume")}
                  </a>
                </Button>
              </div>
              <div className="mt-2">
                <CredentialValue
                  label={t("credentials.resumeUrl")}
                  value={credentials.resumeUrl}
                  copied={copiedCredential === "resumeUrl"}
                  copyLabel={t("credentials.copy")}
                  copiedLabel={t("credentials.copied")}
                  onCopy={() => void copyCredential("resumeUrl", credentials.resumeUrl)}
                />
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="w-full bg-white"
              onClick={() => void revealCredentials()}
              disabled={revealingCredentials}
            >
              {revealingCredentials ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
              {revealingCredentials ? t("credentials.revealing") : t("credentials.reveal")}
            </Button>
          )}
          {credentialError ? <ClientErrorAlert message={credentialError} /> : null}
        </div>

        <div className="space-y-3 rounded-md border border-input bg-background p-3" data-testid="uk-official-links">
          <div className="flex items-center gap-2 text-xs font-medium text-brand-700">
            <CalendarCheck className="h-4 w-4" aria-hidden="true" />
            {t("officialLinks.title")}
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{t("officialLinks.body")}</p>
          <div className="grid gap-2">
            <ExternalOfficialLink
              href={UK_VISA_LINKS.signInVisaApplication}
              label={t("officialLinks.signIn")}
              description={t("officialLinks.signInDescription")}
            />
            <ExternalOfficialLink
              href={UK_VISA_LINKS.findVisaApplicationCentre}
              label={t("officialLinks.findCentre")}
              description={t("officialLinks.findCentreDescription")}
            />
          </div>
        </div>

        <div className="space-y-3 rounded-md border border-input bg-background p-3" data-testid="uk-evisa-links">
          <div className="flex items-center gap-2 text-xs font-medium text-brand-700">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            {t("evisa.title")}
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{t("evisa.body")}</p>
          <div className="grid gap-2">
            <ExternalOfficialLink
              href={UK_VISA_LINKS.setUpUkviAccount}
              label={t("evisa.setup")}
              description={t("evisa.setupDescription")}
            />
            <ExternalOfficialLink
              href={UK_VISA_LINKS.viewProveImmigrationStatus}
              label={t("evisa.view")}
              description={t("evisa.viewDescription")}
            />
            <ExternalOfficialLink
              href={UK_VISA_LINKS.updateUkviAccountDetails}
              label={t("evisa.update")}
              description={t("evisa.updateDescription")}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
