import { getCuratedCityLabel } from "@/lib/travel/locations";
import { countries } from "country-data-list";

export const FORM_PAYLOAD_PREFIX = "__TRAVEL_FORM__:";
export const DEFAULT_CITY_DAYS = 2;

export type TravelField =
  | "country"
  | "cities"
  | "destination_confirmation"
  | "departure_date"
  | "travel_days"
  | "travelers"
  | "budget"
  | "origin"
  | "travel_order"
  | "flight_selection"
  | "hotel_selection"
  | "final_note";

export type TravelDateFlexibility = "flexible" | "fixed";

export type FlightOptionResult = {
  provider?: string;
  estimated?: boolean;
  provider_status?: string;
  provider_reason?: string;
  provider_message?: string;
  airline?: string;
  price?: string;
  currency?: string;
  departure?: string;
  arrival?: string;
  from?: string;
  to?: string;
  from_id?: string;
  to_id?: string;
  offer_token?: string;
  departure_airport?: string;
  arrival_airport?: string;
  duration?: string;
  stops?: number;
  cabin_class?: string;
  booking_url?: string;
  flight_number?: string;
  aircraft?: string;
};

export type HotelOptionResult = {
  provider?: string;
  city?: string;
  name?: string;
  hotel_id?: string | number;
  price_per_night?: string;
  taxes_and_fees?: string;
  currency?: string;
  check_in?: string;
  check_out?: string;
  adults?: number;
  rating?: number | string;
  average_price_per_night?: string;
  total_price?: string;
  address?: string;
  latitude?: number | string;
  longitude?: number | string;
  contact_phone?: string;
  contact_email?: string;
  website?: string;
  review_text?: string;
  check_in_time?: string;
  check_out_time?: string;
  distance_to_center?: string;
};

export type FlightLegResult = {
  from: string;
  to: string;
  departure_date: string;
  options: FlightOptionResult[];
  provider_unavailable?: boolean;
  estimated?: boolean;
  provider_message?: string;
};

export type HotelStayResult = {
  city: string;
  check_in: string;
  check_out: string;
  nights: number;
  adults?: number;
  options: HotelOptionResult[];
};

export type SelectedFlightOption = {
  leg_index: number;
  from: string;
  to: string;
  departure_date: string;
  skip: boolean;
  option_index?: number;
  option?: FlightOptionResult | null;
};

export type SelectedHotelOption = {
  stay_index: number;
  /** One-based itinerary day for a per-night hotel override. */
  day_index?: number;
  city: string;
  check_in: string;
  check_out: string;
  nights: number;
  option_index: number;
  option: HotelOptionResult;
};

export type TravelState = {
  country: string | null;
  countries: string[];
  cities: string[];
  seed_country: string | null;
  seed_city: string | null;
  city_days: Record<string, number>;
  destination_confirmed: boolean;
  departure_date: string | null;
  date_flexibility: TravelDateFlexibility | null;
  travel_days: number | null;
  travelers: number | null;
  budget: number | null;
  origin_country: string | null;
  origin_city: string | null;
  return_country: string | null;
  return_city: string | null;
  travel_order: string[];
  selected_flights: SelectedFlightOption[];
  selected_hotels: SelectedHotelOption[];
  final_note: string | null;
  attached_files: string[];
};

export type TravelPlanningPayload = {
  country: string;
  countries: string[];
  cities: string[];
  city_days: Record<string, number>;
  departure_date: string;
  date_flexibility: TravelDateFlexibility;
  travel_days: number;
  travelers: number;
  budget: number;
  travel_order: string[];
  origin_country: string;
  origin_city: string;
  return_country: string;
  return_city: string;
};

export type TravelPayload = TravelPlanningPayload & {
  selected_flights: SelectedFlightOption[];
  selected_hotels: SelectedHotelOption[];
  final_note: string;
  attached_files: string[];
};

export type ItineraryDay = {
  day: number | string;
  city: string;
  activities: string[];
  food: string[];
  cost: string;
};

export type ChatLikeMessage = {
  role: string;
  content?: string;
  parts?: Array<{ type?: string; text?: string }>;
};

export type TravelFormDisplayPayload = {
  seed_country?: string;
  seed_city?: string;
  country?: string;
  countries?: string[];
  cities?: string[];
  city_labels?: Record<string, string>;
  origin_country?: string;
  origin_city?: string;
  return_country?: string;
  return_city?: string;
  departure_date?: string;
  date_flexibility?: TravelDateFlexibility;
  travel_days?: number;
  travel_days_label?: string;
  travelers_label?: string;
  budget_label?: string;
  travel_order?: string[];
  destination_confirmed?: boolean;
};

