"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "@phosphor-icons/react";
import {
  acceptAdminRegistrationInvite,
  claimAdminRegistrationInvite,
  signInForAdminInvite,
} from "@/app/actions/admin-access";
import { ActionButton } from "@/components/ui/action-button";
import { AuthLanguageSwitcher } from "@/components/client/auth-language-switcher";
import { Alert, AlertDescription, AlertIcon } from "@/components/ui/alert";

type Locale = "en" | "zh";

const COPY = {
  en: {
    eyebrow: "VIZA internal portal",
    title: "Accept admin invitation",
    intro: "Use your verified email to activate a secure admin account. This link works once and expires after 24 hours.",
    email: "Email",
    emailHint: "The first email submitted binds this link.",
    claim: "Continue",
    claiming: "Checking invitation…",
    signInTitle: "Already have a VIZA account?",
    signInHint: "Sign in with the same verified email to accept the invitation. Existing customer data stays unchanged.",
    password: "Password",
    name: "Display name (optional)",
    signInAccept: "Sign in and activate",
    signingIn: "Activating…",
    newTitle: "Check your email",
    newHint: "We sent a verification email if this is a new account. Open it, set a password below, then return to this page.",
    newPassword: "Set admin password",
    complete: "Activate admin access",
    completing: "Activating…",
    success: "Admin access is active. Redirecting to the portal…",
    generic: "This invitation is invalid, expired, revoked, or already used.",
    privacy: "Privacy Policy",
    terms: "Terms of Service",
    back: "Back to admin login",
  },
  zh: {
    eyebrow: "VIZA 内部平台",
    title: "接受管理员邀请",
    intro: "请使用你的已验证邮箱启用安全的管理员账号。链接仅可使用一次，并在 24 小时后失效。",
    email: "邮箱",
    emailHint: "首次提交的邮箱会与此注册链接绑定。",
    claim: "继续",
    claiming: "正在检查邀请…",
    signInTitle: "已有 VIZA 账号？",
    signInHint: "使用同一已验证邮箱登录后接受邀请，现有客户资料不会改变。",
    password: "密码",
    name: "显示名称（可选）",
    signInAccept: "登录并启用",
    signingIn: "正在启用…",
    newTitle: "请检查邮箱",
    newHint: "如果这是新账号，我们已发送验证邮件。打开邮件后在下方设置密码，再返回此页面。",
    newPassword: "设置管理员密码",
    complete: "启用管理员权限",
    completing: "正在启用…",
    success: "管理员权限已启用，正在进入后台…",
    generic: "注册链接无效、已过期、已撤销或已使用。",
    privacy: "隐私政策",
    terms: "服务条款",
    back: "返回管理员登录",
  },
} as const;

