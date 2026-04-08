"use client";

import { useState, type FormEvent } from "react";
import { motion } from "motion/react";
import { Loader2, Mail, Lock } from "lucide-react";
import { signIn } from "@/app/actions/auth";
import Image from "next/image";
import Link from "next/link";

export default function AdminLoginPage() {
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
              Admin Portal
            </h1>
            <p className="text-[clamp(12px,1.2vw,14px)] leading-[1.5] tracking-[-0.24px] text-[rgba(0,0,0,0.55)]">
              Sign in to manage your workspace
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
              Email
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
                placeholder="admin@viza.com"
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
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-[12px] text-brand-500 hover:opacity-70 transition-opacity"
              >
                Forgot password?
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
                placeholder="Enter your password"
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
                Signing in...
              </span>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="flex items-center gap-4 text-[clamp(10px,0.85vw,12px)] font-medium tracking-[-0.21px] leading-[1.5] text-[rgba(0,0,0,0.55)]">
          <Link
            href="/privacy"
            className="whitespace-nowrap hover:opacity-70 transition-opacity"
          >
            Privacy Policy
          </Link>
          <Link
            href="/terms"
            className="whitespace-nowrap hover:opacity-70 transition-opacity"
          >
            Terms of Service
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
