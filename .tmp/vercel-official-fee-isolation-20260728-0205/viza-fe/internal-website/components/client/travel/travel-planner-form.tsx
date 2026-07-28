"use client";

import {
  CheckIcon,
  ChevronsUpDownIcon,
  ExternalLinkIcon,
  Globe2Icon,
  Loader2Icon,
  MapPinIcon,
  MessageSquareTextIcon,
  MoveDownIcon,
  MoveUpIcon,
  PhoneIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CircleFlag } from "react-circle-flags";
import { toast } from "sonner";
import {
  DEFAULT_CITY_DAYS,
  buildTravelStateFromMessages,
  createTravelFormMessage,
  getFieldQuestionForState,
  getDefaultFlexibleDepartureDate,
  nextMissingField,
  toTravelPlanningPayload,
  type ChatLikeMessage,
  type FlightLegResult,
  type HotelStayResult,
  type SelectedFlightOption,
  type SelectedHotelOption,
  type TravelFormPayload,
  type TravelPlanningPayload,
  type TravelDateFlexibility,
} from "@/lib/travel/planner";
import type {
  TravelChatInputMessage,
  TravelChatMessage,
  TravelChatStatus,
} from "@/lib/travel/chat-types";
import { cn, matchesSearchText } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";

type Option = {
  value: string;
  label: string;
  keywords?: string[];
  flagCode?: string;
  featured?: boolean;
  sortLabel?: string;
  secondaryLabel?: string;
};
type CountryApiOption = {
  value?: string;
  label?: string;
  labelEn?: string;
  labelZh?: string;
  code?: string;
  search?: string;
};
type CityApiOption = {
  value?: string;
  label?: string;
  labelEn?: string;
  labelZh?: string;
  search?: string;
};
type IpLocation = {
  country: string;
  city: string;
  countryCode?: string;
  source?: string;
};
type DestinationAddStep = "idle" | "country" | "city";

const OTHER_COUNTRY_VALUE = "__country_other__";
const OTHER_CITY_VALUE = "__city_other__";
const POPULAR_COUNTRY_CODES = [
  "JP",
  "KR",
  "SG",
  "TH",
  "ID",
  "MY",
  "AU",
  "FR",
  "IT",
  "GB",
  "US",
  "CN",
] as const;
const POPULAR_COUNTRY_CODE_ORDER: ReadonlyMap<string, number> = new Map(
  POPULAR_COUNTRY_CODES.map((code, index) => [code, index])
);

function normalizeToken(value: string): string {
  return value.trim();
}

function normalizeLookupKey(value: string): string {
  return value.trim().toLowerCase();
}

function splitCustomValues(input: string): string[] {
  if (!input.trim()) return [];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of input.split(/[,\n，、；;]/)) {
    const normalized = normalizeToken(item);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }

  return result;
}

function dedupeValues(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = normalizeToken(value);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }

  return result;
}

function removeSpecialValue(values: string[], specialValue: string): string[] {
  return values.filter((value) => value !== specialValue);
}

function getOptionDisplayLabel(
  option: Pick<Option, "value" | "label"> | CountryApiOption | CityApiOption
): string {
  if ("labelZh" in option && typeof option.labelZh === "string") {
    const labelZh = option.labelZh.trim();
    if (labelZh) return labelZh;
  }

  if ("label" in option && typeof option.label === "string") {
    const label = option.label.trim();
    if (label) return label;
  }

  if ("value" in option && typeof option.value === "string") {
    return option.value.trim();
  }

  return "";
}

function withOtherOption(
  options: Option[],
  otherValue: string,
  otherLabel: string
): Option[] {
  const withoutOther = options.filter((option) => option.value !== otherValue);
  return [
    ...withoutOther,
    {
      value: otherValue,
      label: otherLabel,
      keywords: [otherLabel, "other", "自定义", "custom"],
    },
  ];
}

function getOptionGroups(options: Option[]): Array<{ heading?: string; options: Option[] }> {
  const featuredOptions = options.filter((option) => option.featured);
  if (!featuredOptions.length) {
    return [{ options }];
  }

  const regularOptions = options.filter((option) => !option.featured);
  return [
    { heading: "热门目的地", options: featuredOptions },
    { heading: "其他国家", options: regularOptions },
  ].filter((group) => group.options.length > 0);
}

function OptionFlagIcon({ option }: { option: Option }) {
  if (option.flagCode) {
    return (
      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-slate-200">
        <CircleFlag countryCode={option.flagCode.toLowerCase()} height={20} />
      </span>
    );
  }

  if (option.value === OTHER_COUNTRY_VALUE) {
    return <Globe2Icon className="h-4 w-4 shrink-0 text-slate-400" />;
  }

  return null;
}

function SelectOptionContent({
  option,
  selected,
}: {
  option: Option;
  selected: boolean;
}) {
  return (
    <>
      <OptionFlagIcon option={option} />
      <span className="min-w-0 flex-1">
        <span className="block truncate">{option.label}</span>
        {option.secondaryLabel && (
          <span className="block truncate text-xs text-slate-400">
            {option.secondaryLabel}
          </span>
        )}
      </span>
      {option.featured && (
        <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
          热门
        </span>
      )}
      <CheckIcon
        className={cn(
          "ml-auto size-3.5 shrink-0",
          selected ? "opacity-100" : "opacity-0"
        )}
      />
    </>
  );
}

function buildOptionKeywords(...parts: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const keywords: string[] = [];

  for (const part of parts) {
    if (!part) continue;
    const normalized = part.trim();
    if (!normalized) continue;

    const tokens = normalized
      .split(/[\s,，、;；|()（）]+/)
      .map((token) => token.trim())
      .filter(Boolean);

    for (const token of [normalized, ...tokens]) {
      const key = token.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      keywords.push(token);
    }
  }

  return keywords;
}

