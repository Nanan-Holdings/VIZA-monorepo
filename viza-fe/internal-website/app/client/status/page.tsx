import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, FileText } from "@phosphor-icons/react/ssr";
import { getLocale, getTranslations } from "next-intl/server";
import {
  ApplicationsList,
} from "./applications-list";
import {
  getClientStatusData,
  type ClientStatusData,
} from "./status-data";
import {
  normalizeCountryParam,
  toApplicationListItem,
} from "./application-list-items";
import { StatusGuide } from "./status-guide";
import { buildApplicationLongFormHref } from "@/lib/client/recent-application-form";

type SearchParams = Promise<{
  applicationId?: string | string[];
  packageId?: string | string[];
  country?: string | string[];
  view?: string | string[];
}>;

export const dynamic = "force-dynamic";

function getParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function EmptyState({ t }: { t: Awaited<ReturnType<typeof getTranslations>> }) {
  return (
    <section className="rounded-xl border border-dashed border-[#cbd8ea] bg-white px-6 py-14 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-500">
        <FileText className="h-6 w-6" />
      </div>
      <h2 className="mt-4 font-heading text-[24px] font-medium text-[#26364a]">
        {t("empty.title")}
      </h2>
      <p className="mx-auto mt-2 max-w-lg text-[15px] leading-6 text-[#66758a]">
        {t("empty.description")}
      </p>
      <Link
        href="/client/application"
        className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand-500 px-5 py-2 text-[14px] font-semibold text-white transition hover:bg-brand-600"
      >
        {t("empty.cta")}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </section>
  );
}

function ApplicationsIndex({
  data,
  locale,
  t,
  expandedCountry,
}: {
  data: ClientStatusData;
  locale: string;
  t: Awaited<ReturnType<typeof getTranslations>>;
  expandedCountry: string | null;
}) {
  const items = data.applications.map((application) =>
    toApplicationListItem(application, locale, t)
  );
  const matchedExpandedCountry = expandedCountry
    ? (items.find(
        (item) => normalizeCountryParam(item.countryKey) === expandedCountry
      )?.countryKey ?? null)
    : null;

  return (
    <div className="mx-auto w-full max-w-[1040px] pb-16">
      <section className="pt-4">
        <div>
          <h1 className="text-3xl font-semibold text-foreground sm:text-4xl">
            {t("index.title")}
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-7 text-muted-foreground">
            {t("index.subtitle")}
          </p>
        </div>
      </section>

      <section className="mt-8">
        {items.length === 0 ? (
          <>
            <h2 className="mb-4 font-heading text-[22px] font-medium text-[#26364a]">
              {t("index.yourApplications")}
            </h2>
            <EmptyState t={t} />
          </>
        ) : (
          <ApplicationsList
            items={items}
            initialExpandedCountry={matchedExpandedCountry}
          />
        )}
      </section>

      <StatusGuide t={t} className="mt-8" />
    </div>
  );
}

export default async function ClientStatusPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const params = searchParams ? await searchParams : {};
  const [t, locale, data] = await Promise.all([
    getTranslations("clientStatus"),
    getLocale(),
    getClientStatusData(),
  ]);
  if (!data.authenticated) redirect("/client/login");

  const selectedApplicationId = getParam(params.applicationId);
  const selectedPackageId = getParam(params.packageId);
  const selectedCountry = normalizeCountryParam(getParam(params.country));

  if (selectedApplicationId) {
    const application = data.detailApplications.find(
      (candidate) => candidate.id === selectedApplicationId
    );
    if (application?.id) {
      redirect(buildApplicationLongFormHref({
        applicationId: application.id,
        country: application.country,
        visaType: application.visaType,
        step: "status",
      }));
    }
  }

  if (selectedPackageId) {
    const application = data.detailApplications.find(
      (candidate) => candidate.packageId === selectedPackageId
    );
    if (application?.id) {
      redirect(buildApplicationLongFormHref({
        applicationId: application.id,
        country: application.country,
        visaType: application.visaType,
        step: "status",
      }));
    }
  }

  return (
    <ApplicationsIndex
      data={data}
      locale={locale}
      t={t}
      expandedCountry={selectedCountry}
    />
  );
}