export type TravelFormPayload = Partial<TravelPayload> & {
  reset?: boolean;
  country?: string;
  countries?: string[];
  cities?: string[];
  departure_date?: string;
  date_flexibility?: TravelDateFlexibility;
  travel_days?: number;
  seed_country?: string;
  seed_city?: string;
  city_days?: Record<string, number>;
  destination_confirmed?: boolean;
  travelers?: number;
  budget?: number;
  origin_country?: string;
  origin_city?: string;
  return_country?: string;
  return_city?: string;
  travel_order?: string[];
  selected_flights?: SelectedFlightOption[];
  selected_hotels?: SelectedHotelOption[];
  final_note?: string;
  attached_files?: string[];
  display?: TravelFormDisplayPayload;
};

export const FIELD_QUESTIONS: Record<TravelField, string> = {
  country: "请选择要去的国家（可搜索、可多选）。",
  cities: "请选择要去的城市（可搜索、可多选）。",
  destination_confirmation: "还要添加其他国家或城市吗？",
  departure_date: "请选择出行日期：可以灵活出行，也可以指定日期。",
  travel_days: "请输入本次旅行一共多少天，也可以先灵活规划。",
  travelers: "请输入旅行人数，也可以先灵活规划。",
  budget: "请输入总预算（RMB），也可以先灵活规划。",
  origin: "请确认出发和返程城市。",
  travel_order: "请调整你的游玩顺序。",
  flight_selection:
    "请按出发/到达和游玩顺序为每个航段选择机票（可跳过，表示使用其他交通工具）。",
  hotel_selection: "请按游玩顺序为每个城市选择酒店。",
  final_note:
    "最后一步：可填写备注并附上文件说明（可留空），然后生成最终行程。",
};

export function getFieldQuestionForState(
  state: Pick<TravelState, "seed_country" | "seed_city">,
  field: TravelField
): string {
  if (field === "country" && state.seed_country) {
    return "还有哪些国家想去吗？请选择国家（可搜索、可多选）。如果没有别的国家，可点击“没有别的国家了”。";
  }

  if (field === "cities" && state.seed_city) {
    return "还有哪些城市想去吗？请选择城市（可搜索、可多选）。如果没有别的城市，可点击“没有别的城市了”。";
  }

  return FIELD_QUESTIONS[field];
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function comparableLabel(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

export function getTravelTextKey(value: string): string {
  return comparableLabel(value);
}

const COUNTRY_CANONICAL_BY_KEY = new Map<string, string>();
const COUNTRY_DISPLAY_NAMES = new Intl.DisplayNames(["zh-CN"], {
  type: "region",
});

for (const item of countries.all as unknown[]) {
  if (!item || typeof item !== "object") continue;
  const record = item as {
    name?: unknown;
    alpha2?: unknown;
    alpha3?: unknown;
  };
  const canonical = typeof record.name === "string" ? record.name.trim() : "";
  const alpha2 =
    typeof record.alpha2 === "string"
      ? record.alpha2.trim().toUpperCase()
      : "";
  const alpha3 =
    typeof record.alpha3 === "string"
      ? record.alpha3.trim().toUpperCase()
      : "";
  if (!canonical) continue;

  const aliases = [canonical, alpha2, alpha3];
  if (alpha2) {
    try {
      const localized = COUNTRY_DISPLAY_NAMES.of(alpha2);
      if (localized) aliases.push(localized);
    } catch {
      // Ignore malformed metadata from the dependency; exact names/codes remain valid.
    }
  }
  for (const alias of aliases) {
    const key = comparableLabel(alias);
    if (key) COUNTRY_CANONICAL_BY_KEY.set(key, canonical);
  }
}

export function getTravelCountryKey(value: string): string {
  const normalized = value.trim();
  return comparableLabel(
    COUNTRY_CANONICAL_BY_KEY.get(comparableLabel(normalized)) ?? normalized
  );
}

export function getTravelDestinationKey(value: string): string {
  const normalized = value.trim();
  const curatedEnglish = getCuratedCityLabel(normalized, "en");
  return getTravelTextKey(curatedEnglish ?? normalized);
}

function normalizeStringArray(
  value: unknown,
  keyForValue: (value: string) => string = (value) => value
): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const entry of value) {
    const normalized = normalizeString(entry);
    const key = normalized ? keyForValue(normalized) : "";
    if (!normalized || !key || seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }

  return result;
}

function normalizeDestinationArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const entry of value) {
    const normalized = normalizeString(entry);
    if (!normalized) continue;
    const key = getTravelDestinationKey(normalized);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }

  return result;
}

function normalizeCountryArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const entry of value) {
    const normalized = normalizeString(entry);
    if (!normalized) continue;
    const key = getTravelCountryKey(normalized);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }

  return result;
}

function normalizePositiveInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (!Number.isInteger(value) || value <= 0) return null;
  return value;
}

function distributeTravelDays(
  cities: string[],
  totalDays: number | null
): Record<string, number> {
  if (!cities.length) return {};
  const normalizedTotal = Math.max(cities.length, totalDays ?? cities.length);
  const baseDays = Math.floor(normalizedTotal / cities.length);
  const extraDays = normalizedTotal % cities.length;

  return Object.fromEntries(
    cities.map((city, index) => [
      city,
      baseDays + (index < extraDays ? 1 : 0),
    ])
  );
}

function addCalendarMonths(date: Date, months: number): Date {
  const next = new Date(date);
  const originalDay = next.getDate();
  next.setMonth(next.getMonth() + months);

  if (next.getDate() !== originalDay) {
    next.setDate(0);
  }

  return next;
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDefaultFlexibleDepartureDate(baseDate = new Date()): string {
  return toIsoDate(addCalendarMonths(baseDate, 2));
}

export function normalizeIsoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;

  const [yearText, monthText, dayText] = normalized.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return normalized;
}

function normalizeDateFlexibility(value: unknown): TravelDateFlexibility | null {
  return value === "flexible" || value === "fixed" ? value : null;
}

function normalizeCityDays(
  value: unknown,
  allowedCities: string[]
): Record<string, number> {
  if (!value || typeof value !== "object") return {};

  const cityByKey = new Map(
    allowedCities.map((city) => [getTravelDestinationKey(city), city])
  );
  const result: Record<string, number> = {};

  for (const [rawCity, raw] of Object.entries(value)) {
    const city = cityByKey.get(getTravelDestinationKey(rawCity));
    if (!city) continue;
    const normalized = normalizePositiveInt(raw);
    if (!normalized) continue;
    result[city] = normalized;
  }

  return result;
}

function normalizeTravelOrder(value: unknown, cities: string[]): string[] {
  const order = normalizeStringArray(value);
  if (!order.length) return [];

  if (order.length !== cities.length) return [];
  const cityByKey = new Map(
    cities.map((city) => [getTravelDestinationKey(city), city])
  );
  const canonicalOrder = order.flatMap((city) => {
    const canonical = cityByKey.get(getTravelDestinationKey(city));
    return canonical ? [canonical] : [];
  });
  if (canonicalOrder.length !== order.length) return [];
  if (
    new Set(canonicalOrder.map(getTravelDestinationKey)).size !==
    canonicalOrder.length
  ) {
    return [];
  }
  return canonicalOrder;
}

function normalizeFlightOption(value: unknown): FlightOptionResult | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const result: FlightOptionResult = {};

  if (typeof item.provider === "string") result.provider = item.provider;
  if (typeof item.airline === "string") result.airline = item.airline;
  if (typeof item.price === "string") result.price = item.price;
  if (typeof item.currency === "string") result.currency = item.currency;
  if (typeof item.departure === "string") result.departure = item.departure;
  if (typeof item.arrival === "string") result.arrival = item.arrival;
  if (typeof item.from === "string") result.from = item.from;
  if (typeof item.to === "string") result.to = item.to;
  if (typeof item.from_id === "string") result.from_id = item.from_id;
  if (typeof item.to_id === "string") result.to_id = item.to_id;
  if (typeof item.offer_token === "string") result.offer_token = item.offer_token;
  if (typeof item.departure_airport === "string") {
    result.departure_airport = item.departure_airport;
  }
  if (typeof item.arrival_airport === "string") {
    result.arrival_airport = item.arrival_airport;
  }
  if (typeof item.duration === "string") result.duration = item.duration;
  if (typeof item.stops === "number") result.stops = item.stops;
  if (typeof item.cabin_class === "string") result.cabin_class = item.cabin_class;
  if (typeof item.booking_url === "string") result.booking_url = item.booking_url;
  if (typeof item.flight_number === "string") result.flight_number = item.flight_number;
  if (typeof item.aircraft === "string") result.aircraft = item.aircraft;

  return result;
}

export function normalizeSelectedFlights(value: unknown): SelectedFlightOption[] {
  if (!Array.isArray(value)) return [];
  const byIndex = new Map<number, SelectedFlightOption>();

  for (const rawEntry of value) {
    if (!rawEntry || typeof rawEntry !== "object") continue;
    const entry = rawEntry as Record<string, unknown>;
    const legIndex = normalizePositiveInt(entry.leg_index);
    if (legIndex === null) continue;

    const from = normalizeString(entry.from);
    const to = normalizeString(entry.to);
    const departureDate = normalizeString(entry.departure_date);
    if (!from || !to || !departureDate) continue;

    const skip = entry.skip === true;
    const optionIndex = normalizePositiveInt(entry.option_index);
    const option = normalizeFlightOption(entry.option);

    if (!skip && (!option || optionIndex === null)) continue;

    byIndex.set(legIndex, {
      leg_index: legIndex,
      from,
      to,
      departure_date: departureDate,
      skip,
      option_index: skip ? undefined : optionIndex ?? undefined,
      option: skip ? null : option ?? undefined,
    });
  }

  return Array.from(byIndex.values()).sort((a, b) => a.leg_index - b.leg_index);
}

