"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  ArrowRight,
  Check,
  CaretRight as ChevronRight,
  Question as CircleHelp,
  Coins,
  Database,
  Gift,
  GlobeHemisphereWest as Globe2,
  Headphones,
  IdentificationCard as IdCard,
  Key as KeyRound,
  CircleNotch as Loader2,
  LockKey as LockKeyhole,
  SignOut as LogOut,
  Envelope as Mail,
  ChatCircle as MessageCircle,
  ShieldCheck,
  Sparkle as Sparkles,
  SealPercent as TicketPercent,
  Trophy,
  Phone,
  UserCircle as UserRound,
  UsersThree as UsersRound,
  type Icon as PhosphorIcon,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ActionButton } from "@/components/ui/action-button";
import { ApplicationFormPanel } from "@/components/ui/application-form-panel";
import { ClientErrorAlert } from "@/components/client/client-error-alert";
import { Button } from "@/components/ui/button";
import { PageBackButton } from "@/components/ui/page-back-button";
import { prepareAuthEmailLocale } from "@/app/actions/client-auth";
import { normalizeAuthEmailLocale } from "@/lib/i18n/locale";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { FrequentTravelersTab } from "./components/frequent-travelers-tab";
import { PrivacyTab } from "./components/privacy-tab";

type SecurityPanel = "password" | "email" | null;
type SettingsView =
  | "home"
  | "points"
  | "travelers"
  | "privacy"
  | "security-password"
  | "security-email";

interface ApplicantSettingsProfile {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  passport_number: string | null;
}

interface RewardWalletSummary {
  balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
}

const rewardItems = [
  {
    key: "arrivalCardSubmission",
    cost: 1000,
    icon: TicketPercent,
    countriesKey: "pointsCenter.rewards.arrivalCardSubmission.countries",
  },
  { key: "priorityChecklist", cost: 199, icon: Sparkles },
  { key: "consultationCredit", cost: 499, icon: Gift },
] as const;

function SettingsRow({
  icon: Icon,
  title,
  description,
  href,
  onClick,
  badge,
  isActive,
  ariaControls,
}: {
  icon: PhosphorIcon;
  title: string;
  description: string;
  href?: string;
  onClick?: () => void;
  badge?: string;
  isActive?: boolean;
  ariaControls?: string;
}) {
  const content = (
    <>
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
      <ChevronRight
        className={cn(
          "h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5",
          isActive && "rotate-90 text-brand-500 group-hover:translate-x-0"
        )}
      />
    </>
  );

  const className =
    "group flex min-h-[72px] items-center gap-4 border-b border-border px-1 py-4 last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(className, "w-full text-left")}
        aria-expanded={typeof isActive === "boolean" ? isActive : undefined}
        aria-controls={ariaControls}
      >
        {content}
      </button>
    );
  }

  return (
    <Link href={href ?? "#"} className={className}>
      {content}
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
      <ApplicationFormPanel aria-label={title} className="px-4 sm:px-5">
        {children}
      </ApplicationFormPanel>
    </section>
  );
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function getPasswordChecks(password: string) {
  const checks = {
    length: password.length >= 8,
    letter: /[A-Za-z]/.test(password),
    digit: /\d/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };

  return {
    ...checks,
    isValid: checks.length && checks.letter && checks.digit && checks.symbol,
  };
}

function settingsTitleKey(view: SettingsView) {
  if (view === "points") return "rows.pointsCenter.title";
  if (view === "travelers") return "rows.travelers.title";
  if (view === "privacy") return "privacy.title";
  if (view === "security-password") return "security.passwordTitle";
  if (view === "security-email") return "security.emailTitle";
  return "title";
}

function initialSecurityPanel(view: SettingsView): SecurityPanel {
  if (view === "security-password") return "password";
  if (view === "security-email") return "email";
  return null;
}

