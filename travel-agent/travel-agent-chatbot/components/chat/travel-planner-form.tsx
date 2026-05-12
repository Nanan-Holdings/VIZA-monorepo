"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import {
  CheckIcon,
  ChevronsUpDownIcon,
  ExternalLinkIcon,
  Loader2Icon,
  MapPinIcon,
  MessageSquareTextIcon,
  MoveDownIcon,
  MoveUpIcon,
  PhoneIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  buildTravelStateFromMessages,
  createTravelFormMessage,
  FIELD_QUESTIONS,
  nextMissingField,
  toTravelPlanningPayload,
  type ChatLikeMessage,
  type FlightLegResult,
  type HotelStayResult,
  type SelectedFlightOption,
  type SelectedHotelOption,
  type TravelPlanningPayload,
  type TravelPayload,
} from "@/lib/travel/planner";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../ui/command";
import { Input } from "../ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Textarea } from "../ui/textarea";

type Option = { value: string; label: string; keywords?: string[] };
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

const OTHER_COUNTRY_VALUE = "__country_other__";
const OTHER_CITY_VALUE = "__city_other__";

function normalizeToken(value: string): string {
  return value.trim();
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
  const selectedLabel = options.find((option) => option.value === value)?.label ?? "";

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          className="h-9 w-full justify-between"
          disabled={disabled}
          size="sm"
          variant="outline"
        >
          <span className={cn("truncate", !selectedLabel && "text-muted-foreground")}>
            {selectedLabel || placeholder}
          </span>
          <ChevronsUpDownIcon className="size-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[360px] p-0">
        <Command>
          <CommandInput placeholder="搜索..." />
          <CommandList>
            <CommandEmpty>没有匹配项</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  keywords={option.keywords}
                  onSelect={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  value={`${option.value} ${option.label} ${option.keywords?.join(" ") ?? ""}`}
                >
                  <CheckIcon
                    className={cn(
                      "size-3.5",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
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

  const summary = useMemo(() => {
    if (!values.length) return "";
    const optionMap = new Map(options.map((option) => [option.value, option.label]));
    const labels = values.map((value) => optionMap.get(value) ?? value);
    return labels.join(" / ");
  }, [options, values]);

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
          <span className={cn("truncate", !summary && "text-muted-foreground")}>
            {summary || placeholder}
          </span>
          <ChevronsUpDownIcon className="size-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[360px] p-0">
        <Command>
          <CommandInput placeholder="搜索..." />
          <CommandList>
            <CommandEmpty>没有匹配项</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  keywords={option.keywords}
                  onSelect={() => {
                    toggleValue(option.value);
                  }}
                  value={`${option.value} ${option.label} ${option.keywords?.join(" ") ?? ""}`}
                >
                  <CheckIcon
                    className={cn(
                      "size-3.5",
                      values.includes(option.value) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function toChatLikeMessages(messages: ChatMessage[]): ChatLikeMessage[] {
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
    if (!value || !label) continue;

    options.push({
      value,
      label,
      keywords: buildOptionKeywords(search, label, value, labelEn, labelZh, code),
    });
  }

  return options;
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
      if (!value || !label) continue;

      options.push({
        value,
        label,
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
  return date.toISOString().slice(0, 10);
}

function buildFallbackFlightLegs(payload: TravelPlanningPayload): FlightLegResult[] {
  const route = [
    payload.origin_city,
    ...payload.cities,
    payload.return_city,
  ].filter(Boolean);

  if (route.length < 2) return [];

  const startDate = addDays(new Date(), 14);
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
  const startDate = addDays(new Date(), 14);
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
  messages,
  sendMessage,
  status,
}: {
  messages: ChatMessage[];
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  status: UseChatHelpers<ChatMessage>["status"];
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

  const [countries, setCountries] = useState<string[]>(travelState.countries);
  const [cities, setCities] = useState<string[]>(travelState.cities);
  const [cityDaysDraft, setCityDaysDraft] = useState<Record<string, string>>({});
  const [travelers, setTravelers] = useState<string>(travelState.travelers?.toString() ?? "");
  const [budget, setBudget] = useState<string>(travelState.budget?.toString() ?? "");
  const [originCountry, setOriginCountry] = useState<string>(travelState.origin_country ?? "");
  const [originCity, setOriginCity] = useState<string>(travelState.origin_city ?? "");
  const [returnCountry, setReturnCountry] = useState<string>(travelState.return_country ?? "");
  const [returnCity, setReturnCity] = useState<string>(travelState.return_city ?? "");
  const [travelOrder, setTravelOrder] = useState<string[]>(travelState.travel_order);

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
  const [customCountriesInput, setCustomCountriesInput] = useState("");
  const [customCitiesInput, setCustomCitiesInput] = useState("");
  const [customOriginCountry, setCustomOriginCountry] = useState("");
  const [customOriginCity, setCustomOriginCity] = useState("");
  const [customReturnCountry, setCustomReturnCountry] = useState("");
  const [customReturnCity, setCustomReturnCity] = useState("");
  const [finalNoteDraft, setFinalNoteDraft] = useState(
    travelState.final_note ?? ""
  );
  const [attachedFilesDraft, setAttachedFilesDraft] = useState<File[]>([]);
  const [attachmentInputKey, setAttachmentInputKey] = useState(0);

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
    setCountries(travelState.countries);
    setCities(travelState.cities);
    setTravelers(travelState.travelers?.toString() ?? "");
    setBudget(travelState.budget?.toString() ?? "");
    setOriginCountry(travelState.origin_country ?? "");
    setOriginCity(travelState.origin_city ?? "");
    setReturnCountry(travelState.return_country ?? "");
    setReturnCity(travelState.return_city ?? "");
    setTravelOrder(
      travelState.travel_order.length === travelState.cities.length
        ? travelState.travel_order
        : travelState.cities
    );

    const nextDraft: Record<string, string> = {};
    for (const city of travelState.cities) {
      const existing = travelState.city_days[city];
      nextDraft[city] = existing ? String(existing) : "";
    }
    setCityDaysDraft(nextDraft);

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
  }, [travelState]);

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
    const neededCountries = countries.filter(
      (country) =>
        country !== OTHER_COUNTRY_VALUE &&
        !Object.prototype.hasOwnProperty.call(citiesByCountry, country)
    );
    if (!neededCountries.length) return;
    loadCitiesForCountries(neededCountries);
  }, [countries, citiesByCountry, loadCitiesForCountries]);

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
        payload = { legs: [] };
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

  const cityLoadSummary = useMemo(() => {
    const summaryCountries = removeSpecialValue(countries, OTHER_COUNTRY_VALUE);
    if (!summaryCountries.length) return "";
    const items = summaryCountries
      .map((country) => {
        const count = cityCountByCountry[country];
        if (typeof count !== "number") return null;
        return `${country}: ${count}`;
      })
      .filter((item): item is string => Boolean(item));

    return items.join(" | ");
  }, [countries, cityCountByCountry]);

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

  const sendStructuredMessage = (payload: Partial<TravelPayload>) => {
    sendMessage({
      role: "user",
      parts: [{ type: "text", text: createTravelFormMessage(payload) }],
    });
  };

  if (!missingField) {
    return null;
  }

  return (
    <div
      className="w-full max-w-[1000px] rounded-xl border border-border/40 bg-card/40 p-4"
      data-testid="travel-planner-form"
    >
      <div className="mb-2 text-sm font-medium text-foreground">旅行信息向导</div>
      <div className="mb-3 text-xs text-muted-foreground">{FIELD_QUESTIONS[missingField]}</div>

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
            onClick={() => {
              if (!resolvedCountries.length) {
                toast.error("请至少选择一个国家。");
                return;
              }
              sendStructuredMessage({
                countries: resolvedCountries,
                country: resolvedCountries.join("、"),
              });
            }}
            size="sm"
          >
            确认国家
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
            options={cityOptionsWithOther}
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
            onClick={() => {
              if (!resolvedCities.length) {
                toast.error("请至少选择一个城市。");
                return;
              }
              sendStructuredMessage({
                cities: resolvedCities,
                travel_order: resolvedCities,
              });
            }}
            size="sm"
          >
            确认城市
          </Button>
        </div>
      )}

      {missingField === "city_days" && (
        <div className="space-y-2">
          {cities.map((city) => (
            <div className="flex items-center gap-2" key={city}>
              <div className="w-28 shrink-0 text-xs text-muted-foreground">{city}</div>
              <Input
                inputMode="numeric"
                min={1}
                onChange={(event) => {
                  const value = event.target.value.replace(/[^\d]/g, "");
                  setCityDaysDraft((current) => ({ ...current, [city]: value }));
                }}
                placeholder="天数"
                type="text"
                value={cityDaysDraft[city] ?? ""}
              />
            </div>
          ))}
          <Button
            className="w-full"
            disabled={busy || cities.length === 0}
            onClick={() => {
              const city_days: Record<string, number> = {};
              for (const city of cities) {
                const parsed = parsePositiveIntText(cityDaysDraft[city] ?? "");
                if (!parsed) {
                  toast.error(`${city} 的停留天数必须是正整数。`);
                  return;
                }
                city_days[city] = parsed;
              }
              sendStructuredMessage({ city_days });
            }}
            size="sm"
          >
            确认天数
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
        </div>
      )}

      {missingField === "origin" && (
        <div className="space-y-2">
          {cityLoadError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
              {cityLoadError}
            </div>
          )}
          <SearchableSingleSelect
            disabled={busy || isLoadingCountryOptions}
            onChange={(value) => {
              setOriginCountry(value);
              setOriginCity("");
            }}
            options={countryOptionsWithOther}
            placeholder={isLoadingCountryOptions ? "正在加载国家..." : "选择出发国家"}
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
              {originCountryForCityLookup} 已加载{" "}
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
          <Button
            className="w-full"
            disabled={busy}
            onClick={() => {
              if (!resolvedOriginCountry || !resolvedOriginCity) {
                toast.error("请完整选择出发国家和城市。");
                return;
              }
              sendStructuredMessage({
                origin_country: resolvedOriginCountry,
                origin_city: resolvedOriginCity,
              });
            }}
            size="sm"
          >
            确认出发地
          </Button>
        </div>
      )}

      {missingField === "return" && (
        <div className="space-y-2">
          {cityLoadError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
              {cityLoadError}
            </div>
          )}
          <SearchableSingleSelect
            disabled={busy || isLoadingCountryOptions}
            onChange={(value) => {
              setReturnCountry(value);
              setReturnCity("");
            }}
            options={countryOptionsWithOther}
            placeholder={isLoadingCountryOptions ? "正在加载国家..." : "选择返程国家"}
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
              {returnCountryForCityLookup} 已加载{" "}
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
          <Button
            className="w-full"
            disabled={busy}
            onClick={() => {
              if (!resolvedReturnCountry || !resolvedReturnCity) {
                toast.error("请完整选择返程国家和城市。");
                return;
              }
              sendStructuredMessage({
                return_country: resolvedReturnCountry,
                return_city: resolvedReturnCity,
              });
            }}
            size="sm"
          >
            确认返程地
          </Button>
        </div>
      )}

      {missingField === "travel_order" && (
        <div className="space-y-2">
          {travelOrder.map((city, index) => (
            <div
              className="flex items-center justify-between rounded-lg border border-border/40 px-2.5 py-1.5"
              key={`${city}-${index}`}
            >
              <div className="text-sm">{city}</div>
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
                  size="icon-xs"
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
                  size="icon-xs"
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
              航班接口暂时不可用，当前步骤可直接跳过继续。({flightLoadError})
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
            const selectedValue = flightSelectionDraft[legIndex] ?? "skip";
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
                  航段 {legIndex}: {leg.from} → {leg.to}（{leg.departure_date}）
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
            disabled={busy}
            onClick={() => {
              const selected_flights: SelectedFlightOption[] = [];

              for (let index = 0; index < flightLegsForSelection.length; index += 1) {
                const leg = flightLegsForSelection[index];
                const legIndex = index + 1;
                const selectedValue = flightSelectionDraft[legIndex] ?? "skip";

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
              酒店接口暂时不可用，你可以选择“不选择酒店（自行安排）”继续。({hotelLoadError})
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
            const selectedValue = hotelSelectionDraft[stayIndex] ?? "self";
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
                  城市 {stayIndex}: {stay.city}（{stay.check_in} ~ {stay.check_out}，{stay.nights} 晚）
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
            disabled={busy}
            onClick={() => {
              const selected_hotels: SelectedHotelOption[] = [];

              for (let index = 0; index < hotelStaysForSelection.length; index += 1) {
                const stay = hotelStaysForSelection[index];
                const stayIndex = index + 1;
                const selectedValue = hotelSelectionDraft[stayIndex] ?? "self";

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
                  toast.error(`${stay.city} 的酒店选择无效，请重新选择。`);
                  return;
                }

                const chosenOption = stay.options[optionIndex - 1];
                if (!chosenOption) {
                  toast.error(`${stay.city} 的酒店选项已失效，请重新选择。`);
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
