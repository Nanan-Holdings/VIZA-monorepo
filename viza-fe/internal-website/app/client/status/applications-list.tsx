"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CaretDown as ChevronDown,
  CircleNotch as Loader2,
} from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { SmoothProgressBar } from "@/components/smooth-progress";
import { DestinationFlag } from "@/components/client/home/DestinationFlag";
import { ClientErrorAlert } from "@/components/client/client-error-alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { selectUserVisaDestination } from "@/app/actions/user-package";
import {
  ACTIVE_APPLICATION_SELECTION_EVENT,
  readActiveApplicationSelection,
  setActiveApplicationSelection,
} from "@/lib/client/active-application-selection";

export type ApplicationListTone = "brand" | "warn" | "alert" | "success";

export interface ApplicationListRecord {
  selectionKey: string;
  applicationId: string | null;
  packageId: string | null;
  visaLabel: string;
  stateLabel: string;
  tone: ApplicationListTone;
  progressPercent: number;
  country: string;
  visaType: string;
  continueHref: string;
  detailHref: string;
  ongoing: boolean;
}

export interface ApplicationListItem {
  key: string;
  countryKey: string;
  flag: string;
  countryLabel: string;
  visaLabel: string;
  stateLabel: string;
  tone: ApplicationListTone;
  progressPercent: number;
  continueHref: string;
  country: string;
  visaType: string;
  destinationId: string | null;
  records: ApplicationListRecord[];
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

const APPLICATION_PANEL_CLASS =
  "flex flex-col overflow-hidden rounded-xl border border-[#efefef] bg-white";
const APPLICATION_ROW_CLASS =
  "grid w-full grid-cols-[36px_minmax(0,1fr)] items-center gap-x-4 gap-y-4 p-5 text-left lg:grid-cols-[44px_minmax(0,1fr)_220px_auto] lg:gap-6 lg:px-6";
const APPLICATION_ROW_INTERACTIVE_CLASS =
  "transition-colors hover:bg-[#f7f9fc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500";

function ApplicationRowContent({
  flag,
  countryLabel,
  secondaryLabel,
  stateLabel,
  tone,
  progressPercent,
  progressAriaLabel,
}: {
  flag: string;
  countryLabel: string;
  secondaryLabel: string;
  stateLabel: string;
  tone: ApplicationListTone;
  progressPercent: number;
  progressAriaLabel: string;
}) {
  return (
    <>
      <DestinationFlag flag={flag} size={34} />
      <div className="min-w-0">
        <p className="font-heading text-[17px] font-medium text-[#26364a]">
          {countryLabel}
        </p>
        <p className="mt-1 truncate text-[14px] text-[#66758a]">
          {secondaryLabel}
        </p>
      </div>
      <div className="col-span-2 flex flex-col gap-2 lg:col-span-1">
        <div className="flex items-center gap-2 text-[13px] text-[#66758a]">
          <span
            aria-hidden="true"
            className={cn("h-1.5 w-1.5 shrink-0 rounded-full", TONE_DOT[tone])}
          />
          <span className={cn("font-medium", TONE_TEXT[tone])}>
            {stateLabel}
          </span>
          <span className="tabular-nums">· {Math.round(progressPercent)}%</span>
        </div>
        <SmoothProgressBar
          displayedProgress={progressPercent}
          ariaLabel={progressAriaLabel}
          showValue={false}
          size="xs"
          barClassName={TONE_BAR[tone]}
        />
      </div>
    </>
  );
}

function recordSelection(record: ApplicationListRecord) {
  return {
    applicationId: record.applicationId,
    packageId: record.packageId,
    country: record.country,
    visaType: record.visaType,
    href: record.continueHref,
  };
}

export function ApplicationsList({
  items,
  initialExpandedCountry,
}: {
  items: ApplicationListItem[];
  initialExpandedCountry?: string | null;
}) {
  const t = useTranslations("clientStatus.index");
  const router = useRouter();
  const [currentApplicationId, setCurrentApplicationId] = useState<
    string | null
  >(null);
  const [currentPackageId, setCurrentPackageId] = useState<string | null>(null);
  const [expandedCountry, setExpandedCountry] = useState<string | null>(
    initialExpandedCountry ?? null
  );
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isNavigatingToSelection = useRef(false);

  const ongoingRecords = useMemo(
    () =>
      items.flatMap((item) => item.records.filter((record) => record.ongoing)),
    [items]
  );

  useEffect(() => {
    const synchronizeSelection = () => {
      // Keep the status-page panels stable while the selected application is
      // persisted and Home is loading. The destination page reads the new
      // selection directly from storage after navigation.
      if (isNavigatingToSelection.current) return;

      const stored = readActiveApplicationSelection();
      const storedRecord = stored?.applicationId
        ? ongoingRecords.find(
            (record) => record.applicationId === stored.applicationId
          )
        : stored?.packageId
          ? ongoingRecords.find(
              (record) => record.packageId === stored.packageId
            )
          : null;
      const fallback = ongoingRecords[0] ?? null;
      const resolved = storedRecord ?? fallback;
      setCurrentApplicationId(resolved?.applicationId ?? null);
      setCurrentPackageId(resolved?.packageId ?? null);
      if (resolved && !storedRecord)
        setActiveApplicationSelection(recordSelection(resolved));
    };

    synchronizeSelection();
    window.addEventListener(
      ACTIVE_APPLICATION_SELECTION_EVENT,
      synchronizeSelection
    );
    return () =>
      window.removeEventListener(
        ACTIVE_APPLICATION_SELECTION_EVENT,
        synchronizeSelection
      );
  }, [ongoingRecords]);

  function selectRecord(
    record: ApplicationListRecord,
    destinationId: string | null
  ) {
    setSwitchError(null);
    setSwitchingId(record.selectionKey);

    if (!destinationId) {
      isNavigatingToSelection.current = true;
      setActiveApplicationSelection(recordSelection(record));
      router.push("/client/home");
      return;
    }

    startTransition(async () => {
      const result = await selectUserVisaDestination(destinationId);
      if (!result.success) {
        setSwitchError(result.error ?? t("switchError"));
      } else {
        isNavigatingToSelection.current = true;
        setActiveApplicationSelection(recordSelection(record));
        router.push("/client/home");
      }
      setSwitchingId(null);
    });
  }

  const currentRecord =
    ongoingRecords.find((record) =>
      currentApplicationId
        ? record.applicationId === currentApplicationId
        : Boolean(currentPackageId && record.packageId === currentPackageId)
    ) ?? null;
  const currentItem = currentRecord
    ? (items.find((item) =>
        item.records.some(
          (record) => record.selectionKey === currentRecord.selectionKey
        )
      ) ?? null)
    : null;
  const selectableItems = items.flatMap((item) => {
    const records = currentRecord
      ? item.records.filter(
          (record) => record.selectionKey !== currentRecord.selectionKey
        )
      : item.records;
    if (records.length === 0) return [];

    const primaryRecord =
      records.find((record) => record.ongoing) ?? records[0];
    return [
      {
        ...item,
        visaLabel: primaryRecord.visaLabel,
        stateLabel: primaryRecord.stateLabel,
        tone: primaryRecord.tone,
        progressPercent: primaryRecord.progressPercent,
        continueHref: primaryRecord.continueHref,
        records,
      },
    ];
  });

  return (
    <>
      {currentRecord && currentItem ? (
        <section className="mb-8">
          <h2 className="mb-4 font-heading text-[22px] font-medium text-[#26364a]">
            {t("currentHandling")}
          </h2>
          <ul className={APPLICATION_PANEL_CLASS}>
            <li>
              <Link
                className={cn(
                  APPLICATION_ROW_CLASS,
                  APPLICATION_ROW_INTERACTIVE_CLASS
                )}
                href="/client/home"
              >
                <ApplicationRowContent
                  flag={currentItem.flag}
                  countryLabel={currentItem.countryLabel}
                  secondaryLabel={currentRecord.visaLabel}
                  stateLabel={currentRecord.stateLabel}
                  tone={currentRecord.tone}
                  progressPercent={currentRecord.progressPercent}
                  progressAriaLabel={t("progressAriaLabel")}
                />
                <span className="col-span-2 flex h-11 w-11 items-center justify-center justify-self-end text-[#8a94a6] lg:col-span-1">
                  <ArrowRight
                    className="h-5 w-5"
                    data-testid="single-application-arrow"
                  />
                </span>
              </Link>
            </li>
          </ul>
        </section>
      ) : null}

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="font-heading text-[22px] font-medium text-[#26364a]">
          {t("yourApplications")}
        </h2>
        <p className="text-[14px] text-[#8a94a6]">
          {t("destinationCount", { count: selectableItems.length })}
        </p>
      </div>

      {switchError ? <ClientErrorAlert className="mb-3" message={switchError} /> : null}

      {selectableItems.length > 0 ? (
        <ul className={APPLICATION_PANEL_CLASS}>
          {selectableItems.map((item) => {
            const hasMultiple = item.records.length > 1;
            const singleRecord =
              item.records.length === 1 ? item.records[0] : null;
            const isOpen = expandedCountry === item.countryKey;
            const loadingSingle = Boolean(
              singleRecord &&
              isPending &&
              switchingId === singleRecord.selectionKey
            );
            const rowContent = (
              <ApplicationRowContent
                flag={item.flag}
                countryLabel={item.countryLabel}
                secondaryLabel={
                  hasMultiple
                    ? t("applicationCount", { count: item.records.length })
                    : item.visaLabel
                }
                stateLabel={item.stateLabel}
                tone={item.tone}
                progressPercent={item.progressPercent}
                progressAriaLabel={t("progressAriaLabel")}
              />
            );

            return (
              <li
                key={item.key}
                className="border-t border-[#efefef] first:border-t-0"
              >
                <Collapsible
                  open={isOpen}
                  onOpenChange={(open) =>
                    setExpandedCountry(open ? item.countryKey : null)
                  }
                >
                  {hasMultiple ? (
                    <CollapsibleTrigger asChild>
                      <button
                        aria-label={t("selectApplication")}
                        className={cn(
                          APPLICATION_ROW_CLASS,
                          APPLICATION_ROW_INTERACTIVE_CLASS
                        )}
                        type="button"
                      >
                        {rowContent}
                        <span className="col-span-2 flex h-11 w-11 items-center justify-center justify-self-end text-[#8a94a6] lg:col-span-1">
                          <ChevronDown
                            className={cn(
                              "h-5 w-5 transition-transform",
                              isOpen && "rotate-180"
                            )}
                            data-testid="multi-application-chevron"
                          />
                        </span>
                      </button>
                    </CollapsibleTrigger>
                  ) : singleRecord ? (
                    <button
                      className={cn(
                        APPLICATION_ROW_CLASS,
                        APPLICATION_ROW_INTERACTIVE_CLASS,
                        "disabled:cursor-wait disabled:opacity-70"
                      )}
                      disabled={loadingSingle}
                      onClick={() => {
                        if (singleRecord.ongoing)
                          selectRecord(singleRecord, item.destinationId);
                        else router.push(singleRecord.detailHref);
                      }}
                      type="button"
                    >
                      {rowContent}
                      <span className="col-span-2 flex h-11 w-11 items-center justify-center justify-self-end text-[#8a94a6] lg:col-span-1">
                        {loadingSingle ? (
                          <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
                        ) : (
                          <ArrowRight
                            className="h-5 w-5"
                            data-testid="single-application-arrow"
                          />
                        )}
                      </span>
                    </button>
                  ) : null}

                  {hasMultiple ? (
                    <CollapsibleContent>
                      <div className="border-t border-[#efefef] bg-white">
                        {item.records.map((record) => {
                          const loading =
                            isPending && switchingId === record.selectionKey;
                          return (
                            <button
                              key={record.selectionKey}
                              type="button"
                              onClick={() => {
                                if (record.ongoing)
                                  selectRecord(record, item.destinationId);
                                else router.push(record.detailHref);
                              }}
                              disabled={loading}
                              className="flex min-h-[76px] w-full items-center border-t border-[#ececec] py-3 pl-[72px] pr-5 text-left transition-colors first:border-t-0 hover:bg-[#f7f9fc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 disabled:cursor-wait disabled:opacity-70 lg:pl-[92px] lg:pr-6"
                            >
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-2">
                                  <span className="block truncate text-[14px] font-medium text-[#26364a]">
                                    {record.visaLabel}
                                  </span>
                                  {loading ? (
                                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-brand-500" />
                                  ) : null}
                                </span>
                                <span className="mt-1 block text-[12px] text-[#66758a]">
                                  {record.stateLabel} ·{" "}
                                  {Math.round(record.progressPercent)}%
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  ) : null}
                </Collapsible>
              </li>
            );
          })}
        </ul>
      ) : null}
    </>
  );
}
