"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  CalendarCheck,
  ArrowSquareOut as ExternalLink,
  Copy,
  Check,
  ShieldCheck,
  Printer,
  ArrowCounterClockwise as RotateCcw,
  CircleNotch as Loader2,
} from "@phosphor-icons/react";
import { Alert, AlertDescription, AlertIcon, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { UsSubmissionResult } from "@/lib/submission-result";
import type { Ds160ProofKind } from "@/lib/ds160-proof";

function CopyValue({ label, value }: { label: string; value: string }) {
  const t = useTranslations("usAppointment.ds160Card");
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-input bg-background px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-0.5 break-all font-mono text-sm text-foreground">{value}</div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="shrink-0"
        aria-label={t(copied ? "copiedValue" : "copyValue", { label })}
        onClick={() => {
          const clipboard = navigator.clipboard;
          if (!clipboard) return;
          void clipboard.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }).catch(() => undefined);
        }}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
}

function ProofActionButton({
  busy,
  label,
  onClick,
  ariaControls,
  ariaExpanded,
  children,
}: {
  busy: boolean;
  label: string;
  onClick: () => void;
  ariaControls?: string;
  ariaExpanded?: boolean;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className="justify-start"
      onClick={onClick}
      disabled={busy}
      aria-controls={ariaControls}
      aria-expanded={ariaExpanded}
    >
      {busy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : children}
      <span className="ml-2 truncate">{label}</span>
    </Button>
  );
}

