import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  MessageCircle,
  Plane,
  ShieldCheck,
  Sparkles,
  UsersRound,
  XCircle,
} from "lucide-react";
import {
  getCurrentSubscriptionForCurrentUser,
  reconcileStripeSubscriptionReturn,
  type SubscriptionReturnState,
} from "./data";
import { buildPayPerGroups } from "./pay-per-data";
import { PayPerApplicationBrowser } from "./pay-per-application-browser";
import {
  formatCny,
  getCommercialProduct,
} from "@/lib/payments/commercial-products";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

type SubscriptionSearchParams = {
  error?: string | string[];
  payment?: string | string[];
  paymentId?: string | string[];
  provider?: string | string[];
  session_id?: string | string[];
};

interface SubscriptionPageProps {
  searchParams?: Promise<SubscriptionSearchParams>;
}

const monthlyPlans = [
  {
    id: "access",
    productId: "monthly_access",
    countryLimit: 7,
    featured: false,
    featureKeys: ["countryAccess", "requirements", "checklist", "multilingual", "status"],
    unavailableKeys: ["ai", "group", "travel"],
  },
  {
    id: "pro",
    productId: "monthly_pro",
    countryLimit: 14,
    featured: true,
    featureKeys: [
      "countryAccess",
      "requirements",
      "checklist",
      "multilingual",
      "status",
      "ai",
      "group",
      "travel",
    ],
    unavailableKeys: [],
  },
] as const;

