"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CircleNotch as Loader2,
  MagnifyingGlass as Search,
} from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { isChineseLocale } from "@/lib/i18n/locale";
import { isCountryLaunched } from "@/lib/launched-countries";
import { DestinationFlag } from "@/components/client/home/DestinationFlag";
import { selectUserVisaDestination } from "@/app/actions/user-package";
import { buildApplicationLongFormHref } from "@/lib/client/recent-application-form";
import {
  VISA_DESTINATION_COUNTRY_GROUPS,
  VISA_DESTINATION_COUNTRY_REGIONS,
  getVisaDestinationDescription,
  getVisaDestinationKey,
  getVisaDestinationRegionName,
  getVisaDestinationVisaName,
  matchesVisaDestinationSearch,
  type PopularVisaDestination,
  type VisaDestinationCountryGroup,
} from "@/lib/visa-destinations";

const ALL_REGIONS = "__all__";
const DESTINATION_SELECTION_UI_TIMEOUT_MS = 5_000;

async function selectWithDeadline(destinationId: string) {
  let timeout: number | undefined;
  try {
    return await Promise.race([
      selectUserVisaDestination(destinationId),
      new Promise<never>((_, reject) => {
        timeout = window.setTimeout(
          () => reject(new Error("destination_selection_timeout")),
          DESTINATION_SELECTION_UI_TIMEOUT_MS
        );
      }),
    ]);
  } finally {
    if (timeout) window.clearTimeout(timeout);
  }
}

function matchesGroup(
  group: VisaDestinationCountryGroup,
  query: string
): boolean {
  if (!query) return true;
  return group.destinations.some((destinationItem) =>
    matchesVisaDestinationSearch(destinationItem, query)
  );
}

function isGroupAvailable(group: VisaDestinationCountryGroup): boolean {
  return group.destinations.some(
    (destinationItem) =>
      destinationItem.kind === "group" ||
      isCountryLaunched(destinationItem.country)
  );
}

function isGroupStarted(
  group: VisaDestinationCountryGroup,
  started: Set<string>
): boolean {
  return group.destinations.some(
    (destinationItem) =>
      destinationItem.kind !== "group" &&
      started.has(
        getVisaDestinationKey(destinationItem.country, destinationItem.visaType)
      )
  );
}

function isBrowseGroup(group: VisaDestinationCountryGroup): boolean {
  return group.destinations.some(
    (destinationItem) => destinationItem.kind === "group"
  );
}

export function getGroupSortRank(
  group: VisaDestinationCountryGroup,
  started: Set<string>
): number {
  if (isBrowseGroup(group)) return 0;
  if (isGroupAvailable(group) && !isGroupStarted(group, started)) return 1;
  if (isGroupStarted(group, started)) return 2;
  return 3;
}

