"use client";

import { useState, type FormEvent } from "react";
import { motion } from "motion/react";
import { Loader2, Mail, Lock, Languages } from "lucide-react";
import { signIn } from "@/app/actions/auth";
import Image from "next/image";
import Link from "next/link";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { LOCALE_COOKIE, normalizeInterfaceLocale } from "@/lib/i18n/locale";

const COPY = {
  en: {
    title: "Admin Portal",
    subtitle: "Sign in to manage your workspace",
    email: "Email",
    password: "Password",
    forgotPassword: "Forgot password?",
    passwordPlaceholder: "Enter your password",
    signingIn: "Signing in...",
    signIn: "Sign In",
    privacy: "Privacy Policy",
    terms: "Terms of Service",
    language: "Language",
    english: "English",
    chinese: "中文",
  },
  zh: {
    title: "管理后台",
    subtitle: "登录以管理 VIZA 工作台",
    email: "邮箱",
    password: "密码",
    forgotPassword: "忘记密码？",
    passwordPlaceholder: "输入密码",
    signingIn: "正在登录...",
    signIn: "登录",
    privacy: "隐私政策",
    terms: "服务条款",
    language: "语言",
    english: "English",
    chinese: "中文",
  },
} as const;

export default function AdminLoginPage() {
  const locale = normalizeInterfaceLocale(useLocale());
  const copy = COPY[locale];
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const result = await signIn(formData);

    if (result?.error) {
      setError(result.error);
      setIsSubmitting(false);
    }
  };

  function setLocale(nextLocale: "en" | "zh") {
    document.cookie = `${LOCALE_COOKIE}=${nextLocale}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    router.refresh();
  }

  return (
    <div
      style={{
        height: "100vh",
        background: "linear-gradient(to bottom, #03346E, #3D6DAD)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "clamp(16px, 4vh, 64px)",
      }}
    >
      <motion.div
        className="relative flex w-full max-w-[420px] flex-col gap-[clamp(24px,4vh,48px)] rounded-[16px] bg-white px-[clamp(24px,3vw,40px)] py-[clamp(28px,4vh,48px)]"
        style={{ boxShadow: "0 8px 40px rgba(0, 0, 0, 0.15)" }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        {/* Logo */}
        <div className="flex flex-col items-start gap-[clamp(20px,3vh,36px)]">
          <Image
            src="/logo/viza-logo-blue.svg"
            alt="VIZA"
            width={80}
            height={24}
            priority
          />
          <div className="flex flex-col gap-[4px]">
            <h1 className="font-heading text-[clamp(22px,3vw,32px)] font-semibold leading-[1.3] tracking-[-0.5px] text-[#3d3d3d]">
              {copy.title}
            </h1>
            <p className="text-[clamp(12px,1.2vw,14px)] leading-[1.5] tracking-[-0.24px] text-[rgba(0,0,0,0.55)]">
              {copy.subtitle}
            </p>
          </div>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-[clamp(12px,1.8vh,18px)]"
        >
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email"
              className="text-[13px] font-medium text-[#374151]"
            >
              {copy.email}
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
              <input
                id="email"
                name="email"
                type="email"
                required
                autoFocus
                disabled={isSubmitting}
                placeholder="admin@viza.test"
                className="h-[clamp(38px,5vh,46px)] w-full rounded-[8px] border border-[#efefef] bg-white pl-10 pr-3 text-[clamp(12px,1vw,14px)] tracking-[-0.21px] text-[#3d3d3d] placeholder:text-[#3d3d3d]/50 outline-none transition-colors focus:border-[#3d3d3d] disabled:opacity-50"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="password"
                className="text-[13px] font-medium text-[#374151]"
              >
                {copy.password}
              </label>
              <Link
                href="/forgot-password"
                className="text-[12px] text-brand-500 hover:opacity-70 transition-opacity"
              >
                {copy.forgotPassword}
              </Link>
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
              <input
                id="password"
                name="password"
                type="password"
                required
                disabled={isSubmitting}
                placeholder={copy.passwordPlaceholder}
                className="h-[clamp(38px,5vh,46px)] w-full rounded-[8px] border border-[#efefef] bg-white pl-10 pr-3 text-[clamp(12px,1vw,14px)] tracking-[-0.21px] text-[#3d3d3d] placeholder:text-[#3d3d3d]/50 outline-none transition-colors focus:border-[#3d3d3d] disabled:opacity-50"
              />
            </div>
          </div>

          {error && (
            <motion.p
              className="rounded-[12px] border border-[#f7c7ba] bg-[#ffe8e0] px-4 py-2 text-[13px] text-[#a13d2d]"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {error}
            </motion.p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-1 flex h-[clamp(38px,5vh,44px)] w-full items-center justify-center rounded-[999px] bg-black text-[clamp(12px,1vw,14px)] font-medium tracking-[-0.24px] text-white transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {copy.signingIn}
              </span>
            ) : (
              copy.signIn
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="flex items-center gap-4 text-[clamp(10px,0.85vw,12px)] font-medium tracking-[-0.21px] leading-[1.5] text-[rgba(0,0,0,0.55)]">
          <Link
            href="/privacy"
            className="whitespace-nowrap hover:opacity-70 transition-opacity"
          >
            {copy.privacy}
          </Link>
          <Link
            href="/terms"
            className="whitespace-nowrap hover:opacity-70 transition-opacity"
          >
            {copy.terms}
          </Link>
          <div className="ml-auto flex items-center rounded-full border border-[#efefef] bg-white p-1">
            <span className="sr-only">{copy.language}</span>
            <Languages className="mx-1 h-3.5 w-3.5 text-[#6b7280]" />
            {(["en", "zh"] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLocale(code)}
                className={`rounded-full px-2 py-0.5 transition-colors ${
                  locale === code
                    ? "bg-brand-50 text-brand-500"
                    : "hover:bg-[#f5f5f5] hover:text-[#3d3d3d]"
                }`}
              >
                {code === "en" ? copy.english : copy.chinese}
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
