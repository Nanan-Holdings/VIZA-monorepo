import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, FileText } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { AddDestinationSection } from "./add-destination-section";
import {
  ApplicationsList,
  type ApplicationListItem,
  type ApplicationListRecord,
  type ApplicationListTone,
} from "./applications-list";
import {
  getClientStatusData,
  type ClientStatusData,
  type ClientStatusState,
  type StatusApplication,
} from "./status-data";
import {
  getPopularVisaDestinationByPackage,
  getVisaDestinationKey,
} from "@/lib/visa-destinations";
import { isOngoingApplicationState } from "@/lib/client/active-application-selection";

type SearchParams = Promise<{
  applicationId?: string | string[];
  packageId?: string | string[];
  country?: string | string[];
  view?: string | string[];
}>;

export const dynamic = "force-dynamic";

const LIST_TONE: Record<ClientStatusState, ApplicationListTone> = {
  not_started: "brand",
  needs_payment: "alert",
  needs_consent: "warn",
  in_progress: "brand",
  needs_documents: "warn",
  packet_pending: "brand",
  external_pending: "brand",
  submitted: "brand",
  needs_attention: "warn",
  approved: "success",
  rejected: "alert",
};

function getParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function normalizeCountryParam(value: string | null): string | null {
  if (!value) return null;
  const decoded = decodeURIComponent(value).trim().toLowerCase();
  if (!decoded) return null;
  const aliases: Record<string, string> = {
    malaysia: "马来西亚",
    my: "马来西亚",
    马来西亚: "马来西亚",
    thailand: "泰国",
    th: "泰国",
    泰国: "泰国",
    singapore: "新加坡",
    sg: "新加坡",
    新加坡: "新加坡",
  };
  return aliases[decoded] ?? decoded;
}

function statusLabel(
  state: ClientStatusState,
  t: Awaited<ReturnType<typeof getTranslations>>,
): string {
  return t(`states.${state}`);
}

function toApplicationListItem(
  application: StatusApplication,
  locale: string,
  t: Awaited<ReturnType<typeof getTranslations>>,
): ApplicationListItem {
  const isZh = locale.startsWith("zh");
  const catalogueDestination = getPopularVisaDestinationByPackage(
    application.country,
    application.visaType,
  );
  const records: ApplicationListRecord[] = application.applicationRecords.map((record) => ({
    selectionKey: record.id,
    applicationId: record.applicationId,
    packageId: record.packageId,
    visaLabel: isZh ? record.visaTypeLabelZh : record.visaTypeLabel,
    stateLabel: statusLabel(record.state, t),
    tone: LIST_TONE[record.state],
    progressPercent: record.progressPercent,
    country: record.country,
    visaType: record.visaType,
    continueHref: record.continueHref,
    detailHref: record.detailHref,
    ongoing: isOngoingApplicationState(record.state),
  }));
  const primaryRecord = records.find((record) => record.ongoing) ?? records[0] ?? null;

  return {
    key: application.key,
    countryKey: application.countryKey,
    flag: application.countryFlag,
    countryLabel: isZh ? application.countryNameZh : application.countryName,
    visaLabel: primaryRecord?.visaLabel ?? (isZh ? application.visaTypeLabelZh : application.visaTypeLabel),
    stateLabel: primaryRecord?.stateLabel ?? statusLabel(application.state, t),
    tone: primaryRecord?.tone ?? LIST_TONE[application.state],
    progressPercent: primaryRecord?.progressPercent ?? application.progressPercent,
    continueHref: primaryRecord?.continueHref ?? "/client/application",
    country: application.country,
    visaType: application.visaType,
    destinationId: catalogueDestination?.id ?? null,
    records,
  };
}

function EmptyState({ t }: { t: Awaited<ReturnType<typeof getTranslations>> }) {
  return (
    <section className="rounded-xl border border-dashed border-[#cbd8ea] bg-white px-6 py-14 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-500">
        <FileText className="h-6 w-6" />
      </div>
      <h2 className="mt-4 font-heading text-[24px] font-medium text-[#26364a]">{t("empty.title")}</h2>
      <p className="mx-auto mt-2 max-w-lg text-[15px] leading-6 text-[#66758a]">{t("empty.description")}</p>
      <Link href="#add-destination" className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand-500 px-5 py-2 text-[14px] font-semibold text-white transition hover:bg-brand-600">
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
  const items = data.applications.map((application) => toApplicationListItem(application, locale, t));
  const matchedExpandedCountry = expandedCountry
    ? items.find((item) => normalizeCountryParam(item.countryKey) === expandedCountry)?.countryKey ?? null
    : null;

  return (
    <div className="mx-auto w-full max-w-[1090px] pb-24 pt-5 sm:pt-8">
      <h1 className="font-heading text-[32px] font-medium leading-tight tracking-[-0.96px] text-[#26364a]">{t("index.title")}</h1>
      <p className="mt-2.5 max-w-[56ch] text-[16px] leading-6 text-[#66758a]">{t("index.subtitle")}</p>

      <section className="mt-8">
        {items.length === 0 ? (
          <>
            <h2 className="mb-4 font-heading text-[22px] font-medium text-[#26364a]">{t("index.yourApplications")}</h2>
            <EmptyState t={t} />
          </>
        ) : (
          <ApplicationsList items={items} initialExpandedCountry={matchedExpandedCountry} />
        )}
      </section>

      <div id="add-destination">
        <AddDestinationSection startedKeys={items.map((item) => getVisaDestinationKey(item.country, item.visaType))} />
      </div>
    </div>
  );
}

export default async function ClientStatusPage({ searchParams }: { searchParams?: SearchParams }) {
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
    const application = data.detailApplications.find((candidate) => candidate.id === selectedApplicationId);
    if (application?.id) {
      redirect(`/client/application/long-form?applicationId=${encodeURIComponent(application.id)}&step=status`);
    }
  }

  if (selectedPackageId) {
    const application = data.detailApplications.find((candidate) => candidate.packageId === selectedPackageId);
    if (application?.id) {
      redirect(`/client/application/long-form?applicationId=${encodeURIComponent(application.id)}&step=status`);
    }
  }

  return <ApplicationsIndex data={data} locale={locale} t={t} expandedCountry={selectedCountry} />;
}
