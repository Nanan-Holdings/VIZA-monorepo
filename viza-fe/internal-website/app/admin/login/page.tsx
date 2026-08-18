"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { Eye, EyeSlash as EyeOff } from "@phosphor-icons/react";
import { useLocale } from "next-intl";
import { signIn } from "@/app/actions/auth";
import { AuthLanguageSwitcher } from "@/components/client/auth-language-switcher";
import { ActionButton } from "@/components/ui/action-button";
import { Alert, AlertDescription, AlertIcon } from "@/components/ui/alert";
import { ApplicationFormInputGroup } from "@/components/ui/application-form-input";
import { InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { normalizeInterfaceLocale } from "@/lib/i18n/locale";

const COPY = {
  en: {
    title: "Admin Portal",
    emailPlaceholder: "Work email address",
    passwordPlaceholder: "Password",
    forgotPassword: "Forgot password?",
    signingIn: "Signing in",
    signIn: "Sign in to Admin",
    privacy: "Privacy Policy",
    terms: "Terms of Service",
    disclaimer: "Disclaimer",
    showPassword: "Show password",
    hidePassword: "Hide password",
  },
  zh: {
    title: "管理后台",
    emailPlaceholder: "工作邮箱",
    passwordPlaceholder: "密码",
    forgotPassword: "忘记密码？",
    signingIn: "正在登录",
    signIn: "登录管理后台",
    privacy: "隐私政策",
    terms: "服务条款",
    disclaimer: "免责声明",
    showPassword: "显示密码",
    hidePassword: "隐藏密码",
  },
} as const;

export default function AdminLoginPage() {
  const locale = normalizeInterfaceLocale(useLocale());
  const copy = COPY[locale];
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const formData = new FormData(event.currentTarget);
    const result = await signIn(formData);
    if (result?.error) {
      setError(result.error);
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-gradient-to-b from-[#03346e] to-[#3d6dad] p-4 sm:p-8">
      <motion.section
        className="relative z-10 flex w-full max-w-[480px] flex-col rounded-[24px] bg-white px-6 py-8 shadow-[0_24px_90px_rgba(0,0,0,0.2)] sm:px-10 sm:py-10"
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="flex justify-center">
          <Image src="/logo/viza-logo-blue.svg" alt="VIZA" width={100} height={30} priority />
        </div>

        <motion.div
          className="mt-9 flex w-full flex-col gap-8"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.35 }}
        >
          <div className="text-center">
            <h1 className="text-[clamp(26px,6vw,34px)] font-normal leading-[1.2] tracking-[-1px] text-[#3d3d3d]">{copy.title}</h1>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-[clamp(12px,1.5vh,16px)]">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="portal" value="admin" />
            <ApplicationFormInputGroup className="h-12" filled={Boolean(email)}>
              <InputGroupInput
                type="email"
                name="email"
                placeholder={copy.emailPlaceholder}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoFocus
                autoComplete="email"
                disabled={isSubmitting}
                className="h-12 font-sans text-[15px] tracking-[-0.21px] text-[#3d3d3d] placeholder:text-[#3d3d3d]/50 disabled:opacity-50"
              />
            </ApplicationFormInputGroup>
            <div className="space-y-2">
              <ApplicationFormInputGroup className="h-12" filled={Boolean(password)}>
                <InputGroupInput
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder={copy.passwordPlaceholder}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete="current-password"
                  disabled={isSubmitting}
                  className="h-12 font-sans text-[15px] tracking-[-0.21px] text-[#3d3d3d] placeholder:text-[#3d3d3d]/50 disabled:opacity-50"
                />
                <InputGroupAddon align="inline-end" className="pr-4">
                  <InputGroupButton
                    size="icon-sm"
                    onClick={() => setShowPassword((value) => !value)}
                    className="rounded-full text-[#737373] hover:bg-[#f5f5f5]"
                    aria-label={showPassword ? copy.hidePassword : copy.showPassword}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </InputGroupButton>
                </InputGroupAddon>
              </ApplicationFormInputGroup>
              <Link href="/forgot-password" className="block text-right text-xs font-medium text-brand-500 underline-offset-2 hover:underline focus-visible:underline">
                {copy.forgotPassword}
              </Link>
            </div>
            {error ? (
              <Alert variant="destructive">
                <AlertIcon variant="destructive" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <ActionButton
              type="submit"
              size="lg"
              variant="primary"
              loading={isSubmitting}
              loadingText={copy.signingIn}
              disabled={isSubmitting || !email || !password}
              className="w-full font-sans tracking-[-0.24px]"
            >
              {copy.signIn}
            </ActionButton>
          </form>
        </motion.div>

        <footer className="mt-9 flex items-center justify-between gap-3 border-t border-[#efefef] pt-5 font-sans text-[10px] font-medium leading-[1.5] tracking-[-0.21px] text-black/55 sm:text-[11px]">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/privacy" className="whitespace-nowrap transition-opacity hover:opacity-70">{copy.privacy}</Link>
            <Link href="/terms" className="whitespace-nowrap transition-opacity hover:opacity-70">{copy.terms}</Link>
            <Link href="/disclaimer" className="whitespace-nowrap transition-opacity hover:opacity-70">{copy.disclaimer}</Link>
          </div>
          <div className="shrink-0">
            <AuthLanguageSwitcher />
          </div>
        </footer>
      </motion.section>
    </main>
  );
}