function SearchableSingleSelect({
  options,
  placeholder,
  value,
  onChange,
  disabled,
}: {
  options: Option[];
  placeholder: string;
  value: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value);
  const selectedLabel =
    selectedOption?.label ?? (value ? getLocalLocationDisplayName(value) : "");
  const optionGroups = getOptionGroups(options);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          className="h-9 w-full justify-between"
          disabled={disabled}
          size="sm"
          variant="outline"
        >
          <span
            className={cn(
              "flex min-w-0 items-center gap-2 truncate",
              !selectedLabel && "text-muted-foreground"
            )}
          >
            {selectedOption && <OptionFlagIcon option={selectedOption} />}
            <span className="truncate">{selectedLabel || placeholder}</span>
          </span>
          <ChevronsUpDownIcon className="size-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="min-w-[--radix-popper-anchor-width] max-w-[calc(100vw-2rem)] p-0"
      >
        <Command
          filter={(commandValue, search, keywords) =>
            matchesSearchText(search, [commandValue, ...(keywords ?? [])]) ? 1 : 0
          }
        >
          <CommandInput placeholder="搜索..." />
          <CommandList className="max-h-[280px]">
            <CommandEmpty>没有匹配项</CommandEmpty>
            {optionGroups.map((group) => (
              <CommandGroup heading={group.heading} key={group.heading ?? "options"}>
                {group.options.map((option) => (
                  <CommandItem
                    className="flex w-full items-center gap-2 py-2 [&_svg]:size-auto"
                    key={option.value}
                    keywords={option.keywords}
                    onSelect={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    value={`${option.value} ${option.label} ${option.keywords?.join(" ") ?? ""}`}
                  >
                    <SelectOptionContent
                      option={option}
                      selected={value === option.value}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function SearchableMultiSelect({
  options,
  placeholder,
  values,
  onChange,
  disabled,
}: {
  options: Option[];
  placeholder: string;
  values: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const selectedOptions = useMemo(() => {
    const optionMap = new Map(options.map((option) => [option.value, option]));
    return values.map((value) => optionMap.get(value)).filter(Boolean) as Option[];
  }, [options, values]);

  const summary = useMemo(() => {
    if (!values.length) return "";
    const optionMap = new Map(options.map((option) => [option.value, option.label]));
    const labels = values.map(
      (value) => optionMap.get(value) ?? getLocalLocationDisplayName(value)
    );
    return labels.join(" / ");
  }, [options, values]);
  const optionGroups = getOptionGroups(options);

  const toggleValue = (value: string) => {
    if (values.includes(value)) {
      onChange(values.filter((item) => item !== value));
      return;
    }
    onChange([...values, value]);
  };

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          className="h-9 w-full justify-between"
          disabled={disabled}
          size="sm"
          variant="outline"
        >
          <span
            className={cn(
              "flex min-w-0 items-center gap-2 truncate",
              !summary && "text-muted-foreground"
            )}
          >
            {selectedOptions.some((option) => option.flagCode) && (
              <span className="-space-x-1.5 flex shrink-0">
                {selectedOptions.slice(0, 3).map((option) => (
                  <OptionFlagIcon key={option.value} option={option} />
                ))}
              </span>
            )}
            <span className="truncate">{summary || placeholder}</span>
          </span>
          <ChevronsUpDownIcon className="size-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="min-w-[--radix-popper-anchor-width] max-w-[calc(100vw-2rem)] p-0"
      >
        <Command
          filter={(commandValue, search, keywords) =>
            matchesSearchText(search, [commandValue, ...(keywords ?? [])]) ? 1 : 0
          }
        >
          <CommandInput placeholder="搜索..." />
          <CommandList className="max-h-[280px]">
            <CommandEmpty>没有匹配项</CommandEmpty>
            {optionGroups.map((group) => (
              <CommandGroup heading={group.heading} key={group.heading ?? "options"}>
                {group.options.map((option) => (
                  <CommandItem
                    className="flex w-full items-center gap-2 py-2 [&_svg]:size-auto"
                    key={option.value}
                    keywords={option.keywords}
                    onSelect={() => {
                      toggleValue(option.value);
                    }}
                    value={`${option.value} ${option.label} ${option.keywords?.join(" ") ?? ""}`}
                  >
                    <SelectOptionContent
                      option={option}
                      selected={values.includes(option.value)}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function toChatLikeMessages(messages: TravelChatMessage[]): ChatLikeMessage[] {
  return messages.map((message) => ({
    role: message.role,
    parts: message.parts
      .filter((part) => part.type === "text")
      .map((part) => ({ type: "text", text: part.text ?? "" })),
  }));
}

function parsePositiveIntText(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function parseApiErrorText(rawText: string, fallback: string): string {
  const text = rawText.trim();
  if (!text) return fallback;

  try {
    const parsed = JSON.parse(text) as unknown;
    if (parsed && typeof parsed === "object") {
      const record = parsed as Record<string, unknown>;
      if (typeof record.detail === "string" && record.detail.trim()) {
        return record.detail.trim();
      }
      if (typeof record.error === "string" && record.error.trim()) {
        let message = record.error.trim();
        const debugValue = record.debug;
        if (Array.isArray(debugValue) && debugValue.length > 0) {
          const debugText = debugValue
            .map((item) => {
              if (!item || typeof item !== "object") return null;
              const debugItem = item as Record<string, unknown>;
              const path =
                typeof debugItem.path === "string" ? debugItem.path : "?";
              const status =
                typeof debugItem.status === "number"
                  ? debugItem.status
                  : "?";
              const detail =
                typeof debugItem.detail === "string" ? debugItem.detail : "";
              return `${path} -> ${status}${detail ? ` (${detail})` : ""}`;
            })
            .filter((item): item is string => Boolean(item))
            .join(" | ");

          if (debugText) {
            message = `${message} [${debugText}]`;
          }
        }
        return message;
      }
      if (typeof record.message === "string" && record.message.trim()) {
        return record.message.trim();
      }
    }
  } catch {
    // fallback to raw text
  }

  return text || fallback;
}

function coerceIpLocation(raw: unknown): IpLocation | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const city = typeof record.city === "string" ? record.city.trim() : "";
  const country = typeof record.country === "string" ? record.country.trim() : "";
  if (!city || !country) return null;

  return {
    city,
    country,
    countryCode:
      typeof record.countryCode === "string"
        ? record.countryCode.trim()
        : undefined,
    source: typeof record.source === "string" ? record.source.trim() : undefined,
  };
}

const LOCAL_LOCATION_NAME_BY_KEY: Record<string, string> = {
  australia: "澳大利亚",
  beijing: "北京",
  china: "中国",
  france: "法国",
  hongkong: "香港",
  italy: "意大利",
  japan: "日本",
  kyoto: "京都",
  london: "伦敦",
  newyork: "纽约",
  osaka: "大阪",
  paris: "巴黎",
  pisa: "比萨",
  rome: "罗马",
  sanfrancisco: "旧金山",
  seoul: "首尔",
  singapore: "新加坡",
  southkorea: "韩国",
  sydney: "悉尼",
  thailand: "泰国",
  tokyo: "东京",
  unitedkingdom: "英国",
  unitedstates: "美国",
};

function getLocalLocationDisplayName(value: string): string {
  const key = value.trim().toLowerCase().replace(/\s+/g, "");
  return LOCAL_LOCATION_NAME_BY_KEY[key] ?? value;
}

function coerceCountryOptions(raw: unknown): Option[] {
  if (!raw || typeof raw !== "object") return [];
  const record = raw as Record<string, unknown>;
  if (!Array.isArray(record.countries)) return [];

  const options: Option[] = [];

  for (const item of record.countries) {
    const option = item as CountryApiOption;
    const value = typeof option.value === "string" ? option.value.trim() : "";
    const label = typeof option.label === "string" ? option.label.trim() : "";
    const labelEn =
      typeof option.labelEn === "string" ? option.labelEn.trim() : "";
    const labelZh =
      typeof option.labelZh === "string" ? option.labelZh.trim() : "";
    const code = typeof option.code === "string" ? option.code.trim() : "";
    const search = typeof option.search === "string" ? option.search.trim() : "";
    const displayLabel = getOptionDisplayLabel(option);
    if (!value || !displayLabel) continue;
    const normalizedCode = code.toUpperCase();
    const isFeatured = POPULAR_COUNTRY_CODE_ORDER.has(normalizedCode);

    options.push({
      value,
      label: displayLabel,
      flagCode: normalizedCode || undefined,
      featured: isFeatured,
      secondaryLabel: labelEn && labelEn !== displayLabel ? labelEn : undefined,
      sortLabel: labelEn || displayLabel,
      keywords: buildOptionKeywords(search, label, value, labelEn, labelZh, code),
    });
  }

  return options.sort((a, b) => {
    const aFeaturedIndex = a.flagCode
      ? POPULAR_COUNTRY_CODE_ORDER.get(a.flagCode.toUpperCase())
      : undefined;
    const bFeaturedIndex = b.flagCode
      ? POPULAR_COUNTRY_CODE_ORDER.get(b.flagCode.toUpperCase())
      : undefined;

    if (aFeaturedIndex !== undefined || bFeaturedIndex !== undefined) {
      if (aFeaturedIndex === undefined) return 1;
      if (bFeaturedIndex === undefined) return -1;
      return aFeaturedIndex - bFeaturedIndex;
    }

    return (a.sortLabel ?? a.label).localeCompare(b.sortLabel ?? b.label, "en", {
      sensitivity: "base",
    });
  });
}

function coerceCitiesByCountry(raw: unknown): Record<string, Option[]> {
  if (!raw || typeof raw !== "object") return {};
  const record = raw as Record<string, unknown>;
  if (!record.citiesByCountry || typeof record.citiesByCountry !== "object") return {};

  const citiesByCountryRaw = record.citiesByCountry as Record<string, unknown>;
  const result: Record<string, Option[]> = {};

  for (const [country, cities] of Object.entries(citiesByCountryRaw)) {
    if (!Array.isArray(cities)) {
      result[country] = [];
      continue;
    }

    const options: Option[] = [];
    for (const city of cities) {
      if (typeof city === "string") {
        const name = city.trim();
        if (!name) continue;
        options.push({
          value: name,
          label: name,
          keywords: [name],
        });
        continue;
      }

      if (!city || typeof city !== "object") continue;
      const cityOption = city as CityApiOption;
      const value =
        typeof cityOption.value === "string" ? cityOption.value.trim() : "";
      const label =
        typeof cityOption.label === "string" ? cityOption.label.trim() : "";
      const labelEn =
        typeof cityOption.labelEn === "string" ? cityOption.labelEn.trim() : "";
      const labelZh =
        typeof cityOption.labelZh === "string" ? cityOption.labelZh.trim() : "";
      const search =
        typeof cityOption.search === "string" ? cityOption.search.trim() : "";
      const displayLabel = getOptionDisplayLabel(cityOption);
      if (!value || !displayLabel) continue;

      options.push({
        value,
        label: displayLabel,
        keywords: buildOptionKeywords(search, label, value, labelEn, labelZh),
      });
    }

    const uniqueOptions = new Map<string, Option>();
    for (const option of options) {
      const key = option.value.toLowerCase();
      if (uniqueOptions.has(key)) continue;
      uniqueOptions.set(key, option);
    }
    result[country] = Array.from(uniqueOptions.values());
  }

  return result;
}

function coerceCityCountByCountry(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object") return {};
  const record = raw as Record<string, unknown>;
  if (!record.cityCountByCountry || typeof record.cityCountByCountry !== "object") {
    return {};
  }

  const countsRaw = record.cityCountByCountry as Record<string, unknown>;
  const result: Record<string, number> = {};
  for (const [country, count] of Object.entries(countsRaw)) {
    if (typeof count !== "number" || count < 0 || !Number.isFinite(count)) {
      result[country] = 0;
      continue;
    }
    result[country] = Math.floor(count);
  }

  return result;
}

function cityOptionsFromCountries(
  countries: string[],
  citiesByCountry: Record<string, Option[]>
): Option[] {
  const options: Option[] = [];
  const seen = new Set<string>();

  for (const country of countries) {
    const cities = citiesByCountry[country] ?? [];
    for (const city of cities) {
      const key = city.value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      options.push(city);
    }
  }

  return options;
}

function optionLabelFromMap(
  value: string,
  labelMap: ReadonlyMap<string, string>
): string {
  return labelMap.get(value) ?? getLocalLocationDisplayName(value);
}

function optionLabelsFromValues(
  values: string[],
  labelMap: ReadonlyMap<string, string>
): string[] {
  return values.map((value) => optionLabelFromMap(value, labelMap));
}

function formatCountryCityLabel(country: string, city: string): string {
  const countryLabel = getLocalLocationDisplayName(country);
  const cityLabel = getLocalLocationDisplayName(city);
  return countryLabel === cityLabel ? cityLabel : `${countryLabel} ${cityLabel}`;
}

function coerceFlightLegs(raw: unknown): FlightLegResult[] {
  if (!raw || typeof raw !== "object") return [];
  const record = raw as Record<string, unknown>;
  if (!Array.isArray(record.legs)) return [];

  const legs: FlightLegResult[] = [];
  for (const rawLeg of record.legs) {
    if (!rawLeg || typeof rawLeg !== "object") continue;
    const leg = rawLeg as Record<string, unknown>;
    const from = typeof leg.from === "string" ? leg.from : null;
    const to = typeof leg.to === "string" ? leg.to : null;
    const departureDate =
      typeof leg.departure_date === "string" ? leg.departure_date : null;
    if (!from || !to || !departureDate) continue;

    const options = Array.isArray(leg.options)
      ? leg.options.filter(
          (option): option is NonNullable<FlightLegResult["options"][number]> =>
            Boolean(option && typeof option === "object")
        )
      : [];

    legs.push({
      from,
      to,
      departure_date: departureDate,
      options,
    });
  }

  return legs;
}

function coerceHotelStays(raw: unknown): HotelStayResult[] {
  if (!raw || typeof raw !== "object") return [];
  const record = raw as Record<string, unknown>;
  if (!Array.isArray(record.stays)) return [];

  const stays: HotelStayResult[] = [];
  for (const rawStay of record.stays) {
    if (!rawStay || typeof rawStay !== "object") continue;
    const stay = rawStay as Record<string, unknown>;
    const city = typeof stay.city === "string" ? stay.city : null;
    const checkIn = typeof stay.check_in === "string" ? stay.check_in : null;
    const checkOut = typeof stay.check_out === "string" ? stay.check_out : null;
    const nights = typeof stay.nights === "number" ? stay.nights : null;
    if (!city || !checkIn || !checkOut || !nights) continue;

    const options = Array.isArray(stay.options)
      ? stay.options.filter(
          (option): option is NonNullable<HotelStayResult["options"][number]> =>
            Boolean(option && typeof option === "object")
        )
      : [];

    stays.push({
      city,
      check_in: checkIn,
      check_out: checkOut,
      nights,
      adults: typeof stay.adults === "number" ? stay.adults : undefined,
      options,
    });
  }

  return stays;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value: string): Date {
  const [yearText, monthText, dayText] = value.split("-");
  const parsed = new Date(Number(yearText), Number(monthText) - 1, Number(dayText));
  return Number.isNaN(parsed.getTime())
    ? parseIsoDate(getDefaultFlexibleDepartureDate())
    : parsed;
}

function buildFallbackFlightLegs(payload: TravelPlanningPayload): FlightLegResult[] {
  const route = [
    payload.origin_city,
    ...payload.cities,
    payload.return_city,
  ].filter(Boolean);

  if (route.length < 2) return [];

  const startDate = parseIsoDate(payload.departure_date);
  const legs: FlightLegResult[] = [];

  for (let index = 0; index < route.length - 1; index += 1) {
    const from = route[index];
    const to = route[index + 1];
    if (!from || !to || from === to) continue;

    const priorCities = index === 0 ? [] : payload.cities.slice(0, index);
    const offsetDays = priorCities.reduce(
      (sum, city) => sum + (payload.city_days[city] ?? 1),
      0
    );

    legs.push({
      from,
      to,
      departure_date: toIsoDate(addDays(startDate, offsetDays)),
      options: [],
    });
  }

  return legs;
}

function buildFallbackHotelStays(payload: TravelPlanningPayload): HotelStayResult[] {
  const startDate = parseIsoDate(payload.departure_date);
  const stays: HotelStayResult[] = [];
  let elapsed = 0;

  for (const city of payload.cities) {
    const nights = payload.city_days[city] ?? 1;
    const checkIn = addDays(startDate, elapsed);
    const checkOut = addDays(startDate, elapsed + nights);
    stays.push({
      city,
      check_in: toIsoDate(checkIn),
      check_out: toIsoDate(checkOut),
      nights,
      adults: payload.travelers,
      options: [],
    });
    elapsed += nights;
  }

  return stays;
}

function formatFlightLabel(
  option: FlightLegResult["options"][number],
  fallbackOrder: number
): string {
  const airline = option.airline || `方案 ${fallbackOrder}`;
  const price = option.price ? `${option.price} ${option.currency ?? ""}`.trim() : "价格未知";
  const departure = option.departure ? `出发 ${option.departure}` : "出发时间未知";
  return `${airline} | ${price} | ${departure}`;
}

function formatHotelLabel(
  option: HotelStayResult["options"][number],
  fallbackOrder: number
): string {
  const name = option.name || `酒店方案 ${fallbackOrder}`;
  const price = option.price_per_night
    ? `${option.price_per_night} ${option.currency ?? ""}/晚`.trim()
    : "价格未知";
  const rating =
    option.rating !== undefined && option.rating !== null ? `评分 ${option.rating}` : "暂无评分";
  return `${name} | ${price} | ${rating}`;
}

function formatFlightStops(stops?: number): string {
  if (typeof stops !== "number" || stops < 0) return "未知";
  if (stops === 0) return "直飞";
  return `${stops} 次中转`;
}

function compactFlightOptionForMessage(
  option: FlightLegResult["options"][number]
): FlightLegResult["options"][number] {
  return {
    provider: option.provider,
    airline: option.airline,
    price: option.price,
    currency: option.currency,
    departure: option.departure,
    arrival: option.arrival,
    from: option.from,
    to: option.to,
    from_id: option.from_id,
    to_id: option.to_id,
    departure_airport: option.departure_airport,
    arrival_airport: option.arrival_airport,
    duration: option.duration,
    stops: option.stops,
    cabin_class: option.cabin_class,
    flight_number: option.flight_number,
    aircraft: option.aircraft,
    booking_url: option.booking_url,
  };
}

function compactHotelOptionForMessage(
  option: HotelStayResult["options"][number]
): HotelStayResult["options"][number] {
  return {
    provider: option.provider,
    city: option.city,
    name: option.name,
    hotel_id: option.hotel_id,
    price_per_night: option.price_per_night,
    taxes_and_fees: option.taxes_and_fees,
    currency: option.currency,
    check_in: option.check_in,
    check_out: option.check_out,
    adults: option.adults,
    rating: option.rating,
    average_price_per_night: option.average_price_per_night,
    total_price: option.total_price,
    address: option.address,
    latitude: option.latitude,
    longitude: option.longitude,
    contact_phone: option.contact_phone,
    contact_email: option.contact_email,
    website: option.website,
    review_text: option.review_text,
    check_in_time: option.check_in_time,
    check_out_time: option.check_out_time,
    distance_to_center: option.distance_to_center,
  };
}

export function TravelPlannerForm({
  isPrefetchingIpLocation = false,
  messages,
  prefetchedIpLocation = null,
  prefetchedIpLocationError = null,
  sendMessage,
  status,
}: {
  isPrefetchingIpLocation?: boolean;
  messages: TravelChatMessage[];
  prefetchedIpLocation?: IpLocation | null;
  prefetchedIpLocationError?: string | null;
  sendMessage: (message: TravelChatInputMessage) => void;
  status: TravelChatStatus;
}) {
  const travelState = useMemo(
    () => buildTravelStateFromMessages(toChatLikeMessages(messages)),
    [messages]
  );

  const missingField = nextMissingField(travelState);
  const planningPayload = useMemo(
    () => toTravelPlanningPayload(travelState),
    [travelState]
  );
  const planningPayloadKey = useMemo(
    () => (planningPayload ? JSON.stringify(planningPayload) : null),
    [planningPayload]
  );

  const busy = status === "submitted" || status === "streaming";
  const fieldQuestion = useMemo(
    () => getFieldQuestionForState(travelState, missingField ?? "country"),
    [missingField, travelState]
  );

  const [countries, setCountries] = useState<string[]>(travelState.countries);
  const [cities, setCities] = useState<string[]>(travelState.cities);
  const [dateMode, setDateMode] = useState<TravelDateFlexibility>(
    travelState.date_flexibility ?? "flexible"
  );
  const [departureDate, setDepartureDate] = useState<string>(
    travelState.departure_date ?? getDefaultFlexibleDepartureDate()
  );
  const [travelDays, setTravelDays] = useState<string>(
    travelState.travel_days?.toString() ?? ""
  );
  const [travelers, setTravelers] = useState<string>(travelState.travelers?.toString() ?? "");
  const [budget, setBudget] = useState<string>(travelState.budget?.toString() ?? "");
  const [originCountry, setOriginCountry] = useState<string>(travelState.origin_country ?? "");
  const [originCity, setOriginCity] = useState<string>(travelState.origin_city ?? "");
  const [returnCountry, setReturnCountry] = useState<string>(travelState.return_country ?? "");
  const [returnCity, setReturnCity] = useState<string>(travelState.return_city ?? "");
  const [travelOrder, setTravelOrder] = useState<string[]>(travelState.travel_order);
  const [destinationAddStep, setDestinationAddStep] =
    useState<DestinationAddStep>("idle");
  const [additionalCountries, setAdditionalCountries] = useState<string[]>([]);
  const [additionalCities, setAdditionalCities] = useState<string[]>([]);

  const [flightLegs, setFlightLegs] = useState<FlightLegResult[]>([]);
  const [hotelStays, setHotelStays] = useState<HotelStayResult[]>([]);
  const [flightSelectionDraft, setFlightSelectionDraft] = useState<
    Record<number, string>
  >({});
  const [hotelSelectionDraft, setHotelSelectionDraft] = useState<Record<number, string>>({});
  const [isLoadingFlights, setIsLoadingFlights] = useState(false);
  const [isLoadingHotels, setIsLoadingHotels] = useState(false);
  const [flightLoadError, setFlightLoadError] = useState<string | null>(null);
  const [hotelLoadError, setHotelLoadError] = useState<string | null>(null);
  const [loadedFlightsKey, setLoadedFlightsKey] = useState<string | null>(null);
  const [loadedHotelsKey, setLoadedHotelsKey] = useState<string | null>(null);
  const [countryOptions, setCountryOptions] = useState<Option[]>([]);
  const [citiesByCountry, setCitiesByCountry] = useState<Record<string, Option[]>>({});
  const [cityCountByCountry, setCityCountByCountry] = useState<Record<string, number>>({});
  const [isLoadingCountryOptions, setIsLoadingCountryOptions] = useState(false);
  const [isLoadingCityOptions, setIsLoadingCityOptions] = useState(false);
  const [countryLoadError, setCountryLoadError] = useState<string | null>(null);
  const [cityLoadError, setCityLoadError] = useState<string | null>(null);
  const [ipLocation, setIpLocation] = useState<IpLocation | null>(
    prefetchedIpLocation
  );
  const [isLoadingIpLocation, setIsLoadingIpLocation] = useState(
    isPrefetchingIpLocation
  );
  const [ipLocationError, setIpLocationError] = useState<string | null>(
    prefetchedIpLocationError
  );
  const [manualEndpointMode, setManualEndpointMode] = useState(false);
  const [customCountriesInput, setCustomCountriesInput] = useState("");
  const [customCitiesInput, setCustomCitiesInput] = useState("");
  const [customAdditionalCountriesInput, setCustomAdditionalCountriesInput] =
    useState("");
  const [customAdditionalCitiesInput, setCustomAdditionalCitiesInput] =
    useState("");
  const [customOriginCountry, setCustomOriginCountry] = useState("");
  const [customOriginCity, setCustomOriginCity] = useState("");
  const [customReturnCountry, setCustomReturnCountry] = useState("");
  const [customReturnCity, setCustomReturnCity] = useState("");
  const [finalNoteDraft, setFinalNoteDraft] = useState(
    travelState.final_note ?? ""
  );
  const [attachedFilesDraft, setAttachedFilesDraft] = useState<File[]>([]);
  const [attachmentInputKey, setAttachmentInputKey] = useState(0);
  const ipEndpointDefaultAppliedRef = useRef(false);

  const loadCitiesForCountries = useCallback(async (targetCountries: string[]) => {
    const normalizedCountries = targetCountries
      .map((country) => country.trim())
      .filter(Boolean);
    if (!normalizedCountries.length) return;

    const requestBody = { countries: normalizedCountries };
    setIsLoadingCityOptions(true);
    setCityLoadError(null);

    try {
      const response = await fetch("/api/travel/locations/cities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const text = await response.text();
      if (!response.ok) {
        throw new Error(parseApiErrorText(text, "加载城市数据失败。"));
      }

      let payload: unknown = {};
      try {
        payload = JSON.parse(text);
      } catch {
        payload = {};
      }

      const nextCitiesByCountry = coerceCitiesByCountry(payload);
      const nextCityCountByCountry = coerceCityCountByCountry(payload);
      setCitiesByCountry((current) => ({
        ...current,
        ...nextCitiesByCountry,
      }));
      setCityCountByCountry((current) => ({
        ...current,
        ...nextCityCountByCountry,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "加载城市数据失败。";
      setCityLoadError(message);
    } finally {
      setIsLoadingCityOptions(false);
    }
  }, []);

  useEffect(() => {
    const nextCountries =
      travelState.countries.length > 0
        ? travelState.countries
        : travelState.seed_country
          ? [travelState.seed_country]
          : [];
    const nextCities =
      travelState.cities.length > 0
        ? travelState.cities
        : travelState.seed_city
          ? [travelState.seed_city]
          : [];

    setCountries(nextCountries);
    setCities(nextCities);
    setDateMode(travelState.date_flexibility ?? "flexible");
    setDepartureDate(
      travelState.departure_date ?? getDefaultFlexibleDepartureDate()
    );
    setTravelDays(travelState.travel_days?.toString() ?? "");
    setTravelers(travelState.travelers?.toString() ?? "");
    setBudget(travelState.budget?.toString() ?? "");
    setOriginCountry(travelState.origin_country ?? "");
    setOriginCity(travelState.origin_city ?? "");
    setReturnCountry(travelState.return_country ?? "");
    setReturnCity(travelState.return_city ?? "");
    if (
      travelState.origin_country ||
      travelState.origin_city ||
      travelState.return_country ||
      travelState.return_city
    ) {
      ipEndpointDefaultAppliedRef.current = true;
    }
    setManualEndpointMode(
      Boolean(
        travelState.origin_country ||
          travelState.origin_city ||
          travelState.return_country ||
          travelState.return_city ||
          ipLocationError ||
          prefetchedIpLocationError
      )
    );
    setTravelOrder(
      travelState.travel_order.length === travelState.cities.length
        ? travelState.travel_order
        : travelState.cities.length > 0
          ? travelState.cities
          : nextCities.length === 1
            ? nextCities
            : []
    );

    const nextFlightDraft: Record<number, string> = {};
    for (const selected of travelState.selected_flights) {
      nextFlightDraft[selected.leg_index] = selected.skip
        ? "skip"
        : String(selected.option_index ?? "");
    }
    setFlightSelectionDraft(nextFlightDraft);

    const nextHotelDraft: Record<number, string> = {};
    for (const selected of travelState.selected_hotels) {
      const provider = selected.option?.provider;
      const name = selected.option?.name;
      nextHotelDraft[selected.stay_index] =
        provider === "self-arranged" || name === "自行安排"
          ? "self"
          : String(selected.option_index);
    }
    setHotelSelectionDraft(nextHotelDraft);
    setFinalNoteDraft(travelState.final_note ?? "");
  }, [ipLocationError, prefetchedIpLocationError, travelState]);

  useEffect(() => {
    if (prefetchedIpLocation) {
      setIpLocation(prefetchedIpLocation);
      setIpLocationError(null);
      setIsLoadingIpLocation(false);
      return;
    }

    if (prefetchedIpLocationError) {
      setIpLocationError(prefetchedIpLocationError);
      setIsLoadingIpLocation(false);
      setManualEndpointMode(true);
      return;
    }

    setIsLoadingIpLocation(isPrefetchingIpLocation);
  }, [
    isPrefetchingIpLocation,
    prefetchedIpLocation,
    prefetchedIpLocationError,
  ]);

  useEffect(() => {
    if (missingField !== "origin") return;
    if (!ipLocation || ipEndpointDefaultAppliedRef.current) return;
    if (
      travelState.origin_country ||
      travelState.origin_city ||
      travelState.return_country ||
      travelState.return_city
    ) {
      ipEndpointDefaultAppliedRef.current = true;
      return;
    }

    setOriginCountry(ipLocation.country);
    setOriginCity(ipLocation.city);
    setReturnCountry(ipLocation.country);
    setReturnCity(ipLocation.city);
    ipEndpointDefaultAppliedRef.current = true;
  }, [
    ipLocation,
    missingField,
    travelState.origin_city,
    travelState.origin_country,
    travelState.return_city,
    travelState.return_country,
  ]);

  useEffect(() => {
    let disposed = false;
    setIsLoadingCountryOptions(true);
    setCountryLoadError(null);

    fetch("/api/travel/locations/countries", {
      method: "GET",
    })
      .then(async (response) => {
        const text = await response.text();
        if (!response.ok) {
          throw new Error(parseApiErrorText(text, "加载国家数据失败。"));
        }
        try {
          return JSON.parse(text) as unknown;
        } catch {
          return {} as unknown;
        }
      })
      .then((payload) => {
        if (disposed) return;
        setCountryOptions(coerceCountryOptions(payload));
      })
      .catch((error) => {
        if (disposed) return;
        const message = error instanceof Error ? error.message : "加载国家数据失败。";
        setCountryLoadError(message);
      })
      .finally(() => {
        if (disposed) return;
        setIsLoadingCountryOptions(false);
      });

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    if (missingField !== "destination_confirmation") {
      setDestinationAddStep("idle");
      setAdditionalCountries([]);
      setAdditionalCities([]);
      setCustomAdditionalCountriesInput("");
      setCustomAdditionalCitiesInput("");
    }
  }, [missingField]);

  useEffect(() => {
    const neededCountries = countries.filter(
      (country) =>
        country !== OTHER_COUNTRY_VALUE &&
        !Object.prototype.hasOwnProperty.call(citiesByCountry, country)
    );
    if (!neededCountries.length) return;
    loadCitiesForCountries(neededCountries);
  }, [countries, citiesByCountry, loadCitiesForCountries]);

  useEffect(() => {
    const neededCountries = removeSpecialValue(
      additionalCountries,
      OTHER_COUNTRY_VALUE
    ).filter(
      (country) =>
        country &&
        !Object.prototype.hasOwnProperty.call(citiesByCountry, country)
    );
    if (!neededCountries.length) return;
    loadCitiesForCountries(neededCountries);
  }, [additionalCountries, citiesByCountry, loadCitiesForCountries]);

  useEffect(() => {
    const neededCountries = [originCountry, returnCountry]
      .map((country) => country.trim())
      .filter(
        (country) =>
          country &&
          country !== OTHER_COUNTRY_VALUE &&
          !Object.prototype.hasOwnProperty.call(citiesByCountry, country)
      );
    if (!neededCountries.length) return;
    loadCitiesForCountries(neededCountries);
  }, [originCountry, returnCountry, citiesByCountry, loadCitiesForCountries]);

  useEffect(() => {
    if (ipLocation || ipLocationError || isPrefetchingIpLocation) return;

    let disposed = false;
    setIsLoadingIpLocation(true);

    fetch("/api/travel/ip-location", { method: "GET" })
      .then(async (response) => {
        const text = await response.text();
        if (!response.ok) {
          throw new Error(parseApiErrorText(text, "无法根据 IP 推断城市。"));
        }
        try {
          return JSON.parse(text) as unknown;
        } catch {
          return {} as unknown;
        }
      })
      .then((payload) => {
        if (disposed) return;
        const location = coerceIpLocation(payload);
        if (!location) {
          throw new Error("无法根据 IP 推断城市。");
        }
        setIpLocation(location);
      })
      .catch((error) => {
        if (disposed) return;
        const message =
          error instanceof Error ? error.message : "无法根据 IP 推断城市。";
        setIpLocationError(message);
        setManualEndpointMode(true);
      })
      .finally(() => {
        if (disposed) return;
        setIsLoadingIpLocation(false);
      });

    return () => {
      disposed = true;
    };
  }, [ipLocation, ipLocationError, isPrefetchingIpLocation]);

  useEffect(() => {
    if (missingField !== "flight_selection") return;
    if (!planningPayload || !planningPayloadKey) return;
    if (loadedFlightsKey === planningPayloadKey) return;

    let disposed = false;
    setIsLoadingFlights(true);
    setFlightLoadError(null);

    fetch("/api/travel/flights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(planningPayload),
    })
      .then(async (response) => {
      const text = await response.text();

      let payload: unknown = {};

      try {
      payload = JSON.parse(text);
      } catch {
        payload = {};
      }

      if (!response.ok) {
        throw new Error(parseApiErrorText(text, "加载机票失败。"));
      }

      return payload;
    })
      .then((payload) => {
        if (disposed) return;
        const legs = coerceFlightLegs(payload);
        setFlightLegs(legs);
        setLoadedFlightsKey(planningPayloadKey);
      })
      .catch((error) => {
        if (disposed) return;
        const message = error instanceof Error ? error.message : "加载机票失败。";
        setFlightLoadError(message);
      })
      .finally(() => {
        if (disposed) return;
        setIsLoadingFlights(false);
      });

    return () => {
      disposed = true;
    };
  }, [missingField, planningPayload, planningPayloadKey, loadedFlightsKey]);

  useEffect(() => {
    if (missingField !== "hotel_selection") return;
    if (!planningPayload || !planningPayloadKey) return;
    if (loadedHotelsKey === planningPayloadKey) return;

    let disposed = false;
    setIsLoadingHotels(true);
    setHotelLoadError(null);

    fetch("/api/travel/hotels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(planningPayload),
    })
      .then(async (response) => {
        const text = await response.text();
        if (!response.ok) {
          throw new Error(parseApiErrorText(text, "加载酒店失败。"));
        }
        try {
          return JSON.parse(text) as unknown;
        } catch {
          return { stays: [] } as unknown;
        }
      })
      .then((payload) => {
        if (disposed) return;
        const stays = coerceHotelStays(payload);
        setHotelStays(stays);
        setLoadedHotelsKey(planningPayloadKey);
      })
      .catch((error) => {
        if (disposed) return;
        const message = error instanceof Error ? error.message : "加载酒店失败。";
        setHotelLoadError(message);
      })
      .finally(() => {
        if (disposed) return;
        setIsLoadingHotels(false);
      });

    return () => {
      disposed = true;
    };
  }, [missingField, planningPayload, planningPayloadKey, loadedHotelsKey]);

  const countryOptionsWithOther = useMemo(
    () => withOtherOption(countryOptions, OTHER_COUNTRY_VALUE, "其他（自定义国家）"),
    [countryOptions]
  );

  const cityOptions = useMemo(() => {
    const baseCountries = removeSpecialValue(countries, OTHER_COUNTRY_VALUE);
    return cityOptionsFromCountries(baseCountries, citiesByCountry);
  }, [countries, citiesByCountry]);
  const cityOptionsWithOther = useMemo(
    () => withOtherOption(cityOptions, OTHER_CITY_VALUE, "其他（自定义城市）"),
    [cityOptions]
  );
  const cityOptionsForStep = useMemo(() => {
    if (missingField !== "cities") return cityOptionsWithOther;
    if (!travelState.seed_city || travelState.cities.length > 0) {
      return cityOptionsWithOther;
    }

    const seedKey = normalizeLookupKey(travelState.seed_city);
    return cityOptionsWithOther.filter(
      (option) =>
        option.value === OTHER_CITY_VALUE ||
        normalizeLookupKey(option.value) !== seedKey
    );
  }, [cityOptionsWithOther, missingField, travelState.cities.length, travelState.seed_city]);
  const additionalCityOptions = useMemo(() => {
    const baseCountries = removeSpecialValue(
      additionalCountries,
      OTHER_COUNTRY_VALUE
    );
    return withOtherOption(
      cityOptionsFromCountries(baseCountries, citiesByCountry),
      OTHER_CITY_VALUE,
      "其他（自定义城市）"
    );
  }, [additionalCountries, citiesByCountry]);
  const citySet = useMemo(() => new Set(cities), [cities]);

  const resolvedCountries = useMemo(() => {
    const selected = removeSpecialValue(countries, OTHER_COUNTRY_VALUE);
    const custom = splitCustomValues(customCountriesInput);
    return dedupeValues([...selected, ...custom]);
  }, [countries, customCountriesInput]);

  const resolvedCities = useMemo(() => {
    const selected = removeSpecialValue(cities, OTHER_CITY_VALUE);
    const custom = splitCustomValues(customCitiesInput);
    return dedupeValues([...selected, ...custom]);
  }, [cities, customCitiesInput]);
  const resolvedAdditionalCountries = useMemo(() => {
    const selected = removeSpecialValue(additionalCountries, OTHER_COUNTRY_VALUE);
    const custom = splitCustomValues(customAdditionalCountriesInput);
    return dedupeValues([...selected, ...custom]);
  }, [additionalCountries, customAdditionalCountriesInput]);

  const resolvedAdditionalCities = useMemo(() => {
    const selected = removeSpecialValue(additionalCities, OTHER_CITY_VALUE);
    const custom = splitCustomValues(customAdditionalCitiesInput);
    return dedupeValues([...selected, ...custom]);
  }, [additionalCities, customAdditionalCitiesInput]);

  const resolvedOriginCountry = useMemo(() => {
    if (originCountry === OTHER_COUNTRY_VALUE) {
      return normalizeToken(customOriginCountry);
    }
    return normalizeToken(originCountry);
  }, [originCountry, customOriginCountry]);

  const resolvedOriginCity = useMemo(() => {
    if (originCity === OTHER_CITY_VALUE) {
      return normalizeToken(customOriginCity);
    }
    return normalizeToken(originCity);
  }, [originCity, customOriginCity]);

  const resolvedReturnCountry = useMemo(() => {
    if (returnCountry === OTHER_COUNTRY_VALUE) {
      return normalizeToken(customReturnCountry);
    }
    return normalizeToken(returnCountry);
  }, [returnCountry, customReturnCountry]);

  const resolvedReturnCity = useMemo(() => {
    if (returnCity === OTHER_CITY_VALUE) {
      return normalizeToken(customReturnCity);
    }
    return normalizeToken(returnCity);
  }, [returnCity, customReturnCity]);

  const originCountryForCityLookup =
    originCountry === OTHER_COUNTRY_VALUE ? "" : originCountry;
  const originCityOptions = useMemo(() => {
    if (!originCountryForCityLookup) {
      return withOtherOption(cityOptions, OTHER_CITY_VALUE, "其他（自定义城市）");
    }
    const baseOptions = cityOptionsFromCountries(
      [originCountryForCityLookup],
      citiesByCountry
    );
    return withOtherOption(baseOptions, OTHER_CITY_VALUE, "其他（自定义城市）");
  }, [originCountryForCityLookup, cityOptions, citiesByCountry]);

  const returnCountryForCityLookup =
    returnCountry === OTHER_COUNTRY_VALUE ? "" : returnCountry;
  const returnCityOptions = useMemo(() => {
    if (!returnCountryForCityLookup) {
      return withOtherOption(cityOptions, OTHER_CITY_VALUE, "其他（自定义城市）");
    }
    const baseOptions = cityOptionsFromCountries(
      [returnCountryForCityLookup],
      citiesByCountry
    );
    return withOtherOption(baseOptions, OTHER_CITY_VALUE, "其他（自定义城市）");
  }, [returnCountryForCityLookup, cityOptions, citiesByCountry]);

  const countryLabelMap = useMemo(
    () => new Map(countryOptionsWithOther.map((option) => [option.value, option.label])),
    [countryOptionsWithOther]
  );
  const cityLabelMap = useMemo(
    () =>
      new Map(
        [
          ...cityOptionsWithOther,
          ...additionalCityOptions,
          ...originCityOptions,
          ...returnCityOptions,
        ].map((option) => [option.value, option.label])
      ),
    [
      additionalCityOptions,
      cityOptionsWithOther,
      originCityOptions,
      returnCityOptions,
    ]
  );
  const getCountryDisplayName = useCallback(
    (value: string) => optionLabelFromMap(value, countryLabelMap),
    [countryLabelMap]
  );
  const getCityDisplayName = useCallback(
    (value: string) => optionLabelFromMap(value, cityLabelMap),
    [cityLabelMap]
  );
  const resolvedCountryDisplayNames = useMemo(() => {
    const selected = removeSpecialValue(countries, OTHER_COUNTRY_VALUE);
    const custom = splitCustomValues(customCountriesInput);
    return dedupeValues([
      ...optionLabelsFromValues(selected, countryLabelMap),
      ...custom,
    ]);
  }, [countries, countryLabelMap, customCountriesInput]);
  const resolvedCityDisplayNames = useMemo(() => {
    const selected = removeSpecialValue(cities, OTHER_CITY_VALUE);
    const custom = splitCustomValues(customCitiesInput);
    return dedupeValues([
      ...optionLabelsFromValues(selected, cityLabelMap),
      ...custom,
    ]);
  }, [cities, cityLabelMap, customCitiesInput]);
  const resolvedAdditionalCountryDisplayNames = useMemo(() => {
    const selected = removeSpecialValue(additionalCountries, OTHER_COUNTRY_VALUE);
    const custom = splitCustomValues(customAdditionalCountriesInput);
    return dedupeValues([
      ...optionLabelsFromValues(selected, countryLabelMap),
      ...custom,
    ]);
  }, [additionalCountries, countryLabelMap, customAdditionalCountriesInput]);
  const resolvedAdditionalCityDisplayNames = useMemo(() => {
    const selected = removeSpecialValue(additionalCities, OTHER_CITY_VALUE);
    const custom = splitCustomValues(customAdditionalCitiesInput);
    return dedupeValues([
      ...optionLabelsFromValues(selected, cityLabelMap),
      ...custom,
    ]);
  }, [additionalCities, cityLabelMap, customAdditionalCitiesInput]);
  const selectedCityLabelMap = useMemo(
    () =>
      Object.fromEntries(
        resolvedCities.map((city) => [city, getCityDisplayName(city)])
      ),
    [getCityDisplayName, resolvedCities]
  );
  const resolvedOriginCountryDisplay = useMemo(() => {
    if (originCountry === OTHER_COUNTRY_VALUE) {
      return normalizeToken(customOriginCountry);
    }
    return resolvedOriginCountry
      ? getCountryDisplayName(resolvedOriginCountry)
      : "";
  }, [
    customOriginCountry,
    getCountryDisplayName,
    originCountry,
    resolvedOriginCountry,
  ]);
  const resolvedOriginCityDisplay = useMemo(() => {
    if (originCity === OTHER_CITY_VALUE) {
      return normalizeToken(customOriginCity);
    }
    return resolvedOriginCity ? getCityDisplayName(resolvedOriginCity) : "";
  }, [customOriginCity, getCityDisplayName, originCity, resolvedOriginCity]);
  const resolvedReturnCountryDisplay = useMemo(() => {
    if (returnCountry === OTHER_COUNTRY_VALUE) {
      return normalizeToken(customReturnCountry);
    }
    return resolvedReturnCountry
      ? getCountryDisplayName(resolvedReturnCountry)
      : "";
  }, [
    customReturnCountry,
    getCountryDisplayName,
    resolvedReturnCountry,
    returnCountry,
  ]);
  const resolvedReturnCityDisplay = useMemo(() => {
    if (returnCity === OTHER_CITY_VALUE) {
      return normalizeToken(customReturnCity);
    }
    return resolvedReturnCity ? getCityDisplayName(resolvedReturnCity) : "";
  }, [customReturnCity, getCityDisplayName, resolvedReturnCity, returnCity]);

  const cityLoadSummary = useMemo(() => {
    const summaryCountries = removeSpecialValue(countries, OTHER_COUNTRY_VALUE);
    if (!summaryCountries.length) return "";
    const items = summaryCountries
      .map((country) => {
        const count = cityCountByCountry[country];
        if (typeof count !== "number") return null;
        return `${getCountryDisplayName(country)}：${count}`;
      })
      .filter((item): item is string => Boolean(item));

    return items.join(" | ");
  }, [countries, cityCountByCountry, getCountryDisplayName]);

  const fallbackFlightLegs = useMemo(
    () => (planningPayload ? buildFallbackFlightLegs(planningPayload) : []),
    [planningPayload]
  );
  const fallbackHotelStays = useMemo(
    () => (planningPayload ? buildFallbackHotelStays(planningPayload) : []),
    [planningPayload]
  );
  const flightLegsForSelection =
    flightLegs.length > 0 ? flightLegs : fallbackFlightLegs;
  const hotelStaysForSelection =
    hotelStays.length > 0 ? hotelStays : fallbackHotelStays;
  const flexibleTravelDays = Math.max(
    Math.max(1, travelState.cities.length) * DEFAULT_CITY_DAYS,
    Math.max(1, travelState.cities.length)
  );
  const flexibleTravelers = travelState.travelers ?? 2;
  const flexibleBudget = Math.max(
    3000,
    (travelState.travel_days ?? flexibleTravelDays) *
      flexibleTravelers *
      1200
  );
  const sendStructuredMessage = useCallback(
    (payload: TravelFormPayload) => {
      sendMessage({
        role: "user",
        parts: [{ type: "text", text: createTravelFormMessage(payload) }],
      });
    },
    [sendMessage]
  );

  const submitCountries = useCallback(() => {
    if (!resolvedCountries.length) {
      toast.error("请至少选择一个国家。");
      return;
    }
    sendStructuredMessage({
      countries: resolvedCountries,
      country: resolvedCountries.join("、"),
      display: {
        countries: resolvedCountryDisplayNames,
        country: resolvedCountryDisplayNames.join("、"),
      },
    });
  }, [resolvedCountries, resolvedCountryDisplayNames, sendStructuredMessage]);

  const submitCities = useCallback(() => {
    if (!resolvedCities.length) {
      toast.error("请至少选择一个城市。");
      return;
    }
    sendStructuredMessage({
      cities: resolvedCities,
      travel_order: resolvedCities.length === 1 ? resolvedCities : undefined,
      display: {
        cities: resolvedCityDisplayNames,
        city_labels: selectedCityLabelMap,
        travel_order:
          resolvedCityDisplayNames.length === 1
            ? resolvedCityDisplayNames
            : undefined,
      },
    });
  }, [
    resolvedCities,
    resolvedCityDisplayNames,
    selectedCityLabelMap,
    sendStructuredMessage,
  ]);

  const submitAdditionalDestination = useCallback(() => {
    if (!resolvedAdditionalCountries.length) {
      toast.error("请至少选择一个要添加的国家。");
      return;
    }
    if (!resolvedAdditionalCities.length) {
      toast.error("请至少选择一个要添加的城市。");
      return;
    }

    const existingCountries =
      travelState.countries.length > 0
        ? travelState.countries
        : travelState.country
          ? [travelState.country]
          : [];
    const nextCountries = dedupeValues([
      ...existingCountries,
      ...resolvedAdditionalCountries,
    ]);
    const nextCities = dedupeValues([
      ...travelState.cities,
      ...resolvedAdditionalCities,
    ]);
    const existingOrder =
      travelState.travel_order.length === travelState.cities.length
        ? travelState.travel_order
        : [];
    const nextOrder = existingOrder.length
      ? dedupeValues([...existingOrder, ...resolvedAdditionalCities])
      : undefined;

    sendStructuredMessage({
      country: nextCountries.join("、"),
      countries: nextCountries,
      cities: nextCities,
      travel_order:
        nextOrder && nextOrder.length === nextCities.length
          ? nextOrder
          : undefined,
      display: {
        country: nextCountries.map(getCountryDisplayName).join("、"),
        countries: nextCountries.map(getCountryDisplayName),
        cities: nextCities.map(getCityDisplayName),
        city_labels: Object.fromEntries(
          nextCities.map((city) => [city, getCityDisplayName(city)])
        ),
        travel_order:
          nextOrder && nextOrder.length === nextCities.length
            ? nextOrder.map(getCityDisplayName)
            : undefined,
      },
    });

    setDestinationAddStep("idle");
    setAdditionalCountries([]);
    setAdditionalCities([]);
    setCustomAdditionalCountriesInput("");
    setCustomAdditionalCitiesInput("");
  }, [
    getCityDisplayName,
    getCountryDisplayName,
    resolvedAdditionalCities,
    resolvedAdditionalCountries,
    sendStructuredMessage,
    travelState.cities,
    travelState.countries,
    travelState.country,
    travelState.travel_order,
  ]);

  const submitEndpoints = useCallback(() => {
    if (
      !resolvedOriginCountry ||
      !resolvedOriginCity ||
      !resolvedReturnCountry ||
      !resolvedReturnCity
    ) {
      toast.error("请完整确认出发和返程国家、城市。");
      return;
    }

    sendStructuredMessage({
      origin_country: resolvedOriginCountry,
      origin_city: resolvedOriginCity,
      return_country: resolvedReturnCountry,
      return_city: resolvedReturnCity,
      display: {
        origin_country: resolvedOriginCountryDisplay,
        origin_city: resolvedOriginCityDisplay,
        return_country: resolvedReturnCountryDisplay,
        return_city: resolvedReturnCityDisplay,
      },
    });
  }, [
    resolvedOriginCountry,
    resolvedOriginCity,
    resolvedOriginCountryDisplay,
    resolvedOriginCityDisplay,
    resolvedReturnCountry,
    resolvedReturnCity,
    resolvedReturnCountryDisplay,
    resolvedReturnCityDisplay,
    sendStructuredMessage,
  ]);

  const submitIpDefaultEndpoints = useCallback(() => {
    if (!ipLocation) {
      toast.error("暂时没有识别到当前城市，请选择另选。");
      return;
    }

    const country = normalizeToken(ipLocation.country);
    const city = normalizeToken(ipLocation.city);
    if (!country || !city) {
      toast.error("暂时没有识别到当前城市，请选择另选。");
      return;
    }

    const displayLabel = formatCountryCityLabel(country, city);
    sendStructuredMessage({
      origin_country: country,
      origin_city: city,
      return_country: country,
      return_city: city,
      display: {
        origin_country: getLocalLocationDisplayName(country),
        origin_city: getLocalLocationDisplayName(city),
        return_country: getLocalLocationDisplayName(country),
        return_city: getLocalLocationDisplayName(city),
      },
    });
    toast.success(`已确认出发和返程城市：${displayLabel}`);
  }, [ipLocation, sendStructuredMessage]);

  const showManualEndpointFields = manualEndpointMode || Boolean(ipLocationError);
  const ipEndpointDisplay = ipLocation
    ? formatCountryCityLabel(ipLocation.country, ipLocation.city)
    : "";

  if (!missingField) {
    return null;
  }

  return (
    <div
      className="w-full max-w-[1000px] overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)]"
      data-testid="travel-planner-form"
    >
      <div className="mb-3 rounded-xl border border-sky-100/80 bg-gradient-to-r from-sky-50 to-cyan-50/70 px-3 py-2.5">
        <div className="text-sm font-semibold text-slate-900">旅行信息向导</div>
        <div className="mt-0.5 text-xs text-slate-600">{fieldQuestion}</div>
      </div>

      {missingField === "country" && (
        <div className="space-y-2">
          {countryLoadError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
              {countryLoadError}
            </div>
          )}
          <SearchableMultiSelect
            disabled={busy || isLoadingCountryOptions}
            onChange={setCountries}
            options={countryOptionsWithOther}
            placeholder={
              isLoadingCountryOptions ? "正在加载国家..." : "请选择国家（可多选）"
            }
            values={countries}
          />
          {countries.includes(OTHER_COUNTRY_VALUE) && (
            <Input
              onChange={(event) => setCustomCountriesInput(event.target.value)}
              placeholder="输入其他国家（可多项，逗号分隔）"
              type="text"
              value={customCountriesInput}
            />
          )}
          <Button
            className="w-full"
            disabled={busy || isLoadingCountryOptions || countries.length === 0}
            onClick={submitCountries}
            size="sm"
          >
            确认国家
          </Button>
          <Button
            className="w-full"
            disabled={busy || isLoadingCountryOptions || countries.length === 0}
            onClick={submitCountries}
            size="sm"
            variant="outline"
          >
            没有别的国家了
          </Button>
        </div>
      )}

      {missingField === "cities" && (
        <div className="space-y-2">
          {cityLoadError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
              {cityLoadError}
            </div>
          )}
          <SearchableMultiSelect
            disabled={busy || countries.length === 0 || isLoadingCityOptions}
            onChange={setCities}
            options={cityOptionsForStep}
            placeholder={
              !countries.length
                ? "请先选择国家后再选城市"
                : isLoadingCityOptions
                ? "正在加载城市..."
                : "请选择城市（可多选）"
            }
            values={cities}
          />
          {cities.includes(OTHER_CITY_VALUE) && (
            <Input
              onChange={(event) => setCustomCitiesInput(event.target.value)}
              placeholder="输入其他城市（可多项，逗号分隔）"
              type="text"
              value={customCitiesInput}
            />
          )}
          {cityLoadSummary && (
            <div className="text-[11px] text-muted-foreground">
              已加载城市数量：{cityLoadSummary}
            </div>
          )}
          <Button
            className="w-full"
            disabled={busy || isLoadingCityOptions || cities.length === 0}
            onClick={submitCities}
            size="sm"
          >
            确认城市
          </Button>
          <Button
            className="w-full"
            disabled={busy || isLoadingCityOptions || cities.length === 0}
            onClick={submitCities}
            size="sm"
            variant="outline"
          >
            没有别的城市了
          </Button>
        </div>
      )}

      {missingField === "destination_confirmation" && (
        <div className="space-y-2">
          <div className="rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            已选目的地：
            {resolvedCityDisplayNames.length > 0
              ? resolvedCityDisplayNames.join("、")
              : travelState.cities.join("、")}
            。如果还想加入别的国家或城市，可以继续选择国家和城市。
          </div>
          {destinationAddStep === "idle" && (
            <div className="grid grid-cols-2 gap-2">
              <Button
                className="w-full"
                disabled={busy}
                onClick={() => setDestinationAddStep("country")}
                size="sm"
                type="button"
                variant="outline"
              >
                继续添加目的地
              </Button>
              <Button
                className="w-full"
                disabled={busy}
                onClick={() => sendStructuredMessage({ destination_confirmed: true })}
                size="sm"
                type="button"
              >
                目的地就这些
              </Button>
            </div>
          )}

          {destinationAddStep === "country" && (
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="text-xs font-semibold text-slate-700">
                先选择要追加的国家
              </div>
              {countryLoadError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
                  {countryLoadError}
                </div>
              )}
              <SearchableMultiSelect
                disabled={busy || isLoadingCountryOptions}
                onChange={(values) => {
                  setAdditionalCountries(values);
                  setAdditionalCities([]);
                  setCustomAdditionalCitiesInput("");
                }}
                options={countryOptionsWithOther}
                placeholder={
                  isLoadingCountryOptions
                    ? "正在加载国家..."
                    : "选择要追加的国家（可多选）"
                }
                values={additionalCountries}
              />
              {additionalCountries.includes(OTHER_COUNTRY_VALUE) && (
                <Input
                  onChange={(event) =>
                    setCustomAdditionalCountriesInput(event.target.value)
                  }
                  placeholder="输入其他国家（可多项，逗号分隔）"
                  type="text"
                  value={customAdditionalCountriesInput}
                />
              )}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  className="w-full"
                  disabled={busy}
                  onClick={() => {
                    setDestinationAddStep("idle");
                    setAdditionalCountries([]);
                    setAdditionalCities([]);
                    setCustomAdditionalCountriesInput("");
                    setCustomAdditionalCitiesInput("");
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  返回
                </Button>
                <Button
                  className="w-full"
                  disabled={
                    busy ||
                    isLoadingCountryOptions ||
                    resolvedAdditionalCountries.length === 0
                  }
                  onClick={() => setDestinationAddStep("city")}
                  size="sm"
                  type="button"
                >
                  下一步选城市
                </Button>
              </div>
            </div>
          )}

          {destinationAddStep === "city" && (
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="text-xs font-semibold text-slate-700">
                再选择要追加的城市
              </div>
              {cityLoadError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
                  {cityLoadError}
                </div>
              )}
              <SearchableMultiSelect
                disabled={
                  busy ||
                  resolvedAdditionalCountries.length === 0 ||
                  isLoadingCityOptions
                }
                onChange={setAdditionalCities}
                options={additionalCityOptions}
                placeholder={
                  isLoadingCityOptions
                    ? "正在加载城市..."
                    : "选择要追加的城市（可多选）"
                }
                values={additionalCities}
              />
              {additionalCities.includes(OTHER_CITY_VALUE) && (
                <Input
                  onChange={(event) =>
                    setCustomAdditionalCitiesInput(event.target.value)
                  }
                  placeholder="输入其他城市（可多项，逗号分隔）"
                  type="text"
                  value={customAdditionalCitiesInput}
                />
              )}
              {resolvedAdditionalCountryDisplayNames.length > 0 && (
                <div className="text-[11px] text-muted-foreground">
                  正在添加：
                  {resolvedAdditionalCountryDisplayNames.join("、")}
                  {resolvedAdditionalCityDisplayNames.length > 0
                    ? ` · ${resolvedAdditionalCityDisplayNames.join("、")}`
                    : ""}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  className="w-full"
                  disabled={busy}
                  onClick={() => setDestinationAddStep("country")}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  上一步
                </Button>
                <Button
                  className="w-full"
                  disabled={
                    busy ||
                    isLoadingCityOptions ||
                    resolvedAdditionalCities.length === 0
                  }
                  onClick={submitAdditionalDestination}
                  size="sm"
                  type="button"
                >
                  加入这些目的地
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {missingField === "departure_date" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Button
              className="w-full"
              disabled={busy}
              onClick={() => {
                setDateMode("flexible");
                setDepartureDate(getDefaultFlexibleDepartureDate());
              }}
              size="sm"
              type="button"
              variant={dateMode === "flexible" ? "default" : "outline"}
            >
              灵活出行
            </Button>
            <Button
              className="w-full"
              disabled={busy}
              onClick={() => setDateMode("fixed")}
              size="sm"
              type="button"
              variant={dateMode === "fixed" ? "default" : "outline"}
            >
              指定日期
            </Button>
          </div>

          {dateMode === "fixed" ? (
            <Input
              onChange={(event) => setDepartureDate(event.target.value)}
              type="date"
              value={departureDate}
            />
          ) : (
            <div className="rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              灵活出行会先按两个月后的日期规划：{getDefaultFlexibleDepartureDate()}。
            </div>
          )}

          <Button
            className="w-full"
            disabled={busy}
            onClick={() => {
              const finalDate =
                dateMode === "flexible"
                  ? getDefaultFlexibleDepartureDate()
                  : departureDate;
              if (!/^\d{4}-\d{2}-\d{2}$/.test(finalDate)) {
                toast.error("请选择有效的出行日期。");
                return;
              }
              setLoadedFlightsKey(null);
              setLoadedHotelsKey(null);
              sendStructuredMessage({
                departure_date: finalDate,
                date_flexibility: dateMode,
                display: {
                  departure_date: finalDate,
                  date_flexibility: dateMode,
                },
              });
            }}
            size="sm"
          >
            确认出行日期
          </Button>
        </div>
      )}

      {missingField === "travel_days" && (
        <div className="space-y-2">
          <Input
            inputMode="numeric"
            onChange={(event) =>
              setTravelDays(event.target.value.replace(/[^\d]/g, ""))
            }
            placeholder="请输入总出行天数（正整数）"
            type="text"
            value={travelDays}
          />
          <div className="text-[11px] text-muted-foreground">
            已选 {travelState.cities.length} 个城市，出行天数至少为{" "}
            {Math.max(1, travelState.cities.length)} 天。
          </div>
          <Button
            className="w-full"
            disabled={busy}
            onClick={() => {
              const value = parsePositiveIntText(travelDays);
              const minimumDays = Math.max(1, travelState.cities.length);
              if (!value || value < minimumDays) {
                toast.error(`出行天数必须不少于 ${minimumDays} 天。`);
                return;
              }
              setLoadedFlightsKey(null);
              setLoadedHotelsKey(null);
              sendStructuredMessage({ travel_days: value });
            }}
            size="sm"
          >
            确认出行天数
          </Button>
          <Button
            className="w-full"
            disabled={busy}
            onClick={() => {
              setLoadedFlightsKey(null);
              setLoadedHotelsKey(null);
              sendStructuredMessage({
                travel_days: flexibleTravelDays,
                display: {
                  travel_days_label: `天数先灵活，暂按 ${flexibleTravelDays} 天规划。`,
                },
              });
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            天数灵活，先按 {flexibleTravelDays} 天规划
          </Button>
        </div>
      )}

      {missingField === "travelers" && (
        <div className="space-y-2">
          <Input
            inputMode="numeric"
            onChange={(event) => setTravelers(event.target.value.replace(/[^\d]/g, ""))}
            placeholder="请输入旅行人数（正整数）"
            type="text"
            value={travelers}
          />
          <Button
            className="w-full"
            disabled={busy}
            onClick={() => {
              const value = parsePositiveIntText(travelers);
              if (!value) {
                toast.error("旅行人数必须是正整数。");
                return;
              }
              sendStructuredMessage({ travelers: value });
            }}
            size="sm"
          >
            确认人数
          </Button>
          <Button
            className="w-full"
            disabled={busy}
            onClick={() => {
              sendStructuredMessage({
                travelers: flexibleTravelers,
                display: {
                  travelers_label: `人数先灵活，暂按 ${flexibleTravelers} 人规划。`,
                },
              });
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            人数灵活，先按 {flexibleTravelers} 人规划
          </Button>
        </div>
      )}

      {missingField === "budget" && (
        <div className="space-y-2">
          <Input
            inputMode="numeric"
            onChange={(event) => setBudget(event.target.value.replace(/[^\d]/g, ""))}
            placeholder="请输入预算（RMB，正整数）"
            type="text"
            value={budget}
          />
          <Button
            className="w-full"
            disabled={busy}
            onClick={() => {
              const value = parsePositiveIntText(budget);
              if (!value) {
                toast.error("预算必须是正整数。");
                return;
              }
              sendStructuredMessage({ budget: value });
            }}
            size="sm"
          >
            确认预算
          </Button>
          <Button
            className="w-full"
            disabled={busy}
            onClick={() => {
              sendStructuredMessage({
                budget: flexibleBudget,
                display: {
                  budget_label: `预算先灵活，暂按 ${flexibleBudget} RMB 规划。`,
                },
              });
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            预算灵活，先按 {flexibleBudget} RMB 规划
          </Button>
        </div>
      )}

      {missingField === "origin" && (
        <div className="space-y-3">
          {cityLoadError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
              {cityLoadError}
            </div>
          )}

          {isLoadingIpLocation && !ipLocation && (
            <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/20 p-3 text-xs text-muted-foreground">
              <Loader2Icon className="size-3.5 animate-spin" />
              正在根据 IP 默认填入出发和返程城市...
            </div>
          )}

          {ipLocation && !manualEndpointMode && !ipLocationError && (
            <div className="space-y-3 rounded-xl border border-sky-100 bg-sky-50/80 p-3">
              <div className="text-xs text-sky-800">
                已根据当前 IP 识别到你在{" "}
                <span className="font-semibold">{ipEndpointDisplay}</span>。
                是否将出发和返程城市都设为这里？
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  className="w-full"
                  disabled={busy}
                  onClick={submitIpDefaultEndpoints}
                  size="sm"
                  type="button"
                >
                  确认
                </Button>
                <Button
                  className="w-full"
                  disabled={busy}
                  onClick={() => {
                    setOriginCountry("");
                    setOriginCity("");
                    setReturnCountry("");
                    setReturnCity("");
                    setManualEndpointMode(true);
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  另选
                </Button>
              </div>
            </div>
          )}

          {ipLocationError && (
            <div className="rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              {ipLocationError} 请手动选择出发和返程城市。
            </div>
          )}

          {!manualEndpointMode && !ipLocation && !ipLocationError && (
            <div className="space-y-2 rounded-lg border border-border/40 bg-muted/20 p-3">
              <div className="text-xs text-muted-foreground">
                如果没有识别到当前位置，请手动选择出发和返程城市。
              </div>
              <Button
                className="w-full"
                disabled={busy}
                onClick={() => setManualEndpointMode(true)}
                size="sm"
                type="button"
                variant="outline"
              >
                手动选择
              </Button>
            </div>
          )}

          {showManualEndpointFields && (
            <div className="space-y-3">
              <div className="space-y-2 rounded-lg border border-border/40 p-2.5">
                <div className="text-xs font-medium text-muted-foreground">
                  出发城市
                </div>
                <SearchableSingleSelect
                  disabled={busy || isLoadingCountryOptions}
                  onChange={(value) => {
                    setOriginCountry(value);
                    setOriginCity("");
                  }}
                  options={countryOptionsWithOther}
                  placeholder={
                    isLoadingCountryOptions ? "正在加载国家..." : "选择出发国家"
                  }
                  value={originCountry || null}
                />
                {originCountry === OTHER_COUNTRY_VALUE && (
                  <Input
                    onChange={(event) => setCustomOriginCountry(event.target.value)}
                    placeholder="输入出发国家"
                    type="text"
                    value={customOriginCountry}
                  />
                )}
                <SearchableSingleSelect
                  disabled={busy || !originCountry || isLoadingCityOptions}
                  onChange={setOriginCity}
                  options={originCityOptions}
                  placeholder={
                    !originCountry
                      ? "请先选择出发国家"
                      : originCountry === OTHER_COUNTRY_VALUE
                        ? "可选“其他”后输入出发城市"
                        : isLoadingCityOptions
                          ? "正在加载城市..."
                          : "选择出发城市"
                  }
                  value={originCity || null}
                />
                {originCountryForCityLookup &&
                  typeof cityCountByCountry[originCountryForCityLookup] === "number" && (
                    <div className="text-[11px] text-muted-foreground">
                      {getCountryDisplayName(originCountryForCityLookup)} 已加载{" "}
                      {cityCountByCountry[originCountryForCityLookup]} 个城市
                    </div>
                  )}
                {originCity === OTHER_CITY_VALUE && (
                  <Input
                    onChange={(event) => setCustomOriginCity(event.target.value)}
                    placeholder="输入出发城市"
                    type="text"
                    value={customOriginCity}
                  />
                )}
              </div>

              <div className="space-y-2 rounded-lg border border-border/40 p-2.5">
                <div className="text-xs font-medium text-muted-foreground">
                  返程城市
                </div>
                <SearchableSingleSelect
                  disabled={busy || isLoadingCountryOptions}
                  onChange={(value) => {
                    setReturnCountry(value);
                    setReturnCity("");
                  }}
                  options={countryOptionsWithOther}
                  placeholder={
                    isLoadingCountryOptions ? "正在加载国家..." : "选择返程国家"
                  }
                  value={returnCountry || null}
                />
                {returnCountry === OTHER_COUNTRY_VALUE && (
                  <Input
                    onChange={(event) => setCustomReturnCountry(event.target.value)}
                    placeholder="输入返程国家"
                    type="text"
                    value={customReturnCountry}
                  />
                )}
                <SearchableSingleSelect
                  disabled={busy || !returnCountry || isLoadingCityOptions}
                  onChange={setReturnCity}
                  options={returnCityOptions}
                  placeholder={
                    !returnCountry
                      ? "请先选择返程国家"
                      : returnCountry === OTHER_COUNTRY_VALUE
                        ? "可选“其他”后输入返程城市"
                        : isLoadingCityOptions
                          ? "正在加载城市..."
                          : "选择返程城市"
                  }
                  value={returnCity || null}
                />
                {returnCountryForCityLookup &&
                  typeof cityCountByCountry[returnCountryForCityLookup] === "number" && (
                    <div className="text-[11px] text-muted-foreground">
                      {getCountryDisplayName(returnCountryForCityLookup)} 已加载{" "}
                      {cityCountByCountry[returnCountryForCityLookup]} 个城市
                    </div>
                  )}
                {returnCity === OTHER_CITY_VALUE && (
                  <Input
                    onChange={(event) => setCustomReturnCity(event.target.value)}
                    placeholder="输入返程城市"
                    type="text"
                    value={customReturnCity}
                  />
                )}
              </div>

              <Button
                className="w-full"
                disabled={busy}
                onClick={submitEndpoints}
                size="sm"
              >
                确认出发和返程城市
              </Button>
            </div>
          )}
        </div>
      )}

      {missingField === "travel_order" && (
        <div className="space-y-2">
          {travelOrder.map((city, index) => (
            <div
              className="flex items-center justify-between rounded-lg border border-border/40 px-2.5 py-1.5"
              key={`${city}-${index}`}
            >
              <div className="text-sm">{getCityDisplayName(city)}</div>
              <div className="flex items-center gap-1">
                <Button
                  disabled={busy || index === 0}
                  onClick={() => {
                    const next = [...travelOrder];
                    const current = next[index];
                    next[index] = next[index - 1];
                    next[index - 1] = current;
                    setTravelOrder(next);
                  }}
                  className="h-7 w-7"
                  size="icon"
                  variant="ghost"
                >
                  <MoveUpIcon className="size-3.5" />
                </Button>
                <Button
                  disabled={busy || index === travelOrder.length - 1}
                  onClick={() => {
                    const next = [...travelOrder];
                    const current = next[index];
                    next[index] = next[index + 1];
                    next[index + 1] = current;
                    setTravelOrder(next);
                  }}
                  className="h-7 w-7"
                  size="icon"
                  variant="ghost"
                >
                  <MoveDownIcon className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}

          <div className="text-[11px] text-muted-foreground">
            顺序确认后会进入航班选择，再进入酒店选择。
          </div>

          <Button
            className="w-full"
            disabled={busy}
            onClick={() => {
              if (travelOrder.length !== cities.length) {
                toast.error("旅行顺序必须覆盖全部已选城市。");
                return;
              }

              for (const city of travelOrder) {
                if (!citySet.has(city)) {
                  toast.error("旅行顺序中有不在已选列表的城市。");
                  return;
                }
              }

              setLoadedFlightsKey(null);
              setLoadedHotelsKey(null);
              sendStructuredMessage({
                travel_order: travelOrder,
                display: {
                  travel_order: travelOrder.map((city) =>
                    getCityDisplayName(city)
                  ),
                },
              });
            }}
            size="sm"
          >
            确认顺序
          </Button>
        </div>
      )}

      {missingField === "flight_selection" && (
        <div className="space-y-3">
          {isLoadingFlights && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2Icon className="size-3.5 animate-spin" />
              正在加载航班选项...
            </div>
          )}

          {flightLoadError && (
            <div className="rounded-md border border-amber-400/30 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-300">
              航班 API 暂时不可用，无法生成默认航班。请稍后重试。({flightLoadError})
            </div>
          )}

          {!isLoadingFlights && !flightLoadError && flightLegsForSelection.length === 0 && (
            <div className="rounded-md border border-border/40 px-2.5 py-2 text-xs text-muted-foreground">
              当前没有可选航段。
            </div>
          )}

          {flightLegsForSelection.map((leg, index) => {
            const legIndex = index + 1;
            const options: Option[] = [
              { value: "skip", label: "跳过此航段（其他交通）" },
              ...leg.options.map((option, optionIndex) => ({
                value: String(optionIndex + 1),
                label: formatFlightLabel(option, optionIndex + 1),
              })),
            ];
            const selectedValue =
              flightSelectionDraft[legIndex] ?? (leg.options.length ? "1" : "skip");
            const selectedOption =
              selectedValue && selectedValue !== "skip"
                ? leg.options[Number(selectedValue) - 1]
                : null;

            return (
              <div
                className="space-y-1.5 rounded-lg border border-border/40 p-2.5"
                key={`${leg.from}-${leg.to}-${leg.departure_date}-${legIndex}`}
              >
                <div className="text-xs text-muted-foreground">
                  航段 {legIndex}: {getCityDisplayName(leg.from)} →{" "}
                  {getCityDisplayName(leg.to)}（{leg.departure_date}）
                </div>
                <SearchableSingleSelect
                  disabled={busy}
                  onChange={(value) => {
                    setFlightSelectionDraft((current) => ({
                      ...current,
                      [legIndex]: value,
                    }));
                  }}
                  options={options}
                  placeholder="选择航班或跳过"
                  value={selectedValue}
                />
                {selectedValue === "skip" && (
                  <div className="rounded-md border border-border/40 bg-muted/20 p-2 text-xs text-muted-foreground">
                    该航段已选择跳过。
                  </div>
                )}
                {selectedOption && (
                  <div className="space-y-1 rounded-md border border-border/40 bg-muted/20 p-2 text-xs">
                    <div className="font-medium text-foreground">航班详情</div>
                    <div>航空公司：{selectedOption.airline ?? "未知"}</div>
                    <div>
                      价格：
                      {selectedOption.price
                        ? `${selectedOption.price} ${selectedOption.currency ?? ""}`.trim()
                        : "未知"}
                    </div>
                    <div>出发时间：{selectedOption.departure ?? "未知"}</div>
                    <div>到达时间：{selectedOption.arrival ?? "未知"}</div>
                    <div>时长：{selectedOption.duration ?? "未知"}</div>
                    <div>经停：{formatFlightStops(selectedOption.stops)}</div>
                    {selectedOption.departure_airport && (
                      <div>出发机场：{selectedOption.departure_airport}</div>
                    )}
                    {selectedOption.arrival_airport && (
                      <div>到达机场：{selectedOption.arrival_airport}</div>
                    )}
                    {selectedOption.cabin_class && (
                      <div>舱位：{selectedOption.cabin_class}</div>
                    )}
                    {selectedOption.flight_number && (
                      <div>航班号：{selectedOption.flight_number}</div>
                    )}
                    {selectedOption.aircraft && <div>机型：{selectedOption.aircraft}</div>}
                    {selectedOption.offer_token && (
                      <div className="break-all text-[11px] text-muted-foreground">
                        Offer Token：{selectedOption.offer_token}
                      </div>
                    )}
                    {selectedOption.booking_url && (
                      <a
                        className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
                        href={selectedOption.booking_url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        前往预订
                        <ExternalLinkIcon className="size-3" />
                      </a>
                    )}
                    <div className="text-[11px] text-muted-foreground">
                      数据来源：{selectedOption.provider ?? "unknown"}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <Button
            className="w-full"
            disabled={
              busy ||
              isLoadingFlights ||
              Boolean(flightLoadError) ||
              flightLegsForSelection.length === 0 ||
              flightLegsForSelection.some((leg) => leg.options.length === 0)
            }
            onClick={() => {
              const selected_flights: SelectedFlightOption[] = [];

              for (let index = 0; index < flightLegsForSelection.length; index += 1) {
                const leg = flightLegsForSelection[index];
                const legIndex = index + 1;
                const selectedValue =
                  flightSelectionDraft[legIndex] ?? (leg.options.length ? "1" : "skip");

                if (selectedValue === "skip") {
                  selected_flights.push({
                    leg_index: legIndex,
                    from: leg.from,
                    to: leg.to,
                    departure_date: leg.departure_date,
                    skip: true,
                  });
                  continue;
                }

                const optionIndex = Number(selectedValue);
                if (!Number.isInteger(optionIndex) || optionIndex <= 0) {
                  toast.error(`航段 ${legIndex} 的选择无效，请重新选择。`);
                  return;
                }

                const chosenOption = leg.options[optionIndex - 1];
                if (!chosenOption) {
                  toast.error(`航段 ${legIndex} 的航班已失效，请重新选择。`);
                  return;
                }

                selected_flights.push({
                  leg_index: legIndex,
                  from: leg.from,
                  to: leg.to,
                  departure_date: leg.departure_date,
                  skip: false,
                  option_index: optionIndex,
                  option: compactFlightOptionForMessage(chosenOption),
                });
              }

              sendStructuredMessage({ selected_flights });
            }}
            size="sm"
          >
            确认航班选择
          </Button>
        </div>
      )}

      {missingField === "hotel_selection" && (
        <div className="space-y-3">
          {isLoadingHotels && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2Icon className="size-3.5 animate-spin" />
              正在加载酒店选项...
            </div>
          )}

          {hotelLoadError && (
            <div className="rounded-md border border-amber-400/30 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-300">
              酒店 API 暂时不可用，无法生成默认酒店。请稍后重试。({hotelLoadError})
            </div>
          )}

          {!isLoadingHotels && !hotelLoadError && hotelStaysForSelection.length === 0 && (
            <div className="rounded-md border border-border/40 px-2.5 py-2 text-xs text-muted-foreground">
              当前没有可选酒店。
            </div>
          )}

          {hotelStaysForSelection.map((stay, index) => {
            const stayIndex = index + 1;
            const options: Option[] = [
              { value: "self", label: "不选择酒店（自行安排）" },
              ...stay.options.map((option, optionIndex) => ({
                value: String(optionIndex + 1),
                label: formatHotelLabel(option, optionIndex + 1),
              })),
            ];
            const selectedValue =
              hotelSelectionDraft[stayIndex] ?? (stay.options.length ? "1" : "self");
            const selectedOption =
              selectedValue === "self"
                ? null
                : selectedValue
              ? stay.options[Number(selectedValue) - 1]
              : null;

            return (
              <div
                className="space-y-1.5 rounded-lg border border-border/40 p-2.5"
                key={`${stay.city}-${stay.check_in}-${stay.check_out}-${stayIndex}`}
              >
                <div className="text-xs text-muted-foreground">
                  城市 {stayIndex}: {getCityDisplayName(stay.city)}（
                  {stay.check_in} ~ {stay.check_out}，{stay.nights} 晚）
                </div>
                <SearchableSingleSelect
                  disabled={busy}
                  onChange={(value) => {
                    setHotelSelectionDraft((current) => ({
                      ...current,
                      [stayIndex]: value,
                    }));
                  }}
                  options={options}
                  placeholder="选择酒店"
                  value={selectedValue}
                />
                {selectedValue === "self" && (
                  <div className="rounded-md border border-border/40 bg-muted/20 p-2 text-xs text-muted-foreground">
                    该城市酒店由你自行安排。
                  </div>
                )}
                {selectedOption && (
                  <div className="space-y-1 rounded-md border border-border/40 bg-muted/20 p-2 text-xs">
                    <div className="font-medium text-foreground">酒店详情</div>
                    <div>名称：{selectedOption.name ?? "未知"}</div>
                    <div>
                      均价/晚：
                      {selectedOption.average_price_per_night ??
                        selectedOption.price_per_night ??
                        "未知"}
                      {selectedOption.currency ? ` ${selectedOption.currency}` : ""}
                    </div>
                    {selectedOption.total_price && (
                      <div>
                        总价：{selectedOption.total_price}
                        {selectedOption.currency ? ` ${selectedOption.currency}` : ""}
                      </div>
                    )}
                    {selectedOption.taxes_and_fees && (
                      <div>
                        税费：{selectedOption.taxes_and_fees}
                        {selectedOption.currency ? ` ${selectedOption.currency}` : ""}
                      </div>
                    )}
                    <div>
                      评分：
                      {selectedOption.rating !== undefined &&
                      selectedOption.rating !== null
                        ? selectedOption.rating
                        : "暂无"}
                    </div>
                    {selectedOption.address && (
                      <div className="flex items-start gap-1">
                        <MapPinIcon className="mt-0.5 size-3 shrink-0" />
                        <span>{selectedOption.address}</span>
                      </div>
                    )}
                    {(selectedOption.latitude || selectedOption.longitude) && (
                      <div>
                        坐标：{selectedOption.latitude ?? "-"},{" "}
                        {selectedOption.longitude ?? "-"}
                      </div>
                    )}
                    {selectedOption.distance_to_center && (
                      <div>距市中心：{selectedOption.distance_to_center}</div>
                    )}
                    {selectedOption.check_in_time && (
                      <div>入住时间：{selectedOption.check_in_time}</div>
                    )}
                    {selectedOption.check_out_time && (
                      <div>离店时间：{selectedOption.check_out_time}</div>
                    )}
                    {selectedOption.contact_phone && (
                      <div className="flex items-center gap-1">
                        <PhoneIcon className="size-3" />
                        <span>{selectedOption.contact_phone}</span>
                      </div>
                    )}
                    {selectedOption.contact_email && (
                      <div className="flex items-start gap-1">
                        <MessageSquareTextIcon className="mt-0.5 size-3 shrink-0" />
                        <span>{selectedOption.contact_email}</span>
                      </div>
                    )}
                    {selectedOption.website && (
                      <a
                        className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
                        href={selectedOption.website}
                        rel="noreferrer"
                        target="_blank"
                      >
                        酒店官网/链接
                        <ExternalLinkIcon className="size-3" />
                      </a>
                    )}
                    {selectedOption.review_text && (
                      <div className="rounded border border-border/50 px-1.5 py-1 text-[11px] text-muted-foreground">
                        {selectedOption.review_text}
                      </div>
                    )}
                    <div className="text-[11px] text-muted-foreground">
                      数据来源：{selectedOption.provider ?? "unknown"}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <Button
            className="w-full"
            disabled={
              busy ||
              isLoadingHotels ||
              Boolean(hotelLoadError) ||
              hotelStaysForSelection.length === 0 ||
              hotelStaysForSelection.some((stay) => stay.options.length === 0)
            }
            onClick={() => {
              const selected_hotels: SelectedHotelOption[] = [];

              for (let index = 0; index < hotelStaysForSelection.length; index += 1) {
                const stay = hotelStaysForSelection[index];
                const stayIndex = index + 1;
                const selectedValue =
                  hotelSelectionDraft[stayIndex] ?? (stay.options.length ? "1" : "self");

                if (selectedValue === "self") {
                  selected_hotels.push({
                    stay_index: stayIndex,
                    city: stay.city,
                    check_in: stay.check_in,
                    check_out: stay.check_out,
                    nights: stay.nights,
                    option_index: 1,
                    option: compactHotelOptionForMessage({
                      provider: "self-arranged",
                      city: stay.city,
                      name: "自行安排",
                      check_in: stay.check_in,
                      check_out: stay.check_out,
                      adults: stay.adults,
                      price_per_night: "0",
                      currency: "USD",
                    }),
                  });
                  continue;
                }

                const optionIndex = Number(selectedValue);
                if (!Number.isInteger(optionIndex) || optionIndex <= 0) {
                  toast.error(`${getCityDisplayName(stay.city)} 的酒店选择无效，请重新选择。`);
                  return;
                }

                const chosenOption = stay.options[optionIndex - 1];
                if (!chosenOption) {
                  toast.error(`${getCityDisplayName(stay.city)} 的酒店选项已失效，请重新选择。`);
                  return;
                }

                selected_hotels.push({
                  stay_index: stayIndex,
                  city: stay.city,
                  check_in: stay.check_in,
                  check_out: stay.check_out,
                  nights: stay.nights,
                  option_index: optionIndex,
                  option: compactHotelOptionForMessage(chosenOption),
                });
              }

              sendStructuredMessage({ selected_hotels });
            }}
            size="sm"
          >
            确认酒店选择
          </Button>
        </div>
      )}

      {missingField === "final_note" && (
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">
            可选：补充偏好、禁忌、特殊需求，并附上参考文件（文件名会一并发给模型）。
          </div>

          <Textarea
            className="min-h-24"
            onChange={(event) => setFinalNoteDraft(event.target.value)}
            placeholder="例如：希望节奏慢一些；不吃海鲜；每天安排亲子活动。"
            value={finalNoteDraft}
          />

          <div className="space-y-2 rounded-lg border border-border/40 p-2.5">
            <Input
              accept="*/*"
              key={attachmentInputKey}
              multiple
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                setAttachedFilesDraft(files);
              }}
              type="file"
            />
            {attachedFilesDraft.length > 0 && (
              <div className="space-y-1 text-xs text-muted-foreground">
                {attachedFilesDraft.map((file) => (
                  <div key={`${file.name}-${file.size}`}>
                    {file.name} ({Math.max(1, Math.round(file.size / 1024))} KB)
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button
            className="w-full"
            disabled={busy}
            onClick={() => {
              const attached_files = attachedFilesDraft.map(
                (file) => `${file.name} (${Math.max(1, Math.round(file.size / 1024))} KB)`
              );
              sendStructuredMessage({
                final_note: finalNoteDraft.trim(),
                attached_files,
              });
              setAttachedFilesDraft([]);
              setAttachmentInputKey((key) => key + 1);
            }}
            size="sm"
          >
            确认备注并生成行程
          </Button>
        </div>
      )}
    </div>
  );
}
