"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CaretDown as ChevronDown,
  CircleNotch as Loader2,
  Microphone,
} from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
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
  createdAt?: string | null;
  updatedAt?: string | null;
  submittedAt?: string | null;
  secondaryAction?: {
    href: string;
    label: string;
  } | null;
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

function hasVisibleProgress(record: ApplicationListRecord): boolean {
  return Number.isFinite(record.progressPercent) && record.progressPercent > 0;
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
const MANAGE_VISIBLE_LIMIT = 5;

function ApplicationRowContent({
  flag,
  countryLabel,
  secondaryLabel,
  stateLabel,
  tone,
  progressPercent,
  progressAriaLabel,
  metadataLabel,
}: {
  flag: string;
  countryLabel: string;
  secondaryLabel: string;
  stateLabel: string;
  tone: ApplicationListTone;
  progressPercent: number;
  progressAriaLabel: string;
  metadataLabel?: string | null;
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
        {metadataLabel ? (
          <p className="mt-1 truncate text-[12px] text-[#8a94a6]">
            {metadataLabel}
          </p>
        ) : null}
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

function formatRecordMetadata(record: ApplicationListRecord, locale: string): string | null {
  const dateValue = record.updatedAt ?? record.submittedAt ?? record.createdAt;
  const formattedDate = dateValue
    ? new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(new Date(dateValue))
    : null;
  const shortId = record.applicationId?.slice(0, 8) ?? record.packageId?.slice(0, 8) ?? null;
  return [formattedDate, shortId ? `ID ${shortId}` : null].filter(Boolean).join(" · ") || null;
}

function recordTimestamp(record: ApplicationListRecord): number {
  const value = record.updatedAt ?? record.submittedAt ?? record.createdAt;
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function ManageApplicationRowContent({
  item,
  record,
  locale,
  statusLabel,
  completionLabel,
}: {
  item: ApplicationListItem;
  record: ApplicationListRecord;
  locale: string;
  statusLabel: string;
  completionLabel: string;
}) {
  return (
    <>
      <DestinationFlag flag={item.flag} size={30} />
      <div className="min-w-0">
        <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
          <p className="truncate font-heading text-[15px] font-medium text-[#26364a]">
            {item.countryLabel}
          </p>
          <p className="truncate text-[13px] text-[#66758a]">
            {record.visaLabel}
          </p>
        </div>
        <p className="mt-1 truncate text-[12px] text-[#8a94a6]">
          {formatRecordMetadata(record, locale)}
        </p>
      </div>
      <div className="col-span-2 grid min-w-0 grid-cols-1 gap-1 text-[12px] text-[#66758a] sm:grid-cols-2 lg:col-span-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span
            aria-hidden="true"
            className={cn("h-1.5 w-1.5 shrink-0 rounded-full", TONE_DOT[record.tone])}
          />
          <span className="shrink-0 text-[#8a94a6]">{statusLabel}</span>
          <span className={cn("min-w-0 truncate font-medium", TONE_TEXT[record.tone])}>
            {record.stateLabel}
          </span>
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 text-[#8a94a6]">{completionLabel}</span>
          <span className="font-medium tabular-nums text-[#26364a]">
            {Math.round(record.progressPercent)}%
          </span>
        </span>
      </div>
    </>
  );
}

export function ApplicationsList({
  items,
  initialExpandedCountry,
  mode = "switch",
  showManageHeader = true,
}: {
  items: ApplicationListItem[];
  initialExpandedCountry?: string | null;
  mode?: "switch" | "manage";
  showManageHeader?: boolean;
}) {
  const t = useTranslations("clientStatus.index");
  const locale = useLocale();
  const router = useRouter();
  const [currentApplicationId, setCurrentApplicationId] = useState<
    string | null
  >(null);
  const [currentPackageId, setCurrentPackageId] = useState<string | null>(null);
  const [expandedCountry, setExpandedCountry] = useState<string | null>(
    initialExpandedCountry ?? null
  );
  const [showAllManaged, setShowAllManaged] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isNavigatingToSelection = useRef(false);

  const progressItems = useMemo(
    () =>
      items.flatMap((item) => {
        const records = mode === "manage"
          ? item.records
          : item.records.filter(hasVisibleProgress);
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
      }),
    [items, mode]
  );

  const ongoingRecords = useMemo(
    () =>
      progressItems.flatMap((item) =>
        item.records.filter((record) => record.ongoing)
      ),
    [progressItems]
  );

  useEffect(() => {
    if (mode !== "switch") return;

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
  }, [mode, ongoingRecords]);

  function selectRecord(
    record: ApplicationListRecord,
    destinationId: string | null
  ) {
    if (mode === "manage") {
      router.push(record.continueHref || record.detailHref);
      return;
    }

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
    ? (progressItems.find((item) =>
        item.records.some(
          (record) => record.selectionKey === currentRecord.selectionKey
        )
      ) ?? null)
    : null;
  const selectableItems = progressItems.flatMap((item) => {
    const records = mode === "switch" && currentRecord
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

  if (progressItems.length === 0) return null;

  if (mode === "manage") {
    const manageRecords = items
      .flatMap((item) =>
        item.records.map((record) => ({
          item,
          record,
        }))
      )
      .sort((left, right) => {
        const timestampDelta = recordTimestamp(right.record) - recordTimestamp(left.record);
        if (timestampDelta !== 0) return timestampDelta;
        return right.record.selectionKey.localeCompare(left.record.selectionKey);
      });
    const visibleManageRecords = showAllManaged
      ? manageRecords
      : manageRecords.slice(0, MANAGE_VISIBLE_LIMIT);

    return (
      <>
        {showManageHeader ? (
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
            <h2 className="font-heading text-[22px] font-medium text-[#26364a]">
              {t("yourApplications")}
            </h2>
            <p className="text-[14px] text-[#8a94a6]">
              {t("destinationCount", { count: manageRecords.length })}
            </p>
          </div>
        ) : null}

        {manageRecords.length > 0 ? (
          <ul className={APPLICATION_PANEL_CLASS}>
            {visibleManageRecords.map(({ item, record }) => (
              <li
                key={`${record.selectionKey}:${record.applicationId ?? record.packageId ?? record.continueHref}`}
                className="border-t border-[#efefef] first:border-t-0"
              >
                <div className="px-4 py-3 transition-colors hover:bg-[#f7f9fc] focus-within:bg-[#f7f9fc]">
                  <button
                    type="button"
                    onClick={() => router.push(record.continueHref || record.detailHref)}
                    className={cn(
                      "grid w-full grid-cols-[34px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 text-left sm:grid-cols-[34px_minmax(0,1fr)_minmax(210px,0.8fr)_28px] sm:gap-x-4",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
                    )}
                  >
                    <ManageApplicationRowContent
                      item={item}
                      record={record}
                      locale={locale}
                      statusLabel={t("statusLabel")}
                      completionLabel={t("completionLabel")}
                    />
                    <span className="col-span-2 flex h-8 w-8 items-center justify-center justify-self-end text-[#8a94a6] sm:col-span-1">
                      <ArrowRight
                        className="h-4 w-4"
                        data-testid="manage-application-arrow"
                      />
                    </span>
                  </button>
                  {record.secondaryAction ? (
                    <div className="mt-2 flex pl-[46px] sm:pl-[46px]">
                      <Link
                        href={record.secondaryAction.href}
                        className="inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full border border-brand-100 bg-brand-50 px-3 py-1.5 text-[12px] font-semibold text-brand-700 transition hover:border-brand-200 hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                      >
                        <Microphone className="h-4 w-4 shrink-0" />
                        <span className="truncate">
                          {record.secondaryAction.label}
                        </span>
                      </Link>
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
            {manageRecords.length > MANAGE_VISIBLE_LIMIT ? (
              <li className="border-t border-[#efefef]">
                <button
                  type="button"
                  className="flex w-full items-center justify-center px-4 py-3 text-[13px] font-medium text-brand-600 transition-colors hover:bg-[#f7f9fc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
                  onClick={() => setShowAllManaged((current) => !current)}
                >
                  {showAllManaged
                    ? t("collapseApplications")
                    : t("viewAllApplications", { count: manageRecords.length })}
                </button>
              </li>
            ) : null}
          </ul>
        ) : null}
      </>
    );
  }

  return (
    <>
      {mode === "switch" && currentRecord && currentItem ? (
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
                  metadataLabel={formatRecordMetadata(currentRecord, locale)}
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
                metadataLabel={singleRecord ? formatRecordMetadata(singleRecord, locale) : null}
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
                                  {formatRecordMetadata(record, locale)
                                    ? ` · ${formatRecordMetadata(record, locale)}`
                                    : ""}
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
