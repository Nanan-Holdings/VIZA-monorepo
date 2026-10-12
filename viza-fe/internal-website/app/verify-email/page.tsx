"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Envelope as Mail, CircleNotch as Loader2, CheckCircle as CheckCircle2, WarningCircle as AlertCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export default function VerifyEmailPage() {
  const t = useTranslations("emailVerification");
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get("email") || "";
  const [email, setEmail] = useState(initialEmail);
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorKey, setErrorKey] = useState<"failed" | "rateLimited" | null>(null);

  useEffect(() => {
    if (!initialEmail) {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data }) => {
        if (data.user?.email) setEmail(data.user.email);
      });
    }
  }, [initialEmail]);

  const handleResend = async (): Promise<void> => {
    setResending(true);
    setResendStatus("idle");
    setErrorKey(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resend({ type: "signup", email });
      if (error) {
        setResendStatus("error");
        setErrorKey(error.status === 429 ? "rateLimited" : "failed");
      } else {
        setResendStatus("success");
      }
    } catch {
      setResendStatus("error");
      setErrorKey("failed");
    } finally {
      setResending(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#fafafa] px-6 py-10">
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
          <Mail className="h-6 w-6 text-brand-500" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground">{t("title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t.rich("sentTo", { email: email || t("inbox"), strong: (chunks) => <span className="font-medium text-foreground">{chunks}</span> })}
        </p>

        <div className="mt-6 w-full rounded-xl border border-input bg-white p-5 shadow-sm">
          <p className="text-xs text-muted-foreground">{t("notReceived")}</p>
          <Button
            type="button"
            variant="outline"
            onClick={handleResend}
            disabled={resending || !email}
            className="mt-3 w-full"
          >
            {resending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t("resend")}
          </Button>
          {resendStatus === "success" ? (
            <p className="mt-2 inline-flex items-center gap-1 text-xs text-brand-500">
              <CheckCircle2 className="h-3.5 w-3.5" /> {t("resent")}
            </p>
          ) : null}
          {resendStatus === "error" ? (
            <p className="mt-2 inline-flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5" /> {t(errorKey ?? "failed")}
            </p>
          ) : null}
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          {t("verified")}{" "}
          <Link href="/login" className="font-medium text-brand-500 hover:underline">
            {t("signIn")}
          </Link>
        </p>
      </div>
    </main>
  );
}
