"use client";

import * as React from "react";
import { format } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";
import { Calendar as CalendarDays } from "@phosphor-icons/react";
import { useLocale } from "next-intl";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

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
}

function parseDateValue(value?: string): Date | undefined {
  const trimmed = value?.trim();
  if (!trimmed || !/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return undefined;

  const date = new Date(`${trimmed}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
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
}: ApplicationFormDatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const locale = useLocale();
  const resolvedLocale = displayLocale ?? locale;
  const dateFnsLocale = resolvedLocale === "zh" ? zhCN : enUS;
  const date = parseDateValue(value);
  const rawDisplayValue = value?.trim();
  const resolvedPlaceholder = placeholder ?? (resolvedLocale === "zh" ? "请选择日期" : "Pick a date");

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
