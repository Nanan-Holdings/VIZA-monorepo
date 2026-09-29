"use client";

import { useEffect, useId, useRef, useState } from "react";
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
  Envelope as Mail,
  ArrowCounterClockwise as RotateCcw,
  CircleNotch as Loader2,
} from "@phosphor-icons/react";
import { Alert, AlertDescription, AlertIcon, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { UsSubmissionResult } from "@/lib/submission-result";
import {
  DS160_PROOF_EMAIL_ERROR_CODE,
  DS160_PROOF_EMAIL_PENDING_CODE,
  DS160_PROOF_EMAIL_UNKNOWN_CODE,
  DS160_PROOF_EMAIL_UNAVAILABLE_CODE,
  type Ds160ProofKind,
} from "@/lib/ds160-proof";

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
  ok?: boolean;
  status?: "idle" | "ready" | "queued" | "sending" | "sent" | "unknown" | "unsupported" | "failed";
  code?: string;
  jobId?: string | null;
  currentStage?: string | null;
  downloadUrl?: string;
  recipient?: string;
  message?: string;
  error?: string;
  retryable?: boolean;
};

type ProofErrorState = {
  code?: string;
  message: string;
};

function createProofRequestError(message: string, code?: string): Error & { code?: string } {
  const error = new Error(message) as Error & { code?: string };
  if (code) error.code = code;
  return error;
}

