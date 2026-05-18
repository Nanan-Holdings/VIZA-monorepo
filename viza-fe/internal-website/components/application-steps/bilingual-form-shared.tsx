"use client";

import { type ReactNode, useState } from "react";
import { CalendarDays, CheckIcon, ChevronDown, Globe, User } from "lucide-react";
import { CircleFlag } from "react-circle-flags";
import { countries } from "country-data-list";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type BilingualSide = "zh" | "en";

export interface BilingualOptionPair {
  code: string;
  zh: string;
  en: string;
}

interface CountryRecord {
  alpha2: string;
  emoji?: string;
  ioc: string;
  name: string;
  status: string;
}

export const COUNTRY_OPTIONS = buildCountryOptions();

export function normalizeLookup(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function getLocalizedRegionName(alpha2: string) {
  try {
    const displayNames = new Intl.DisplayNames(["zh"], { type: "region" });
    return displayNames.of(alpha2.toUpperCase()) ?? "";
  } catch {
    return "";
  }
}

function buildCountryOptions(): BilingualOptionPair[] {
  const priorityCodes = ["CN", "US", "GB", "SG", "JP", "CA", "AU", "FR", "DE"];
  const priorityIndex = new Map(priorityCodes.map((code, index) => [code, index]));

  return (countries.all as CountryRecord[])
    .filter((country) => country.emoji && country.status !== "deleted" && country.ioc !== "PRK")
    .map((country) => ({
      code: country.alpha2,
      zh: getLocalizedRegionName(country.alpha2) || country.name,
      en: country.name,
    }))
    .sort((a, b) => {
      const aPriority = priorityIndex.get(a.code) ?? Number.MAX_SAFE_INTEGER;
      const bPriority = priorityIndex.get(b.code) ?? Number.MAX_SAFE_INTEGER;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return a.en.localeCompare(b.en);
    });
}

export function findBilingualOption(options: BilingualOptionPair[], value?: string) {
  if (!value) return undefined;
  const lookup = normalizeLookup(value);
  return options.find(
    (option) =>
      normalizeLookup(option.code) === lookup ||
      normalizeLookup(option.zh) === lookup ||
      normalizeLookup(option.en) === lookup,
  );
}

export function formatChineseDate(isoValue: string) {
  if (!isoValue) return "";
  const [year, month, day] = isoValue.split("-");
  return `${year}年${Number(month)}月${Number(day)}日`;
}

export function formatOfficialDate(isoValue: string) {
  if (!isoValue) return "";
  const [year, month, day] = isoValue.split("-");
  return `${day}/${month}/${year}`;
}

export function mirrorText(value: string) {
  return value.trim();
}

export function translateWithDictionary(
  value: string,
  dictionary: Record<string, string>,
  fallbackPrefix: string,
) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const direct = dictionary[trimmed];
  if (direct) return direct;
  if (/^[\dA-Za-z\s,.'#/-]+$/.test(trimmed)) return trimmed;
  return `${fallbackPrefix}: ${trimmed}`;
}

export function reverseWithDictionary(value: string, dictionary: Record<string, string>) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const reversed = Object.entries(dictionary).find(
    ([, en]) => normalizeLookup(en) === normalizeLookup(trimmed),
  );
  return reversed?.[0] ?? trimmed;
}

export function BilingualSectionHeader(_props: { children: ReactNode }) {
  return null;
}

export function BilingualTableShell({ children }: { children: ReactNode }) {
  return <div className="flex flex-col">{children}</div>;
}

export function BilingualRow({
  label,
  zhControl,
  enControl,
}: {
  label: string;
  helper?: string;
  badge?: string;
  zhControl: ReactNode;
  enControl: ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-3 px-4 py-4 md:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#24272f]">{label}</p>
      </div>
      <label className="min-w-0">
        <span className="mb-1 block text-xs font-semibold text-[#667085] md:hidden">中文</span>
        {zhControl}
      </label>
      <label className="min-w-0">
        <span className="mb-1 block text-xs font-semibold text-[#667085] md:hidden">English / Official</span>
        {enControl}
      </label>
    </div>
  );
}

export function BilingualTextControl({
  value,
  side,
  placeholder,
  required,
  icon,
  onChange,
}: {
  value: string;
  side: BilingualSide;
  placeholder: string;
  required?: boolean;
  icon?: ReactNode;
  onChange: (value: string) => void;
}) {
  return (
    <InputGroup className="h-12 rounded-lg border-[#e8e8e8] focus-within:ring-1 focus-within:ring-[#03346E] focus-within:border-[#03346E]">
      <InputGroupAddon align="inline-start">
        {icon ?? <User className="h-4 w-4 text-gray-400" />}
      </InputGroupAddon>
      <InputGroupInput
        aria-label={side === "zh" ? "中文" : "English"}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        className="h-12 text-[15px]"
      />
    </InputGroup>
  );
}

export function BilingualOptionControl({
  value,
  side,
  options,
  placeholder,
  icon,
  onChange,
}: {
  value: string;
  side: BilingualSide;
  options: BilingualOptionPair[];
  placeholder: string;
  icon?: ReactNode;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-12 rounded-lg border-[#e8e8e8] text-[15px] focus:ring-1 focus:ring-[#03346E] focus:border-[#03346E] data-[placeholder]:text-muted-foreground">
        <div className="flex min-w-0 items-center gap-2">
          {icon ? <span className="shrink-0 text-gray-400">{icon}</span> : null}
          <SelectValue placeholder={placeholder} />
        </div>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={`${side}-${option.code}`} value={option.code}>
            {side === "zh" ? option.zh : option.en}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function BilingualCountryControl({
  value,
  side,
  placeholder,
  onChange,
}: {
  value: string;
  side: BilingualSide;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedOption = findBilingualOption(COUNTRY_OPTIONS, value);
  const emptyText = side === "zh" ? "未找到国家" : "No country found.";
  const searchPlaceholder = side === "zh" ? "搜索国家..." : "Search country...";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="flex h-12 w-full items-center justify-between rounded-lg border border-[#e8e8e8] bg-transparent px-3 text-[15px] font-normal shadow-xs hover:bg-transparent focus:outline-none focus:ring-1 focus:ring-[#03346E] focus:border-[#03346E]">
        {selectedOption ? (
          <div className="flex min-w-0 items-center gap-2 overflow-hidden">
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full">
              <CircleFlag countryCode={selectedOption.code.toLowerCase()} height={20} />
            </span>
            <span className="overflow-hidden text-ellipsis whitespace-nowrap">
              {side === "zh" ? selectedOption.zh : selectedOption.en}
            </span>
          </div>
        ) : (
          <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
            <Globe className="h-4 w-4 shrink-0 text-gray-400" />
            <span className="overflow-hidden text-ellipsis whitespace-nowrap">{placeholder}</span>
          </div>
        )}
        <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
      </PopoverTrigger>
      <PopoverContent collisionPadding={10} side="bottom" className="min-w-[--radix-popper-anchor-width] p-0">
        <Command
          className="w-full"
          filter={(commandValue, search, keywords) => {
            const haystack = [commandValue, ...(keywords ?? [])].join(" ").toLowerCase();
            return haystack.includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList className="max-h-[200px] sm:max-h-[270px]">
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {COUNTRY_OPTIONS.map((option) => (
                <CommandItem
                  className="flex w-full items-center gap-2 [&_svg]:size-auto"
                  key={`${side}-${option.code}`}
                  value={option.code}
                  keywords={[option.zh, option.en, option.code]}
                  onSelect={() => {
                    onChange(option.code);
                    setOpen(false);
                  }}
                >
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full">
                    <CircleFlag countryCode={option.code.toLowerCase()} height={20} />
                  </span>
                  <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                    {side === "zh" ? option.zh : option.en}
                  </span>
                  <span className="hidden shrink-0 text-xs text-gray-400 sm:inline">
                    {side === "zh" ? option.en : option.zh}
                  </span>
                  <CheckIcon
                    className={cn(
                      "ml-auto !h-4 !w-4 shrink-0",
                      selectedOption?.code === option.code ? "opacity-100" : "opacity-0",
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function BilingualDateControl({
  value,
  side,
  placeholder,
  onChange,
}: {
  value: string;
  side: BilingualSide;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedDate = value ? new Date(`${value}T00:00:00`) : undefined;
  const displayValue = side === "zh" ? formatChineseDate(value) : formatOfficialDate(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-12 w-full justify-start rounded-lg border-[#e8e8e8] bg-transparent text-left text-[15px] font-normal shadow-xs hover:bg-transparent focus:ring-1 focus:ring-[#03346E] focus:border-[#03346E]"
        >
          <CalendarDays className="mr-2 h-4 w-4 shrink-0 text-gray-400" />
          {displayValue || <span className="text-muted-foreground">{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          defaultMonth={selectedDate}
          onSelect={(date) => {
            if (!date) return;
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, "0");
            const day = String(date.getDate()).padStart(2, "0");
            onChange(`${year}-${month}-${day}`);
            setOpen(false);
          }}
          captionLayout="dropdown"
          startMonth={new Date(1920, 0)}
          endMonth={new Date(2036, 11)}
        />
      </PopoverContent>
    </Popover>
  );
}
