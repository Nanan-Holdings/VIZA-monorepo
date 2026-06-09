"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Loader2, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  DESTINATION_REGION_GROUP_DESTINATIONS,
  FEATURED_VISA_DESTINATIONS,
  SEARCHABLE_VISA_DESTINATIONS,
  getVisaDestinationCountryName,
  getVisaDestinationDescription,
  getVisaDestinationKey,
  getVisaDestinationRegionName,
  getVisaDestinationVisaName,
  type PopularVisaDestination,
} from "@/lib/visa-destinations";
import {
  selectUserVisaDestination,
  type UserVisaPackage,
} from "@/app/actions/user-package";
import { SmoothProgressMeter } from "@/components/smooth-progress";

function isSelectedDestination(
  destination: PopularVisaDestination,
  selectedPackages: UserVisaPackage[],
): boolean {
  if (destination.kind === "group") return false;
  const destinationKey = getVisaDestinationKey(destination.country, destination.visaType);
  return selectedPackages.some(
    (selectedPackage) => getVisaDestinationKey(selectedPackage.country, selectedPackage.visa_type) === destinationKey,
  );
}

function matchesDestinationSearch(destination: PopularVisaDestination, normalizedSearch: string): boolean {
  const searchableText = [
    destination.countryName,
    destination.countryNameZh,
    destination.visaName,
    destination.visaNameZh,
    destination.description,
    destination.descriptionZh,
    destination.region,
    destination.supportLabel,
    ...(destination.searchAliases ?? []),
  ].join(" ").toLowerCase();
  return searchableText.includes(normalizedSearch);
}

export interface DestinationApplicationProgress {
  applicationId: string;
  status: string;
  percent: number;
  label: string;
  updatedAt: string | null;
}

