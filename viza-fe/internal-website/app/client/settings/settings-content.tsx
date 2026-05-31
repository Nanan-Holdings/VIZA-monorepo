"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  ArrowRight,
  Banknote,
  Check,
  ChevronRight,
  CircleHelp,
  CreditCard,
  Database,
  Globe2,
  Headphones,
  KeyRound,
  Loader2,
  LockKeyhole,
  LogOut,
  Mail,
  MessageCircle,
  ReceiptText,
  ShieldCheck,
  UserRound,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { PrivacyTab } from "./components/privacy-tab";

type PaymentPreference = "card" | "bank_transfer" | "wechat_pay";

interface ApplicantSettingsProfile {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  passport_number: string | null;
}

const PAYMENT_STORAGE_KEY = "viza.settings.paymentPreference";

const paymentMethods: Array<{
  id: PaymentPreference;
  icon: LucideIcon;
  accentClass: string;
}> = [
  {
    id: "card",
    icon: CreditCard,
    accentClass: "from-brand-700 to-brand-500",
  },
  {
    id: "bank_transfer",
    icon: Banknote,
    accentClass: "from-slate-900 to-slate-700",
  },
  {
    id: "wechat_pay",
    icon: MessageCircle,
    accentClass: "from-emerald-700 to-emerald-500",
  },
];