function normalizeHotelOption(value: unknown): HotelOptionResult | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const result: HotelOptionResult = {};

  if (typeof item.provider === "string") result.provider = item.provider;
  if (typeof item.city === "string") result.city = item.city;
  if (typeof item.name === "string") result.name = item.name;
  if (typeof item.hotel_id === "string" || typeof item.hotel_id === "number") {
    result.hotel_id = item.hotel_id;
  }
  if (typeof item.price_per_night === "string") {
    result.price_per_night = item.price_per_night;
  }
  if (typeof item.taxes_and_fees === "string") {
    result.taxes_and_fees = item.taxes_and_fees;
  }
  if (typeof item.currency === "string") result.currency = item.currency;
  if (typeof item.check_in === "string") result.check_in = item.check_in;
  if (typeof item.check_out === "string") result.check_out = item.check_out;
  if (typeof item.adults === "number") result.adults = item.adults;
  if (typeof item.rating === "number" || typeof item.rating === "string") {
    result.rating = item.rating;
  }
  if (typeof item.average_price_per_night === "string") {
    result.average_price_per_night = item.average_price_per_night;
  }
  if (typeof item.total_price === "string") result.total_price = item.total_price;
  if (typeof item.address === "string") result.address = item.address;
  if (typeof item.latitude === "number" || typeof item.latitude === "string") {
    result.latitude = item.latitude;
  }
  if (typeof item.longitude === "number" || typeof item.longitude === "string") {
    result.longitude = item.longitude;
  }
  if (typeof item.contact_phone === "string") result.contact_phone = item.contact_phone;
  if (typeof item.contact_email === "string") result.contact_email = item.contact_email;
  if (typeof item.website === "string") result.website = item.website;
  if (typeof item.review_text === "string") result.review_text = item.review_text;
  if (typeof item.check_in_time === "string") result.check_in_time = item.check_in_time;
  if (typeof item.check_out_time === "string") result.check_out_time = item.check_out_time;
  if (typeof item.distance_to_center === "string") {
    result.distance_to_center = item.distance_to_center;
  }

  return result;
}

export function normalizeSelectedHotels(value: unknown): SelectedHotelOption[] {
  if (!Array.isArray(value)) return [];
  const byIndex = new Map<string, SelectedHotelOption>();

  for (const rawEntry of value) {
    if (!rawEntry || typeof rawEntry !== "object") continue;
    const entry = rawEntry as Record<string, unknown>;
    const stayIndex = normalizePositiveInt(entry.stay_index);
    const dayIndex = normalizePositiveInt(entry.day_index);
    const optionIndex = normalizePositiveInt(entry.option_index);
    if (stayIndex === null || optionIndex === null) continue;

    const city = normalizeString(entry.city);
    const checkIn = normalizeString(entry.check_in);
    const checkOut = normalizeString(entry.check_out);
    const nights = normalizePositiveInt(entry.nights);
    const option = normalizeHotelOption(entry.option);
    if (!city || !checkIn || !checkOut || nights === null || !option) continue;

    byIndex.set(`${stayIndex}:${dayIndex ?? "stay"}`, {
      stay_index: stayIndex,
      ...(dayIndex === null ? {} : { day_index: dayIndex }),
      city,
      check_in: checkIn,
      check_out: checkOut,
      nights,
      option_index: optionIndex,
      option,
    });
  }

  return Array.from(byIndex.values()).sort(
    (a, b) =>
      (a.day_index ?? Number.MAX_SAFE_INTEGER) -
        (b.day_index ?? Number.MAX_SAFE_INTEGER) ||
      a.stay_index - b.stay_index
  );
}

export function createInitialTravelState(): TravelState {
  return {
    country: null,
    countries: [],
    cities: [],
    seed_country: null,
    seed_city: null,
    city_days: {},
    destination_confirmed: false,
    departure_date: null,
    date_flexibility: null,
    travel_days: null,
    travelers: null,
    budget: null,
    origin_country: null,
    origin_city: null,
    return_country: null,
    return_city: null,
    travel_order: [],
    selected_flights: [],
    selected_hotels: [],
    final_note: null,
    attached_files: [],
  };
}