export function PopularDestinationsSection({
  selectedPackages,
  applicationProgress,
}: {
  selectedPackages: UserVisaPackage[];
  applicationProgress: Record<string, DestinationApplicationProgress>;
}) {
  const t = useTranslations("home.popularDestinations");
  const locale = useLocale();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingDestinationId, setPendingDestinationId] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const searchResults = normalizedSearch
    ? SEARCHABLE_VISA_DESTINATIONS.filter((destination) => matchesDestinationSearch(destination, normalizedSearch))
    : [];

  function handleSelect(destination: PopularVisaDestination) {
    setSelectionError(null);

    if (destination.kind === "group" && destination.href) {
      router.push(destination.href);
      return;
    }

    setPendingDestinationId(destination.id);

    startTransition(async () => {
      const result = await selectUserVisaDestination(destination.id);
      if (!result.success) {
        setSelectionError(result.error ?? t("selectError"));
        setPendingDestinationId(null);
        return;
      }

      router.push(
        `/client/application?country=${encodeURIComponent(destination.country)}&visaType=${encodeURIComponent(destination.visaType)}`,
      );
    });
  }

  function renderDestinationCard(destination: PopularVisaDestination) {
    const countryName = getVisaDestinationCountryName(destination, locale);
    const visaName = getVisaDestinationVisaName(destination, locale);
    const description = getVisaDestinationDescription(destination, locale);
    const regionName = getVisaDestinationRegionName(destination.region, locale);
    const isGroup = destination.kind === "group";
    const progress = isGroup
      ? undefined
      : applicationProgress[getVisaDestinationKey(destination.country, destination.visaType)];
    const selected = isSelectedDestination(destination, selectedPackages) || Boolean(progress);
    const highlighted = selected && !isGroup;
    const loading = isPending && pendingDestinationId === destination.id;
    const actionLabel = isGroup
      ? t("browseRegion")
      : progress
        ? t("continue")
        : selected
          ? t("open")
          : t("start");
    const progressLabel = progress
      ? progress.label
      : selected
        ? t("addedNotStarted")
        : isGroup
          ? t("countriesCount", { count: destination.countryCount ?? 0 })
          : t("readyToStart");
    const progressPill = isGroup
      ? (destination.countryCount ?? 0) > 0
        ? t("chooseCountry")
        : t("comingSoon")
      : progress
        ? t("progressPill", { pct: progress.percent })
        : selected
          ? t("selectedNotFilled")
          : t("fillable");

    return (
      <button
        key={destination.id}
        type="button"
        onClick={() => handleSelect(destination)}
        disabled={loading}
        className={[
          "group flex min-h-[172px] flex-col justify-between rounded-[16px] border bg-white p-5 text-left transition",
          highlighted
            ? "border-[#03346E] shadow-[0_12px_30px_rgba(3,52,110,0.12)]"
            : "border-[#efefef] hover:border-[#c7d5e8] hover:shadow-[0_10px_26px_rgba(15,23,42,0.08)]",
          loading ? "cursor-wait opacity-80" : "cursor-pointer",
        ].join(" ")}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-[34px] leading-none" aria-hidden="true">
              {destination.flag}
            </span>
            <div>
              <p className="font-heading text-[18px] font-medium leading-tight text-[#222]">
                {countryName}
              </p>
              <p className="mt-1 text-[13px] font-medium text-[#637083]">
                {countryName} · {regionName}
              </p>
            </div>
          </div>
          {selected && !isGroup && <CheckCircle2 className="h-5 w-5 shrink-0 text-[#03346E]" />}
        </div>

        <div className="mt-5 space-y-3">
          <div>
            <p className="text-[15px] font-semibold leading-5 text-[#03346E]">
              {visaName}
            </p>
            <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-[rgba(0,0,0,0.55)]">
              {description}
            </p>
          </div>

          <SmoothProgressMeter
            serverProgress={progress?.percent ?? 0}
            status={progress && progress.percent >= 100 ? "completed" : progress || selected ? "running" : "waiting_for_user"}
            intervalMs={140}
            label={progressLabel}
            ariaLabel={t("progressAriaLabel", { country: countryName })}
            labelClassName="text-[12px] font-medium text-[#526174]"
            valueClassName={progress || selected ? "text-[12px] font-medium text-[#526174]" : "hidden"}
            size="xs"
          />

          <div className="flex items-center justify-between gap-3">
            <span className="rounded-full bg-[#f3f6fa] px-2.5 py-1 text-[12px] font-medium text-[#526174]">
              {progressPill}
            </span>
            <span className="inline-flex items-center gap-1 text-[14px] font-semibold text-[#03346E]">
              {loading ? t("starting") : actionLabel}
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              )}
            </span>
          </div>
        </div>
      </button>
    );
  }

  return (
    <section className="mt-10 w-full max-w-[1090px] xl:mt-12">
      <div className="mb-8 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="font-heading text-[30px] font-medium leading-[1.3] tracking-[-0.9px] text-[#3d3d3d]">
            {t("heading")}
          </p>
          <p className="mt-2 max-w-3xl text-[16px] leading-6 text-[rgba(0,0,0,0.52)]">
            {t("subheading")}
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center xl:w-auto">
          <label className="relative w-full sm:w-[320px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a94a3]" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t("searchPlaceholder")}
              className="h-11 w-full rounded-full border border-[#dce5f0] bg-white pl-10 pr-4 text-[14px] font-medium text-[#26364a] outline-none transition focus:border-[#03346E] focus:shadow-[0_0_0_3px_rgba(3,52,110,0.08)]"
            />
          </label>
          <span className="w-fit rounded-full bg-[#eef3fa] px-3 py-1 text-[13px] font-medium text-[#03346E]">
            {t("schemaReady")}
          </span>
        </div>
      </div>

      {selectionError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {selectionError}
        </div>
      )}

      {normalizedSearch ? (
        <>
          <p className="mb-3 text-[15px] font-semibold text-[#03346E]">{t("searchResultsHeading")}</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {searchResults.map(renderDestinationCard)}
          </div>
          {searchResults.length === 0 && (
            <div className="rounded-[16px] border border-dashed border-[#dce5f0] bg-white px-5 py-10 text-center">
              <p className="text-[15px] font-medium text-[#526174]">{t("noSearchResults")}</p>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col gap-8">
          <div>
            <p className="mb-3 text-[15px] font-semibold text-[#03346E]">{t("featuredHeading")}</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {FEATURED_VISA_DESTINATIONS.map(renderDestinationCard)}
            </div>
          </div>

          <div>
            <p className="mb-3 text-[15px] font-semibold text-[#03346E]">{t("regionHeading")}</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {DESTINATION_REGION_GROUP_DESTINATIONS.map(renderDestinationCard)}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
