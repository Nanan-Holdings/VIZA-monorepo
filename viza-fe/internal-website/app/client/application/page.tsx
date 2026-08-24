import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, FileText } from "@phosphor-icons/react/ssr";
import { getLocale, getTranslations } from "next-intl/server";
import { AddDestinationSection } from "@/app/client/status/add-destination-section";
import { ApplicationsList } from "@/app/client/status/applications-list";
import {
  getClientStatusData,
  type ClientStatusData,
} from "@/app/client/status/status-data";
import { StatusGuide } from "@/app/client/status/status-guide";
import { toApplicationListItem } from "@/app/client/status/application-list-items";
import { getRecentApplicationTarget } from "@/app/client/application/recent-application-target";
import { BackButton } from "@/components/ui/back-button";
import { getVisaDestinationKey } from "@/lib/visa-destinations";

export const dynamic = "force-dynamic";

function EmptyApplications({
  t,
}: {
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  return (
    <section className="rounded-xl border border-dashed border-[#cbd8ea] bg-white px-6 py-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-500">
        <FileText className="h-6 w-6" />
      </div>
      <h2 className="mt-4 font-heading text-[22px] font-medium text-[#26364a]">
        {t("emptyApplications.title")}
      </h2>
      <p className="mx-auto mt-2 max-w-lg text-[15px] leading-6 text-[#66758a]">
        {t("emptyApplications.description")}
      </p>
    </section>
  );
}

function ApplicationCenter({
  data,
  locale,
  t,
  tStatus,
}: {
  data: ClientStatusData;
  locale: string;
  t: Awaited<ReturnType<typeof getTranslations>>;
  tStatus: Awaited<ReturnType<typeof getTranslations>>;
}) {
  const items = data.applications.map((application) =>
    toApplicationListItem(application, locale, tStatus)
  );
  const recentTarget = getRecentApplicationTarget(items);
  const primaryCtaLabel = t(`primaryCta.${recentTarget.labelMode}`);

  return (
    <div className="mx-auto w-full max-w-[1040px] pb-16 scroll-smooth">
      <div className="mb-4">
        <BackButton fallbackHref="/client/home" label={t("back")} />
      </div>

      <section className="relative left-1/2 w-screen -translate-x-1/2 border-y border-[#dce5f0] bg-[#eef4fb]">
        <div className="mx-auto max-w-[1040px] px-4 py-7 sm:px-6 md:px-10 xl:px-0">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <h1 className="text-[32px] font-semibold leading-tight text-[#172235] sm:text-[40px]">
                {t("title")}
              </h1>
              <p className="mt-2 text-[16px] leading-7 text-[#526173]">
                {t("subtitle")}
              </p>
            </div>
            <Link
              href={recentTarget.href}
              className="inline-flex min-h-11 w-fit shrink-0 items-center justify-center gap-2 rounded-full bg-brand-500 px-5 py-2 text-[14px] font-semibold text-white shadow-sm transition hover:bg-brand-600"
            >
              {primaryCtaLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <nav
            aria-label={t("sectionNavLabel")}
            className="mt-6 grid grid-cols-1 overflow-hidden rounded-lg border border-[#c8d5e5] bg-white sm:inline-grid sm:grid-cols-3"
          >
            <Link
              href="#my-applications"
              className="inline-flex min-h-11 items-center justify-center border-b border-[#dce5f0] px-4 text-[13px] font-semibold text-[#26364a] transition hover:bg-brand-50 hover:text-brand-600 sm:border-b-0 sm:border-r"
            >
              {t("sectionNav.myApplications")}
            </Link>
            <Link
              href="#application-status-guide"
              className="inline-flex min-h-11 items-center justify-center border-b border-[#dce5f0] px-4 text-[13px] font-semibold text-[#26364a] transition hover:bg-brand-50 hover:text-brand-600 sm:border-b-0 sm:border-r"
            >
              {t("sectionNav.statusGuide")}
            </Link>
            <Link
              href="#start-new-application"
              className="inline-flex min-h-11 items-center justify-center px-4 text-[13px] font-semibold text-[#26364a] transition hover:bg-brand-50 hover:text-brand-600"
            >
              {t("sectionNav.startNew")}
            </Link>
          </nav>
        </div>
      </section>

      <section
        id="my-applications"
        className="mt-7 scroll-mt-[152px] sm:scroll-mt-36 xl:scroll-mt-32"
      >
        <div className="mb-4">
          <h2 className="font-heading text-[22px] font-medium text-[#26364a]">
            {t("myApplicationsTitle")}
          </h2>
          <p className="mt-1 max-w-2xl text-[14px] leading-6 text-[#66758a]">
            {t("myApplicationsDescription")}
          </p>
        </div>

        {items.length === 0 ? (
          <EmptyApplications t={t} />
        ) : (
          <ApplicationsList
            items={items}
            initialExpandedCountry={null}
            mode="manage"
            showManageHeader={false}
          />
        )}
      </section>

      <section
        id="application-status-guide"
        className="mt-9 scroll-mt-[152px] border-t border-[#e9edf3] pt-8 sm:scroll-mt-36 xl:scroll-mt-32"
      >
        <StatusGuide t={tStatus} />
      </section>

      <AddDestinationSection
        id="start-new-application"
        className="mt-9 border-t border-[#e9edf3] pt-8 scroll-mt-[152px] sm:scroll-mt-36 xl:scroll-mt-32"
        startedKeys={items.map((item) =>
          getVisaDestinationKey(item.country, item.visaType)
        )}
      />
    </div>
  );
}

export default async function ApplicationCenterPage() {
  const [t, tStatus, locale, data] = await Promise.all([
    getTranslations("applicationCenter"),
    getTranslations("clientStatus"),
    getLocale(),
    getClientStatusData(),
  ]);
  if (!data.authenticated) redirect("/client/login");

  return (
    <ApplicationCenter
      data={data}
      locale={locale}
      t={t}
      tStatus={tStatus}
    />
  );
}
