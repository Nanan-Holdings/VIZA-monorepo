"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { SmoothProgressBar } from "@/components/smooth-progress";
import { selectUserVisaDestination } from "@/app/actions/user-package";
import {
  getRecentApplicationFormHref,
  readApplicationFormTarget,
} from "@/lib/client/recent-application-form";
import { getVisaDestinationKey } from "@/lib/visa-destinations";

export type ApplicationListTone = "brand" | "warn" | "alert" | "success";

export interface ApplicationListItem {
  /** Stable React key — the status page's selection key. */
  key: string;
  /** Destination key (country + form visa type) used to match the active form. */
  destinationKey: string;
  flag: string;
  countryLabel: string;
  visaLabel: string;
  stateLabel: string;
  tone: ApplicationListTone;
  progressPercent: number;
  /** Status detail view for this application. */
  detailHref: string;
  /** Next actionable step — payment, form, documents… */
  continueHref: string;
  /** Catalogue id, when the package maps to a known destination. */
  destinationId: string | null;
}

const TONE_DOT: Record<ApplicationListTone, string> = {
  brand: "bg-brand-500",
  warn: "bg-amber-500",
  alert: "bg-destructive",
  success: "bg-emerald-600",
};

const TONE_TEXT: Record<ApplicationListTone, string> = {
  brand: "text-[#26364a]",
  warn: "text-amber-800",
  alert: "text-destructive",
  success: "text-emerald-700",
};

const TONE_BAR: Record<ApplicationListTone, string> = {
  brand: "bg-brand-500",
  warn: "bg-amber-500",
  alert: "bg-destructive",
  success: "bg-emerald-600",
};

export function ApplicationsList({ items }: { items: ApplicationListItem[] }) {
  const t = useTranslations("clientStatus.index");
  const router = useRouter();
  const [currentKey, setCurrentKey] = useState<string | null>(null);
  const [switchingKey, setSwitchingKey] = useState<string | null>(null);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // The "current" application is whichever form the applicant opened last —
  // the same signal `/client/destinations` used before the pages merged.
  useEffect(() => {
    const target = readApplicationFormTarget(getRecentApplicationFormHref());
    if (target?.country && target.visaType) {
      setCurrentKey(getVisaDestinationKey(target.country, target.visaType));
    }
  }, []);

  const resolvedCurrentKey =
    currentKey && items.some((item) => item.destinationKey === currentKey)
      ? currentKey
      : items[0]?.destinationKey ?? null;

  function handleSwitch(item: ApplicationListItem) {
    setSwitchError(null);
    setSwitchingKey(item.key);
    router.push(item.continueHref);

    // Packages outside the catalogue still navigate; there is just no
    // destination record to mark as the applicant's active selection.
    const { destinationId } = item;
    if (!destinationId) return;

    startTransition(async () => {
      const result = await selectUserVisaDestination(destinationId);
      if (!result.success) {
        setSwitchError(result.error ?? t("switchError"));
        setSwitchingKey(null);
      }
    });
  }

  return (
    <>
      {switchError && (
        <div
          role="alert"
          className="mb-3 rounded-xl border border-[#f4c7c3] bg-[#fff8f7] px-4 py-3 text-[14px] text-[#b42318]"
        >
          {switchError}
        </div>
      )}

      <ul className="flex flex-col overflow-hidden rounded-2xl border border-[#efefef] bg-white">
        {items.map((item) => {
          const isCurrent = item.destinationKey === resolvedCurrentKey;
          const isSwitching = isPending && switchingKey === item.key;

          return (
            <li
              key={item.key}
              className={cn(
                "relative grid grid-cols-[36px_minmax(0,1fr)] items-start gap-x-4 gap-y-4 border-t border-[#efefef] p-5 transition-colors first:border-t-0",
                "lg:grid-cols-[44px_minmax(0,1fr)_220px_auto] lg:items-center lg:gap-6 lg:px-6",
                isCurrent ? "bg-[#fbfbfb]" : "hover:bg-[#fbfbfb]",
              )}
            >
              <span
                aria-hidden="true"
                className="text-[28px] leading-none lg:text-center lg:text-[30px]"
              >
                {item.flag}
              </span>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={item.detailHref}
                    className="font-heading text-[17px] font-medium text-[#26364a] outline-none after:absolute after:inset-0 after:content-[''] focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                  >
                    {item.countryLabel}
                  </Link>
                  {isCurrent && (
                    <span className="rounded-full border border-[#e5e7eb] bg-white px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.04em] text-brand-500">
                      {t("current")}
                    </span>
                  )}
                </div>
                <p className="mt-1 truncate text-[14px] text-[#66758a]">{item.visaLabel}</p>
              </div>

              <div className="col-span-2 flex flex-col gap-2 lg:col-span-1">
                <div className="flex items-center gap-2 text-[13px] text-[#66758a]">
                  <span aria-hidden="true" className={cn("h-1.5 w-1.5 shrink-0 rounded-full", TONE_DOT[item.tone])} />
                  <span className={cn("font-medium", TONE_TEXT[item.tone])}>{item.stateLabel}</span>
                  <span className="tabular-nums">· {Math.round(item.progressPercent)}%</span>
                </div>
                <SmoothProgressBar
                  displayedProgress={item.progressPercent}
                  ariaLabel={t("progressAriaLabel")}
                  showValue={false}
                  size="xs"
                  barClassName={TONE_BAR[item.tone]}
                />
              </div>

              <div className="col-span-2 lg:col-span-1 lg:justify-self-end">
                {isCurrent ? (
                  <Link
                    href={item.continueHref}
                    className="relative z-10 inline-flex h-10 min-h-11 w-full items-center justify-center gap-2 rounded-full bg-brand-500 px-[18px] text-[14px] font-medium text-white transition hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 lg:min-h-10 lg:w-auto"
                  >
                    {t("continue")}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSwitch(item)}
                    disabled={isSwitching}
                    className="relative z-10 inline-flex h-10 min-h-11 w-full items-center justify-center gap-2 rounded-full border border-[#e5e7eb] bg-white px-[18px] text-[14px] font-medium text-[#26364a] transition hover:bg-[#fbfbfb] disabled:cursor-wait disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 lg:min-h-10 lg:w-auto"
                  >
                    {isSwitching ? t("switching") : t("switchTo")}
                    {isSwitching && <Loader2 className="h-4 w-4 animate-spin" />}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
