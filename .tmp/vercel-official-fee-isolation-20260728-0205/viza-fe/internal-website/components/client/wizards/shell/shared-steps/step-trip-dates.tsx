"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { CalendarRange } from "lucide-react";
import { BrandActionButton } from "@/components/client/brand-action-button";
import { BrandField } from "@/components/client/brand-field";
import { DatePicker } from "@/components/ui/date-picker";
import { TabChoice } from "@/components/client/simplified-form/tab-choice";

interface TripDatesValue {
  arrival: string;
  departure: string;
  entries?: string;
}

export interface EntryOption {
  value: string;
  labelKey: string;
}

interface StepTripDatesProps {
  i18nNamespace: string;
  titleKey?: string;
  subtitleKey?: string;
  arrivalKey: string;
  departureKey: string;
  entriesKey?: string;
  arrivalLabelKey: string;
  departureLabelKey: string;
  entriesLabelKey?: string;
  entriesOptions?: EntryOption[];
  /**
   * Optional max-stay rule used for the live duration hint
   * (e.g. Schengen Type C = 90 days within any 180).
   */
  maxStayDays?: number;
  maxStayHintKey?: string;
  values: TripDatesValue;
  onChange: (next: TripDatesValue) => void;
  onContinue: () => void;
}

function diffDays(a: string, b: string): number | null {
  if (!a || !b) return null;
  const ad = new Date(a);
  const bd = new Date(b);
  if (Number.isNaN(ad.getTime()) || Number.isNaN(bd.getTime())) return null;
  const ms = bd.getTime() - ad.getTime();
  return Math.round(ms / 86_400_000) + 1;
}

export function StepTripDates({
  i18nNamespace,
  titleKey,
  subtitleKey,
  arrivalKey,
  departureKey,
  entriesKey,
  arrivalLabelKey,
  departureLabelKey,
  entriesLabelKey,
  entriesOptions,
  maxStayDays,
  maxStayHintKey,
  values,
  onChange,
  onContinue,
}: StepTripDatesProps) {
  const t = useTranslations(i18nNamespace);
  const tShared = useTranslations("simplifiedForm.shared");
  const tr = (key?: string): string => {
    if (!key) return "";
    if (key.startsWith("literal:")) return key.slice("literal:".length);
    if (t.has(key as never)) return t(key as never);
    if (tShared.has(key as never)) return tShared(key as never);
    return key.split(".").pop() ?? key;
  };

  const duration = useMemo(
    () => diffDays(values.arrival, values.departure),
    [values.arrival, values.departure],
  );
  const exceedsLimit = maxStayDays != null && duration != null && duration > maxStayDays;
  const datesInvalid =
    values.arrival && values.departure && duration != null && duration <= 0;

  const canContinue = !!values.arrival && !!values.departure && !datesInvalid;

  return (
    <div className="flex flex-col gap-6">
      {(titleKey || subtitleKey) && (
        <header className="flex flex-col gap-2">
          {titleKey ? (
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {tr(titleKey)}
            </h1>
          ) : null}
          {subtitleKey ? (
            <p className="text-sm text-muted-foreground sm:text-base">{tr(subtitleKey)}</p>
          ) : null}
        </header>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <BrandField label={tr(arrivalLabelKey)} required>
          <DatePicker
            value={values.arrival}
            onChange={(v) => onChange({ ...values, [arrivalKey]: v, arrival: v })}
          />
        </BrandField>
        <BrandField label={tr(departureLabelKey)} required>
          <DatePicker
            value={values.departure}
            onChange={(v) => onChange({ ...values, [departureKey]: v, departure: v })}
          />
        </BrandField>
      </div>

      {duration != null ? (
        <div
          className={
            exceedsLimit
              ? "flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
              : datesInvalid
                ? "flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                : "flex items-start gap-2 rounded-lg border border-brand-100 bg-brand-50 p-3 text-sm text-brand-600"
          }
          role="status"
          aria-live="polite"
        >
          <CalendarRange className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {datesInvalid
              ? tShared("tripDates.invalid")
              : tShared("tripDates.duration", { days: duration })}
            {exceedsLimit && maxStayHintKey ? <> · {tr(maxStayHintKey)}</> : null}
          </span>
        </div>
      ) : null}

      {entriesKey && entriesOptions && entriesLabelKey ? (
        <BrandField label={tr(entriesLabelKey)}>
          <TabChoice
            name={entriesKey}
            value={values.entries ?? ""}
            columns={3}
            onChange={(v) => onChange({ ...values, [entriesKey]: v, entries: v })}
            options={entriesOptions.map((o) => ({ value: o.value, label: tr(o.labelKey) }))}
          />
        </BrandField>
      ) : null}

      <BrandActionButton
        onClick={onContinue}
        disabled={!canContinue}
        className="self-end"
      >
        {tShared("continue")}
      </BrandActionButton>
    </div>
  );
}
