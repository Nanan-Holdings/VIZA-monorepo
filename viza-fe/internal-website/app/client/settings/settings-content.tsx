"use client";

import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  CircleHelp,
  Coins,
  CreditCard,
  Database,
  Gift,
  Globe2,
  Headphones,
  KeyRound,
  Loader2,
  LockKeyhole,
  LogOut,
  Mail,
  MessageCircle,
  Pencil,
  QrCode,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  TicketPercent,
  Trophy,
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
type SettingsView =
  | "home"
  | "payment-methods"
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

interface PaymentAccount {
  id: string;
  method: PaymentMethodId;
  label: string;
  identifier: string;
  isDefault: boolean;
  verificationStatus?: "bound" | "requires_action";
  providerReference?: string;
}

interface PaymentFormState {
  label: string;
}

interface WalletBindingIntent {
  bindingId: string;
  method: Exclude<PaymentMethodId, "bank_card">;
  qrCodeDataUrl: string;
  expiresAt: string;
}

interface CardBindingIntent {
  bindingId: string;
  customerId: string;
  intentId?: string;
  clientSecret: string;
  currency: string;
  label: string;
}

interface AirwallexCardElement {
  mount(containerId: string): void;
  confirm?: (options: { intent_id: string; client_secret: string }) => Promise<unknown>;
  createPaymentConsent?: (options: {
    client_secret: string;
    customer_id?: string;
    next_triggered_by?: "merchant" | "customer";
    merchant_trigger_reason?: "scheduled" | "unscheduled";
    metadata?: Record<string, unknown>;
  }) => Promise<{
    id?: string;
    client_secret?: string;
    customer_id?: string;
    payment_consent_id?: string;
    payment_method?: unknown;
  } | boolean>;
  verifyConsent?: (options: {
    client_secret: string;
    currency?: string;
    verification_options?: { card: { currency: string } };
    verificationOptions?: { card: { currency: string } };
  }) => Promise<{
    id?: string;
    customer_id?: string;
    payment_consent_id?: string;
    payment_method?: unknown;
  } | boolean>;
  on(event: "ready" | "success" | "error", handler: (event?: unknown) => void): void;
}

interface AirwallexComponentsSdk {
  init(options: { env: "demo" | "prod"; enabledElements: string[]; locale: string }): Promise<void>;
  createElement(
    type: "card",
    options: {
      intent_id?: string;
      client_secret: string;
      currency: string;
      style?: Record<string, unknown>;
    },
  ): Promise<AirwallexCardElement | null>;
}

declare global {
  interface Window {
    AirwallexComponentsSDK?: AirwallexComponentsSdk;
  }
}

interface RewardWalletSummary {
  balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
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

function isWalletMethod(method: PaymentMethodId): method is Exclude<PaymentMethodId, "bank_card"> {
  return method === "wechat_pay" || method === "alipay";
}

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
  isActive,
  ariaControls,
}: {
  icon: LucideIcon;
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
      <div className="rounded-xl border bg-white px-4 shadow-sm sm:px-5">
        {children}
      </div>
    </section>
  );
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
        verificationStatus:
          "verificationStatus" in account && account.verificationStatus === "requires_action"
            ? "requires_action"
            : "bound",
        providerReference:
          "providerReference" in account && typeof account.providerReference === "string"
            ? account.providerReference
            : undefined,
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

