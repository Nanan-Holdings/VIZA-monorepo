"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  ArrowRight,
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
  Pencil,
  Plus,
  ReceiptText,
  ShieldCheck,
  Trash2,
  UserRound,
  UsersRound,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { prepareAuthEmailLocale } from "@/app/actions/client-auth";
import { normalizeAuthEmailLocale } from "@/lib/i18n/locale";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { FrequentTravelersTab } from "./components/frequent-travelers-tab";
import { PrivacyTab } from "./components/privacy-tab";

type PaymentMethodId = "bank_card" | "wechat_pay" | "alipay";
type SecurityPanel = "password" | "email" | null;

interface ApplicantSettingsProfile {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  passport_number: string | null;
}

interface PaymentAccount {
  id: string;
  method: PaymentMethodId;
  label: string;
  identifier: string;
  isDefault: boolean;
}

const PAYMENT_STORAGE_KEY = "viza.settings.paymentAccounts.v1";

const paymentMethods: Array<{
  id: PaymentMethodId;
  icon: LucideIcon;
  accentClass: string;
}> = [
  {
    id: "bank_card",
    icon: CreditCard,
    accentClass: "from-brand-700 to-brand-500",
  },
  {
    id: "wechat_pay",
    icon: MessageCircle,
    accentClass: "from-emerald-700 to-emerald-500",
  },
  {
    id: "alipay",
    icon: WalletCards,
    accentClass: "from-sky-700 to-sky-500",
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
  onClick,
  badge,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  href?: string;
  onClick?: () => void;
  badge?: string;
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
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </>
  );

  const className =
    "group flex min-h-[72px] items-center gap-4 border-b border-border px-1 py-4 last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(className, "w-full text-left")}>
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
      <div className="rounded-xl border bg-white px-4 shadow-sm sm:px-5">
        {children}
      </div>
    </section>
  );
}

