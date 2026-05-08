"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, ShieldCheck, ShieldOff, KeyRound, AlertCircle, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

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
  const [factors, setFactors] = useState<ExistingFactor[]>([]);
  const [draft, setDraft] = useState<EnrollmentDraft | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const loadFactors = async (): Promise<void> => {
    const { data, error: factorsErr } = await supabase.auth.mfa.listFactors();
    if (factorsErr) {
      setError(factorsErr.message);
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
        setError(enrolErr?.message ?? "Enrol failed");
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
        setError(challengeRes.error?.message ?? "Challenge failed");
        return;
      }
      const verifyRes = await supabase.auth.mfa.verify({
        factorId: draft.factorId,
        challengeId: challengeRes.data.id,
        code: code.replace(/\s+/g, ""),
      });
      if (verifyRes.error) {
        setError(verifyRes.error.message);
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
        setError(unenrolErr.message);
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
          <h1 className="text-2xl font-semibold text-foreground">Account security</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Two-factor authentication via a TOTP authenticator app (Google Authenticator, 1Password, Authy).
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
                  <ShieldCheck className="h-5 w-5 text-brand-500" /> TOTP enabled
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Factor {verifiedFactor.id.slice(0, 8)}… · status {verifiedFactor.status}
                </p>
              </div>
              <Button type="button" variant="outline" onClick={() => disableFactor(verifiedFactor.id)} disabled={pending}>
                <ShieldOff className="mr-2 h-4 w-4" /> Disable
              </Button>
            </div>
          ) : draft ? (
            <div className="space-y-4">
              <h2 className="inline-flex items-center gap-2 text-base font-semibold text-foreground">
                <KeyRound className="h-5 w-5 text-brand-500" /> Set up authenticator
              </h2>
              <p className="text-sm text-muted-foreground">
                Scan the QR code with your authenticator app, then enter the 6-digit code below to confirm.
              </p>
              <div
                className="rounded-md border border-input bg-white p-3"
                dangerouslySetInnerHTML={{ __html: draft.qrSvg }}
              />
              <details className="rounded-md border border-input bg-[#fafafa] px-3 py-2 text-xs text-muted-foreground">
                <summary className="cursor-pointer font-medium">Can&apos;t scan? Use this secret</summary>
                <code className="mt-2 block break-all rounded bg-white px-2 py-1 font-mono">{draft.secret}</code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => copyToClipboard(draft.secret)}
                >
                  <Copy className="mr-1 h-3.5 w-3.5" /> Copy
                </Button>
              </details>
              <div className="space-y-1">
                <Label htmlFor="totp-code">6-digit code</Label>
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
                  <p className="font-medium text-foreground">Recovery codes (shown once — save them now)</p>
                  <ul className="mt-2 grid grid-cols-2 gap-1 font-mono">
                    {recoveryCodes.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDraft(null)}>
                  Cancel
                </Button>
                <Button type="button" onClick={verifyEnrol} disabled={pending || code.length !== 6} className="bg-brand-500 hover:bg-brand-400">
                  {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Verify &amp; enable
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">TOTP not configured</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add a second factor to protect your account.
                </p>
              </div>
              <Button type="button" onClick={beginEnrol} disabled={pending} className="bg-brand-500 hover:bg-brand-400">
                {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Enable TOTP
              </Button>
            </div>
          )}
        </section>

        <p className="text-xs text-muted-foreground">
          Lost both your device and your recovery codes?{" "}
          <Link href="/account-recovery" className="font-medium text-brand-500 hover:underline">
            Account recovery
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
