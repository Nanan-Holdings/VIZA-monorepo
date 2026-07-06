"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Search } from "lucide-react";
import { useLocale } from "next-intl";
import {
  getVisaDestinationCountryName,
  getVisaDestinationDescription,
  getVisaDestinationKey,
  getVisaDestinationRegionName,
  getVisaDestinationVisaName,
  type PopularVisaDestination,
  type VisaDestinationRegionGroup,
} from "@/lib/visa-destinations";
import {
  getUserVisaPackages,
  selectUserVisaDestination,
  type UserVisaPackage,
} from "@/app/actions/user-package";

function isSelectedDestination(
  destination: PopularVisaDestination,
  selectedPackages: UserVisaPackage[],
): boolean {
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

export function DestinationRegionPageClient({
  region,
  destinations,
}: {
  region: VisaDestinationRegionGroup;
  destinations: PopularVisaDestination[];
}) {
  const router = useRouter();
  const locale = useLocale();
  const isZh = locale.toLowerCase().startsWith("zh");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPackages, setSelectedPackages] = useState<UserVisaPackage[]>([]);
  const [pendingDestinationId, setPendingDestinationId] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let isMounted = true;
    getUserVisaPackages().then((packages) => {
      if (isMounted) setSelectedPackages(packages);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredDestinations = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    if (!normalizedSearch) return destinations;
    return destinations.filter((destination) => matchesDestinationSearch(destination, normalizedSearch));
  }, [destinations, searchQuery]);

  function handleSelect(destination: PopularVisaDestination) {
    setSelectionError(null);
    setPendingDestinationId(destination.id);

    startTransition(async () => {
      const result = await selectUserVisaDestination(destination.id);
      if (!result.success) {
        setSelectionError(result.error ?? (isZh ? "暂时无法选择该目的地，请重试。" : "Could not select this destination. Please try again."));
        setPendingDestinationId(null);
        return;
      }

      router.push(
        `/client/application?country=${encodeURIComponent(destination.country)}&visaType=${encodeURIComponent(destination.visaType)}`,
      );
    });
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
              <p className="text-[14px] font-semibold text-[#03346E]">{isZh ? region.name : "Destination region"}</p>
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
              const selected = isSelectedDestination(destination, selectedPackages);
              const loading = isPending && pendingDestinationId === destination.id;
              const actionLabel = selected ? (isZh ? "打开" : "Open") : (isZh ? "开始" : "Start");
              const countryName = getVisaDestinationCountryName(destination, locale);
              const visaName = getVisaDestinationVisaName(destination, locale);
              const description = getVisaDestinationDescription(destination, locale);
              const regionName = getVisaDestinationRegionName(destination.region, locale);

              return (
                <button
                  key={destination.id}
                  type="button"
                  onClick={() => handleSelect(destination)}
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
                      <span className="text-[26px] leading-none sm:text-[34px]" aria-hidden="true">
                        {destination.flag}
                      </span>
                      <div>
                        <p className="font-heading text-[16px] font-medium leading-tight text-[#222] sm:text-[18px]">
                          {countryName}
                        </p>
                        <p className="mt-1 text-[13px] font-medium text-[#637083]">
                          {countryName} · {regionName}
                        </p>
                      </div>
                    </div>
                    {selected && <CheckCircle2 className="h-5 w-5 shrink-0 text-[#03346E]" />}
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
                        {destination.supportLabel}
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