function settingsTitleKey(view: SettingsView) {
  if (view === "payment-methods") return "rows.paymentMethods.title";
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
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<ApplicantSettingsProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([]);
  const [activePaymentMethod, setActivePaymentMethod] =
    useState<PaymentMethodId>("bank_card");
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>({
    label: "",
  });
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [activeQrBinding, setActiveQrBinding] = useState<WalletBindingIntent | null>(null);
  const [activeCardBinding, setActiveCardBinding] = useState<CardBindingIntent | null>(null);
  const [airwallexScriptReady, setAirwallexScriptReady] = useState(false);
  const [cardElement, setCardElement] = useState<AirwallexCardElement | null>(null);
  const [isCardElementReady, setIsCardElementReady] = useState(false);
  const [isCompletingCardBinding, setIsCompletingCardBinding] = useState(false);
  const [isStartingPaymentBinding, setIsStartingPaymentBinding] = useState(false);
  const [isCheckingPaymentBinding, setIsCheckingPaymentBinding] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
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
    const storedAccounts = window.localStorage.getItem(PAYMENT_STORAGE_KEY);

    if (storedAccounts) {
      try {
        setPaymentAccounts(normalizePaymentAccounts(JSON.parse(storedAccounts)));
      } catch {
        setPaymentAccounts([]);
      }
    }

    const params = new URLSearchParams(window.location.search);
    const paymentBind = params.get("payment_bind");
    if (paymentBind === "success") {
      setPaymentMessage({ tone: "success", text: t("payment.messages.stripeReturned") });
    } else if (paymentBind === "cancelled") {
      setPaymentMessage({ tone: "error", text: t("payment.messages.stripeCancelled") });
    }
  }, [t]);

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

      const { data: walletData } = await supabase
        .from("reward_wallets")
        .select("balance, lifetime_earned, lifetime_spent")
        .eq("user_id", user.id)
        .maybeSingle();

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
  const pointsFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        maximumFractionDigits: 0,
      }),
    [locale]
  );

  function savePaymentAccounts(nextAccounts: PaymentAccount[]) {
    setPaymentAccounts(nextAccounts);
    window.localStorage.setItem(PAYMENT_STORAGE_KEY, JSON.stringify(nextAccounts));
  }

  function resetPaymentForm() {
    setPaymentForm({ label: "" });
    setEditingPaymentId(null);
    setActiveCardBinding(null);
    setCardElement(null);
    setIsCardElementReady(false);
    const container = document.getElementById("airwallex-settings-card-element");
    if (container) container.innerHTML = "";
  }

  useEffect(() => {
    if (!activeCardBinding) {
      setCardElement(null);
      setIsCardElementReady(false);
      const container = document.getElementById("airwallex-settings-card-element");
      if (container) container.innerHTML = "";
      return;
    }
    if (!airwallexScriptReady || !window.AirwallexComponentsSDK) return;

    let cancelled = false;
    const binding = activeCardBinding;
    async function mountCardElement() {
      setCardElement(null);
      setIsCardElementReady(false);
      const container = document.getElementById("airwallex-settings-card-element");
      if (container) container.innerHTML = "";

      await window.AirwallexComponentsSDK?.init({
        env: "demo",
        enabledElements: ["payments"],
        locale: "zh",
      });

      const element = await window.AirwallexComponentsSDK?.createElement("card", {
        ...(binding.intentId ? { intent_id: binding.intentId } : {}),
        client_secret: binding.clientSecret,
        currency: binding.currency,
        style: {
          base: {
            color: "#111827",
            fontSize: "16px",
            "::placeholder": { color: "#9ca3af" },
          },
        },
      });

      if (cancelled || !element) return;
      element.mount("airwallex-settings-card-element");
      element.on("ready", () => setIsCardElementReady(true));
      element.on("error", () => setPaymentMessage({ tone: "error", text: t("payment.messages.cardElementFailed") }));
      setCardElement(element);
    }

    mountCardElement().catch((caught) => {
      console.error("[settings-card-binding]", caught);
      if (!cancelled) setPaymentMessage({ tone: "error", text: t("payment.messages.cardElementFailed") });
    });

    return () => {
      cancelled = true;
    };
  }, [activeCardBinding, airwallexScriptReady, t]);

  async function handlePaymentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPaymentMessage(null);

    const label = paymentForm.label.trim();

    if (!label) {
      setPaymentMessage({ tone: "error", text: t("payment.messages.nicknameRequired") });
      return;
    }

    if (editingPaymentAccount) {
      savePaymentAccounts(
        paymentAccounts.map((account) =>
          account.id === editingPaymentAccount.id
            ? { ...account, label }
            : account
        )
      );
      setPaymentMessage({ tone: "success", text: t("payment.messages.updated") });
      resetPaymentForm();
      return;
    }

    setIsStartingPaymentBinding(true);
    const response = await fetch("/api/payments/bind/airwallex-card", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: label }),
    });
    setIsStartingPaymentBinding(false);

    const result = (await response.json().catch(() => null)) as {
      bindingId?: string;
      customerId?: string;
      intentId?: string;
      clientSecret?: string | null;
      currency?: string;
      error?: string;
    } | null;

    if (
      !response.ok ||
      !result?.bindingId ||
      !result.customerId ||
      !result.clientSecret ||
      !result.currency
    ) {
      setPaymentMessage({
        tone: "error",
        text:
          response.status === 503
            ? t("payment.messages.cardUnavailable")
            : result?.error ?? t("payment.messages.cardStartFailed"),
      });
      return;
    }

    setActiveCardBinding({
      bindingId: result.bindingId,
      customerId: result.customerId,
      intentId: result.intentId,
      clientSecret: result.clientSecret,
      currency: result.currency,
      label,
    });
    setPaymentMessage({ tone: "success", text: t("payment.messages.cardReady") });
  }

  async function completeCardBinding() {
    if (!activeCardBinding || !cardElement?.createPaymentConsent) return;

    setPaymentMessage(null);
    setIsCompletingCardBinding(true);
    try {
      const consent = await cardElement.createPaymentConsent({
        client_secret: activeCardBinding.clientSecret,
        customer_id: activeCardBinding.customerId,
        next_triggered_by: "merchant",
        merchant_trigger_reason: "scheduled",
        metadata: {
          binding_id: activeCardBinding.bindingId,
          source: "client_settings_payment_binding",
        },
      });

      if (typeof consent === "boolean") {
        throw new Error("Missing payment consent id.");
      }

      const verifiedConsent =
        consent.client_secret && cardElement.verifyConsent
          ? await cardElement.verifyConsent({
              client_secret: consent.client_secret,
              currency: activeCardBinding.currency,
              verification_options: {
                card: {
                  currency: activeCardBinding.currency,
                },
              },
              verificationOptions: {
                card: {
                  currency: activeCardBinding.currency,
                },
              },
            })
          : consent;

      const consentResult = typeof verifiedConsent === "boolean" ? consent : verifiedConsent;
      const paymentConsentId = consentResult.payment_consent_id ?? consentResult.id ?? consent.payment_consent_id ?? consent.id;
      if (!paymentConsentId) {
        throw new Error("Missing payment consent id.");
      }

      const response = await fetch(`/api/payments/bind/airwallex-card/${activeCardBinding.bindingId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentConsentId,
          customerId: consentResult.customer_id ?? consent.customer_id,
          paymentMethod: consentResult.payment_method ?? consent.payment_method,
        }),
      });
      const result = (await response.json().catch(() => null)) as {
        bindingId?: string;
        identifier?: string;
        error?: string;
      } | null;

      if (!response.ok || !result?.bindingId) {
        throw new Error(result?.error ?? t("payment.messages.cardBindFailed"));
      }

      const shouldBeDefault = activeMethodAccounts.length === 0;
      savePaymentAccounts([
        ...paymentAccounts.filter((account) => account.id !== result.bindingId),
        {
          id: result.bindingId,
          method: "bank_card",
          label: activeCardBinding.label,
          identifier: result.identifier ?? t("payment.cardIdentifier"),
          isDefault: shouldBeDefault,
          verificationStatus: "bound",
          providerReference: result.bindingId,
        },
      ]);

      setPaymentMessage({ tone: "success", text: t("payment.messages.cardBound") });
      resetPaymentForm();
    } catch (caught) {
      console.error("[settings-card-binding-complete]", caught);
      setPaymentMessage({
        tone: "error",
        text: caught instanceof Error && caught.message ? caught.message : t("payment.messages.cardBindFailed"),
      });
    } finally {
      setIsCompletingCardBinding(false);
    }
  }

  async function startWalletBinding() {
    if (!isWalletMethod(activePaymentMethod)) return;

    setPaymentMessage(null);
    setIsStartingPaymentBinding(true);
    const response = await fetch("/api/payments/bind/qr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: activePaymentMethod }),
    });
    setIsStartingPaymentBinding(false);

    const result = (await response.json().catch(() => null)) as WalletBindingIntent & {
      error?: string;
    } | null;

    if (!response.ok || !result?.bindingId || !result.qrCodeDataUrl) {
      setPaymentMessage({
        tone: "error",
        text:
          response.status === 503
            ? t("payment.messages.walletBindingUnavailable")
            : result?.error ?? t("payment.messages.qrStartFailed"),
      });
      return;
    }

    setActiveQrBinding({
      bindingId: result.bindingId,
      method: result.method,
      qrCodeDataUrl: result.qrCodeDataUrl,
      expiresAt: result.expiresAt,
    });
    setPaymentMessage({ tone: "success", text: t("payment.messages.qrReady") });
  }

  async function checkWalletBindingStatus() {
    if (!activeQrBinding) return;

    setPaymentMessage(null);
    setIsCheckingPaymentBinding(true);
    const response = await fetch(`/api/payments/bind/status/${activeQrBinding.bindingId}`);
    setIsCheckingPaymentBinding(false);

    const result = (await response.json().catch(() => null)) as {
      bindingId?: string;
      method?: PaymentMethodId;
      status?: string;
      accountLabel?: string;
      identifier?: string | null;
      error?: string;
    } | null;

    if (!response.ok || !result?.bindingId) {
      setPaymentMessage({
        tone: "error",
        text: result?.error ?? t("payment.messages.qrStatusFailed"),
      });
      return;
    }

    if (result.status === "expired") {
      setPaymentMessage({ tone: "error", text: t("payment.messages.qrExpired") });
      return;
    }

    if (result.status !== "bound" || !result.identifier || !result.method) {
      setPaymentMessage({ tone: "error", text: t("payment.messages.qrPending") });
      return;
    }

    if (!paymentAccounts.some((account) => account.id === result.bindingId)) {
      const methodAccounts = paymentAccounts.filter((account) => account.method === result.method);
      savePaymentAccounts([
        ...paymentAccounts,
        {
          id: result.bindingId,
          method: result.method,
          label: result.accountLabel ?? t(`payment.methods.${result.method}.title`),
          identifier: result.identifier,
          isDefault: methodAccounts.length === 0,
          verificationStatus: "bound",
          providerReference: result.bindingId,
        },
      ]);
    }

    setActiveQrBinding(null);
    setPaymentMessage({ tone: "success", text: t("payment.messages.qrBound") });
    resetPaymentForm();
  }

  function editPaymentAccount(account: PaymentAccount) {
    setActivePaymentMethod(account.method);
    setEditingPaymentId(account.id);
    setPaymentForm({
      label: account.label,
    });
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
      <Script
        src="https://static.airwallex.com/components/sdk/v1/index.js"
        strategy="afterInteractive"
        onLoad={() => setAirwallexScriptReady(true)}
        onError={() => setPaymentMessage({ tone: "error", text: t("payment.messages.cardElementFailed") })}
      />
      {view === "home" ? (
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
      ) : null}

      <section className={cn("space-y-4", view === "home" ? "mt-8" : "pt-4")}>
        <div>
          <h1 className="text-3xl font-semibold text-foreground sm:text-4xl">
            {t(settingsTitleKey(view))}
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-7 text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>

        {view !== "home" ? (
          <Button asChild variant="outline" className="h-10 rounded-full">
            <Link href="/client/settings">
              <ArrowLeft className="h-4 w-4" />
              {t("backToSettings")}
            </Link>
          </Button>
        ) : null}
      </section>

      {view === "payment-methods" ? (
      <section className="mt-6 space-y-4" id="payment-methods">
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
                  setActiveQrBinding(null);
                  setActiveCardBinding(null);
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
                {t(`payment.managerHints.${activePaymentMethod}`)}
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
                        {account.verificationStatus === "requires_action" ? (
                          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                            {t("payment.pendingVerification")}
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
                      {account.method === "bank_card" ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 rounded-full"
                          onClick={() => editPaymentAccount(account)}
                        >
                          <Pencil className="h-4 w-4" />
                          {t("payment.edit")}
                        </Button>
                      ) : null}
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

            {activePaymentMethod === "bank_card" ? (
              <form className="rounded-lg border bg-muted/20 p-4" onSubmit={handlePaymentSubmit}>
                <h3 className="font-semibold text-foreground">
                  {editingPaymentAccount ? t("payment.editTitle") : t("payment.cardAddTitle")}
                </h3>
                <div className="mt-4 grid gap-3">
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {t("payment.fields.nickname")}
                    </span>
                    <input
                      value={paymentForm.label}
                      onChange={(event) =>
                        setPaymentForm((current) => ({ ...current, label: event.target.value }))
                      }
                      placeholder={t("payment.placeholders.bank_card.nickname")}
                      className="h-11 rounded-lg border bg-white px-3 text-sm outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    />
                  </label>
                  <p className="text-xs leading-5 text-muted-foreground">
                    {t("payment.cardHint")}
                  </p>
                  {activeCardBinding ? (
                    <div className="grid gap-3 rounded-lg border bg-white p-3">
                      {!airwallexScriptReady ? (
                        <p className="flex items-center text-sm text-muted-foreground">
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t("payment.cardElementPreparing")}
                        </p>
                      ) : null}
                      <div id="airwallex-settings-card-element" className="rounded-lg border bg-white p-3" />
                      <Button
                        type="button"
                        className="h-10 rounded-full"
                        onClick={completeCardBinding}
                        disabled={!isCardElementReady || isCompletingCardBinding}
                      >
                        {isCompletingCardBinding ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ShieldCheck className="h-4 w-4" />
                        )}
                        {t("payment.completeCardBinding")}
                      </Button>
                    </div>
                  ) : null}
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="submit"
                      className="h-10 rounded-full"
                      disabled={isStartingPaymentBinding || Boolean(activeCardBinding)}
                    >
                      {isStartingPaymentBinding ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : editingPaymentAccount ? (
                        <Pencil className="h-4 w-4" />
                      ) : (
                        <CreditCard className="h-4 w-4" />
                      )}
                      {editingPaymentAccount
                        ? t("payment.saveEdit")
                        : t("payment.verifyWithAirwallex")}
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
            ) : (
              <div className="rounded-lg border bg-muted/20 p-4">
                <h3 className="font-semibold text-foreground">{t("payment.qrAddTitle")}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {t(`payment.qrHint.${activePaymentMethod}`)}
                </p>

                {activeQrBinding ? (
                  <div className="mt-4 grid gap-3">
                    <div className="flex justify-center rounded-lg border bg-white p-4">
                      <Image
                        src={activeQrBinding.qrCodeDataUrl}
                        alt={t("payment.qrAlt")}
                        width={192}
                        height={192}
                        unoptimized
                        className="h-48 w-48"
                      />
                    </div>
                    <p className="text-xs leading-5 text-muted-foreground">
                      {t("payment.qrExpires", {
                        time: new Date(activeQrBinding.expiresAt).toLocaleTimeString(),
                      })}
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 rounded-lg border border-dashed bg-white p-5 text-sm leading-6 text-muted-foreground">
                    {t("payment.qrEmpty")}
                  </div>
                )}

                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    className="h-10 rounded-full"
                    onClick={startWalletBinding}
                    disabled={isStartingPaymentBinding}
                  >
                    {isStartingPaymentBinding ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <QrCode className="h-4 w-4" />
                    )}
                    {activeQrBinding ? t("payment.regenerateQr") : t("payment.generateQr")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 rounded-full"
                    onClick={checkWalletBindingStatus}
                    disabled={!activeQrBinding || isCheckingPaymentBinding}
                  >
                    {isCheckingPaymentBinding ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    {t("payment.checkQrStatus")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
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
          </SectionCard>

          <SectionCard title={t("sections.payments")}>
            <SettingsRow
              icon={WalletCards}
              title={t("rows.paymentMethods.title")}
              description={t("rows.paymentMethods.description")}
              href="/client/settings/payment-methods"
              badge={t("rows.paymentMethods.badge")}
            />
            <SettingsRow
              icon={ShieldCheck}
              title={t("rows.subscription.title")}
              description={t("rows.subscription.description")}
              href="/client/settings/subscription"
              badge={t("rows.subscription.badge")}
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
