export const FORM_PAYLOAD_PREFIX = "__TRAVEL_FORM__:";

export type TravelField =
  | "country"
  | "cities"
  | "city_days"
  | "travelers"
  | "budget"
  | "origin"
  | "return"
  | "travel_order"
  | "flight_selection"
  | "hotel_selection"
  | "final_note";

export type FlightOptionResult = {
  provider?: string;
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

type TravelFormPayload = Partial<TravelPayload> & {
  country?: string;
  countries?: string[];
  cities?: string[];
  seed_country?: string;
  seed_city?: string;
  city_days?: Record<string, number>;
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
};

type ExpectedFlightLeg = {
  leg_index: number;
  from: string;
  to: string;
};

type ExpectedHotelStay = {
  stay_index: number;
  city: string;
  nights: number;
};

export const FIELD_QUESTIONS: Record<TravelField, string> = {
  country: "请选择要去的国家（可搜索、可多选）。",
  cities: "请选择要去的城市（可搜索、可多选）。",
  city_days: "请为每个城市填写停留天数（必须是正整数）。",
  travelers: "请输入旅行人数（必须是正整数）。",
  budget: "请输入总预算（RMB，必须是正整数）。",
  origin: "请选择出发国家和出发城市。",
  return: "请选择返程国家和返程城市。",
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

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const entry of value) {
    const normalized = normalizeString(entry);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

function normalizePositiveInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (!Number.isInteger(value) || value <= 0) return null;
  return value;
}

function normalizeCityDays(
  value: unknown,
  allowedCities: string[]
): Record<string, number> {
  if (!value || typeof value !== "object") return {};

  const citySet = new Set(allowedCities);
  const result: Record<string, number> = {};

  for (const [city, raw] of Object.entries(value)) {
    if (!citySet.has(city)) continue;
    const normalized = normalizePositiveInt(raw);
    if (!normalized) continue;
    result[city] = normalized;
  }

  return result;
}

function normalizeTravelOrder(value: unknown, cities: string[]): string[] {
  const order = normalizeStringArray(value);
  if (!order.length) return [];

  const citySet = new Set(cities);
  if (order.length !== cities.length) return [];
  if (order.some((city) => !citySet.has(city))) return [];
  return order;
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

function normalizeSelectedFlights(value: unknown): SelectedFlightOption[] {
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

function normalizeSelectedHotels(value: unknown): SelectedHotelOption[] {
  if (!Array.isArray(value)) return [];
  const byIndex = new Map<number, SelectedHotelOption>();

  for (const rawEntry of value) {
    if (!rawEntry || typeof rawEntry !== "object") continue;
    const entry = rawEntry as Record<string, unknown>;
    const stayIndex = normalizePositiveInt(entry.stay_index);
    const optionIndex = normalizePositiveInt(entry.option_index);
    if (stayIndex === null || optionIndex === null) continue;

    const city = normalizeString(entry.city);
    const checkIn = normalizeString(entry.check_in);
    const checkOut = normalizeString(entry.check_out);
    const nights = normalizePositiveInt(entry.nights);
    const option = normalizeHotelOption(entry.option);
    if (!city || !checkIn || !checkOut || nights === null || !option) continue;

    byIndex.set(stayIndex, {
      stay_index: stayIndex,
      city,
      check_in: checkIn,
      check_out: checkOut,
      nights,
      option_index: optionIndex,
      option,
    });
  }

  return Array.from(byIndex.values()).sort((a, b) => a.stay_index - b.stay_index);
}

export function createInitialTravelState(): TravelState {
  return {
    country: null,
    countries: [],
    cities: [],
    seed_country: null,
    seed_city: null,
    city_days: {},
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
  const seedCountry = normalizeString(payload.seed_country);
  const seedCity = normalizeString(payload.seed_city);
  if (seedCity || seedCountry) {
    if (seedCountry && seedCity) {
      return `我想从 ${seedCountry} 的 ${seedCity} 开始规划旅行。`;
    }
    if (seedCity) {
      return `我想把 ${seedCity} 加入旅行计划。`;
    }
    return `我想先去 ${seedCountry} 旅行。`;
  }

  if (payload.countries?.length) {
    return `我选择了国家：${payload.countries.join("、")}。`;
  }
  if (payload.cities?.length) {
    return `我选择了城市：${payload.cities.join("、")}。`;
  }
  if (payload.city_days && Object.keys(payload.city_days).length > 0) {
    const summary = Object.entries(payload.city_days)
      .map(([city, days]) => `${city}${days}天`)
      .join("，");
    return `我设置了停留天数：${summary}。`;
  }
  if (typeof payload.travelers === "number") {
    return `出行人数是 ${payload.travelers} 人。`;
  }
  if (typeof payload.budget === "number") {
    return `预算是 ${payload.budget} RMB。`;
  }
  if (payload.origin_country || payload.origin_city) {
    return `出发地：${payload.origin_country ?? "-"} ${payload.origin_city ?? "-"}`.trim();
  }
  if (payload.return_country || payload.return_city) {
    return `返程地：${payload.return_country ?? "-"} ${payload.return_city ?? "-"}`.trim();
  }
  if (payload.travel_order?.length) {
    return `游玩顺序：${payload.travel_order.join(" -> ")}。`;
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
  const visibleText = describeTravelFormPayload(payload);
  const hiddenPayload = `<!--${FORM_PAYLOAD_PREFIX}${JSON.stringify(payload)}-->`;
  return `${visibleText}\n\n${hiddenPayload}`;
}

function isTravelOrderComplete(cities: string[], order: string[]): boolean {
  if (cities.length === 0) return false;
  if (order.length !== cities.length) return false;

  const citySet = new Set(cities);
  const orderSet = new Set(order);

  return (
    orderSet.size === order.length && order.every((city) => citySet.has(city))
  );
}

function getOrderedCities(state: TravelState): string[] {
  if (isTravelOrderComplete(state.cities, state.travel_order)) {
    return state.travel_order;
  }
  return state.cities;
}

function getExpectedFlightLegs(state: TravelState): ExpectedFlightLeg[] {
  const orderedCities = getOrderedCities(state);
  if (!orderedCities.length) return [];

  const originCity = normalizeString(state.origin_city) ?? orderedCities[0];
  const returnCity = normalizeString(state.return_city) ?? originCity;
  const route = [originCity, ...orderedCities, returnCity];
  const legs: ExpectedFlightLeg[] = [];
  let legIndex = 1;

  for (let index = 0; index < route.length - 1; index += 1) {
    const from = route[index];
    const to = route[index + 1];
    if (!from || !to || from === to) continue;
    legs.push({ leg_index: legIndex, from, to });
    legIndex += 1;
  }

  return legs;
}

function getExpectedHotelStays(state: TravelState): ExpectedHotelStay[] {
  const orderedCities = getOrderedCities(state);
  return orderedCities.map((city, index) => ({
    stay_index: index + 1,
    city,
    nights: state.city_days[city] ?? 1,
  }));
}

function applyFormPayload(state: TravelState, payload: TravelFormPayload): void {
  const seedCountry = normalizeString(payload.seed_country);
  if (seedCountry) {
    state.seed_country = seedCountry;
  }

  const seedCity = normalizeString(payload.seed_city);
  if (seedCity) {
    state.seed_city = seedCity;
  }

  const countries = normalizeStringArray(payload.countries);
  if (countries.length > 0) {
    state.countries = countries;
    if (!state.country) {
      state.country = countries.join("、");
    }
    state.seed_country = null;
  }

  const country = normalizeString(payload.country);
  if (country) {
    state.country = country;
    state.seed_country = null;
  }

  const cities = normalizeStringArray(payload.cities);
  if (cities.length > 0) {
    state.cities = cities;
    state.seed_city = null;

    const citySet = new Set(cities);
    state.city_days = Object.fromEntries(
      Object.entries(state.city_days).filter(([city]) => citySet.has(city))
    );
    state.travel_order = state.travel_order.filter((city) => citySet.has(city));
    state.selected_flights = [];
    state.selected_hotels = [];
  }

  const cityDays = normalizeCityDays(payload.city_days, state.cities);
  if (Object.keys(cityDays).length > 0) {
    state.city_days = {
      ...state.city_days,
      ...cityDays,
    };
  }

  const travelers = normalizePositiveInt(payload.travelers);
  if (travelers !== null) {
    state.travelers = travelers;
  }

  const budget = normalizePositiveInt(payload.budget);
  if (budget !== null) {
    state.budget = budget;
  }

  const originCountry = normalizeString(payload.origin_country);
  if (originCountry) {
    state.origin_country = originCountry;
  }
  const originCity = normalizeString(payload.origin_city);
  if (originCity) {
    state.origin_city = originCity;
    state.selected_flights = [];
  }

  const returnCountry = normalizeString(payload.return_country);
  if (returnCountry) {
    state.return_country = returnCountry;
  }
  const returnCity = normalizeString(payload.return_city);
  if (returnCity) {
    state.return_city = returnCity;
    state.selected_flights = [];
  }

  const travelOrder = normalizeTravelOrder(payload.travel_order, state.cities);
  if (travelOrder.length > 0) {
    state.travel_order = travelOrder;
    state.selected_flights = [];
    state.selected_hotels = [];
  }

  const selectedFlights = normalizeSelectedFlights(payload.selected_flights);
  if (selectedFlights.length > 0) {
    state.selected_flights = selectedFlights;
  }

  const selectedHotels = normalizeSelectedHotels(payload.selected_hotels);
  if (selectedHotels.length > 0) {
    state.selected_hotels = selectedHotels;
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
    const days = state.city_days[city];
    return Number.isInteger(days) && days > 0;
  });
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

function hasCompleteFlightSelections(state: TravelState): boolean {
  const expected = getExpectedFlightLegs(state);
  if (expected.length === 0) return true;

  const selectedByIndex = new Map(
    state.selected_flights.map((item) => [item.leg_index, item])
  );

  for (const leg of expected) {
    const selected = selectedByIndex.get(leg.leg_index);
    if (!selected) return false;
    if (selected.from !== leg.from || selected.to !== leg.to) return false;
    if (selected.skip) continue;
    if (
      selected.option_index === undefined ||
      !Number.isInteger(selected.option_index) ||
      selected.option_index < 1
    ) {
      return false;
    }
    if (!selected.option) return false;
  }

  return true;
}

function hasCompleteHotelSelections(state: TravelState): boolean {
  const expected = getExpectedHotelStays(state);
  if (expected.length === 0) return true;

  const selectedByIndex = new Map(
    state.selected_hotels.map((item) => [item.stay_index, item])
  );

  for (const stay of expected) {
    const selected = selectedByIndex.get(stay.stay_index);
    if (!selected) return false;
    if (selected.city !== stay.city) return false;
    if (
      !Number.isInteger(selected.option_index) ||
      selected.option_index < 1 ||
      !selected.option
    ) {
      return false;
    }
  }

  return true;
}

export function nextMissingField(state: TravelState): TravelField | null {
  if (!state.countries.length && !normalizeString(state.country)) return "country";
  if (state.cities.length === 0) return "cities";
  if (!hasCompleteCityDays(state)) return "city_days";
  if (!state.travelers) return "travelers";
  if (!state.budget) return "budget";
  if (!hasCompleteOrigin(state)) return "origin";
  if (!hasCompleteReturn(state)) return "return";
  if (!isTravelOrderComplete(state.cities, state.travel_order)) return "travel_order";
  if (!hasCompleteFlightSelections(state)) return "flight_selection";
  if (!hasCompleteHotelSelections(state)) return "hotel_selection";
  if (state.final_note === null) return "final_note";
  return null;
}

export function toTravelPlanningPayload(
  state: TravelState
): TravelPlanningPayload | null {
  if (!state.cities.length) return null;
  if (!hasCompleteCityDays(state)) return null;
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
    const days = state.city_days[city];
    if (!days) return null;
    cityDays[city] = days;
  }

  const originCountry = normalizeString(state.origin_country);
  const originCity = normalizeString(state.origin_city);
  const returnCountry = normalizeString(state.return_country);
  const returnCity = normalizeString(state.return_city);
  if (!originCountry || !originCity || !returnCountry || !returnCity) return null;

  return {
    country,
    countries: state.countries,
    cities: orderedCities,
    city_days: cityDays,
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

  const expectedLegs = getExpectedFlightLegs(state);
  const selectedFlightMap = new Map(
    state.selected_flights.map((item) => [item.leg_index, item])
  );
  const selectedFlights: SelectedFlightOption[] = [];

  for (const leg of expectedLegs) {
    const selected = selectedFlightMap.get(leg.leg_index);
    if (!selected) return null;
    selectedFlights.push(selected);
  }

  const expectedStays = getExpectedHotelStays(state);
  const selectedHotelMap = new Map(
    state.selected_hotels.map((item) => [item.stay_index, item])
  );
  const selectedHotels: SelectedHotelOption[] = [];

  for (const stay of expectedStays) {
    const selected = selectedHotelMap.get(stay.stay_index);
    if (!selected) return null;
    selectedHotels.push(selected);
  }

  return {
    ...basePayload,
    selected_flights: selectedFlights,
    selected_hotels: selectedHotels,
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