export function extractMessageText(message: ChatLikeMessage): string {
  if (typeof message.content === "string" && message.content.trim()) {
    return message.content.trim();
  }

  return (
    message.parts
      ?.filter((part) => part.type === "text")
      .map((part) => part.text ?? "")
      .join(" ")
      .trim() ?? ""
  );
}

function parseTravelFormMessage(message: ChatLikeMessage): TravelFormPayload | null {
  const text = extractMessageText(message);
  const candidates: string[] = [];

  if (text.startsWith(FORM_PAYLOAD_PREFIX)) {
    candidates.push(text.slice(FORM_PAYLOAD_PREFIX.length).trim());
  }

  const htmlCommentPrefix = `<!--${FORM_PAYLOAD_PREFIX}`;
  const startIndex = text.indexOf(htmlCommentPrefix);
  if (startIndex >= 0) {
    const endIndex = text.indexOf("-->", startIndex + htmlCommentPrefix.length);
    if (endIndex > startIndex) {
      candidates.push(
        text
          .slice(startIndex + htmlCommentPrefix.length, endIndex)
          .trim()
      );
    }
  }

  for (const jsonText of candidates) {
    if (!jsonText) continue;
    try {
      const parsed = JSON.parse(jsonText) as unknown;
      if (!parsed || typeof parsed !== "object") continue;
      return parsed as TravelFormPayload;
    } catch {
      continue;
    }
  }

  return null;
}

export function describeTravelFormPayload(payload: TravelFormPayload): string {
  const display = payload.display;
  const seedCountry = normalizeString(payload.seed_country);
  const seedCity = normalizeString(payload.seed_city);
  const seedCountryLabel = display?.seed_country ?? seedCountry;
  const seedCityLabel = display?.seed_city ?? seedCity;
  if (seedCity || seedCountry) {
    if (seedCountryLabel && seedCityLabel) {
      return `我想从 ${seedCountryLabel} 的 ${seedCityLabel} 开始规划旅行。`;
    }
    if (seedCityLabel) {
      return `我想把 ${seedCityLabel} 加入旅行计划。`;
    }
    return `我想先去 ${seedCountryLabel} 旅行。`;
  }

  if (payload.countries?.length && payload.cities?.length) {
    const countries = display?.countries?.length
      ? display.countries
      : payload.countries;
    const cities = display?.cities?.length ? display.cities : payload.cities;
    return `我更新了目的地：城市 ${cities.join("、")}；国家 ${countries.join("、")}。`;
  }

  if (payload.destination_confirmed === true) {
    return "目的地就这些，继续规划后面的行程信息。";
  }

  if (payload.destination_confirmed === false) {
    return "我还想继续添加其他国家或城市。";
  }

  if (payload.countries?.length) {
    const countries = display?.countries?.length
      ? display.countries
      : payload.countries;
    return `我选择了国家：${countries.join("、")}。`;
  }
  if (payload.cities?.length) {
    const cities = display?.cities?.length ? display.cities : payload.cities;
    return `我选择了城市：${cities.join("、")}。`;
  }
  if (payload.departure_date) {
    if (payload.date_flexibility === "flexible") {
      return `出行日期先按灵活出行：${payload.departure_date}（默认两个月后）。`;
    }
    return `出行日期是 ${payload.departure_date}。`;
  }
  if (typeof payload.travel_days === "number") {
    if (display?.travel_days_label) {
      return display.travel_days_label;
    }
    return `出行天数是 ${payload.travel_days} 天。`;
  }
  if (payload.city_days && Object.keys(payload.city_days).length > 0) {
    const summary = Object.entries(payload.city_days)
      .map(([city, days]) => `${display?.city_labels?.[city] ?? city}${days}天`)
      .join("，");
    return `我设置了停留天数：${summary}。`;
  }
  if (typeof payload.travelers === "number") {
    if (display?.travelers_label) {
      return display.travelers_label;
    }
    return `出行人数是 ${payload.travelers} 人。`;
  }
  if (typeof payload.budget === "number") {
    if (display?.budget_label) {
      return display.budget_label;
    }
    return `预算是 ${payload.budget} RMB。`;
  }
  if (
    payload.origin_country ||
    payload.origin_city ||
    payload.return_country ||
    payload.return_city
  ) {
    const originCountry = display?.origin_country ?? payload.origin_country ?? "-";
    const originCity = display?.origin_city ?? payload.origin_city ?? "-";
    const returnCountry = display?.return_country ?? payload.return_country ?? "-";
    const returnCity = display?.return_city ?? payload.return_city ?? "-";
    const localizedOriginCity = getCuratedCityLabel(originCity, "zh") ?? originCity;
    const localizedReturnCity = getCuratedCityLabel(returnCity, "zh") ?? returnCity;
    return `出发地设为 ${originCountry}｜${localizedOriginCity}；返程地设为 ${returnCountry}｜${localizedReturnCity}。`.trim();
  }
  if (payload.travel_order?.length) {
    const travelOrder = display?.travel_order?.length
      ? display.travel_order
      : payload.travel_order;
    return `游玩顺序：${travelOrder.join(" → ")}。`;
  }
  if (payload.selected_flights?.length) {
    return "我已确认航班选择。";
  }
  if (payload.selected_hotels?.length) {
    return "我已确认酒店选择。";
  }
  if ("final_note" in payload || "attached_files" in payload) {
    const note = payload.final_note?.trim();
    const files = payload.attached_files ?? [];
    if (note && files.length) {
      return `备注：${note}（附 ${files.length} 个文件）`;
    }
    if (note) return `备注：${note}`;
    if (files.length) return `我附上了 ${files.length} 个文件供参考。`;
    return "我没有额外备注，直接生成行程。";
  }

  return "我更新了旅行信息。";
}