export function AddDestinationSection({
  startedKeys,
}: {
  startedKeys: string[];
}) {
  const t = useTranslations("clientStatus.index");
  const locale = useLocale();
  const isZh = isChineseLocale(locale);
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [region, setRegion] = useState<string>(ALL_REGIONS);
  const [pendingDestinationId, setPendingDestinationId] = useState<
    string | null
  >(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);

  const started = useMemo(() => new Set(startedKeys), [startedKeys]);

  const visibleGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return VISA_DESTINATION_COUNTRY_GROUPS.filter(
      (group) =>
        (region === ALL_REGIONS || group.region === region) &&
        matchesGroup(group, normalizedQuery)
    ).sort(
      (first, second) =>
        getGroupSortRank(first, started) - getGroupSortRank(second, started)
    );
  }, [query, region, started]);

  function handleSelect(destinationItem: PopularVisaDestination) {
    if (pendingDestinationId) return;
    setSelectionError(null);

    // Group entries (Schengen) drill into their own picker before a form exists.
    if (destinationItem.kind === "group" && destinationItem.href) {
      router.push(destinationItem.href);
      return;
    }

    setPendingDestinationId(destinationItem.id);
    router.push(
      buildApplicationLongFormHref({
        country: destinationItem.country,
        visaType: destinationItem.visaType,
      })
    );
    void (async () => {
      try {
        const result = await selectWithDeadline(destinationItem.id);
        if (!result.success)
          setSelectionError(result.error ?? t("selectError"));
      } catch {
        setSelectionError(t("selectError"));
      } finally {
        setPendingDestinationId(null);
      }
    })();
  }

  return (
    <section className="mt-12">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="font-heading text-[22px] font-medium text-[#26364a]">
          {t("addDestination")}
        </h2>
        <p className="text-[14px] text-[#8a94a6]">{t("addDestinationHint")}</p>
      </div>

      <label className="relative mb-4 flex items-center">
        <Search className="pointer-events-none absolute left-4 h-[18px] w-[18px] text-[#8a94a6]" />
        <span className="sr-only">{t("searchLabel")}</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("searchPlaceholder")}
          autoComplete="off"
          className="h-[46px] w-full rounded-full border border-[#e8e8e8] bg-white pl-11 pr-4 text-[15px] text-[#26364a] outline-none transition placeholder:text-[#8a94a6] focus-visible:border-brand-500 focus-visible:ring-1 focus-visible:ring-brand-500"
        />
      </label>

      <div className="mb-5 flex flex-wrap gap-2">
        {[ALL_REGIONS, ...VISA_DESTINATION_COUNTRY_REGIONS].map((regionId) => {
          const pressed = region === regionId;
          return (
            <button
              key={regionId}
              type="button"
              aria-pressed={pressed}
              onClick={() => setRegion(regionId)}
              className={cn(
                "inline-flex h-11 items-center rounded-full border px-[14px] text-[13px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 sm:h-8",
                pressed
                  ? "border-brand-500 text-brand-500"
                  : "border-[#e5e7eb] bg-white text-[#66758a] hover:bg-[#fbfbfb]"
              )}
            >
              {regionId === ALL_REGIONS
                ? t("allRegions")
                : getVisaDestinationRegionName(regionId, locale)}
            </button>
          );
        })}
      </div>

      {selectionError && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-[#f4c7c3] bg-[#fff8f7] px-4 py-3 text-[14px] text-[#b42318]"
        >
          {selectionError}
        </div>
      )}

      {visibleGroups.length === 0 ? (
        <div className="rounded-2xl border border-[#efefef] bg-white p-10 text-center">
          <p className="font-heading text-[17px] font-medium text-[#26364a]">
            {t("noResultsTitle")}
          </p>
          <p className="mt-1.5 text-[14px] text-[#66758a]">
            {t("noResultsBody")}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleGroups.map((group) => {
            const groupAvailable = isGroupAvailable(group);
            const groupStarted = isGroupStarted(group, started);
            const countryName = isZh ? group.countryNameZh : group.countryName;
            const groupBrowses = group.destinations.some(
              (destinationItem) => destinationItem.kind === "group"
            );
            const primaryDestination = group.destinations.find(
              (destinationItem) =>
                destinationItem.kind === "group" ||
                isCountryLaunched(destinationItem.country)
            );
            const groupStatus = !groupAvailable
              ? t("comingSoon")
              : groupStarted
                ? t("added")
                : groupBrowses
                  ? t("browse")
                  : null;
            return (
              <li
                key={group.key}
                className={cn(
                  "relative flex flex-col gap-3.5 rounded-2xl border px-5 py-[18px] transition-colors duration-150",
                  groupAvailable
                    ? "border-[#efefef] bg-white hover:bg-[#f7f9fc]"
                    : "border-[#e5e5e5] bg-[#f3f3f3]"
                )}
              >
                <button
                  type="button"
                  aria-label={
                    primaryDestination
                      ? `${countryName}: ${getVisaDestinationVisaName(primaryDestination, locale)}`
                      : countryName
                  }
                  data-testid="destination-card-hit-area"
                  disabled={
                    !primaryDestination || Boolean(pendingDestinationId)
                  }
                  onClick={() => {
                    if (primaryDestination) handleSelect(primaryDestination);
                  }}
                  className="absolute inset-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed"
                />

                <div className="pointer-events-none relative z-10 flex items-center gap-3">
                  <DestinationFlag flag={group.flag} size={30} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p
                        className={cn(
                          "font-heading text-[16px] font-medium",
                          groupAvailable ? "text-[#26364a]" : "text-[#7d8794]"
                        )}
                      >
                        {countryName}
                      </p>
                      {groupStatus ? (
                        <span className="shrink-0 text-[12px] font-medium text-[#8a94a6]">
                          {groupStatus}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-px text-[12px] text-[#8a94a6]">
                      {getVisaDestinationRegionName(group.region, locale)}
                    </p>
                  </div>
                </div>

                <div className="pointer-events-none relative z-10 flex flex-col">
                  {group.destinations.map((destinationItem) => {
                    const isGroup = destinationItem.kind === "group";
                    const launched =
                      isGroup || isCountryLaunched(destinationItem.country);
                    const loading = pendingDestinationId === destinationItem.id;
                    const action = loading ? (
                      <>
                        {t("starting")}
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </>
                    ) : null;

                    return (
                      <button
                        key={destinationItem.id}
                        type="button"
                        onClick={() => handleSelect(destinationItem)}
                        disabled={loading || !launched}
                        aria-disabled={!launched}
                        title={launched ? undefined : t("comingSoon")}
                        className={cn(
                          "group pointer-events-auto flex min-h-11 items-center justify-between gap-3 border-t border-[#efefef] py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
                          !launched
                            ? "cursor-not-allowed opacity-50"
                            : loading
                              ? "cursor-wait opacity-80"
                              : "cursor-pointer"
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block text-[14px] font-medium text-[#26364a] transition group-hover:text-brand-500">
                            {getVisaDestinationVisaName(
                              destinationItem,
                              locale
                            )}
                          </span>
                          <span className="mt-0.5 block line-clamp-2 text-[12px] leading-4 text-[#66758a]">
                            {getVisaDestinationDescription(
                              destinationItem,
                              locale
                            )}
                          </span>
                        </span>
                        {action ? (
                          <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[13px] font-medium text-[#66758a] transition group-hover:text-brand-500">
                            {action}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-5 text-[13px] italic text-[#8a94a6]">
        {t("governmentFeeNote")}
      </p>
    </section>
  );
}
