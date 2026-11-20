"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle as CheckCircle2, CircleNotch as Loader2, Key } from "@phosphor-icons/react";
import { useLocale } from "next-intl";
import {
  Alert,
  AlertAction,
  AlertActions,
  AlertDescription,
  AlertIcon,
  AlertTitle,
} from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isChineseLocale } from "@/lib/i18n/locale";

const FRANCE_VISAS_REGISTER_URL = "https://application-form.france-visas.gouv.fr/fv-fo-dde/";

type LinkState = "loading" | "unlinked" | "editing" | "saving" | "linked" | "error";

/**
 * Links the France-Visas login the applicant registered themselves. VIZA
 * signs in with it to fill the official form; it never creates the account
 * (the official registration has a CAPTCHA the applicant completes).
 */
export function FranceVisasAccountLink({
  applicationId,
  onLinkedChange,
}: {
  applicationId: string;
  onLinkedChange?: (linked: boolean) => void;
}) {
  const locale = useLocale();
  const isZh = isChineseLocale(locale);
  const [state, setState] = useState<LinkState>("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/applications/${encodeURIComponent(applicationId)}/france-visas-account`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { account?: unknown } | null) => {
        if (cancelled) return;
        const linked = Boolean(body?.account);
        setState(linked ? "linked" : "unlinked");
        onLinkedChange?.(linked);
      })
      .catch(() => {
        if (!cancelled) setState("unlinked");
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId, onLinkedChange]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("saving");
    setMessage(null);
    try {
      const response = await fetch(`/api/applications/${encodeURIComponent(applicationId)}/france-visas-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = (await response.json().catch(() => null)) as { email?: string | null; error?: string } | null;
      if (!response.ok) {
        setState("error");
        setMessage(
          response.status === 400
            ? isZh
              ? "请填写您在 France-Visas 注册时使用的邮箱和密码。"
              : "Enter the email and password you registered on France-Visas."
            : body?.error ?? (isZh ? "暂时无法保存，请稍后再试。" : "Could not save right now. Please try again."),
        );
        return;
      }
      setPassword("");
      setState("linked");
      setMessage(
        isZh
          ? `已关联 ${body?.email ?? "您的 France-Visas 账号"}。`
          : `Linked ${body?.email ?? "your France-Visas account"}.`,
      );
      onLinkedChange?.(true);
    } catch {
      setState("error");
      setMessage(isZh ? "暂时无法保存，请稍后再试。" : "Could not save right now. Please try again.");
    }
  }

  if (state === "loading") return null;

  const showForm = state === "unlinked" || state === "editing" || state === "saving" || state === "error";

  return (
    <Alert variant="info">
      <AlertIcon variant="info" />
      <AlertTitle>{isZh ? "France-Visas 账号" : "France-Visas account"}</AlertTitle>
      <AlertDescription>
        {state === "linked" ? (
          <>
            <p className="flex items-start gap-1.5 font-medium text-[#166534]">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {message ?? (isZh ? "已关联您的 France-Visas 账号。" : "Your France-Visas account is linked.")}
            </p>
            <AlertActions>
              <AlertAction onClick={() => { setMessage(null); setState("editing"); }}>
                <Key />
                {isZh ? "更换账号" : "Use another account"}
              </AlertAction>
            </AlertActions>
          </>
        ) : null}
        {showForm ? (
          <form onSubmit={handleSubmit} className="mt-1 space-y-3">
            <p>
              {isZh ? (
                <>
                  VIZA 会用您的 France-Visas 账号登录官网并填写申请表。请先在{" "}
                  <a href={FRANCE_VISAS_REGISTER_URL} target="_blank" rel="noreferrer" className="underline">
                    France-Visas 官网
                  </a>
                  {" "}注册并验证邮箱，然后在这里填写登录邮箱和密码。密码会加密保存，只用于登录官网。
                </>
              ) : (
                <>
                  VIZA signs in to France-Visas with your account to fill the official form. First register and verify
                  your email on{" "}
                  <a href={FRANCE_VISAS_REGISTER_URL} target="_blank" rel="noreferrer" className="underline">
                    France-Visas
                  </a>
                  , then enter the login here. The password is stored encrypted and only used to sign in.
                </>
              )}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="fv-account-email">{isZh ? "登录邮箱" : "Login email"}</Label>
                <Input
                  id="fv-account-email"
                  type="email"
                  autoComplete="username"
                  required
                  maxLength={70}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fv-account-password">{isZh ? "密码" : "Password"}</Label>
                <Input
                  id="fv-account-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  minLength={8}
                  maxLength={128}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
            </div>
            <AlertActions>
              <AlertAction type="submit" disabled={state === "saving"}>
                {state === "saving" ? <Loader2 className="animate-spin" /> : <Key />}
                {state === "saving" ? (isZh ? "保存中" : "Saving") : isZh ? "关联账号" : "Link account"}
              </AlertAction>
            </AlertActions>
            {state === "error" && message ? (
              <div role="alert" className="text-[13px] font-medium text-[hsl(0_72%_35%)]">
                {message}
              </div>
            ) : null}
          </form>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