export function createTravelFormMessage(payload: TravelFormPayload): string {
  return describeTravelFormPayload(payload);
}

function isTravelOrderComplete(cities: string[], order: string[]): boolean {
  if (cities.length === 0) return false;
  if (order.length !== cities.length) return false;

  const citySet = new Set(cities.map(getTravelDestinationKey));
  const orderKeys = order.map(getTravelDestinationKey);
  const orderSet = new Set(orderKeys);

  return (
    orderSet.size === order.length && orderKeys.every((city) => citySet.has(city))
  );
}

function getOrderedCities(state: TravelState): string[] {
  if (isTravelOrderComplete(state.cities, state.travel_order)) {
    const cityByKey = new Map(
      state.cities.map((city) => [getTravelDestinationKey(city), city])
    );
    return state.travel_order.map(
      (city) => cityByKey.get(getTravelDestinationKey(city)) ?? city
    );
  }
  return state.cities;
}

function applyFormPayload(state: TravelState, payload: TravelFormPayload): void {
  if (payload.reset === true) {
    Object.assign(state, createInitialTravelState());
    return;
  }

  let invalidateSelections = false;

  const seedCountry = normalizeString(payload.seed_country);
  if (seedCountry) {
    state.seed_country = seedCountry;
  }

  const seedCity = normalizeString(payload.seed_city);
  if (seedCity) {
    state.seed_city = seedCity;
  }

  const hasCountriesPayload = Array.isArray(payload.countries);
  const countries = normalizeCountryArray(payload.countries);
  if (hasCountriesPayload) {
    const previousCountryKey = state.countries
      .map(getTravelCountryKey)
      .join("|");
    const nextCountryKey = countries
      .map(getTravelCountryKey)
      .join("|");
    const countriesChanged = previousCountryKey !== nextCountryKey;
    state.countries = countries;
    state.country = countries.length ? countries.join("、") : null;
    state.seed_country = null;
    if (countriesChanged) {
      state.destination_confirmed = false;
      invalidateSelections = true;
    }
  }

  const country = normalizeString(payload.country);
  if (country && !hasCountriesPayload) {
    state.country = country;
    state.seed_country = null;
  }

  const hasCitiesPayload = Array.isArray(payload.cities);
  const cities = normalizeDestinationArray(payload.cities);
  if (hasCitiesPayload) {
    const previousCityKey = state.cities
      .map(getTravelDestinationKey)
      .join("|");
    const nextCityKey = cities
      .map(getTravelDestinationKey)
      .join("|");
    const citiesChanged = previousCityKey !== nextCityKey;
    if (citiesChanged) state.cities = cities;
    state.seed_city = null;

    if (citiesChanged) {
      state.city_days = state.travel_days
        ? distributeTravelDays(cities, state.travel_days)
        : Object.fromEntries(cities.map((city) => [city, DEFAULT_CITY_DAYS]));
      state.travel_order = normalizeTravelOrder(state.travel_order, cities);
      state.destination_confirmed = false;
      invalidateSelections = true;
    }
  }

  if (typeof payload.destination_confirmed === "boolean") {
    state.destination_confirmed = payload.destination_confirmed;
  }

  const cityDays = normalizeCityDays(payload.city_days, state.cities);
  if (Object.keys(cityDays).length > 0) {
    const mergedCityDays = {
      ...state.city_days,
      ...cityDays,
    };
    const completeCityDays = Object.fromEntries(
      state.cities.map((city) => [
        city,
        mergedCityDays[city] ?? DEFAULT_CITY_DAYS,
      ])
    );
    const previousCityDays = JSON.stringify(state.city_days);
    state.city_days = completeCityDays;
    state.travel_days = Object.values(completeCityDays).reduce(
      (total, days) => total + days,
      0
    );
    if (previousCityDays !== JSON.stringify(completeCityDays)) {
      invalidateSelections = true;
    }
  }

  const dateFlexibility = normalizeDateFlexibility(payload.date_flexibility);
  const departureDate = normalizeIsoDate(payload.departure_date);
  if (dateFlexibility || departureDate) {
    const nextDateFlexibility =
      dateFlexibility ?? (departureDate ? "fixed" : state.date_flexibility);
    const nextDepartureDate =
      departureDate ??
      (dateFlexibility === "flexible"
        ? getDefaultFlexibleDepartureDate()
        : state.departure_date);
    if (
      state.date_flexibility !== nextDateFlexibility ||
      state.departure_date !== nextDepartureDate
    ) {
      invalidateSelections = true;
    }
    state.date_flexibility = nextDateFlexibility;
    state.departure_date = nextDepartureDate;
  }

  const travelDays = normalizePositiveInt(payload.travel_days);
  if (travelDays !== null) {
    const nextTravelDays = Math.max(travelDays, state.cities.length || 1);
    const previousCityDays = JSON.stringify(state.city_days);
    if (state.travel_days !== nextTravelDays) {
      invalidateSelections = true;
    }
    state.travel_days = nextTravelDays;
    state.city_days = distributeTravelDays(state.cities, state.travel_days);
    if (previousCityDays !== JSON.stringify(state.city_days)) {
      invalidateSelections = true;
    }
  }

  const travelers = normalizePositiveInt(payload.travelers);
  if (travelers !== null) {
    if (state.travelers !== travelers) invalidateSelections = true;
    state.travelers = travelers;
  }

  const budget = normalizePositiveInt(payload.budget);
  if (budget !== null) {
    state.budget = budget;
  }

  const originCountry = normalizeString(payload.origin_country);
  if (originCountry) {
    if (state.origin_country !== originCountry) invalidateSelections = true;
    state.origin_country = originCountry;
  }
  const originCity = normalizeString(payload.origin_city);
  if (originCity) {
    if (state.origin_city !== originCity) invalidateSelections = true;
    state.origin_city = originCity;
  }

  const returnCountry = normalizeString(payload.return_country);
  if (returnCountry) {
    if (state.return_country !== returnCountry) invalidateSelections = true;
    state.return_country = returnCountry;
  }
  const returnCity = normalizeString(payload.return_city);
  if (returnCity) {
    if (state.return_city !== returnCity) invalidateSelections = true;
    state.return_city = returnCity;
  }

  if (Array.isArray(payload.travel_order)) {
    const travelOrder = normalizeTravelOrder(payload.travel_order, state.cities);
    if (payload.travel_order.length === 0) {
      if (state.travel_order.length > 0) invalidateSelections = true;
      state.travel_order = [];
    } else if (travelOrder.length > 0) {
      if (JSON.stringify(state.travel_order) !== JSON.stringify(travelOrder)) {
        invalidateSelections = true;
      }
      state.travel_order = travelOrder;
    }
  }

  if (Array.isArray(payload.selected_flights) && !invalidateSelections) {
    const selectedFlights = normalizeSelectedFlights(payload.selected_flights);
    state.selected_flights = selectedFlights;
  }

  if (Array.isArray(payload.selected_hotels) && !invalidateSelections) {
    const selectedHotels = normalizeSelectedHotels(payload.selected_hotels);
    state.selected_hotels = selectedHotels;
  }

  if (invalidateSelections) {
    state.selected_flights = [];
    state.selected_hotels = [];
  }

  if ("final_note" in payload) {
    const rawNote = typeof payload.final_note === "string" ? payload.final_note : "";
    state.final_note = rawNote.trim();
  }

  if ("attached_files" in payload) {
    state.attached_files = normalizeStringArray(payload.attached_files);
  }
}

