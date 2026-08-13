"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle as CheckCircle2, CircleNotch as Loader2, MagnifyingGlass as Search } from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import {
  getVisaDestinationCountryName,
  getVisaDestinationDescription,
  getVisaDestinationKey,
  getVisaDestinationRegionName,
  getVisaDestinationVisaName,
  matchesVisaDestinationSearch,
  type PopularVisaDestination,
  type VisaDestinationRegionGroup,
} from "@/lib/visa-destinations";
import { DestinationFlag } from "./DestinationFlag";
import {
  selectUserVisaDestination,
  type UserVisaPackage,
} from "@/app/actions/user-package";
import { buildApplicationLongFormHref } from "@/lib/client/recent-application-form";

const DESTINATION_SELECTION_UI_TIMEOUT_MS = 5_000;

async function selectWithDeadline(destinationId: string) {
  let timeout: number | undefined;
  try {
    return await Promise.race([
      selectUserVisaDestination(destinationId),
      new Promise<never>((_, reject) => {
        timeout = window.setTimeout(
          () => reject(new Error("destination_selection_timeout")),
          DESTINATION_SELECTION_UI_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timeout) window.clearTimeout(timeout);
  }
}

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

const SUPPORT_LABELS_ZH: Record<string, string> = {
  "Visitor intake": "访客申请表",
  "DS-160 form": "DS-160 表单",
  "Indonesia eVisa": "印度尼西亚电子签证",
  "Indonesia e-VoA": "印度尼西亚电子落地签",
  "Philippines eTravel": "菲律宾 eTravel 申报",
  "Schengen countries": "申根国家",
  "Schengen Type C": "申根 C 类签证",
  "UKVI form": "英国签证与移民局表单",
  "Vietnam pre-arrival declaration": "越南入境前申报",
  "Application categories": "申请类别",
  "Destination region": "目的地区域",
};

export function DestinationRegionPageClient({
  region,
  destinations,
  initialSelectedPackages,
}: {
  region: VisaDestinationRegionGroup;
  destinations: PopularVisaDestination[];
  initialSelectedPackages: UserVisaPackage[];
}) {
  const router = useRouter();
  const locale = useLocale();
  const destinationMessages = useTranslations("home.popularDestinations");
  const isZh = locale.toLowerCase().startsWith("zh");
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingDestinationId, setPendingDestinationId] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);

  const filteredDestinations = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    if (!normalizedSearch) return destinations;
    return destinations.filter((destination) => matchesVisaDestinationSearch(destination, normalizedSearch));
  }, [destinations, searchQuery]);

  function handleSelect(destination: PopularVisaDestination) {
    if (pendingDestinationId) return;
    setSelectionError(null);

    if (destination.kind === "group" && destination.href) {
      router.push(destination.href);
      return;
    }

    const href = buildApplicationLongFormHref({
      country: destination.country,
      visaType: destination.visaType,
    });

    setPendingDestinationId(destination.id);
    router.push(href);
    void (async () => {
      try {
        const result = await selectWithDeadline(destination.id);
        if (!result.success) {
          setSelectionError(result.error ?? (isZh ? "暂时无法选择该目的地，请重试。" : "Could not select this destination. Please try again."));
        }
      } catch {
        setSelectionError(isZh ? "服务器响应较慢，请稍后重试。" : "The server is taking too long. Please try again shortly.");
      } finally {
        setPendingDestinationId(null);
      }
    })();
  }

  return (
    <div className="min-h-screen bg-[#fcfcfc] pb-16 pt-8">
      <main className="mx-auto flex w-full max-w-[1090px] flex-col gap-6">
        <Link
          href="/client/home"
          className="inline-flex w-fit items-center gap-2 rounded-full border border-[#e6e6e6] bg-white px-4 py-2 text-[14px] font-medium text-[#03346E] transition hover:border-[#03346E]"
        >
          <ArrowLeft className="h-4 w-4" />
          {isZh ? "返回首页" : "Back to Home"}
        </Link>

        <section className="rounded-[18px] border border-[#e7edf5] bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[14px] font-semibold text-[#03346E]">{isZh ? "目的地区域" : "Destination region"}</p>
              <h1 className="mt-2 font-heading text-[28px] font-medium leading-tight text-[#2f2f2f] sm:text-[44px]">
                {isZh ? region.nameZh : region.name}
              </h1>
              <p className="mt-3 max-w-3xl text-[15px] leading-7 text-[#667085]">
                {isZh ? region.descriptionZh : region.description}
              </p>
            </div>
            <label className="relative w-full lg:w-[340px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a94a3]" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={isZh ? "搜索国家、签证或表单..." : "Search country, visa, or form..."}
                className="h-11 w-full rounded-full border border-[#dce5f0] bg-white pl-10 pr-4 text-[14px] font-medium text-[#26364a] outline-none transition focus:border-[#03346E] focus:shadow-[0_0_0_3px_rgba(3,52,110,0.08)]"
              />
            </label>
          </div>

          {selectionError && (
            <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {selectionError}
            </div>
          )}

          <div className="mt-6 grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-3">
            {filteredDestinations.map((destination) => {
              const selected = isSelectedDestination(destination, initialSelectedPackages);
              const loading = pendingDestinationId === destination.id;
              const isGroup = destination.kind === "group";
              const applicationHref = isGroup
                ? null
                : buildApplicationLongFormHref({
                    country: destination.country,
                    visaType: destination.visaType,
                  });
              const actionLabel = isGroup
                ? destinationMessages("chooseCategory")
                : selected
                  ? (isZh ? "打开" : "Open")
                  : (isZh ? "开始" : "Start");
              const countryName = getVisaDestinationCountryName(destination, locale);
              const visaName = getVisaDestinationVisaName(destination, locale);
              const description = getVisaDestinationDescription(destination, locale);
              const regionName = getVisaDestinationRegionName(destination.region, locale);

              return (
                <button
                  key={destination.id}
                  type="button"
                  onClick={() => handleSelect(destination)}
                  onFocus={() => {
                    if (applicationHref) router.prefetch(applicationHref);
                  }}
                  onMouseEnter={() => {
                    if (applicationHref) router.prefetch(applicationHref);
                  }}
                  disabled={loading}
                  className={[
                    "group flex min-h-[144px] flex-col justify-between rounded-[16px] border bg-white p-4 text-left transition sm:min-h-[164px] sm:p-5",
                    selected
                      ? "border-[#03346E] shadow-[0_12px_30px_rgba(3,52,110,0.12)]"
                      : "border-[#efefef] hover:border-[#c7d5e8] hover:shadow-[0_10px_26px_rgba(15,23,42,0.08)]",
                    loading ? "cursor-wait opacity-80" : "cursor-pointer",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <DestinationFlag flag={destination.flag} />
                      <div>
                        <p className="font-heading text-[16px] font-medium leading-tight text-[#222] sm:text-[18px]">
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
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full bg-[#f3f6fa] px-2.5 py-1 text-[12px] font-medium text-[#526174]">
                        {isGroup
                          ? destinationMessages("categoryCount", { count: destination.countryCount ?? 0 })
                          : isZh
                            ? (SUPPORT_LABELS_ZH[destination.supportLabel] ?? "签证申请表")
                            : destination.supportLabel}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[14px] font-semibold text-[#03346E]">
                        {loading ? (isZh ? "正在开始" : "Starting") : actionLabel}
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
            })}
          </div>

          {filteredDestinations.length === 0 && (
            <div className="mt-6 rounded-[16px] border border-dashed border-[#dce5f0] bg-white px-5 py-10 text-center">
              <p className="text-[15px] font-medium text-[#526174]">
                {isZh ? "这个分区暂时没有已接入的签证表单。" : "No connected visa forms are available in this region yet."}
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
