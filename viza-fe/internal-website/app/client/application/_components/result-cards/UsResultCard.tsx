"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
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

const DS160_PROOF_REQUEST_TIMEOUT_MS = 30_000;

class ProofRequestTimeoutError extends Error {
  constructor() {
    super("DS-160 proof request timed out");
    this.name = "ProofRequestTimeoutError";
  }
}

async function requestProofJson<T>(
  input: RequestInfo | URL,
  init: RequestInit,
): Promise<{ response: Response; payload: T | null }> {
  const controller = new AbortController();
  let timedOut = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const request = (async () => {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });
    let payload: T | null = null;
    try {
      payload = await response.json() as T;
    } catch (error) {
      if (timedOut) throw error;
    }
    return { response, payload };
  })();
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      timedOut = true;
      reject(new ProofRequestTimeoutError());
      controller.abort();
    }, DS160_PROOF_REQUEST_TIMEOUT_MS);
  });

  try {
    return await Promise.race([request, timeout]);
  } finally {
    if (timeoutId !== null) clearTimeout(timeoutId);
    if (timedOut) controller.abort();
  }
}

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
  const securityAnswer = result.securityAnswer && result.securityAnswer !== "[REDACTED]"
    ? result.securityAnswer
    : null;
  const submitted = result.status === "submitted";
  const [startingNewApplication, setStartingNewApplication] = useState(false);
  const [newApplicationError, setNewApplicationError] = useState<string | null>(null);
  const [confirmingResubmit, setConfirmingResubmit] = useState(false);
  const [resubmitting, setResubmitting] = useState(false);
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

  // Resubmit = copy this submitted application's answers and documents into a
  // fresh VIZA draft, then queue that draft as a new official DS-160. CEAC
  // issues a new Application ID; the submitted original stays untouched. If
  // queueing is refused (for example a now-invalid answer), the draft remains
  // and "edit then reapply" reopens it for correction.
  const resubmitWithSameAnswers = async () => {
    if (!applicationId || resubmitting) return;
    setResubmitting(true);
    setNewApplicationError(null);
    try {
      const created = await fetch(`/api/applications/${applicationId}/new-application`, { method: "POST" });
      const draft = (await created.json().catch(() => null)) as {
        error?: unknown;
        applicationId?: unknown;
        href?: unknown;
      } | null;
      if (!created.ok) {
        throw new Error(
          typeof draft?.error === "string" ? draft.error : `${t("resubmitError")} (${created.status})`,
        );
      }
      if (typeof draft?.applicationId !== "string" || typeof draft.href !== "string") {
        throw new Error(t("resubmitError"));
      }
      const queued = await fetch(`/api/applications/${draft.applicationId}/retry-submission`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "live_assisted", intent: "new_application" }),
      });
      const job = (await queued.json().catch(() => null)) as {
        error?: unknown;
        jobId?: unknown;
        alreadySubmitted?: unknown;
      } | null;
      if (!queued.ok) {
        throw new Error(
          typeof job?.error === "string" ? job.error : `${t("resubmitError")} (${queued.status})`,
        );
      }
      if (job?.alreadySubmitted === true || typeof job?.jobId !== "string") {
        throw new Error(t("resubmitError"));
      }
      router.push(draft.href);
    } catch (error) {
      setNewApplicationError(error instanceof Error ? error.message : String(error));
      setConfirmingResubmit(false);
    } finally {
      setResubmitting(false);
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
      setProofMessage(
        error instanceof ProofRequestTimeoutError
          ? t("proofTimeout")
          : error instanceof Error
            ? error.message
            : t("proofFailed"),
      );
    } finally {
      setProofBusy((prev) => ({ ...prev, [kind]: false }));
    }
  };

  const postProofAction = async (
    kind: Ds160ProofKind,
    action: "download",
  ): Promise<ProofActionResponse> => {
    const body: Record<string, unknown> = { kind, action };
    const { response, payload } = await requestProofJson<ProofActionResponse>(
      `/api/applications/${applicationId}/ds160-proof`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
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
      const { response, payload } = await requestProofJson<ProofActionResponse>(
        `/api/applications/${applicationId}/ds160-proof?kind=${encodeURIComponent(kind)}`,
        { cache: "no-store" },
      );
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

        {result.photoSkipped && (
          <Alert variant="warning" data-testid="ds160-photo-skipped">
            <AlertIcon variant="warning" />
            <AlertTitle>{t("photoSkippedTitle")}</AlertTitle>
            <AlertDescription>
              <p>{t("photoSkippedBody")}</p>
              <a
                className="mt-1 inline-flex items-center gap-1 underline"
                href="https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/photos.html"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("photoSkippedRequirements")}
                <ExternalLink className="h-3 w-3" />
              </a>
            </AlertDescription>
          </Alert>
        )}

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

        {submitted && (
          <div className="space-y-2">
            {confirmingResubmit ? (
              <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-medium text-amber-950">{t("resubmitConfirmTitle")}</p>
                <p className="text-sm leading-6 text-amber-950">{t("resubmitConfirmBody")}</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    className="w-full sm:flex-1"
                    onClick={() => void resubmitWithSameAnswers()}
                    disabled={!applicationId || resubmitting}
                  >
                    {resubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {resubmitting ? t("resubmitting") : t("resubmitConfirm")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:flex-1"
                    onClick={() => setConfirmingResubmit(false)}
                    disabled={resubmitting}
                  >
                    {t("resubmitCancel")}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                className="w-full"
                onClick={() => setConfirmingResubmit(true)}
                disabled={!applicationId || resubmitting || startingNewApplication}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                {t("resubmitSameAnswers")}
              </Button>
            )}
          </div>
        )}

        <Button asChild variant={submitted ? "outline" : "default"} className="w-full">
          <a href={result.retrievalUrl} target="_blank" rel="noopener noreferrer">
            {t(securityAnswer ? "openCeac" : "openCeacStatus")}
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>

        <div className="space-y-2">
          <Button
            type="button"
            variant={submitted ? "ghost" : "default"}
            className="w-full"
            onClick={startNewApplication}
            disabled={!applicationId || startingNewApplication || resubmitting}
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