export function buildTravelStateFromMessages(messages: ChatLikeMessage[]): TravelState {
  const state = createInitialTravelState();

  for (const message of messages) {
    if (message.role !== "user") continue;
    const payload = parseTravelFormMessage(message);
    if (!payload) continue;
    applyFormPayload(state, payload);
  }

  return state;
}

function hasCompleteCityDays(state: TravelState): boolean {
  if (!state.cities.length) return false;
  return state.cities.every((city) => {
    const days = state.city_days[city] ?? DEFAULT_CITY_DAYS;
    return Number.isInteger(days) && days > 0;
  });
}

function hasCompleteDepartureDate(state: TravelState): boolean {
  return Boolean(
    normalizeIsoDate(state.departure_date) && state.date_flexibility
  );
}

function hasCompleteTravelDays(state: TravelState): boolean {
  if (
    !state.travel_days ||
    !Number.isInteger(state.travel_days) ||
    state.travel_days < Math.max(1, state.cities.length)
  ) {
    return false;
  }

  const cityDays = state.cities.map(
    (city) => state.city_days[city] ?? DEFAULT_CITY_DAYS
  );
  return (
    cityDays.every((days) => Number.isInteger(days) && days > 0) &&
    cityDays.reduce((total, days) => total + days, 0) === state.travel_days
  );
}

