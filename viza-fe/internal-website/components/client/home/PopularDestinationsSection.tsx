"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  POPULAR_VISA_DESTINATIONS,
  type PopularVisaDestination,
} from "@/lib/visa-destinations";
import {
  selectUserVisaDestination,
  type UserVisaPackage,
} from "@/app/actions/user-package";

function isSelectedDestination(
  destination: PopularVisaDestination,
  selectedPackage: UserVisaPackage | null,
): boolean {
  return (
    selectedPackage?.country === destination.country &&
    selectedPackage?.visa_type === destination.visaType
  );
}

export function PopularDestinationsSection({
  selectedPackage,
}: {
  selectedPackage: UserVisaPackage | null;
}) {
  const t = useTranslations("home.popularDestinations");
  const router = useRouter();
  const [pendingDestinationId, setPendingDestinationId] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSelect(destination: PopularVisaDestination) {
    setSelectionError(null);
    setPendingDestinationId(destination.id);

    startTransition(async () => {
      const result = await selectUserVisaDestination(destination.id);
      if (!result.success) {
        setSelectionError(result.error ?? t("selectError"));
        setPendingDestinationId(null);
        return;
      }

      router.push("/client/application");
    });
  }

  return (
    <section className="w-full max-w-[1090px] mt-10 xl:mt-12">
      <div className="mb-5 flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="font-heading font-medium leading-[1.3] text-[#3d3d3d] text-[30px] tracking-[-0.9px]">
            {t("heading")}
          </p>
          <p className="mt-2 max-w-3xl text-[16px] leading-6 text-[rgba(0,0,0,0.52)]">
            {t("subheading")}
          </p>
        </div>
        <span className="w-fit rounded-full bg-[#eef3fa] px-3 py-1 text-[13px] font-medium text-[#03346E]">
          {t("schemaReady")}
        </span>
      </div>

      {selectionError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {selectionError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {POPULAR_VISA_DESTINATIONS.map((destination) => {
          const selected = isSelectedDestination(destination, selectedPackage);
          const loading = isPending && pendingDestinationId === destination.id;

          return (
            <button
              key={destination.id}
              type="button"
              onClick={() => handleSelect(destination)}
              disabled={loading}
              className={[
                "group flex min-h-[172px] flex-col justify-between rounded-[16px] border bg-white p-5 text-left transition",
                selected
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
                      {destination.countryNameZh} / {destination.countryName}
                    </p>
                    <p className="mt-1 text-[13px] font-medium text-[#637083]">
                      {destination.region}
                    </p>
                  </div>
                </div>
                {selected && <CheckCircle2 className="h-5 w-5 shrink-0 text-[#03346E]" />}
              </div>

              <div className="mt-5 space-y-3">
                <div>
                  <p className="text-[15px] font-semibold leading-5 text-[#03346E]">
                    {destination.visaNameZh} / {destination.visaName}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-[rgba(0,0,0,0.55)]">
                    {destination.descriptionZh} {destination.description}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-[#f3f6fa] px-2.5 py-1 text-[12px] font-medium text-[#526174]">
                    {destination.supportLabel}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[14px] font-semibold text-[#03346E]">
                    {loading ? t("starting") : selected ? t("selected") : t("start")}
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
    </section>
  );
}