function createPaymentAccountId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `payment-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizePaymentAccounts(value: unknown): PaymentAccount[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((account): PaymentAccount[] => {
    if (
      typeof account !== "object" ||
      account === null ||
      !("id" in account) ||
      !("method" in account) ||
      !("label" in account) ||
      !("identifier" in account)
    ) {
      return [];
    }

    const method = account.method;
    if (method !== "bank_card" && method !== "wechat_pay" && method !== "alipay") {
      return [];
    }

    return [
      {
        id: String(account.id),
        method,
        label: String(account.label),
        identifier: String(account.identifier),
        isDefault: Boolean("isDefault" in account ? account.isDefault : false),
      },
    ];
  });
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

export function SettingsContent() {
  const router = useRouter();
  const t = useTranslations("settings");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<ApplicantSettingsProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([]);
  const [activePaymentMethod, setActivePaymentMethod] =
    useState<PaymentMethodId>("bank_card");
  const [paymentForm, setPaymentForm] = useState({ label: "", identifier: "" });
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [paymentMessage, setPaymentMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const [activeSecurityPanel, setActiveSecurityPanel] =
    useState<SecurityPanel>(null);
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

  useEffect(() => {
    const storedAccounts = window.localStorage.getItem(PAYMENT_STORAGE_KEY);
    if (!storedAccounts) return;

    try {
      setPaymentAccounts(normalizePaymentAccounts(JSON.parse(storedAccounts)));
    } catch {
      setPaymentAccounts([]);
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

  const paymentSummary = useMemo(() => {
    const defaultAccount = paymentAccounts.find((account) => account.isDefault);
    if (!defaultAccount) return t("quickSnapshot.notSet");

    return `${t(`payment.methods.${defaultAccount.method}.title`)} · ${defaultAccount.label}`;
  }, [paymentAccounts, t]);

  const activeMethodAccounts = paymentAccounts.filter(
    (account) => account.method === activePaymentMethod
  );

  const editingPaymentAccount = editingPaymentId
    ? paymentAccounts.find((account) => account.id === editingPaymentId) ?? null
    : null;

  const passwordChecks = getPasswordChecks(newPassword);

  function savePaymentAccounts(nextAccounts: PaymentAccount[]) {
    setPaymentAccounts(nextAccounts);
    window.localStorage.setItem(PAYMENT_STORAGE_KEY, JSON.stringify(nextAccounts));
  }

  function resetPaymentForm() {
    setPaymentForm({ label: "", identifier: "" });
    setEditingPaymentId(null);
  }

  function handlePaymentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPaymentMessage(null);

    const label = paymentForm.label.trim();
    const identifier = paymentForm.identifier.trim();

    if (!label || !identifier) {
      setPaymentMessage({ tone: "error", text: t("payment.messages.required") });
      return;
    }

    if (editingPaymentAccount) {
      savePaymentAccounts(
        paymentAccounts.map((account) =>
          account.id === editingPaymentAccount.id
            ? { ...account, label, identifier }
            : account
        )
      );
      setPaymentMessage({ tone: "success", text: t("payment.messages.updated") });
      resetPaymentForm();
      return;
    }

    const shouldBeDefault = activeMethodAccounts.length === 0;
    const nextAccount: PaymentAccount = {
      id: createPaymentAccountId(),
      method: activePaymentMethod,
      label,
      identifier,
      isDefault: shouldBeDefault,
    };

    savePaymentAccounts([...paymentAccounts, nextAccount]);
    setPaymentMessage({ tone: "success", text: t("payment.messages.added") });
    resetPaymentForm();
  }

  function editPaymentAccount(account: PaymentAccount) {
    setActivePaymentMethod(account.method);
    setEditingPaymentId(account.id);
    setPaymentForm({ label: account.label, identifier: account.identifier });
    setPaymentMessage(null);
  }

  function deletePaymentAccount(accountId: string) {
    const deletedAccount = paymentAccounts.find((account) => account.id === accountId);
    if (!deletedAccount) return;

    const remainingAccounts = paymentAccounts.filter((account) => account.id !== accountId);
    const methodAccounts = remainingAccounts.filter(
      (account) => account.method === deletedAccount.method
    );

    const nextAccounts =
      deletedAccount.isDefault && methodAccounts.length > 0
        ? remainingAccounts.map((account) =>
            account.id === methodAccounts[0].id ? { ...account, isDefault: true } : account
          )
        : remainingAccounts;

    savePaymentAccounts(nextAccounts);
    if (editingPaymentId === accountId) resetPaymentForm();
    setPaymentMessage({ tone: "success", text: t("payment.messages.deleted") });
  }

  function setDefaultPaymentAccount(accountId: string) {
    const targetAccount = paymentAccounts.find((account) => account.id === accountId);
    if (!targetAccount) return;

    savePaymentAccounts(
      paymentAccounts.map((account) =>
        account.method === targetAccount.method
          ? { ...account, isDefault: account.id === accountId }
          : account
      )
    );
    setPaymentMessage({ tone: "success", text: t("payment.messages.defaultUpdated") });
  }

  function resetSecurityFlow() {
    setVerificationCode("");
    setVerificationSent(false);
    setSecurityVerified(false);
    setSecurityMessage(null);
    setNewPassword("");
    setConfirmPassword("");
    setNewEmail("");
  }

  function openSecurityPanel(panel: Exclude<SecurityPanel, null>) {
    setActiveSecurityPanel(panel);
    resetSecurityFlow();
  }

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
                {paymentSummary}
              </dd>
            </div>
          </dl>
        </motion.div>
      </section>

      <section className="mt-8 space-y-4" id="payment-methods">
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
            const selected = activePaymentMethod === method.id;
            const accounts = paymentAccounts.filter((account) => account.method === method.id);
            const defaultAccount = accounts.find((account) => account.isDefault);

            return (
              <motion.button
                key={method.id}
                type="button"
                onClick={() => {
                  setActivePaymentMethod(method.id);
                  resetPaymentForm();
                  setPaymentMessage(null);
                }}
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
                      {defaultAccount
                        ? t("payment.defaultAccount", { account: defaultAccount.label })
                        : t(`payment.methods.${method.id}.description`)}
                    </span>
                    <span className="mt-2 block text-xs font-semibold text-brand-700">
                      {t("payment.boundCount", { count: accounts.length })}
                    </span>
                  </span>
                  {selected ? (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white">
                      <Check className="h-4 w-4" />
                    </span>
                  ) : null}
                </span>
                <span className="mt-4 inline-flex text-sm font-semibold text-brand-600">
                  {selected ? t("payment.manageSelected") : t("payment.manage")}
                </span>
              </motion.button>
            );
          })}
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                {t(`payment.methods.${activePaymentMethod}.title`)}
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {t("payment.managerHint")}
              </p>
            </div>
            <span className="w-fit rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
              {t("payment.boundCount", { count: activeMethodAccounts.length })}
            </span>
          </div>

          {paymentMessage ? (
            <p
              className={cn(
                "mt-4 rounded-lg border px-3 py-2 text-sm font-medium",
                paymentMessage.tone === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red-200 bg-red-50 text-red-700"
              )}
              role="status"
              aria-live="polite"
            >
              {paymentMessage.text}
            </p>
          ) : null}

          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.85fr]">
            <div className="space-y-3">
              {activeMethodAccounts.length === 0 ? (
                <div className="rounded-lg border border-dashed p-5 text-sm leading-6 text-muted-foreground">
                  {t("payment.empty")}
                </div>
              ) : (
                activeMethodAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-foreground">{account.label}</p>
                        {account.isDefault ? (
                          <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
                            {t("payment.selected")}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 break-all text-sm text-muted-foreground">
                        {account.identifier}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!account.isDefault ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 rounded-full"
                          onClick={() => setDefaultPaymentAccount(account.id)}
                        >
                          <Check className="h-4 w-4" />
                          {t("payment.setDefault")}
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 rounded-full"
                        onClick={() => editPaymentAccount(account)}
                      >
                        <Pencil className="h-4 w-4" />
                        {t("payment.edit")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 rounded-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => deletePaymentAccount(account.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        {t("payment.delete")}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <form className="rounded-lg border bg-muted/20 p-4" onSubmit={handlePaymentSubmit}>
              <h3 className="font-semibold text-foreground">
                {editingPaymentAccount ? t("payment.editTitle") : t("payment.addTitle")}
              </h3>
              <div className="mt-4 grid gap-3">
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {t("payment.fields.label")}
                  </span>
                  <input
                    value={paymentForm.label}
                    onChange={(event) =>
                      setPaymentForm((current) => ({ ...current, label: event.target.value }))
                    }
                    placeholder={t(`payment.placeholders.${activePaymentMethod}.label`)}
                    className="h-11 rounded-lg border bg-white px-3 text-sm outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {t("payment.fields.identifier")}
                  </span>
                  <input
                    value={paymentForm.identifier}
                    onChange={(event) =>
                      setPaymentForm((current) => ({
                        ...current,
                        identifier: event.target.value,
                      }))
                    }
                    placeholder={t(`payment.placeholders.${activePaymentMethod}.identifier`)}
                    className="h-11 rounded-lg border bg-white px-3 text-sm outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  />
                </label>
                <p className="text-xs leading-5 text-muted-foreground">
                  {t("payment.safeHint")}
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button type="submit" className="h-10 rounded-full">
                    <Plus className="h-4 w-4" />
                    {editingPaymentAccount ? t("payment.saveEdit") : t("payment.addAccount")}
                  </Button>
                  {editingPaymentAccount ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 rounded-full"
                      onClick={resetPaymentForm}
                    >
                      {t("payment.cancelEdit")}
                    </Button>
                  ) : null}
                </div>
              </div>
            </form>
          </div>
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
              icon={UsersRound}
              title={t("rows.travelers.title")}
              description={t("rows.travelers.description")}
              href="#frequent-travelers"
              badge={t("rows.travelers.badge")}
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
              href="#payment-methods"
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
            <div className="rounded-xl border bg-white px-4 shadow-sm sm:px-5">
              <SettingsRow
                icon={LockKeyhole}
                title={t("security.passwordTitle")}
                description={t("security.passwordDescription")}
                onClick={() => openSecurityPanel("password")}
              />
              <SettingsRow
                icon={Mail}
                title={t("security.emailTitle")}
                description={t("security.emailDescription")}
                onClick={() => openSecurityPanel("email")}
              />
              <SettingsRow
                icon={ShieldCheck}
                title={t("security.guide")}
                description={t("security.guideDescription")}
                href="/client/help/privacy-and-security/account-security-tips"
              />
            </div>

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
                </div>
              </div>
            ) : null}
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

      <section className="mt-10 scroll-mt-32" id="frequent-travelers">
        <FrequentTravelersTab />
      </section>

      <section className="mt-10" id="privacy">
        <PrivacyTab />
      </section>
    </div>
  );
}