function triggerProofDownload(downloadUrl: string): void {
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = "";
  anchor.rel = "noopener";
  anchor.tabIndex = -1;
  anchor.setAttribute("aria-hidden", "true");
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

type ProofBusyState = Partial<Record<Ds160ProofKind, boolean>>;

type ProofActionResponse = {
  status?: "ready" | "queued" | "unsupported" | "failed";
  code?: string;
  downloadUrl?: string;
  error?: string;
};

function createProofRequestError(message: string, code?: string): Error & { code?: string } {
  const error = new Error(message) as Error & { code?: string };
  if (code) error.code = code;
  return error;
}

export function UsResultCard({
  applicationId,
  result,
}: {
  applicationId?: string;
  result: UsSubmissionResult;
}) {
  const router = useRouter();
  const t = useTranslations("usAppointment.ds160Card");
  const nextT = useTranslations("usAppointment.nextStepCard");
  const securityAnswer = result.securityAnswer && result.securityAnswer !== "[REDACTED]"
    ? result.securityAnswer
    : null;
  const submitted = result.status === "submitted";
  const [startingNewApplication, setStartingNewApplication] = useState(false);
  const [newApplicationError, setNewApplicationError] = useState<string | null>(null);
  const [proofBusy, setProofBusy] = useState<ProofBusyState>({});
  const [proofMessage, setProofMessage] = useState<string | null>(null);

  const startNewApplication = async () => {
    if (!applicationId || startingNewApplication) return;
    setStartingNewApplication(true);
    setNewApplicationError(null);
    try {
      const endpoint = submitted
        ? `/api/applications/${applicationId}/new-application`
        : `/api/applications/${applicationId}/retry-submission`;
      const response = await fetch(endpoint, {
        method: "POST",
        ...(submitted
          ? {}
          : {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                mode: "live_assisted",
                intent: "new_application",
              }),
            }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: unknown;
        jobId?: unknown;
        alreadySubmitted?: unknown;
        applicationId?: unknown;
        href?: unknown;
      } | null;
      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string" ? payload.error : `${t("newApplicationError")} (${response.status})`,
        );
      }
      if (submitted) {
        if (typeof payload?.applicationId !== "string" || typeof payload.href !== "string") {
          throw new Error(t("newApplicationError"));
        }
        router.push(payload.href);
        return;
      }
      if (payload?.alreadySubmitted === true || typeof payload?.jobId !== "string") {
        throw new Error(t("newApplicationError"));
      }
      window.location.reload();
    } catch (error) {
      setNewApplicationError(error instanceof Error ? error.message : String(error));
    } finally {
      setStartingNewApplication(false);
    }
  };

  const requestProof = async (
    kind: Ds160ProofKind,
    action: "download",
  ) => {
    if (!applicationId || proofBusy[kind]) return;
    setProofBusy((prev) => ({ ...prev, [kind]: true }));
    setProofMessage(t("proofPreparing"));
    try {
      const payload = await postProofAction(kind, action);
      if (payload.status === "ready" && payload.downloadUrl) {
        triggerProofDownload(payload.downloadUrl);
        setProofMessage(t("proofReady"));
        return;
      }
      setProofMessage(t("proofQueued"));
      const ready = await waitForProofReady(kind);
      if (!ready.downloadUrl) throw createProofRequestError(t("proofFailed"));
      triggerProofDownload(ready.downloadUrl);
      setProofMessage(t("proofReady"));
    } catch (error) {
      setProofMessage(error instanceof Error ? error.message : t("proofFailed"));
    } finally {
      setProofBusy((prev) => ({ ...prev, [kind]: false }));
    }
  };

  const postProofAction = async (
    kind: Ds160ProofKind,
    action: "download",
  ): Promise<ProofActionResponse> => {
    const body: Record<string, unknown> = { kind, action };
    const response = await fetch(`/api/applications/${applicationId}/ds160-proof`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => null)) as ProofActionResponse | null;
    if (!response.ok) {
      throw createProofRequestError(
        payload?.error ?? `${t("proofFailed")} (${response.status})`,
        payload?.code,
      );
    }
    return payload ?? {};
  };

  const waitForProofReady = async (kind: Ds160ProofKind): Promise<ProofActionResponse> => {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const response = await fetch(`/api/applications/${applicationId}/ds160-proof?kind=${encodeURIComponent(kind)}`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as ProofActionResponse | null;
      if (!response.ok) {
        throw createProofRequestError(
          payload?.error ?? `${t("proofFailed")} (${response.status})`,
          payload?.code,
        );
      }
      if (payload?.status === "failed") {
        throw new Error(payload.error ?? t("proofFailed"));
      }
      if (payload?.status === "ready") return payload;
      if (payload?.status === "unsupported") {
        throw new Error(payload.error ?? t("proofFailed"));
      }
    }
    throw new Error(t("proofTimeout"));
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
          <CopyValue label={t("applicationId")} value={result.applicationId} />
          <CopyValue label={t("surnameFirst5")} value={result.surnameFirst5} />
          <CopyValue label={t("yearOfBirth")} value={String(result.yearOfBirth)} />
        </div>

        {submitted && (
          <div className="rounded-md border border-input bg-background p-3">
            <div className="text-xs font-medium text-muted-foreground">
              {t("officialActions")}
            </div>
            <div className="mt-3">
              <ProofActionButton
                busy={Boolean(proofBusy.confirmation)}
                label={t("printConfirmation")}
                onClick={() => void requestProof("confirmation", "download")}
              >
                <Printer className="h-4 w-4 shrink-0" />
              </ProofActionButton>
            </div>
            {proofMessage && (
              <p className="mt-3 text-sm text-muted-foreground">{proofMessage}</p>
            )}
          </div>
        )}

        <div className="rounded-md border border-brand-100 bg-brand-50 p-3">
          <div className="text-xs font-medium text-brand-500">{t("securityQuestion")}</div>
          <div className="mt-1 text-sm text-foreground">{result.securityQuestion}</div>
          <div className="mt-2 text-xs font-medium text-brand-500">{t("securityAnswer")}</div>
          <div className="mt-1 text-sm text-foreground">
            <span className="font-mono">{securityAnswer ?? t("securityAnswerUnavailable")}</span>
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
            {t(securityAnswer ? "openCeac" : "openCeacStatus")}
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>

        <div className="space-y-2">
          <Button
            type="button"
            variant={submitted ? "outline" : "default"}
            className="w-full"
            onClick={startNewApplication}
            disabled={!applicationId || startingNewApplication}
          >
            {startingNewApplication ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="mr-2 h-4 w-4" />
            )}
            {startingNewApplication
              ? submitted
                ? t("startingNewApplication")
                : t("continuingAutomaticSubmission")
              : submitted
                ? t("newApplication")
                : t("continueAutomaticSubmission")}
          </Button>
          {newApplicationError && (
            <Alert variant="destructive">
              <AlertIcon variant="destructive" />
              <AlertTitle>{t("newApplicationError")}</AlertTitle>
              <AlertDescription>
                <p>{newApplicationError}</p>
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
