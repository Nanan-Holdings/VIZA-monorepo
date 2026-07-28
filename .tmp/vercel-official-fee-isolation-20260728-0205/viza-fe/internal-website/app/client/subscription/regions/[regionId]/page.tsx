import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, MapPinned } from "lucide-react";
import { getPayPerRegion } from "../../pay-per-data";
import { PayPerRow } from "../../pay-per-application-browser";

interface SubscriptionRegionPageProps {
  params: Promise<{ regionId: string }>;
}

export default async function SubscriptionRegionPage({ params }: SubscriptionRegionPageProps) {
  const [{ regionId }, locale, t] = await Promise.all([
    params,
    getLocale(),
    getTranslations("subscription.payPer"),
  ]);
  const region = getPayPerRegion(regionId);
  if (!region) notFound();

  const isZh = locale.toLowerCase().startsWith("zh");

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-16">
      <Link
        href="/client/subscription"
        className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-brand-500 shadow-sm transition hover:border-brand-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("backToSubscription")}
      </Link>

      <section className="rounded-xl border bg-white p-6 shadow-sm lg:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-4">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-50 text-2xl">
              {region.flag}
            </span>
            <div>
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-brand-500">
                <MapPinned className="h-4 w-4" />
                {t("regionDetailEyebrow")}
              </p>
              <h1 className="mt-2 text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
                {isZh ? region.nameZh : region.name}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                {isZh ? region.descriptionZh : region.description}
              </p>
            </div>
          </div>
          <span className="w-fit rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-500">
            {region.items.length} {t("regionCountSuffix")}
          </span>
        </div>

        <div className="mt-6 grid gap-3">
          {region.items.map((item) => (
            <PayPerRow key={item.id} item={item} isZh={isZh} />
          ))}
        </div>

        <p className="mt-5 text-xs leading-5 text-muted-foreground">{t("feeNote")}</p>
      </section>
    </main>
  );
}