function getParam(params: SubscriptionSearchParams | undefined, key: keyof SubscriptionSearchParams): string | null {
  const value = params?.[key];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function getErrorReturnState(error: string | null): SubscriptionReturnState {
  if (!error) return null;

  const messages: Record<string, SubscriptionReturnState> = {
    invalid_product: {
      tone: "error",
      title: "无法识别该方案",
      description: "请选择页面上展示的月付或次付方案后再发起支付。",
    },
    payment_record_failed: {
      tone: "error",
      title: "支付记录创建失败",
      description: "VIZA 未能准备订单，请稍后重试或联系客服。",
    },
    stripe_unconfigured: {
      tone: "warning",
      title: "Stripe 尚未配置",
      description: "请先配置 Stripe Secret Key、Webhook Secret 和应用地址。",
    },
    wechat_unconfigured: {
      tone: "warning",
      title: "微信支付尚未配置",
      description: "请先配置微信支付商户号、AppID、API v3 Key、商户证书序列号和私钥。",
    },
    alipay_unconfigured: {
      tone: "warning",
      title: "支付宝尚未配置",
      description: "请先配置支付宝 AppID、应用私钥和支付宝公钥。",
    },
    airwallex_unconfigured: {
      tone: "warning",
      title: "在线支付尚未配置",
      description: "请先配置 sandbox 支付服务的 Client ID、API Key 和应用地址。",
    },
    app_url_missing: {
      tone: "error",
      title: "应用地址缺失",
      description: "需要 NEXT_PUBLIC_APP_URL 或请求 Host 才能生成支付回调地址。",
    },
  };

  return (
    messages[error] ?? {
      tone: "error",
      title: "支付暂时不可用",
      description: "支付页面未能打开，请稍后重试。",
    }
  );
}

async function getReturnState(params: SubscriptionSearchParams | undefined): Promise<SubscriptionReturnState> {
  const payment = getParam(params, "payment");
  const provider = getParam(params, "provider");

  if (payment === "success" && provider === "stripe") {
    return reconcileStripeSubscriptionReturn(getParam(params, "paymentId"), getParam(params, "session_id"));
  }

  if (payment === "cancelled") {
    return {
      tone: "warning",
      title: "支付已取消",
      description: "当前方案没有扣费，你可以重新选择在线支付。",
    };
  }

  if (payment === "return" && provider === "alipay") {
    return {
      tone: "warning",
      title: "支付宝已返回",
      description: "最终支付状态以支付宝异步通知为准。如已付款，请稍后刷新页面。",
    };
  }

  return getErrorReturnState(getParam(params, "error"));
}

function ReturnStateAlert({ state }: { state: SubscriptionReturnState }) {
  if (!state) return null;

  const Icon =
    state.tone === "success" ? CheckCircle2 : state.tone === "warning" ? AlertCircle : XCircle;

  return (
    <Alert
      className={cn(
        "shadow-sm",
        state.tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-950",
        state.tone === "warning" && "border-amber-200 bg-amber-50 text-amber-950",
        state.tone === "error" && "border-destructive/30 bg-destructive/5 text-destructive",
      )}
    >
      <Icon className="h-4 w-4" />
      <AlertTitle>{state.title}</AlertTitle>
      <AlertDescription>{state.description}</AlertDescription>
    </Alert>
  );
}

function OnlinePayCta({
  productId,
  featured,
}: {
  productId: string;
  featured?: boolean;
}) {
  return (
    <Link
      href={`/payments/checkout?productId=${encodeURIComponent(productId)}&billing=monthly`}
      className={cn(
        "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-1",
        featured
          ? "bg-white text-brand-500 hover:bg-brand-50 focus-visible:ring-white"
          : "border border-brand-500 bg-brand-500 text-white hover:bg-brand-600 focus-visible:ring-ring",
      )}
    >
      <MessageCircle className="h-4 w-4" />
      在线付
    </Link>
  );
}

export default async function SubscriptionPage({ searchParams }: SubscriptionPageProps) {
  const params = await searchParams;
  const [t, locale, returnState, currentSubscription] = await Promise.all([
    getTranslations("subscription"),
    getLocale(),
    getReturnState(params),
    getCurrentSubscriptionForCurrentUser(),
  ]);
  const isZh = locale.toLowerCase().startsWith("zh");
  const payPerGroups = buildPayPerGroups();

  return (
    <div className="min-h-screen bg-[#fafafa] pb-16">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <Link
          href="/client/home"
          className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-brand-500 shadow-sm transition hover:border-brand-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("back")}
        </Link>

        <ReturnStateAlert state={returnState} />

        <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="grid gap-6 border-b bg-brand-50 p-6 lg:grid-cols-[1.15fr_0.85fr] lg:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-brand-500">{t("eyebrow")}</p>
                <h1 className="mt-2 text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
                  {t("title")}
                </h1>
                <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
                  {t("subtitle")}
                </p>
              </div>
            </div>

            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t("current.label")}</p>
                  <p className="mt-1 text-2xl font-semibold text-brand-500">
                    {currentSubscription.planName}
                  </p>
                </div>
                <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-500">
                  {currentSubscription.statusLabel}
                </span>
              </div>
              <div className="mt-5 grid gap-3">
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">{t("current.renewalLabel")}</span>
                  <span className="text-right font-semibold text-foreground">
                    {currentSubscription.renewalLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">{t("current.paymentLabel")}</span>
                  <span className="font-semibold text-foreground">
                    {currentSubscription.paymentMethodLabel}
                  </span>
                </div>
                {currentSubscription.countryLimitPerMonth ? (
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-muted-foreground">{t("current.countryLimitLabel")}</span>
                    <span className="font-semibold text-foreground">
                      {t("monthly.countryLimit", { count: currentSubscription.countryLimitPerMonth })}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-0 divide-y">
            <section className="p-6 lg:p-8">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-foreground">{t("monthly.title")}</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                    {t("monthly.subtitle")}
                  </p>
                </div>
                <span className="w-fit rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-500">
                  {t("monthly.badge")}
                </span>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {monthlyPlans.map((plan) => {
                  const product = getCommercialProduct(plan.productId);
                  if (!product) return null;

                  return (
                    <article
                      key={plan.id}
                      className={
                        plan.featured
                          ? "flex min-h-[440px] flex-col rounded-xl border border-brand-500 bg-brand-500 p-6 text-white shadow-sm"
                          : "flex min-h-[440px] flex-col rounded-xl border bg-white p-6 shadow-sm"
                      }
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-2xl font-semibold">{t(`monthly.plans.${plan.id}.name`)}</h3>
                            {plan.featured ? (
                              <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold text-white">
                                {t("monthly.recommended")}
                              </span>
                            ) : null}
                          </div>
                          <p className={plan.featured ? "mt-2 text-sm leading-6 text-white/75" : "mt-2 text-sm leading-6 text-muted-foreground"}>
                            {t(`monthly.plans.${plan.id}.description`)}
                          </p>
                        </div>
                        <div className="shrink-0">
                          <div className="flex items-end gap-1">
                            <span className="text-4xl font-semibold leading-none">{formatCny(product.amountFen)}</span>
                            <span className={plan.featured ? "pb-1 text-sm font-medium text-white/70" : "pb-1 text-sm font-medium text-muted-foreground"}>
                              {t("monthly.cadence")}
                            </span>
                          </div>
                          <p className={plan.featured ? "mt-2 text-sm text-white/75" : "mt-2 text-sm text-muted-foreground"}>
                            {t("monthly.countryLimit", { count: plan.countryLimit })}
                          </p>
                        </div>
                      </div>

                      <div className="mt-6 grid gap-3">
                        {plan.featureKeys.map((feature) => (
                          <div key={feature} className="flex items-start gap-3 text-sm leading-6">
                            <CheckCircle2 className={plan.featured ? "mt-0.5 h-4 w-4 shrink-0 text-white" : "mt-0.5 h-4 w-4 shrink-0 text-brand-500"} />
                            <span>{t(`monthly.features.${feature}`)}</span>
                          </div>
                        ))}
                        {plan.unavailableKeys.map((feature) => (
                          <div
                            key={feature}
                            className={plan.featured ? "flex items-start gap-3 text-sm leading-6 text-white/60" : "flex items-start gap-3 text-sm leading-6 text-muted-foreground"}
                          >
                            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>{t(`monthly.features.${feature}`)}</span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-auto pt-6">
                        <OnlinePayCta productId={product.id} featured={plan.featured} />
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="p-6 lg:p-8">
              <div className="grid gap-6 lg:grid-cols-[0.78fr_1.22fr]">
                <div>
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-500">
                    <Plane className="h-5 w-5" />
                  </div>
                  <h2 className="mt-4 text-2xl font-semibold text-foreground">{t("payPer.title")}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("payPer.subtitle")}</p>

                  <div className="mt-5 rounded-xl border bg-brand-50 p-5">
                    <div className="flex items-start gap-3">
                      <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">{t("payPer.limitTitle")}</p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">{t("payPer.limitBody")}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-start gap-3">
                      <UsersRound className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">{t("payPer.groupTitle")}</p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">{t("payPer.groupBody")}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-start gap-3">
                      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" />
                      <p className="text-sm leading-6 text-brand-900">{t("payPer.paymentNote")}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <PayPerApplicationBrowser
                    isZh={isZh}
                    regions={payPerGroups}
                    labels={{
                      searchPlaceholder: t("payPer.searchPlaceholder"),
                      searchResults: t("payPer.searchResults"),
                      noResults: t("payPer.noResults"),
                      chooseRegion: t("payPer.chooseRegion"),
                      itemSuffix: t("payPer.regionCountSuffix"),
                    }}
                  />
                  <p className="text-xs leading-5 text-muted-foreground">{t("payPer.feeNote")}</p>
                </div>
              </div>
            </section>

            <section className="border-t p-6 text-center lg:p-8">
              <Link
                href="/client/settings/subscription"
                className="inline-flex min-h-10 items-center justify-center text-sm font-semibold text-brand-500 transition hover:text-brand-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                管理订阅方案
              </Link>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                查看当前月付方案、续费日期，或取消月付。
              </p>
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}