function hasCompleteOrigin(state: TravelState): boolean {
  return Boolean(
    normalizeString(state.origin_country) && normalizeString(state.origin_city)
  );
}

function hasCompleteReturn(state: TravelState): boolean {
  return Boolean(
    normalizeString(state.return_country) && normalizeString(state.return_city)
  );
}

export function nextMissingField(state: TravelState): TravelField | null {
  if (!state.countries.length && !normalizeString(state.country)) return "country";
  if (state.cities.length === 0) return "cities";
  if (!state.destination_confirmed) return "destination_confirmation";
  if (!hasCompleteDepartureDate(state)) return "departure_date";
  if (!hasCompleteTravelDays(state)) return "travel_days";
  if (!state.travelers) return "travelers";
  if (!state.budget) return "budget";
  if (!hasCompleteOrigin(state) || !hasCompleteReturn(state)) return "origin";
  if (!isTravelOrderComplete(state.cities, state.travel_order)) return "travel_order";
  if (state.final_note === null) return "final_note";
  return null;
}

export function toTravelPlanningPayload(
  state: TravelState
): TravelPlanningPayload | null {
  if (!state.cities.length) return null;
  if (!hasCompleteCityDays(state)) return null;
  if (!hasCompleteDepartureDate(state)) return null;
  if (!hasCompleteTravelDays(state)) return null;
  if (!state.travelers || !state.budget) return null;
  if (!hasCompleteOrigin(state) || !hasCompleteReturn(state)) return null;
  if (!isTravelOrderComplete(state.cities, state.travel_order)) return null;

  const orderedCities = getOrderedCities(state);
  const country =
    normalizeString(state.country) ??
    (state.countries.length > 0 ? state.countries.join("、") : null);

  if (!country) return null;

  const cityDays: Record<string, number> = {};
  for (const city of orderedCities) {
    const days = state.city_days[city] ?? DEFAULT_CITY_DAYS;
    if (!days) return null;
    cityDays[city] = days;
  }

  const originCountry = normalizeString(state.origin_country);
  const originCity = normalizeString(state.origin_city);
  const returnCountry = normalizeString(state.return_country);
  const returnCity = normalizeString(state.return_city);
  const travelDays = state.travel_days;
  if (!originCountry || !originCity || !returnCountry || !returnCity) return null;
  if (!travelDays) return null;
  if (Object.values(cityDays).reduce((total, days) => total + days, 0) !== travelDays) {
    return null;
  }

  return {
    country,
    countries: state.countries,
    cities: orderedCities,
    city_days: cityDays,
    departure_date: state.departure_date ?? getDefaultFlexibleDepartureDate(),
    date_flexibility: state.date_flexibility ?? "flexible",
    travel_days: travelDays,
    travelers: state.travelers,
    budget: state.budget,
    travel_order: orderedCities,
    origin_country: originCountry,
    origin_city: originCity,
    return_country: returnCountry,
    return_city: returnCity,
  };
}

export function toTravelPayload(state: TravelState): TravelPayload | null {
  if (nextMissingField(state) !== null) return null;

  const basePayload = toTravelPlanningPayload(state);
  if (!basePayload) return null;

  return {
    ...basePayload,
    selected_flights: state.selected_flights,
    selected_hotels: state.selected_hotels,
    final_note: state.final_note ?? "",
    attached_files: state.attached_files,
  };
}

export function parseItineraryText(text: string): ItineraryDay[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const fencedMatch = trimmed.match(/```json\s*([\s\S]*?)```/i);
  const bracketMatch = trimmed.match(/\[[\s\S]*\]/);
  const cleaned = (fencedMatch?.[1] ?? bracketMatch?.[0] ?? trimmed)
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/```$/i, "");

  if (!cleaned) return [];

  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const record = item as Record<string, unknown>;

        return {
          day: (record.day as number | string) ?? "-",
          city: typeof record.city === "string" ? record.city : "",
          activities: Array.isArray(record.activities)
            ? record.activities.map((value) => String(value))
            : [],
          food: Array.isArray(record.food)
            ? record.food.map((value) => String(value))
            : [],
          cost: typeof record.cost === "string" ? record.cost : "N/A",
        } satisfies ItineraryDay;
      })
      .filter((day): day is ItineraryDay => Boolean(day && day.city));
  } catch {
    return [];
  }
}