function readProofErrorCode(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined;
  const code = (error as Error & { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

function createEmailRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  globalThis.crypto?.getRandomValues?.(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

type ProofRequestOptions = {
  requestId?: string;
  retry?: boolean;
};

export function UsResultCard({
  applicationId,
  result,
}: {
  applicationId?: string;
  result: UsSubmissionResult;
}) {
  const router = useRouter();
  const t = useTranslations("usAppointment.ds160Card");
  const tRef = useRef(t);
  tRef.current = t;
  const nextT = useTranslations("usAppointment.nextStepCard");
  const securityAnswer = result.securityAnswer && result.securityAnswer !== "[REDACTED]"
    ? result.securityAnswer
    : null;
  const submitted = result.status === "submitted";
  const [startingNewApplication, setStartingNewApplication] = useState(false);
  const [newApplicationError, setNewApplicationError] = useState<string | null>(null);
  const [proofBusy, setProofBusy] = useState<ProofBusyState>({});
  const [proofMessage, setProofMessage] = useState<string | null>(null);
  const [proofError, setProofError] = useState<ProofErrorState | null>(null);
  const [emailPanelOpen, setEmailPanelOpen] = useState(false);
  const [emailRetryAvailable, setEmailRetryAvailable] = useState(false);
  const [emailStatusUnavailable, setEmailStatusUnavailable] = useState(false);
  const emailPanelId = `ds160-email-panel-${useId()}`;
  const emailRequestSequence = useRef(0);

  useEffect(() => {
    if (!applicationId || !submitted) return;
    let active = true;
    const requestSequence = emailRequestSequence.current;
    const loadEmailState = async () => {
      try {
        let jobId: string | null = null;
        for (let attempt = 0; attempt < 100; attempt += 1) {
          if (!active || requestSequence !== emailRequestSequence.current) return;
          const query = new URLSearchParams({ kind: "email-confirmation", action: "email" });
          if (jobId) query.set("jobId", jobId);
          const response = await fetch(`/api/applications/${applicationId}/ds160-proof?${query.toString()}`, {
            cache: "no-store",
          });
          const payload = (await response.json().catch(() => null)) as ProofActionResponse | null;
          if (!active || requestSequence !== emailRequestSequence.current) return;
          if (!response.ok) {
            setProofBusy((prev) => ({ ...prev, "email-confirmation": false }));
            setProofMessage(null);
            setEmailRetryAvailable(false);
            setEmailStatusUnavailable(true);
            setEmailPanelOpen(true);
            setProofError({
              code: payload?.code ?? DS160_PROOF_EMAIL_UNAVAILABLE_CODE,
              message: payload?.error ?? tRef.current("proofEmailUnavailableBody"),
            });
            return;
          }
          setEmailStatusUnavailable(false);
          if (!payload) {
            setProofBusy((prev) => ({ ...prev, "email-confirmation": false }));
            setProofMessage(null);
            setEmailRetryAvailable(false);
            setEmailPanelOpen(true);
            setProofError({
              code: DS160_PROOF_EMAIL_UNAVAILABLE_CODE,
              message: tRef.current("proofEmailUnavailableBody"),
            });
            return;
          }
          jobId = payload.jobId ?? jobId;
          if (payload.status === "sent") {
            setProofBusy((prev) => ({ ...prev, "email-confirmation": false }));
            setProofError(null);
            setEmailRetryAvailable(false);
            setProofMessage(tRef.current("proofEmailSent", { email: payload.recipient ?? "" }));
            return;
          }
          if (payload.status === "queued" || payload.status === "sending") {
            setEmailPanelOpen(true);
            setProofBusy((prev) => ({ ...prev, "email-confirmation": true }));
            setProofError(null);
            setEmailRetryAvailable(false);
            setProofMessage(tRef.current("proofEmailSending"));
            if (attempt < 99) await new Promise((resolve) => setTimeout(resolve, 3000));
            continue;
          }
          setProofBusy((prev) => ({ ...prev, "email-confirmation": false }));
          if (payload.status === "failed" || payload.status === "unknown") {
            setEmailPanelOpen(true);
            setProofError({
              code: payload.code,
              message: payload.error ?? tRef.current("proofFailed"),
            });
            setEmailRetryAvailable(true);
          }
          return;
        }
        if (active && requestSequence === emailRequestSequence.current) {
          setProofBusy((prev) => ({ ...prev, "email-confirmation": false }));
          setProofMessage(null);
          setProofError({
            code: DS160_PROOF_EMAIL_PENDING_CODE,
            message: tRef.current("proofEmailStillProcessingBody"),
          });
          setEmailRetryAvailable(false);
        }
      } catch {
        if (!active || requestSequence !== emailRequestSequence.current) return;
        setProofBusy((prev) => ({ ...prev, "email-confirmation": false }));
        setProofMessage(null);
        setEmailRetryAvailable(false);
        setEmailStatusUnavailable(true);
        setEmailPanelOpen(true);
        setProofError({
          code: DS160_PROOF_EMAIL_UNAVAILABLE_CODE,
          message: tRef.current("proofEmailUnavailableBody"),
        });
      }
    };
    void loadEmailState();
    return () => {
      active = false;
    };
  }, [applicationId, submitted]);

  useEffect(() => () => {
    emailRequestSequence.current += 1;
  }, []);

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
    action: "download" | "email",
    options?: ProofRequestOptions,
  ) => {
    if (!applicationId || proofBusy[kind]) return;
    const emailOptions = action === "email"
      ? {
          requestId: options?.requestId ?? createEmailRequestId(),
          retry: options?.retry === true,
        }
      : undefined;
    const requestSequence = action === "email" ? ++emailRequestSequence.current : emailRequestSequence.current;
    setProofBusy((prev) => ({ ...prev, [kind]: true }));
    setProofError(null);
    if (action === "email") setEmailRetryAvailable(false);
    setProofMessage(t("proofPreparing"));
    try {
      const payload = await postProofAction(kind, action, emailOptions);
      if (payload.status === "ready" && payload.downloadUrl) {
        triggerProofDownload(payload.downloadUrl);
        setProofMessage(t("proofReady"));
        return;
      }
      if (action === "email" && requestSequence !== emailRequestSequence.current) return;
      if (payload.status === "sent") {
        setProofMessage(t("proofEmailSent", { email: payload.recipient ?? "" }));
        return;
      }
      if (payload.status === "queued" || payload.status === "sending") {
        if (action === "email") {
          setProofMessage(t("proofEmailSending"));
          const sent = await waitForOfficialEmailStatus(payload.jobId ?? null, requestSequence);
          if (requestSequence !== emailRequestSequence.current) return;
          setProofMessage(t("proofEmailSent", { email: sent.recipient ?? payload.recipient ?? "" }));
        } else {
          setProofMessage(t("proofQueued"));
          const ready = await waitForProofReady(kind);
          if (!ready.downloadUrl) throw createProofRequestError(t("proofFailed"));
          triggerProofDownload(ready.downloadUrl);
          setProofMessage(t("proofReady"));
        }
      } else if (payload.status === "unknown" || payload.status === "failed") {
        throw createProofRequestError(payload.error ?? t("proofFailed"), payload.code);
      } else {
        throw createProofRequestError(t("proofFailed"), payload.code);
      }
    } catch (error) {
      if (action === "email" && requestSequence !== emailRequestSequence.current) return;
      setProofMessage(null);
      setProofError({
        code: readProofErrorCode(error),
        message: error instanceof Error ? error.message : String(error),
      });
      const errorCode = readProofErrorCode(error);
      if (
        action === "email" &&
        (errorCode === DS160_PROOF_EMAIL_ERROR_CODE ||
          errorCode === DS160_PROOF_EMAIL_UNKNOWN_CODE ||
          errorCode === DS160_PROOF_EMAIL_UNAVAILABLE_CODE)
      ) {
        setEmailRetryAvailable(true);
      }
    } finally {
      if (action !== "email" || requestSequence === emailRequestSequence.current) {
        setProofBusy((prev) => ({ ...prev, [kind]: false }));
      }
    }
  };

  const postProofAction = async (
    kind: Ds160ProofKind,
    action: "download" | "email",
    options?: ProofRequestOptions,
  ): Promise<ProofActionResponse> => {
    const body: Record<string, unknown> = { kind, action };
    if (kind === "email-confirmation" && action === "email") {
      body.recipientMode = "account";
      body.requestId = options?.requestId ?? createEmailRequestId();
      body.retry = options?.retry === true;
    }
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

  const waitForOfficialEmailStatus = async (
    jobId: string | null,
    requestSequence: number,
  ): Promise<ProofActionResponse> => {
    if (!jobId) throw createProofRequestError(t("proofFailed"));
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (requestSequence !== emailRequestSequence.current) {
        throw createProofRequestError(t("proofEmailStillProcessingBody"), DS160_PROOF_EMAIL_PENDING_CODE);
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const query = new URLSearchParams({
        kind: "email-confirmation",
        action: "email",
        jobId,
      });
      const response = await fetch(`/api/applications/${applicationId}/ds160-proof?${query.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as ProofActionResponse | null;
      if (!response.ok && payload?.status !== "failed" && payload?.status !== "unknown") {
        throw createProofRequestError(
          payload?.error ?? `${t("proofFailed")} (${response.status})`,
          payload?.code,
        );
      }
      if (payload?.status === "sent") return payload;
      if (payload?.status === "failed" || payload?.status === "unknown") {
        throw createProofRequestError(
          payload.error ?? t(payload.status === "unknown" ? "proofEmailUnknownBody" : "proofEmailFailedBody"),
          payload.code ?? (payload.status === "unknown" ? DS160_PROOF_EMAIL_UNKNOWN_CODE : DS160_PROOF_EMAIL_ERROR_CODE),
        );
      }
      if (payload?.status !== "queued" && payload?.status !== "sending") {
        throw createProofRequestError(t("proofFailed"), payload?.code);
      }
    }
    throw createProofRequestError(t("proofEmailStillProcessingBody"), DS160_PROOF_EMAIL_PENDING_CODE);
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
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <ProofActionButton
                busy={Boolean(proofBusy.confirmation)}
                label={t("printConfirmation")}
                onClick={() => void requestProof("confirmation", "download")}
              >
                <Printer className="h-4 w-4 shrink-0" />
              </ProofActionButton>
              <ProofActionButton
                busy={Boolean(proofBusy["email-confirmation"])}
                label={t("emailConfirmation")}
                onClick={() => setEmailPanelOpen((open) => !open)}
                ariaControls={emailPanelId}
                ariaExpanded={emailPanelOpen}
              >
                <Mail className="h-4 w-4 shrink-0" />
              </ProofActionButton>
            </div>
            {emailPanelOpen && (
              <div id={emailPanelId} className="mt-3 rounded-md border border-input bg-muted/30 p-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void requestProof("email-confirmation", "email", {
                    requestId: createEmailRequestId(),
                    retry: emailRetryAvailable,
                  })}
                  disabled={Boolean(proofBusy["email-confirmation"]) || emailStatusUnavailable}
                >
                  {emailRetryAvailable ? t("retryEmail") : t("sendToAccountEmail")}
                </Button>
              </div>
            )}
            {proofMessage && (
              <p className="mt-3 text-sm text-muted-foreground">{proofMessage}</p>
            )}
            {proofError && (
              <Alert variant="destructive" className="mt-3">
                <AlertIcon variant="destructive" />
                <AlertTitle>
                  {proofError.code === DS160_PROOF_EMAIL_ERROR_CODE
                    ? t("proofEmailFailed")
                    : proofError.code === DS160_PROOF_EMAIL_UNKNOWN_CODE
                      ? t("proofEmailUnknown")
                      : proofError.code === DS160_PROOF_EMAIL_PENDING_CODE
                        ? t("proofEmailSending")
                      : proofError.code === DS160_PROOF_EMAIL_UNAVAILABLE_CODE
                        ? t("proofEmailUnavailable")
                    : t("proofFailed")}
                </AlertTitle>
                <AlertDescription>
                  <p>
                    {proofError.code === DS160_PROOF_EMAIL_ERROR_CODE
                      ? t("proofEmailFailedBody")
                      : proofError.code === DS160_PROOF_EMAIL_UNKNOWN_CODE
                        ? t("proofEmailUnknownBody")
                        : proofError.code === DS160_PROOF_EMAIL_PENDING_CODE
                          ? t("proofEmailStillProcessingBody")
                        : proofError.code === DS160_PROOF_EMAIL_UNAVAILABLE_CODE
                          ? t("proofEmailUnavailableBody")
                        : proofError.message}
                  </p>
                  {emailRetryAvailable && (
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-3"
                      onClick={() => void requestProof("email-confirmation", "email", {
                        requestId: createEmailRequestId(),
                        retry: true,
                      })}
                      disabled={Boolean(proofBusy["email-confirmation"])}
                    >
                      {t("retryEmail")}
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
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
