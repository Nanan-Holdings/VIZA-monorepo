"use client";

import * as React from "react";
import { format } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";
import { Calendar as CalendarDays } from "@phosphor-icons/react";
import { useLocale } from "next-intl";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ApplicationFormInputGroup } from "@/components/ui/application-form-input";
import { InputGroupInput } from "@/components/ui/input-group";
import type { DateMinimumPrecision } from "@/lib/date-field-validation";
import { cn } from "@/lib/utils";

export type DatePickerMode = "full" | "month" | "year";

interface ApplicationFormDatePickerProps {
  /** Date value serialized as YYYY-MM-DD. */
  value?: string;
  /** Receives the selected date serialized as YYYY-MM-DD. */
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  displayLocale?: string;
  displayFormat?: string;
  disabled?: boolean;
  forceWhiteBackground?: boolean;
  /** Minimum precision allowed by the field schema. */
  minimumDatePrecision?: DateMinimumPrecision;
  /** Render a text control for an intentionally partial date. */
  mode?: DatePickerMode;
}

function parseDateValue(value?: string): Date | undefined {
  const trimmed = value?.trim();
  if (!trimmed || !/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return undefined;

  const [, year, month, day] = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed) ?? [];
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (Number.isNaN(date.getTime())) return undefined;
  return date.getFullYear() === Number(year)
    && date.getMonth() === Number(month) - 1
    && date.getDate() === Number(day)
    ? date
    : undefined;
}

function formatPartialDateInput(value: string | undefined, mode: Exclude<DatePickerMode, "full">): string {
  const digits = (value ?? "").replace(/\D/g, "").slice(0, mode === "year" ? 4 : 6);
  if (mode === "year" || digits.length <= 4) return digits;
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}

function ApplicationFormDatePicker({
  value,
  onChange,
  placeholder,
  className,
  displayLocale,
  displayFormat = "PPP",
  disabled = false,
  forceWhiteBackground = false,
  minimumDatePrecision = "day",
  mode,
}: ApplicationFormDatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const locale = useLocale();
  const resolvedLocale = displayLocale ?? locale;
  const dateFnsLocale = resolvedLocale === "zh" ? zhCN : enUS;
  const date = parseDateValue(value);
  const rawDisplayValue = value?.trim();
  const resolvedPlaceholder = placeholder ?? (resolvedLocale === "zh" ? "请选择日期" : "Pick a date");
  const resolvedMode: DatePickerMode = mode ?? "full";

  if (resolvedMode !== "full") {
    const partialPlaceholder = resolvedMode === "year"
      ? "YYYY"
      : "YYYY-MM";
    const partialAriaLabel = resolvedLocale === "zh"
      ? resolvedMode === "year"
        ? "请输入年份（月份和日期未知）"
        : "请输入年份和月份（日期未知）"
      : resolvedMode === "year"
        ? "Enter year (month and day unknown)"
        : "Enter year and month (day unknown)";

    return (
      <ApplicationFormInputGroup
        className="h-12"
        filled={Boolean(rawDisplayValue)}
        forceWhiteBackground={forceWhiteBackground}
        data-date-mode={resolvedMode}
        data-date-precision={minimumDatePrecision}
      >
        <InputGroupInput
          value={formatPartialDateInput(value, resolvedMode)}
          onChange={(event) => onChange(formatPartialDateInput(event.target.value, resolvedMode))}
          placeholder={partialPlaceholder}
          aria-label={partialAriaLabel}
          inputMode="numeric"
          pattern={resolvedMode === "year" ? "[0-9]{4}" : "[0-9]{4}-[0-9]{2}"}
          maxLength={resolvedMode === "year" ? 4 : 7}
          disabled={disabled}
        />
      </ApplicationFormInputGroup>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "application-form-control h-12 w-full justify-start bg-transparent px-3 text-left text-[15px] font-normal shadow-none focus-visible:ring-0",
            !value && "text-muted-foreground",
            className,
          )}
          data-filled={rawDisplayValue ? "true" : "false"}
          data-force-white={forceWhiteBackground ? "true" : "false"}
        >
          <CalendarDays className="mr-2 h-4 w-4 shrink-0 text-gray-400" />
          {date
            ? format(date, displayFormat, { locale: dateFnsLocale })
            : rawDisplayValue
              ? rawDisplayValue
              : <span>{resolvedPlaceholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto overflow-hidden rounded-[var(--application-control-radius)] p-0 shadow-none"
        align="start"
      >
        <Calendar
          mode="single"
          selected={date}
          defaultMonth={date}
          onSelect={(selectedDate) => {
            if (!selectedDate) return;
            onChange(format(selectedDate, "yyyy-MM-dd"));
            setOpen(false);
          }}
          locale={dateFnsLocale}
          captionLayout="dropdown"
          startMonth={new Date(1920, 0)}
          endMonth={new Date(2036, 11)}
        />
      </PopoverContent>
    </Popover>
  );
}

export { ApplicationFormDatePicker, type ApplicationFormDatePickerProps };
