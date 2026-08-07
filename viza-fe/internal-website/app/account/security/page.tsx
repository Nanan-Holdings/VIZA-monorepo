"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { Loader2, ShieldCheck, ShieldOff, KeyRound, AlertCircle, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { getSecurityCopy } from "./copy";

interface EnrollmentDraft {
  factorId: string;
  qrSvg: string;
  uri: string;
  secret: string;
}

interface ExistingFactor {
  id: string;
  status: string;
  friendlyName: string | null;
}

const RECOVERY_CODE_COUNT = 8;

function generateRecoveryCodes(count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    out.push(`${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}`);
  }
  return out;
}

export default function AccountSecurityPage() {
  const supabase = createClient();
  const locale = useLocale();
  const copy = getSecurityCopy(locale);
  const [factors, setFactors] = useState<ExistingFactor[]>([]);
  const [draft, setDraft] = useState<EnrollmentDraft | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const loadFactors = async (): Promise<void> => {
    const { data, error: factorsErr } = await supabase.auth.mfa.listFactors();
    if (factorsErr) {
      setError(copy.errors.loadFactors);
      return;
    }
    const totp = data?.totp ?? [];
    setFactors(
      totp.map((f) => ({
        id: f.id,
        status: f.status,
        friendlyName: f.friendly_name ?? null,
      })),
    );
  };

  useEffect(() => {
    void loadFactors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const beginEnrol = (): void => {
    setError(null);
    startTransition(async () => {
      const { data, error: enrolErr } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (enrolErr || !data) {
        setError(copy.errors.enroll);
        return;
      }
      setDraft({
        factorId: data.id,
        qrSvg: data.totp.qr_code,
        uri: data.totp.uri,
        secret: data.totp.secret,
      });
      setRecoveryCodes(generateRecoveryCodes(RECOVERY_CODE_COUNT));
    });
  };

  const verifyEnrol = (): void => {
    if (!draft) return;
    setError(null);
    startTransition(async () => {
      const challengeRes = await supabase.auth.mfa.challenge({ factorId: draft.factorId });
      if (challengeRes.error || !challengeRes.data) {
        setError(copy.errors.challenge);
        return;
      }
      const verifyRes = await supabase.auth.mfa.verify({
        factorId: draft.factorId,
        challengeId: challengeRes.data.id,
        code: code.replace(/\s+/g, ""),
      });
      if (verifyRes.error) {
        setError(copy.errors.verify);
        return;
      }
      setDraft(null);
      setCode("");
      await loadFactors();
    });
  };

  const disableFactor = (factorId: string): void => {
    setError(null);
    startTransition(async () => {
      const { error: unenrolErr } = await supabase.auth.mfa.unenroll({ factorId });
      if (unenrolErr) {
        setError(copy.errors.disable);
        return;
      }
      await loadFactors();
    });
  };

  const copyToClipboard = async (text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore — fallback is user-driven copy
    }
  };

  const verifiedFactor = factors.find((f) => f.status === "verified");

  return (
    <main className="min-h-screen bg-[#fafafa] px-6 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-foreground">{copy.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {copy.description}
          </p>
        </header>

        {error ? (
          <p className="inline-flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" /> {error}
          </p>
        ) : null}

        <section className="rounded-xl border border-input bg-white p-5 shadow-sm">
          {verifiedFactor ? (
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="inline-flex items-center gap-2 text-base font-semibold text-foreground">
                  <ShieldCheck className="h-5 w-5 text-brand-500" /> {copy.enabled}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {copy.factorStatus(verifiedFactor.id.slice(0, 8), verifiedFactor.status)}
                </p>
              </div>
              <Button type="button" variant="outline" onClick={() => disableFactor(verifiedFactor.id)} disabled={pending}>
                <ShieldOff className="mr-2 h-4 w-4" /> {copy.disable}
              </Button>
            </div>
          ) : draft ? (
            <div className="space-y-4">
              <h2 className="inline-flex items-center gap-2 text-base font-semibold text-foreground">
                <KeyRound className="h-5 w-5 text-brand-500" /> {copy.setup}
              </h2>
              <p className="text-sm text-muted-foreground">
                {copy.setupDescription}
              </p>
              <div
                className="rounded-md border border-input bg-white p-3"
                dangerouslySetInnerHTML={{ __html: draft.qrSvg }}
              />
              <details className="rounded-md border border-input bg-[#fafafa] px-3 py-2 text-xs text-muted-foreground">
                <summary className="cursor-pointer font-medium">{copy.cannotScan}</summary>
                <code className="mt-2 block break-all rounded bg-white px-2 py-1 font-mono">{draft.secret}</code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => copyToClipboard(draft.secret)}
                >
                  <Copy className="mr-1 h-3.5 w-3.5" /> {copy.copy}
                </Button>
              </details>
              <div className="space-y-1">
                <Label htmlFor="totp-code">{copy.codeLabel}</Label>
                <Input
                  id="totp-code"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="123456"
                />
              </div>
              {recoveryCodes ? (
                <div className="rounded-md border border-input bg-[#fafafa] p-3 text-xs">
                  <p className="font-medium text-foreground">{copy.recoveryCodes}</p>
                  <ul className="mt-2 grid grid-cols-2 gap-1 font-mono">
                    {recoveryCodes.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDraft(null)}>
                  {copy.cancel}
                </Button>
                <Button type="button" onClick={verifyEnrol} disabled={pending || code.length !== 6} className="bg-brand-500 hover:bg-brand-400">
                  {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {copy.verifyEnable}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">{copy.notConfigured}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {copy.notConfiguredDescription}
                </p>
              </div>
              <Button type="button" onClick={beginEnrol} disabled={pending} className="bg-brand-500 hover:bg-brand-400">
                {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {copy.enable}
              </Button>
            </div>
          )}
        </section>

        <p className="text-xs text-muted-foreground">
          {copy.recoveryHelp}{" "}
          <Link href="/account-recovery" className="font-medium text-brand-500 hover:underline">
            {copy.recoveryLink}
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
