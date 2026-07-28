// @ts-nocheck - referral system removed during domain migration

"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { Loader2, CheckCircle2, UserPlus, Check } from "lucide-react";
import { useState, useEffect, Suspense } from "react";
import { useTranslations } from "next-intl";

const HERO_IMAGE = "/client-login2/58e1bfc000148c162a19e42110a24bd478a1e0fa.png";
const LOGO_IMAGE = "/client-login2/24bfd98899edee463a9f1be3a53d9572bd4d1a09.png";

function Background() {
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0 bg-gradient-to-b from-[#af714d] to-[#e9c5b1]" />
      <div className="absolute inset-0 bg-[rgba(0,0,0,0.1)] mix-blend-hard-light" />
      <div className="absolute blur-[16px]" style={{ left: "619px", top: "52px", width: "1599px", height: "1066px" }}>
        <Image src={HERO_IMAGE} alt="" fill priority sizes="1599px" className="object-cover object-top" />
      </div>
    </div>
  );
}

function RegisterContent() {
  const t = useTranslations("auth.register");
  const searchParams = useSearchParams();
  const inviteCode = searchParams.get("invite") || "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [cardScale, setCardScale] = useState(0.9);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setCardScale(mq.matches ? 0.9 : 1);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [validatingCode, setValidatingCode] = useState(false);
  const [referrerName, setReferrerName] = useState<string | null>(null);
  const [codeValid, setCodeValid] = useState<boolean | null>(null);

  useEffect(() => {
    if (!inviteCode) { setCodeValid(false); return; }
    setValidatingCode(true);
    validateReferralCode(inviteCode).then((r) => {
      setCodeValid(r.valid);
      setReferrerName(r.referrerName || null);
      setValidatingCode(false);
    });
  }, [inviteCode]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!agreedToTerms) { setError(t("pleaseAgree")); return; }
    if (!inviteCode || !codeValid) { setError(t("invalidReferralLink")); return; }
    setIsSubmitting(true);
    try {
      const result = await registerViaReferral(inviteCode, name, email);
      if (!result.success) { setError(result.error || t("registrationFailed")); setIsSubmitting(false); return; }
      setSuccess(true);
    } catch {
      setError(t("unexpectedError"));
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="relative overflow-hidden" style={{ minHeight: "100vh" }}>
        <Background />
        <div className="relative z-10 flex min-h-screen items-start p-4 sm:p-6 lg:h-screen lg:p-[60px]">
          <motion.section
            className="relative flex w-full max-w-[865px] flex-col items-center justify-center rounded-[16px] border border-[#efefef] bg-white p-10 min-h-[500px] lg:h-full"
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}
          >
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: "spring", stiffness: 200 }}>
              <CheckCircle2 className="h-16 w-16 text-[#a8644d]" />
            </motion.div>
            <motion.h2
              className="mt-6 text-center font-['Sofia_Pro',sans-serif] text-[28px] sm:text-[36px] font-normal leading-tight text-[#3d3d3d]"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            >
              {t("accountCreated")}
            </motion.h2>
            <motion.p
              className="mt-3 max-w-md text-center font-['Sofia_Pro',sans-serif] text-[16px] sm:text-[18px] leading-relaxed text-[rgba(0,0,0,0.55)]"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            >
              {t("accountCreatedMessage")}
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="mt-8">
              <Link href="/client/login" className="flex h-[50px] items-center justify-center rounded-[999px] bg-black px-10 font-['Sofia_Pro',sans-serif] text-[18px] font-medium text-white transition-opacity hover:opacity-80">
                {t("goToLogin")}
              </Link>
            </motion.div>
          </motion.section>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden" style={{ minHeight: "100vh" }}>
      <Background />

      <div className="relative z-10 flex min-h-screen items-start lg:h-screen lg:p-[60px]">
        <motion.section
          className="relative flex w-full flex-col justify-between bg-white px-4 py-[36px] lg:p-[60px] min-h-screen lg:min-h-0 lg:max-w-[865px] lg:rounded-[16px] lg:border lg:border-[#efefef] lg:h-[calc(100%/0.9)]"
          style={{ scale: cardScale, originX: 0, originY: 0 }}
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          {/* ── Logo ── */}
          <div className="relative h-[25px] w-[135px] shrink-0">
            <Image src={LOGO_IMAGE} alt="VIZA" fill priority className="object-contain object-left" />
          </div>

          {/* ── Content ── */}
          <div className="flex w-full flex-col gap-[24px] pb-[30px] lg:pb-[80px] shrink-0">

            {/* Referral badge / status */}
            {validatingCode ? (
              <div className="flex h-8 items-center gap-2 text-[rgba(0,0,0,0.55)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="font-['Sofia_Pro',sans-serif] text-[14px]">{t("validatingReferral")}</span>
              </div>
            ) : codeValid && referrerName ? (
              <motion.div
                className="flex h-8 w-fit shrink-0 items-center gap-2 rounded-[999px] bg-[#fdf5f1] px-3 py-[6px]"
                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              >
                <UserPlus className="h-5 w-5 shrink-0 text-[#a8644d]" />
                <span className="font-['Sofia_Pro',sans-serif] text-[12px] font-medium tracking-[-0.18px] text-[#a8644d] whitespace-nowrap">
                  {t("referredBy", { name: referrerName })}
                </span>
              </motion.div>
            ) : !inviteCode ? (
              <motion.p
                className="rounded-[12px] border border-[#f7c7ba] bg-[#ffe8e0] px-4 py-3 text-[13px] text-[#a13d2d]"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              >
                {t("noReferralCode")}
              </motion.p>
            ) : codeValid === false ? (
              <motion.p
                className="rounded-[12px] border border-[#f7c7ba] bg-[#ffe8e0] px-4 py-3 text-[13px] text-[#a13d2d]"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              >
                {t("invalidReferralCode")}
              </motion.p>
            ) : <div className="h-8 shrink-0" />}

            {/* Form section */}
            <div className="flex flex-col gap-[40px]">
              <div className="flex flex-col gap-[4px]">
                <h1 className="font-['Sofia_Pro',sans-serif] text-[32px] font-normal leading-[1.3] tracking-[-1px] lg:text-[56px] lg:tracking-[-1.68px] text-[#3d3d3d]">
                  {t("createAccount")}
                </h1>
                <p className="font-['Sofia_Pro',sans-serif] text-[16px] tracking-[-0.24px] lg:text-[24px] lg:tracking-[-0.36px] leading-[1.5] text-[rgba(0,0,0,0.55)]">
                  {t("alreadyHaveAccount")}{" "}
                  <Link href="/client/login" className="text-[#a8644d] underline decoration-solid">{t("logIn")}</Link>
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-[16px]">
                <input
                  type="text"
                  name="name"
                  placeholder={t("fullNamePlaceholder")}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                  disabled={isSubmitting || !codeValid}
                  className="h-[48px] lg:h-[65px] w-full rounded-[8px] border border-[#efefef] bg-white pl-[12px] lg:pl-[24px] pr-[12px] font-['Sofia_Pro',sans-serif] text-[14px] lg:text-[20px] tracking-[-0.21px] lg:tracking-[-0.3px] text-[#3d3d3d] placeholder:text-[#3d3d3d]/50 outline-none focus:border-[#3d3d3d] transition-colors disabled:opacity-50"
                />
                <input
                  type="email"
                  name="email"
                  placeholder={t("emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isSubmitting || !codeValid}
                  className="h-[48px] lg:h-[65px] w-full rounded-[8px] border border-[#efefef] bg-white pl-[12px] lg:pl-[24px] pr-[12px] font-['Sofia_Pro',sans-serif] text-[14px] lg:text-[20px] tracking-[-0.21px] lg:tracking-[-0.3px] text-[#3d3d3d] placeholder:text-[#3d3d3d]/50 outline-none focus:border-[#3d3d3d] transition-colors disabled:opacity-50"
                />

                <div className="flex flex-col gap-[16px]">
                  <button
                    type="submit"
                    disabled={isSubmitting || !codeValid}
                    className="flex h-[48px] lg:h-[50px] w-full items-center justify-center rounded-[999px] bg-black font-['Sofia_Pro',sans-serif] text-[16px] lg:text-[20px] font-medium tracking-[-0.24px] lg:tracking-[-0.3px] text-white transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting
                      ? <span className="flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" />{t("creatingAccount")}</span>
                      : t("signUpButton")}
                  </button>

                  <label className="flex cursor-pointer items-center gap-[8px]">
                    <div className="relative flex h-5 w-5 shrink-0 items-center justify-center">
                      <input
                        type="checkbox"
                        checked={agreedToTerms}
                        onChange={(e) => setAgreedToTerms(e.target.checked)}
                        disabled={isSubmitting || !codeValid}
                        className="h-5 w-5 cursor-pointer appearance-none rounded-[4px] border border-[#efefef] bg-white checked:bg-[#a8644d] checked:border-[#a8644d] transition-colors disabled:opacity-50"
                      />
                      {agreedToTerms && <Check className="pointer-events-none absolute h-3 w-3 text-white" />}
                    </div>
                    <span className="font-['Sofia_Pro',sans-serif] text-[16px] leading-[1.5] tracking-[-0.24px] text-[#737373]">
                      {t("agreeToTerms")}{" "}
                      <Link href="/terms" className="text-[#a8644d] underline decoration-solid" onClick={(e) => e.stopPropagation()}>{t("termsOfService")}</Link>
                      {" "}{t("and")}{" "}
                      <Link href="/privacy" className="text-[#a8644d] underline decoration-solid" onClick={(e) => e.stopPropagation()}>{t("privacyPolicy")}</Link>
                    </span>
                  </label>
                </div>

                {error && (
                  <motion.p
                    className="rounded-[12px] border border-[#f7c7ba] bg-[#ffe8e0] px-4 py-3 text-[14px] text-[#a13d2d]"
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  >
                    {error}
                  </motion.p>
                )}
              </form>
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="flex gap-[24px] font-['Sofia_Pro',sans-serif] text-[14px] lg:text-[16px] font-medium tracking-[-0.21px] lg:tracking-[-0.24px] leading-[1.5] text-[rgba(0,0,0,0.55)] shrink-0">
            <Link href="/privacy" className="whitespace-nowrap hover:opacity-70 transition-opacity">{t("privacyPolicy")}</Link>
            <Link href="/terms" className="whitespace-nowrap hover:opacity-70 transition-opacity">{t("termsOfService")}</Link>
          </div>
        </motion.section>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#af714d] to-[#e9c5b1]"><Loader2 className="h-8 w-8 animate-spin text-white" /></div>}>
      <RegisterContent />
    </Suspense>
  );
}