export function SettingsContent({ view = "home" }: { view?: SettingsView }) {
  const router = useRouter();
  const t = useTranslations("settings");
  const locale = useLocale();
  const isZh = locale.toLowerCase().startsWith("zh");
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<ApplicantSettingsProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSecurityPanel] = useState<SecurityPanel>(initialSecurityPanel(view));
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [securityVerified, setSecurityVerified] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [securityMessage, setSecurityMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const [rewardWallet, setRewardWallet] = useState<RewardWalletSummary>({
    balance: 0,
    lifetime_earned: 0,
    lifetime_spent: 0,
  });

  useEffect(() => {
    let mounted = true;

    async function loadSettings() {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;

      if (!user) {
        router.replace("/client/login");
        return;
      }

      // These independent reads used to run serially after an extra remote
      // auth validation. RLS still validates the access token on both queries.
      const [{ data }, { data: walletData }] = await Promise.all([
        supabase
          .from("applicant_profiles")
          .select("full_name, email, phone, passport_number")
          .eq("auth_user_id", user.id)
          .maybeSingle(),
        supabase
          .from("reward_wallets")
          .select("balance, lifetime_earned, lifetime_spent")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      if (!mounted) return;

      setEmail(user.email ?? "");
      setProfile((data ?? null) as ApplicantSettingsProfile | null);
      setRewardWallet({
        balance: walletData?.balance ?? 0,
        lifetime_earned: walletData?.lifetime_earned ?? 0,
        lifetime_spent: walletData?.lifetime_spent ?? 0,
      });
      setIsLoading(false);
    }

    void loadSettings();

    return () => {
      mounted = false;
    };
  }, [router]);

  const profileCompletion = useMemo(() => {
    const fields = [
      profile?.full_name,
      profile?.email ?? email,
      profile?.phone,
      profile?.passport_number,
    ];
    return Math.round((fields.filter(Boolean).length / fields.length) * 100);
  }, [email, profile]);

  const passwordChecks = getPasswordChecks(newPassword);
  const pointsFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        maximumFractionDigits: 0,
      }),
    [locale]
  );

  async function handleSendVerificationCode() {
    setSecurityMessage(null);

    if (!email || !isValidEmail(email)) {
      setSecurityMessage({ tone: "error", text: t("security.emailMissing") });
      return;
    }

    setIsSendingVerification(true);
    const supabase = createClient();
    const normalizedEmail = email.toLowerCase().trim();
    const emailLocale = normalizeAuthEmailLocale(locale);
    await prepareAuthEmailLocale(normalizedEmail, emailLocale);
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        shouldCreateUser: false,
        data: {
          locale: emailLocale,
          language: emailLocale,
          preferred_language: emailLocale,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/client/settings`,
      },
    });
    setIsSendingVerification(false);

    if (error) {
      setSecurityMessage({ tone: "error", text: t("security.verificationSendFailed") });
      return;
    }

    setVerificationSent(true);
    setSecurityMessage({ tone: "success", text: t("security.verificationSent") });
  }

  async function handleVerifySecurityCode() {
    setSecurityMessage(null);
    const normalizedCode = verificationCode.replace(/\D/g, "").slice(0, 8);

    if (normalizedCode.length !== 8) {
      setSecurityMessage({ tone: "error", text: t("security.codeInvalid") });
      return;
    }

    setIsVerifyingCode(true);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email: email.toLowerCase().trim(),
      token: normalizedCode,
      type: "email",
    });
    setIsVerifyingCode(false);

    if (error) {
      setSecurityMessage({ tone: "error", text: t("security.codeFailed") });
      return;
    }

    setSecurityVerified(true);
    setSecurityMessage({ tone: "success", text: t("security.verified") });
  }

  async function handlePasswordUpdate() {
    setSecurityMessage(null);

    if (!securityVerified) {
      setSecurityMessage({ tone: "error", text: t("security.verifyFirst") });
      return;
    }

    if (!passwordChecks.isValid) {
      setSecurityMessage({ tone: "error", text: t("security.requirementError") });
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

  async function handleEmailUpdate() {
    setSecurityMessage(null);

    if (!securityVerified) {
      setSecurityMessage({ tone: "error", text: t("security.verifyFirst") });
      return;
    }

    const normalizedEmail = newEmail.toLowerCase().trim();
    if (!isValidEmail(normalizedEmail)) {
      setSecurityMessage({ tone: "error", text: t("security.emailInvalid") });
      return;
    }

    if (normalizedEmail === email.toLowerCase().trim()) {
      setSecurityMessage({ tone: "error", text: t("security.emailSame") });
      return;
    }

    setIsUpdatingEmail(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ email: normalizedEmail });

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("applicant_profiles")
          .update({ email: normalizedEmail })
          .eq("auth_user_id", user.id);
      }
    }

    setIsUpdatingEmail(false);

    if (error) {
      setSecurityMessage({ tone: "error", text: t("security.emailUpdateFailed") });
      return;
    }

    setEmail(normalizedEmail);
    setNewEmail("");
    setSecurityMessage({ tone: "success", text: t("security.emailUpdated") });
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
      {view !== "home" ? (
        <div className="pt-4">
          <PageBackButton
            fallbackHref="/client/settings"
            label={isZh ? "返回上一页" : "Back to previous page"}
          />
        </div>
      ) : null}

      <section className={view === "home" ? "pt-4" : "pt-8"}>
        <div>
          <h1 className="text-3xl font-semibold text-foreground sm:text-4xl">
            {t(settingsTitleKey(view))}
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-7 text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
      </section>

      {view === "home" ? (
        <section className="mt-8 grid gap-5 lg:grid-cols-[0.82fr_1.18fr]">
        <motion.div
          className="self-start"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <ApplicationFormPanel className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <UserRound className="h-6 w-6" />
              </span>
              <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                {t("profile.complete", { percent: profileCompletion })}
              </span>
            </div>

            <div className="mt-5">
              <h2 className="font-heading text-2xl font-semibold text-foreground">
                {t("profile.universalTitle")}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {t("profile.universalDescription")}
              </p>
            </div>

            <Button asChild className="mt-6 h-11 w-full rounded-full">
              <Link href="/client/universal-info">
                {t("profile.reviewProfile")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </ApplicationFormPanel>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05 }}
        >
          <ApplicationFormPanel className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-semibold uppercase tracking-wide text-brand-500">
                {t("quickSnapshot.label")}
              </p>
            </div>
            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="min-h-[84px] rounded-lg border bg-muted/20 p-3.5">
                <dt className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Mail className="h-4 w-4 text-brand-500" />
                  {t("quickSnapshot.email")}
                </dt>
                <dd className="mt-2 break-words text-sm font-semibold text-foreground">
                  {profile?.email || email || t("quickSnapshot.notSet")}
                </dd>
              </div>
              <div className="min-h-[84px] rounded-lg border bg-muted/20 p-3.5">
                <dt className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Phone className="h-4 w-4 text-brand-500" />
                  {t("quickSnapshot.phone")}
                </dt>
                <dd className="mt-2 break-words text-sm font-semibold text-foreground">
                  {profile?.phone || t("quickSnapshot.notSet")}
                </dd>
              </div>
              <div className="min-h-[84px] rounded-lg border bg-muted/20 p-3.5">
                <dt className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <IdCard className="h-4 w-4 text-brand-500" />
                  {t("quickSnapshot.passport")}
                </dt>
                <dd className="mt-2 break-all text-sm font-semibold text-foreground">
                  {profile?.passport_number || t("quickSnapshot.notSet")}
                </dd>
              </div>

            </dl>
          </ApplicationFormPanel>
        </motion.div>
        </section>
      ) : null}

      {view === "home" || view === "security-password" || view === "security-email" ? (
      <div
        className={cn(
          "mt-8 grid gap-8",
          view === "home" ? "lg:grid-cols-[1fr_1fr]" : "lg:grid-cols-1"
        )}
      >
        <div className={cn("space-y-8", view !== "home" && "hidden")}>
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
              icon={UsersRound}
              title={t("rows.travelers.title")}
              description={t("rows.travelers.description")}
              href="/client/settings/travelers"
              badge={t("rows.travelers.badge")}
            />
            <SettingsRow
              icon={Coins}
              title={t("rows.pointsCenter.title")}
              description={t("rows.pointsCenter.description")}
              href="/client/settings/points"
              badge={t("rows.pointsCenter.badge")}
            />
            <SettingsRow
              icon={Globe2}
              title={t("rows.language.title")}
              description={t("rows.language.description")}
              href="/client/help/getting-started/complete-your-profile"
            />
            <SettingsRow
              icon={MessageCircle}
              title={isZh ? "旅行偏好记忆" : "Travel preference memory"}
              description={
                isZh
                  ? "查看或清除旅行顾问可在新对话中复用的偏好"
                  : "Review or clear preferences the Travel Advisor may reuse"
              }
              href="/client/settings/travel-memory"
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
            <ApplicationFormPanel aria-label={t("security.title")} className="px-4 sm:px-5">
              <SettingsRow
                icon={LockKeyhole}
                title={t("security.passwordTitle")}
                description={t("security.passwordDescription")}
                href="/client/settings/security/password"
              />
              <SettingsRow
                icon={Mail}
                title={t("security.emailTitle")}
                description={t("security.emailDescription")}
                href="/client/settings/security/email"
              />
              <SettingsRow
                icon={ShieldCheck}
                title={t("security.guide")}
                description={t("security.guideDescription")}
                href="/client/help/privacy-and-security/account-security-tips"
              />
            </ApplicationFormPanel>

            {activeSecurityPanel ? (
              <div className="rounded-xl border bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-start gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
                    {activeSecurityPanel === "password" ? (
                      <KeyRound className="h-5 w-5" />
                    ) : (
                      <Mail className="h-5 w-5" />
                    )}
                  </span>
                  <div>
                    <p className="text-base font-semibold text-foreground">
                      {activeSecurityPanel === "password"
                        ? t("security.passwordTitle")
                        : t("security.emailTitle")}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {t("security.verifyDescription", { email })}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3">
                  <div className="grid gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {t("security.verificationCode")}
                    </span>
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                      <input
                        inputMode="numeric"
                        value={verificationCode}
                        onChange={(event) =>
                          setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 8))
                        }
                        placeholder={t("security.codePlaceholder")}
                        disabled={securityVerified}
                        className="h-12 rounded-lg border bg-white px-4 text-base outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-muted"
                      />
                      <Button
                        type="button"
                        variant={verificationSent ? "outline" : "default"}
                        className="h-12 rounded-full"
                        onClick={handleSendVerificationCode}
                        disabled={isSendingVerification || securityVerified}
                      >
                        {isSendingVerification ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Mail className="h-4 w-4" />
                        )}
                        {verificationSent ? t("security.resendCode") : t("security.sendCode")}
                      </Button>
                    </div>
                    {!securityVerified ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 w-fit rounded-full"
                        onClick={handleVerifySecurityCode}
                        disabled={!verificationSent || isVerifyingCode}
                      >
                        {isVerifyingCode ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                        {t("security.verifyCode")}
                      </Button>
                    ) : null}
                  </div>

                  {securityVerified && activeSecurityPanel === "password" ? (
                    <>
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
                      <div className="grid gap-1 text-xs text-muted-foreground">
                        {(["length", "letter", "digit", "symbol"] as const).map((key) => (
                          <span
                            key={key}
                            className={cn(
                              "flex items-center gap-2",
                              passwordChecks[key] && "text-emerald-700"
                            )}
                          >
                            <Check className="h-3.5 w-3.5" />
                            {t(`security.passwordRequirements.${key}`)}
                          </span>
                        ))}
                      </div>
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
                      <Button
                        type="button"
                        className="h-11 w-fit rounded-full"
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
                    </>
                  ) : null}

                  {securityVerified && activeSecurityPanel === "email" ? (
                    <>
                      <label className="grid gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {t("security.newEmail")}
                        </span>
                        <input
                          type="email"
                          autoComplete="email"
                          value={newEmail}
                          onChange={(event) => setNewEmail(event.target.value)}
                          placeholder={t("security.newEmailPlaceholder")}
                          className="h-12 rounded-lg border bg-white px-4 text-base outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                        />
                      </label>
                      <Button
                        type="button"
                        className="h-11 w-fit rounded-full"
                        onClick={handleEmailUpdate}
                        disabled={isUpdatingEmail}
                      >
                        {isUpdatingEmail ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Mail className="h-4 w-4" />
                        )}
                        {isUpdatingEmail ? t("security.savingEmail") : t("security.updateEmail")}
                      </Button>
                    </>
                  ) : null}

                  {securityMessage ? (
                    securityMessage.tone === "success" ? (
                      <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700" role="status" aria-live="polite">
                        {securityMessage.text}
                      </p>
                    ) : (
                      <ClientErrorAlert message={securityMessage.text} />
                    )
                  ) : null}
                </div>
              </div>
            ) : null}
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground sm:text-2xl">
              {t("account.title")}
            </h2>
            <ApplicationFormPanel aria-label={t("account.title")} className="p-5 sm:p-6">
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
                <ActionButton
                  type="button"
                  variant="outline"
                  size="sm"
                  className="!border-[#d8d3d4] bg-[#fafafa] text-[#76696b] hover:bg-[#f1eeee] hover:text-[#68595c]"
                  onClick={handleSignOut}
                >
                  <LogOut />
                  {t("signOut.button")}
                </ActionButton>
              </div>
            </ApplicationFormPanel>
          </section>
        </div>
      </div>
      ) : null}

      {view === "points" ? (
        <section className="mt-6 scroll-mt-32 space-y-6" id="points-center">
          <div className="rounded-xl border bg-white p-5 shadow-sm sm:p-6">
            <div className="rounded-xl bg-brand-50 p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-500 text-white">
                  <Coins className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-normal text-brand-600">
                    {t("pointsCenter.eyebrow")}
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold text-brand-900 sm:text-3xl">
                    {t("pointsCenter.title")}
                  </h2>
                </div>
              </div>

              <div className="mt-6">
                <p className="text-sm font-medium text-brand-700">
                  {t("pointsCenter.totalLabel")}
                </p>
                <p className="mt-2 text-5xl font-semibold leading-none text-brand-900">
                  {pointsFormatter.format(rewardWallet.balance)}
                </p>
                <p className="mt-3 text-sm leading-6 text-brand-700">
                  {t("pointsCenter.referralRule")}
                </p>
                <p className="mt-2 text-sm leading-6 text-brand-700">
                  {t("pointsCenter.purchaseRule")}
                </p>
              </div>

              <dl className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-white p-3">
                  <dt className="text-xs font-medium text-muted-foreground">
                    {t("pointsCenter.lifetimeEarned")}
                  </dt>
                  <dd className="mt-1 text-lg font-semibold text-foreground">
                    {pointsFormatter.format(rewardWallet.lifetime_earned)}
                  </dd>
                </div>
                <div className="rounded-lg bg-white p-3">
                  <dt className="text-xs font-medium text-muted-foreground">
                    {t("pointsCenter.lifetimeSpent")}
                  </dt>
                  <dd className="mt-1 text-lg font-semibold text-foreground">
                    {pointsFormatter.format(rewardWallet.lifetime_spent)}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-foreground">
                  {t("pointsCenter.marketplaceTitle")}
                </h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {t("pointsCenter.marketplaceDescription")}
                </p>
              </div>
              <Trophy className="mt-1 h-5 w-5 shrink-0 text-brand-500" />
            </div>

            <div className="mt-4 grid gap-3">
              {rewardItems.map((item) => {
                const Icon = item.icon;
                const canRedeem = rewardWallet.balance >= item.cost;
                const countries =
                  "countriesKey" in item ? (t.raw(item.countriesKey) as string[]) : null;
                const hasCountries = Array.isArray(countries) && countries.length > 0;

                return (
                  <div
                    key={item.key}
                    className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_auto] sm:items-center"
                  >
                    <div className="flex gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="font-semibold text-foreground">
                          {t(`pointsCenter.rewards.${item.key}.title`)}
                        </p>
                        <p className="mt-1 text-sm leading-5 text-muted-foreground">
                          {t(`pointsCenter.rewards.${item.key}.description`)}
                        </p>
                        {hasCountries ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {countries.map((country) => (
                              <span
                                key={country}
                                className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700"
                              >
                                {country}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <span className="text-sm font-semibold text-brand-700">
                        {t("pointsCenter.cost", {
                          points: pointsFormatter.format(item.cost),
                        })}
                      </span>
                      <Button
                        type="button"
                        variant={canRedeem ? "default" : "outline"}
                        className="h-10 rounded-full"
                        disabled={!canRedeem}
                      >
                        {canRedeem ? t("pointsCenter.redeem") : t("pointsCenter.notEnough")}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {view === "travelers" ? (
      <section className="mt-6 scroll-mt-32" id="frequent-travelers">
        <FrequentTravelersTab />
      </section>
      ) : null}

      {view === "privacy" ? (
      <section className="mt-6" id="privacy">
        <PrivacyTab />
      </section>
      ) : null}
    </div>
  );
}
