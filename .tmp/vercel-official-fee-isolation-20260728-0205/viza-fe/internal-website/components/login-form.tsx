"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { signIn } from "@/app/actions/auth";
import { AlertCircle, Loader2, Mail, Lock } from "lucide-react";

export function LoginForm() {
  const t = useTranslations("auth.loginForm");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const result = await signIn(formData);

    if (result?.error) {
      setError(result.error);
      setIsSubmitting(false);
    }
    // If successful, the server action will redirect
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Email Field */}
      <div className="space-y-2">
        <label
          htmlFor="email"
          className="text-[14px] font-medium text-[#3d3d3d]"
        >
          {t("email")}
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Mail className="h-4 w-4 text-[#b0b0b0]" />
          </div>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder={t("emailPlaceholder")}
            required
            disabled={isSubmitting}
            className="w-full pl-10 pr-4 py-2.5 rounded-[12px] border border-[#efefef] bg-white text-[14px] text-[#3d3d3d] placeholder:text-[#b0b0b0] outline-none focus:border-[#3d3d3d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
      </div>

      {/* Password Field */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label
            htmlFor="password"
            className="text-[14px] font-medium text-[#3d3d3d]"
          >
            {t("password")}
          </label>
          <Link
            href="/forgot-password"
            className="text-[13px] text-[#989898] hover:text-[#3d3d3d] transition-colors"
          >
            {t("forgotPassword")}
          </Link>
        </div>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Lock className="h-4 w-4 text-[#b0b0b0]" />
          </div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder={t("passwordPlaceholder")}
            required
            disabled={isSubmitting}
            className="w-full pl-10 pr-4 py-2.5 rounded-[12px] border border-[#efefef] bg-white text-[14px] text-[#3d3d3d] placeholder:text-[#b0b0b0] outline-none focus:border-[#3d3d3d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-start gap-3 p-3.5 bg-red-50 border border-red-200 rounded-[12px]">
          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-[14px] text-red-700 font-medium">{error}</p>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-full bg-black px-6 py-2.5 text-[14px] font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("signingIn")}
          </span>
        ) : (
          t("signIn")
        )}
      </button>
    </form>
  );
}
