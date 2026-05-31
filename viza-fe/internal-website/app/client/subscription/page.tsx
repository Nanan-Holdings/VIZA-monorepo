import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  CreditCard,
  FileText,
  Globe2,
  Plane,
  Sparkles,
  UsersRound,
  XCircle,
} from "lucide-react";

const monthlyPlans = [
  {
    id: "access",
    price: "$24.99",
    cadence: "/mo",
    countryLimit: 7,
    featured: false,
    featureKeys: ["countryAccess", "requirements", "checklist", "multilingual", "status"],
    unavailableKeys: ["ai", "group", "travel"],
  },
  {
    id: "pro",
    price: "$49",
    cadence: "/mo",
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

const payPerApplicationCountries = [
  { countryKey: "singapore", price: 19 },
  { countryKey: "malaysia", price: 19 },
  { countryKey: "thailand", price: 19 },
  { countryKey: "indonesia", price: 29 },
  { countryKey: "vietnam", price: 29 },
  { countryKey: "cambodia", price: 29 },
  { countryKey: "uae", price: 39 },
  { countryKey: "turkey", price: 39 },
  { countryKey: "japan", price: 49 },
  { countryKey: "southKorea", price: 49 },
  { countryKey: "australia", price: 79 },
  { countryKey: "newZealand", price: 79 },
  { countryKey: "schengen", price: 89 },
  { countryKey: "uk", price: 89 },
  { countryKey: "canada", price: 89 },
  { countryKey: "us", price: 99 },
] as const;

const planHighlights = [
  { icon: Globe2, labelKey: "allCountries" },
  { icon: CreditCard, labelKey: "twoWays" },
  { icon: FileText, labelKey: "officialFees" },
] as const;

export default async function SubscriptionPage() {
  const t = await getTranslations("subscription");

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
                  <p className="mt-1 text-2xl font-semibold text-brand-500">{t("current.plan")}</p>
                </div>
                <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-500">
                  {t("current.badge")}
                </span>
              </div>
              <div className="mt-5 grid gap-3">
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">{t("current.renewalLabel")}</span>
                  <span className="font-semibold text-foreground">{t("current.renewalValue")}</span>
                </div>
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">{t("current.paymentLabel")}</span>
                  <span className="font-semibold text-foreground">{t("current.paymentValue")}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-0 divide-y">
            <section className="grid gap-4 p-6 md:grid-cols-3 lg:p-8">
              {planHighlights.map((item) => {
                const Icon = item.icon;

                return (
                  <div key={item.labelKey} className="rounded-xl border bg-white p-5">
                    <Icon className="h-5 w-5 text-brand-500" />
                    <p className="mt-4 text-base font-semibold text-foreground">
                      {t(`highlights.${item.labelKey}.title`)}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {t(`highlights.${item.labelKey}.body`)}
                    </p>
                  </div>
                );
              })}
            </section>

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
                {monthlyPlans.map((plan) => (
                  <article
                    key={plan.id}
                    className={
                      plan.featured
                        ? "flex min-h-[420px] flex-col rounded-xl border border-brand-500 bg-brand-500 p-6 text-white shadow-sm"
                        : "flex min-h-[420px] flex-col rounded-xl border bg-white p-6 shadow-sm"
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
                          <span className="text-4xl font-semibold leading-none">{plan.price}</span>
                          <span className={plan.featured ? "pb-1 text-sm font-medium text-white/70" : "pb-1 text-sm font-medium text-muted-foreground"}>
                            {plan.cadence}
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

                    <button
                      className={
                        plan.featured
                          ? "mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-brand-500 transition hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white"
                          : "mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-brand-500 px-5 py-2.5 text-sm font-semibold text-brand-500 transition hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      }
                      type="button"
                    >
                      {t("monthly.cta")}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </article>
                ))}
              </div>
            </section>

            <section className="p-6 lg:p-8">
              <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
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
                  </div>
                </div>

                <div className="rounded-xl border bg-white p-4 shadow-sm sm:p-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {payPerApplicationCountries.map((item) => (
                      <div
                        key={item.countryKey}
                        className="flex min-h-16 items-center justify-between gap-3 rounded-lg border bg-background px-4 py-3"
                      >
                        <span className="text-sm font-semibold text-foreground">
                          {t(`payPer.countries.${item.countryKey}`)}
                        </span>
                        <span className="shrink-0 rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-500">
                          ${item.price}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-xs leading-5 text-muted-foreground">{t("payPer.feeNote")}</p>
                </div>
              </div>
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}