function initialsFromName(name: string, fallback: string) {
  const source = name.trim() || fallback.trim();
  if (!source) return "V";

  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

function obfuscatePassport(value: string | null) {
  if (!value) return null;
  if (value.length <= 4) return value;
  return `••${value.slice(-4)}`;
}

function SettingsRow({
  icon: Icon,
  title,
  description,
  href,
  badge,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-[72px] items-center gap-4 border-b border-border px-1 py-4 last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold text-foreground">
          {title}
        </span>
        <span className="mt-1 block text-sm leading-5 text-muted-foreground">
          {description}
        </span>
      </span>
      {badge ? (
        <span className="hidden rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 sm:inline-flex">
          {badge}
        </span>
      ) : null}
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-foreground sm:text-2xl">
        {title}
      </h2>
      <div className="rounded-xl border bg-white px-4 shadow-sm sm:px-5">
        {children}
      </div>
    </section>
  );
}

export function SettingsContent() {
  const router = useRouter();
  const t = useTranslations("settings");
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<ApplicantSettingsProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [paymentPreference, setPaymentPreference] =
    useState<PaymentPreference>("card");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [securityMessage, setSecurityMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    const storedPreference = window.localStorage.getItem(PAYMENT_STORAGE_KEY);
    if (
      storedPreference === "card" ||
      storedPreference === "bank_transfer" ||
      storedPreference === "wechat_pay"
    ) {
      setPaymentPreference(storedPreference);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadSettings() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/client/login");
        return;
      }

      const { data } = await supabase
        .from("applicant_profiles")
        .select("full_name, email, phone, passport_number")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!mounted) return;

      setEmail(user.email ?? "");
      setProfile((data ?? null) as ApplicantSettingsProfile | null);
      setIsLoading(false);
    }

    void loadSettings();

    return () => {
      mounted = false;
    };
  }, [router]);

  const displayName = profile?.full_name?.trim() || email || t("profile.fallbackName");
  const profileCompletion = useMemo(() => {
    const fields = [
      profile?.full_name,
      profile?.email ?? email,
      profile?.phone,
      profile?.passport_number,
    ];
    return Math.round((fields.filter(Boolean).length / fields.length) * 100);
  }, [email, profile]);

  function updatePaymentPreference(nextPreference: PaymentPreference) {
    setPaymentPreference(nextPreference);
    window.localStorage.setItem(PAYMENT_STORAGE_KEY, nextPreference);
  }

  async function handlePasswordUpdate() {
    setSecurityMessage(null);

    if (newPassword.length < 8) {
      setSecurityMessage({ tone: "error", text: t("security.tooShort") });
      return;
    }

    if (newPassword !== confirmPassword) {
      setSecurityMessage({ tone: "error", text: t("security.mismatch") });
      return;
    }

    setIsUpdatingPassword(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setIsUpdatingPassword(false);

    if (error) {
      setSecurityMessage({ tone: "error", text: t("security.failed") });
      return;
    }

    setNewPassword("");
    setConfirmPassword("");
    setSecurityMessage({ tone: "success", text: t("security.updated") });
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/client/login");
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-brand-500" />
        <p className="text-lg text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1040px] pb-16">
      <section className="grid gap-5 pt-4 lg:grid-cols-[1.25fr_0.75fr]">
        <motion.div
          className="overflow-hidden rounded-xl border bg-white shadow-sm"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div className="h-24 bg-gradient-to-br from-brand-700 via-brand-500 to-brand-300" />
          <div className="-mt-10 p-5 sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-end gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-brand-50 text-2xl font-semibold text-brand-700 shadow-sm">
                  {initialsFromName(displayName, email)}
                </div>
                <div className="pb-1">
                  <p className="text-2xl font-semibold text-foreground sm:text-3xl">
                    {displayName}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{email}</p>
                </div>
              </div>
              <Button asChild className="h-11 rounded-full">
                <Link href="/client/universal-info">
                  {t("profile.editDetails")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="mt-6 rounded-lg border bg-brand-50/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-brand-900">
                    {t("profile.completion")}
                  </p>
                  <p className="mt-1 text-sm text-brand-700">
                    {t("profile.completionHint")}
                  </p>
                </div>
                <span className="text-2xl font-semibold text-brand-700">
                  {profileCompletion}%
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-brand-500 transition-all duration-500"
                  style={{ width: `${profileCompletion}%` }}
                />
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="rounded-xl border bg-white p-5 shadow-sm sm:p-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05 }}
        >
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-500">
            {t("quickSnapshot.label")}
          </p>
          <dl className="mt-4 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <dt className="text-sm text-muted-foreground">{t("quickSnapshot.passport")}</dt>
              <dd className="text-right text-sm font-semibold text-foreground">
                {obfuscatePassport(profile?.passport_number ?? null) ?? t("quickSnapshot.notSet")}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-sm text-muted-foreground">{t("quickSnapshot.phone")}</dt>
              <dd className="text-right text-sm font-semibold text-foreground">
                {profile?.phone || t("quickSnapshot.notSet")}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-sm text-muted-foreground">{t("quickSnapshot.payment")}</dt>
              <dd className="text-right text-sm font-semibold text-foreground">
                {t(`payment.methods.${paymentPreference}.title`)}
              </dd>
            </div>
          </dl>
        </motion.div>
      </section>

      <section className="mt-8 space-y-4">
        <div>
          <h1 className="text-3xl font-semibold text-foreground sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-7 text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {paymentMethods.map((method, index) => {
            const Icon = method.icon;
            const selected = paymentPreference === method.id;

            return (
              <motion.button
                key={method.id}
                type="button"
                onClick={() => updatePaymentPreference(method.id)}
                className={cn(
                  "group min-h-[176px] rounded-xl border bg-white p-5 text-left shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected
                    ? "border-brand-300 ring-1 ring-brand-200"
                    : "hover:border-brand-200 hover:shadow-md"
                )}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: index * 0.04 }}
              >
                <span
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br text-white",
                    method.accentClass
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="mt-5 flex items-start justify-between gap-3">
                  <span>
                    <span className="block text-lg font-semibold text-foreground">
                      {t(`payment.methods.${method.id}.title`)}
                    </span>
                    <span className="mt-2 block text-sm leading-6 text-muted-foreground">
                      {t(`payment.methods.${method.id}.description`)}
                    </span>
                  </span>
                  {selected ? (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white">
                      <Check className="h-4 w-4" />
                    </span>
                  ) : null}
                </span>
                <span className="mt-4 inline-flex text-sm font-semibold text-brand-600">
                  {selected ? t("payment.selected") : t("payment.setDefault")}
                </span>
              </motion.button>
            );
          })}
        </div>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-8">
          <SectionCard title={t("sections.general")}>
            <SettingsRow
              icon={Database}
              title={t("rows.universalInfo.title")}
              description={t("rows.universalInfo.description")}
              href="/client/universal-info"
              badge={t("rows.universalInfo.badge")}
            />
            <SettingsRow
              icon={UserRound}
              title={t("rows.account.title")}
              description={t("rows.account.description")}
              href="/client/universal-info"
            />
            <SettingsRow
              icon={Globe2}
              title={t("rows.language.title")}
              description={t("rows.language.description")}
              href="/client/help/getting-started/complete-your-profile"
            />
          </SectionCard>

          <SectionCard title={t("sections.payments")}>
            <SettingsRow
              icon={WalletCards}
              title={t("rows.paymentMethods.title")}
              description={t("rows.paymentMethods.description")}
              href="/client/help/getting-started/add-a-payment-method"
              badge={t("rows.paymentMethods.badge")}
            />
            <SettingsRow
              icon={ReceiptText}
              title={t("rows.billing.title")}
              description={t("rows.billing.description")}
              href="/client/billing"
            />
          </SectionCard>

          <SectionCard title={t("sections.support")}>
            <SettingsRow
              icon={CircleHelp}
              title={t("rows.helpCenter.title")}
              description={t("rows.helpCenter.description")}
              href="/client/help"
            />
            <SettingsRow
              icon={Headphones}
              title={t("rows.feedback.title")}
              description={t("rows.feedback.description")}
              href="/client/support"
            />
          </SectionCard>
        </div>

        <div className="space-y-8">
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground sm:text-2xl">
              {t("security.title")}
            </h2>
            <div className="rounded-xl border bg-white p-5 shadow-sm sm:p-6">
              <div className="flex gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
                  <LockKeyhole className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-base font-semibold text-foreground">
                    {t("security.passwordTitle")}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {t("security.description")}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {t("security.newPassword")}
                  </span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    className="h-12 rounded-lg border bg-white px-4 text-base outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {t("security.confirmPassword")}
                  </span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="h-12 rounded-lg border bg-white px-4 text-base outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  />
                </label>

                {securityMessage ? (
                  <p
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm font-medium",
                      securityMessage.tone === "success"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-red-200 bg-red-50 text-red-700"
                    )}
                    role="status"
                    aria-live="polite"
                  >
                    {securityMessage.text}
                  </p>
                ) : null}

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    className="h-11 rounded-full"
                    onClick={handlePasswordUpdate}
                    disabled={isUpdatingPassword}
                  >
                    {isUpdatingPassword ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <KeyRound className="h-4 w-4" />
                    )}
                    {isUpdatingPassword ? t("security.saving") : t("security.updatePassword")}
                  </Button>
                  <Button asChild variant="outline" className="h-11 rounded-full">
                    <Link href="/client/help/privacy-and-security/account-security-tips">
                      <ShieldCheck className="h-4 w-4" />
                      {t("security.guide")}
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground sm:text-2xl">
              {t("account.title")}
            </h2>
            <div className="rounded-xl border bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
                  <Mail className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    {t("account.email")}
                  </p>
                  <p className="mt-1 break-all text-base font-semibold text-foreground">
                    {email}
                  </p>
                </div>
              </div>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={handleSignOut}
                >
                  <LogOut className="h-4 w-4" />
                  {t("signOut.button")}
                </Button>
              </div>
            </div>
          </section>
        </div>
      </div>

      <section className="mt-10" id="privacy">
        <PrivacyTab />
      </section>
    </div>
  );
}
