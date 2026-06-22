"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  CalendarCheck,
  ExternalLink,
  Copy,
  Check,
  ShieldCheck,
  Printer,
  Mail,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { UsSubmissionResult } from "@/lib/submission-result";
import type { Ds160ProofKind } from "@/lib/ds160-proof";

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

function ProofActionButton({
  busy,
  label,
  onClick,
  children,
}: {
  busy: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button type="button" variant="outline" className="justify-start" onClick={onClick} disabled={busy}>
      {busy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : children}
      <span className="ml-2 truncate">{label}</span>
    </Button>
  );
}

type ProofBusyState = Partial<Record<Ds160ProofKind, boolean>>;

type ProofActionResponse = {
  ok?: boolean;
  status?: "ready" | "queued" | "sent" | "unsupported" | "failed";
  downloadUrl?: string;
  recipient?: string;
  message?: string;
  error?: string;
};

export function UsResultCard({
  applicationId,
  result,
}: {
  applicationId?: string;
  result: UsSubmissionResult;
}) {
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
  const [proofError, setProofError] = useState<string | null>(null);
  const [emailPanelOpen, setEmailPanelOpen] = useState(false);
  const [customEmail, setCustomEmail] = useState("");

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

  const requestProof = async (
    kind: Ds160ProofKind,
    action: "download" | "email",
    emailMode?: "account" | "custom",
  ) => {
    if (!applicationId || proofBusy[kind]) return;
    setProofBusy((prev) => ({ ...prev, [kind]: true }));
    setProofError(null);
    setProofMessage(t("proofPreparing"));
    try {
      const payload = await postProofAction(kind, action, emailMode);
      if (payload.status === "ready" && payload.downloadUrl) {
        window.open(payload.downloadUrl, "_blank", "noopener,noreferrer");
        setProofMessage(t("proofReady"));
        return;
      }
      if (payload.status === "sent") {
        setProofMessage(t("proofEmailSent", { email: payload.recipient ?? "" }));
        return;
      }
      if (payload.status === "queued") {
        setProofMessage(t("proofQueued"));
        const ready = await waitForProofReady(kind);
        if (action === "download") {
          if (ready.downloadUrl) {
            window.open(ready.downloadUrl, "_blank", "noopener,noreferrer");
            setProofMessage(t("proofReady"));
          }
        } else {
          const sent = await postProofAction(kind, "email", emailMode);
          setProofMessage(t("proofEmailSent", { email: sent.recipient ?? "" }));
        }
      }
    } catch (error) {
      setProofMessage(null);
      setProofError(error instanceof Error ? error.message : String(error));
    } finally {
      setProofBusy((prev) => ({ ...prev, [kind]: false }));
    }
  };

  const postProofAction = async (
    kind: Ds160ProofKind,
    action: "download" | "email",
    emailMode?: "account" | "custom",
  ): Promise<ProofActionResponse> => {
    const response = await fetch(`/api/applications/${applicationId}/ds160-proof`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        action,
        emailMode,
        email: emailMode === "custom" ? customEmail : undefined,
      }),
    });
    const payload = (await response.json().catch(() => null)) as ProofActionResponse | null;
    if (!response.ok) {
      throw new Error(payload?.error ?? `${t("proofFailed")} (${response.status})`);
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
        throw new Error(payload?.error ?? `${t("proofFailed")} (${response.status})`);
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
              >
                <Mail className="h-4 w-4 shrink-0" />
              </ProofActionButton>
            </div>
            {emailPanelOpen && (
              <div className="mt-3 rounded-md border border-input bg-muted/30 p-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                  <input
                    className="min-h-10 rounded-md border border-input bg-background px-3 text-sm outline-none"
                    placeholder={t("customEmailPlaceholder")}
                    value={customEmail}
                    onChange={(event) => setCustomEmail(event.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void requestProof("email-confirmation", "email", "account")}
                    disabled={Boolean(proofBusy["email-confirmation"])}
                  >
                    {t("sendToAccountEmail")}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void requestProof("email-confirmation", "email", "custom")}
                    disabled={Boolean(proofBusy["email-confirmation"])}
                  >
                    {t("sendToCustomEmail")}
                  </Button>
                </div>
              </div>
            )}
            {proofMessage && (
              <p className="mt-3 text-sm text-muted-foreground">{proofMessage}</p>
            )}
            {proofError && (
              <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {proofError}
              </div>
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