export default function AdminRegistrationForm({
  locale,
  token,
  initialEmail = "",
  initiallyClaimed = false,
  initiallyInvalid = false,
}: {
  locale: Locale;
  token: string;
  initialEmail?: string;
  initiallyClaimed?: boolean;
  initiallyInvalid?: boolean;
}) {
  const copy = COPY[locale];
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [claimed, setClaimed] = useState(initiallyClaimed);
  const [invalid, setInvalid] = useState(initiallyInvalid || !token);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(invalid ? copy.generic : null);
  const [pending, setPending] = useState(false);

  const submitClaim = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !email) return;
    setPending(true);
    setError(null);
    const result = await claimAdminRegistrationInvite({ token, email, locale });
    if (!result.success) {
      setInvalid(true);
      setError(result.error);
    } else {
      setClaimed(true);
      setMessage(result.message);
    }
    setPending(false);
  };

  const submitExisting = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await signInForAdminInvite({ token, email, password, name, locale });
    if (!result.success) {
      setError(result.error);
      setPending(false);
      return;
    }
    setMessage(result.message);
    router.replace("/admin");
  };

  const submitNew = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await acceptAdminRegistrationInvite({ token, password, name, locale });
    if (!result.success) {
      setError(result.error);
      setPending(false);
      return;
    }
    setMessage(result.message);
    router.replace("/admin");
  };

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#fafafa] px-4 py-8 sm:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(3,52,110,0.12),transparent_42%),radial-gradient(circle_at_90%_80%,rgba(61,109,173,0.12),transparent_38%)]" />
      <section className="relative z-10 w-full max-w-xl rounded-2xl border border-[#d4e0f0] bg-white p-6 shadow-[0_24px_80px_rgba(3,52,110,0.12)] sm:p-10">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="font-heading text-xs font-semibold uppercase tracking-[0.18em] text-[#3d6dad]">{copy.eyebrow}</p>
            <h1 className="mt-2 font-heading text-3xl font-semibold tracking-[-0.04em] text-[#03346e]">{copy.title}</h1>
          </div>
          <ShieldCheck className="size-10 text-[#03346e]" weight="duotone" aria-hidden="true" />
        </div>

        <p className="text-sm leading-6 text-slate-600">{copy.intro}</p>

        {message ? (
          <Alert className="mt-6" variant="success"><AlertIcon variant="success" /><AlertDescription>{message}</AlertDescription></Alert>
        ) : null}
        {error ? (
          <Alert className="mt-6" variant="destructive"><AlertIcon variant="destructive" /><AlertDescription>{error}</AlertDescription></Alert>
        ) : null}

        {!invalid && !claimed ? (
          <form onSubmit={submitClaim} className="mt-8 space-y-4">
            <label className="block text-sm font-medium text-slate-700" htmlFor="invite-email">{copy.email}
              <input id="invite-email" name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-[#03346e] focus:ring-4 focus:ring-[#03346e]/10" />
            </label>
            <p className="text-xs text-slate-500">{copy.emailHint}</p>
            <ActionButton type="submit" size="lg" variant="primary" loading={pending} loadingText={copy.claiming} className="w-full rounded-full" disabled={pending || !token || !email}>{copy.claim}</ActionButton>
          </form>
        ) : !invalid ? (
          <div className="mt-8 space-y-6">
            <form onSubmit={submitExisting} className="space-y-4 rounded-xl border border-slate-200 bg-[#fafafa] p-5">
              <div><h2 className="font-heading text-lg font-semibold text-[#03346e]">{copy.signInTitle}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{copy.signInHint}</p></div>
              <input
                type="email"
                value={email}
                readOnly={Boolean(initialEmail)}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm text-slate-600 read-only:cursor-not-allowed"
                aria-label={copy.email}
              />
              <label className="block text-sm font-medium text-slate-700" htmlFor="existing-password">{copy.password}<input id="existing-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#03346e] focus:ring-4 focus:ring-[#03346e]/10" /></label>
              <label className="block text-sm font-medium text-slate-700" htmlFor="existing-name">{copy.name}<input id="existing-name" type="text" value={name} onChange={(event) => setName(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#03346e] focus:ring-4 focus:ring-[#03346e]/10" /></label>
              <ActionButton type="submit" variant="primary" loading={pending} loadingText={copy.signingIn} className="w-full rounded-full" disabled={pending || !email || !password}>{copy.signInAccept}</ActionButton>
            </form>

            <form onSubmit={submitNew} className="space-y-4 rounded-xl border border-[#d4e0f0] bg-[#eef3fa]/60 p-5">
              <div><h2 className="font-heading text-lg font-semibold text-[#03346e]">{copy.newTitle}</h2><p className="mt-1 text-xs leading-5 text-slate-600">{copy.newHint}</p></div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="new-name">{copy.name}<input id="new-name" type="text" value={name} onChange={(event) => setName(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#03346e] focus:ring-4 focus:ring-[#03346e]/10" /></label>
              <label className="block text-sm font-medium text-slate-700" htmlFor="new-password">{copy.newPassword}<input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#03346e] focus:ring-4 focus:ring-[#03346e]/10" /></label>
              <ActionButton type="submit" variant="primary" loading={pending} loadingText={copy.completing} className="w-full rounded-full" disabled={pending || password.length < 8}>{copy.complete}</ActionButton>
            </form>
          </div>
        ) : null}

        <footer className="mt-8 flex items-center justify-between border-t border-slate-100 pt-5 text-xs text-slate-500">
          <div className="flex items-center gap-3"><a href="/privacy" className="hover:text-[#03346e]">{copy.privacy}</a><a href="/terms" className="hover:text-[#03346e]">{copy.terms}</a></div>
          <div className="flex items-center gap-3"><a href="/admin/login" className="font-medium text-[#03346e] hover:underline">{copy.back}</a><AuthLanguageSwitcher /></div>
        </footer>
      </section>
    </main>
  );
}
