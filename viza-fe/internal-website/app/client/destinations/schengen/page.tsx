"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CircleNotch as Loader2, MagnifyingGlass as Search } from "@phosphor-icons/react";
import { useLocale } from "next-intl";
import { DestinationFlag } from "@/components/client/home/DestinationFlag";
import { ClientErrorAlert } from "@/components/client/client-error-alert";
import {
  SCHENGEN_VISA_DESTINATIONS,
  getVisaDestinationCountryName,
  getVisaDestinationDescription,
  getVisaDestinationKey,
  getVisaDestinationRegionName,
  getVisaDestinationVisaName,
  matchesVisaDestinationSearch,
  type PopularVisaDestination,
} from "@/lib/visa-destinations";
import {
  getUserVisaPackages,
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
          DESTINATION_SELECTION_UI_TIMEOUT_MS
        );
      }),
    ]);
  } finally {
    if (timeout) window.clearTimeout(timeout);
  }
}

function isSelectedDestination(
  destination: PopularVisaDestination,
  selectedPackages: UserVisaPackage[]
): boolean {
  const destinationKey = getVisaDestinationKey(
    destination.country,
    destination.visaType
  );
  return selectedPackages.some(
    (selectedPackage) =>
      getVisaDestinationKey(
        selectedPackage.country,
        selectedPackage.visa_type
      ) === destinationKey
  );
}

export default function SchengenDestinationsPage() {
  const router = useRouter();
  const locale = useLocale();
  const isZh = locale.toLowerCase().startsWith("zh");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPackages, setSelectedPackages] = useState<UserVisaPackage[]>(
    []
  );
  const [pendingDestinationId, setPendingDestinationId] = useState<
    string | null
  >(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);

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
    if (!normalizedSearch) return SCHENGEN_VISA_DESTINATIONS;

    return SCHENGEN_VISA_DESTINATIONS.filter((destination) =>
      matchesVisaDestinationSearch(destination, normalizedSearch)
    );
  }, [searchQuery]);

  function handleSelect(destination: PopularVisaDestination) {
    if (pendingDestinationId) return;
    setSelectionError(null);
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
          setSelectionError(
            result.error ??
              (isZh
                ? "暂时无法选择该目的地，请重试。"
                : "Could not select this destination. Please try again.")
          );
        }
      } catch {
        setSelectionError(
          isZh
            ? "服务器响应较慢，请稍后重试。"
            : "The server is taking too long. Please try again shortly."
        );
      } finally {
        setPendingDestinationId(null);
      }
    })();
  }

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <main className="mx-auto w-full max-w-[1090px] pb-24 pt-5 sm:pt-8">
        <Link
          href="/client/status#add-destination"
          className="inline-flex min-h-11 items-center gap-2 text-[14px] font-medium text-[#66758a] transition-colors hover:text-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <ArrowLeft className="h-4 w-4" />
          {isZh ? "返回添加目的地" : "Back to destinations"}
        </Link>

        <h1 className="mt-4 font-heading text-[32px] font-medium leading-tight tracking-[-0.96px] text-[#26364a]">
          {isZh
            ? "选择申根主要目的地"
            : "Choose your main Schengen destination"}
        </h1>
        <p className="mt-2.5 max-w-[66ch] text-[16px] leading-6 text-[#66758a]">
          {isZh
            ? "申根短期签证共用 C 类表单。请选择主要停留国，系统会在申请中保留该国家作为主目的地。"
            : "Schengen short-stay visas share the Type C form. Choose your main stay country and VIZA will keep it as the primary destination."}
        </p>

        <label className="relative mt-8 flex items-center">
          <Search className="pointer-events-none absolute left-4 h-[18px] w-[18px] text-[#8a94a6]" />
          <span className="sr-only">
            {isZh ? "搜索申根国家" : "Search Schengen countries"}
          </span>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={
              isZh ? "搜索申根国家..." : "Search Schengen country..."
            }
            autoComplete="off"
            className="h-[46px] w-full rounded-full border border-[#e8e8e8] bg-white pl-11 pr-4 text-[15px] text-[#26364a] outline-none transition placeholder:text-[#8a94a6] focus-visible:border-brand-500 focus-visible:ring-1 focus-visible:ring-brand-500"
          />
        </label>

        {selectionError ? <ClientErrorAlert className="mt-4" message={selectionError} /> : null}

        {filteredDestinations.length > 0 ? (
          <ul className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredDestinations.map((destination) => {
              const selected = isSelectedDestination(
                destination,
                selectedPackages
              );
              const loading = pendingDestinationId === destination.id;
              const applicationHref = buildApplicationLongFormHref({
                country: destination.country,
                visaType: destination.visaType,
              });
              const countryName = getVisaDestinationCountryName(
                destination,
                locale
              );
              const visaName = getVisaDestinationVisaName(destination, locale);
              const description = getVisaDestinationDescription(
                destination,
                locale
              );
              const regionName = getVisaDestinationRegionName(
                destination.region,
                locale
              );

              return (
                <li key={destination.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(destination)}
                    onFocus={() => router.prefetch(applicationHref)}
                    onMouseEnter={() => router.prefetch(applicationHref)}
                    disabled={loading}
                    className="group flex h-full w-full flex-col gap-3.5 rounded-2xl border border-[#efefef] bg-white px-5 py-[18px] text-left transition-colors duration-150 hover:border-[#d8e0ea] hover:bg-[#f7f9fc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-wait disabled:opacity-70"
                  >
                    <div className="flex items-center gap-3">
                      <DestinationFlag flag={destination.flag} size={30} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-heading text-[16px] font-medium text-[#26364a]">
                            {countryName}
                          </p>
                          {loading ? (
                            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-brand-500" />
                          ) : selected ? (
                            <span className="shrink-0 text-[12px] font-medium text-[#8a94a6]">
                              {isZh ? "已添加" : "Added"}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-px text-[12px] text-[#8a94a6]">
                          {regionName}
                        </p>
                      </div>
                    </div>

                    <div className="border-t border-[#efefef] pt-3">
                      <p className="text-[14px] font-medium text-[#26364a] transition-colors group-hover:text-brand-500">
                        {visaName}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-[12px] leading-4 text-[#66758a]">
                        {description}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-5 rounded-2xl border border-[#efefef] bg-white p-10 text-center">
            <p className="font-heading text-[17px] font-medium text-[#26364a]">
              {isZh
                ? "没有找到匹配的申根国家。"
                : "No matching Schengen country found."}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
