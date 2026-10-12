import {
  DEFAULT_CITY_DAYS,
  createInitialTravelState,
  getDefaultFlexibleDepartureDate,
  getTravelCountryKey,
  getTravelDestinationKey,
  normalizeSelectedFlights,
  normalizeSelectedHotels,
  normalizeIsoDate,
  type TravelDateFlexibility,
  type TravelState,
} from "./planner";

export const TRAVEL_STATE_PATHS = [
  "countries",
  "cities",
  "destination_confirmed",
  "departure_date",
  "date_flexibility",
  "travel_days",
  "travelers",
  "budget",
  "origin_country",
  "origin_city",
  "return_country",
  "return_city",
  "travel_order",
  "final_note",
] as const;

export type TravelStatePath = (typeof TRAVEL_STATE_PATHS)[number];
export type TravelStateOperationName =
  | "set"
  | "add"
  | "remove"
  | "unset"
  | "reset";

export type TravelStateOperation = {
  op: TravelStateOperationName;
  path: TravelStatePath | "trip";
  valueText: string | null;
  valueNumber: number | null;
  valueBoolean: boolean | null;
  explicit: boolean;
  evidence: string;
};

export type TravelStateMutationResult = {
  state: TravelState;
  applied: TravelStateOperation[];
  rejected: TravelStateOperation[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringArray(
  value: unknown,
  keyForValue: (value: string) => string = (value) => value
): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((item) => {
    if (typeof item !== "string") return [];
    const trimmed = item.trim();
    const key = keyForValue(trimmed);
    if (!trimmed || seen.has(key)) return [];
    seen.add(key);
    return [trimmed];
  });
}

function destinationArray(value: unknown): string[] {
  return stringArray(value, getTravelDestinationKey);
}

function countryArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((item) => {
    if (typeof item !== "string") return [];
    const normalized = item.trim();
    const key = getTravelCountryKey(normalized);
    if (!normalized || !key || seen.has(key)) return [];
    seen.add(key);
    return [normalized];
  });
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function positiveInteger(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0
    ? value
    : null;
}

function positiveNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function completeCityDays(
  cities: string[],
  partialCityDays: Record<string, number>,
  travelDays: number | null
): Record<string, number> {
  if (!cities.length) return {};

  const hasEveryCity = cities.every((city) => partialCityDays[city] != null);
  const partialTotal = cities.reduce(
    (total, city) => total + (partialCityDays[city] ?? 0),
    0
  );
  if (hasEveryCity && (!travelDays || partialTotal === travelDays)) {
    return Object.fromEntries(
      cities.map((city) => [city, partialCityDays[city] ?? DEFAULT_CITY_DAYS])
    );
  }
  if (travelDays) return distributeDays(cities, travelDays);
  return Object.fromEntries(
    cities.map((city) => [city, partialCityDays[city] ?? DEFAULT_CITY_DAYS])
  );
}

function canonicalizeCityMap(
  value: unknown,
  cities: string[]
): Record<string, number> {
  if (!isRecord(value)) return {};
  const cityByKey = new Map(
    cities.map((city) => [getTravelDestinationKey(city), city])
  );
  const result: Record<string, number> = {};
  for (const [rawCity, rawDays] of Object.entries(value)) {
    const city = cityByKey.get(getTravelDestinationKey(rawCity));
    const days = positiveInteger(rawDays);
    if (city && days !== null) result[city] = days;
  }
  return result;
}

function canonicalizeCityList(value: unknown, cities: string[]): string[] {
  const cityByKey = new Map(
    cities.map((city) => [getTravelDestinationKey(city), city])
  );
  const seen = new Set<string>();
  return stringArray(value).flatMap((city) => {
    const canonical = cityByKey.get(getTravelDestinationKey(city));
    const key = canonical ? getTravelDestinationKey(canonical) : "";
    if (!canonical || !key || seen.has(key)) return [];
    seen.add(key);
    return [canonical];
  });
}

export function coerceTravelState(value: unknown): TravelState {
  const initial = createInitialTravelState();
  if (!isRecord(value)) return initial;

  const cities = destinationArray(value.cities);
  const countries = countryArray(value.countries);
  const legacyCountry = nullableString(value.country);
  const departureDate = normalizeIsoDate(value.departure_date);
  const dateFlexibility: TravelDateFlexibility | null =
    value.date_flexibility === "flexible" ||
    value.date_flexibility === "fixed"
      ? value.date_flexibility
      : departureDate
        ? "fixed"
        : null;
  const rawTravelDays = positiveInteger(value.travel_days);
  const travelDays = rawTravelDays
    ? Math.max(rawTravelDays, cities.length || 1)
    : null;
  const parsedCityDays = canonicalizeCityMap(value.city_days, cities);
  const cityDays = completeCityDays(cities, parsedCityDays, travelDays);
  const canonicalCountry = countries.length
    ? countries.join("、")
    : legacyCountry;

  return {
    ...initial,
    country: canonicalCountry,
    countries,
    cities,
    seed_country: nullableString(value.seed_country),
    seed_city: nullableString(value.seed_city),
    city_days: cityDays,
    destination_confirmed: value.destination_confirmed === true,
    departure_date: departureDate,
    date_flexibility: dateFlexibility,
    travel_days: travelDays,
    travelers: positiveInteger(value.travelers),
    budget: positiveNumber(value.budget),
    origin_country: nullableString(value.origin_country),
    origin_city: nullableString(value.origin_city),
    return_country: nullableString(value.return_country),
    return_city: nullableString(value.return_city),
    travel_order: canonicalizeCityList(value.travel_order, cities),
    selected_flights: normalizeSelectedFlights(value.selected_flights),
    selected_hotels: normalizeSelectedHotels(value.selected_hotels),
    final_note:
      typeof value.final_note === "string" ? value.final_note.trim() : null,
    attached_files: stringArray(value.attached_files),
  };
}

function removeByName(
  items: string[],
  value: string,
  keyForValue: (value: string) => string
): string[] {
  const key = keyForValue(value);
  return items.filter((item) => keyForValue(item) !== key);
}

function addByName(
  items: string[],
  value: string,
  keyForValue: (value: string) => string
): string[] {
  const key = keyForValue(value);
  return items.some((item) => keyForValue(item) === key)
    ? items
    : [...items, value];
}

function distributeDays(cities: string[], totalDays: number): Record<string, number> {
  if (!cities.length) return {};
  const safeTotal = Math.max(totalDays, cities.length);
  const base = Math.floor(safeTotal / cities.length);
  let remainder = safeTotal % cities.length;
  return Object.fromEntries(
    cities.map((city) => {
      const days = base + (remainder > 0 ? 1 : 0);
      remainder = Math.max(0, remainder - 1);
      return [city, days];
    })
  );
}

function parseTravelOrder(value: string, cities: string[]): string[] {
  const normalized = value
    .split(/\s*(?:、|,|，|->|→|再到|然后到|再|然后)\s*/u)
    .map((item) => item.trim())
    .filter(Boolean);
  const byKey = new Map(
    cities.map((city) => [getTravelDestinationKey(city), city])
  );
  const order = normalized.flatMap((item) => {
    const city = byKey.get(getTravelDestinationKey(item));
    return city ? [city] : [];
  });
  return order.length === cities.length &&
    new Set(order.map(getTravelDestinationKey)).size === cities.length
    ? order
    : [];
}

function resetDestinationDependentState(
  state: TravelState,
  path: "cities" | "countries"
): void {
  if (path === "cities") {
    const previousCityDays = state.city_days;
    state.city_days = state.travel_days
      ? distributeDays(state.cities, state.travel_days)
      : Object.fromEntries(
          state.cities.map((city) => [
            city,
            previousCityDays[city] ?? DEFAULT_CITY_DAYS,
          ])
        );
    state.travel_order = canonicalizeCityList(state.travel_order, state.cities);
  }
  state.selected_flights = [];
  state.selected_hotels = [];
  state.destination_confirmed = false;
}

export function applyTravelStateOperations(
  current: unknown,
  operations: TravelStateOperation[]
): TravelStateMutationResult {
  let state = coerceTravelState(current);
  const applied: TravelStateOperation[] = [];
  const rejected: TravelStateOperation[] = [];

  for (const operation of operations) {
    if (!operation.explicit || !operation.evidence.trim()) {
      rejected.push(operation);
      continue;
    }

    if (operation.op === "reset" && operation.path === "trip") {
      state = createInitialTravelState();
      applied.push(operation);
      continue;
    }

    if (operation.path === "trip") {
      rejected.push(operation);
      continue;
    }

    const path = operation.path;
    if (path === "cities" || path === "countries") {
      const value = operation.valueText?.trim();
      if (!value || (operation.op !== "add" && operation.op !== "remove")) {
        rejected.push(operation);
        continue;
      }
      const keyForValue =
        path === "cities" ? getTravelDestinationKey : getTravelCountryKey;
      const previousValues = state[path];
      const hadCanonicalCountries =
        path === "countries" && previousValues.length > 0;
      const nextValues =
        operation.op === "add"
          ? addByName(previousValues, value, keyForValue)
          : removeByName(previousValues, value, keyForValue);
      const changed =
        nextValues.length !== previousValues.length ||
        nextValues.some((item, index) => item !== previousValues[index]);
      if (changed) {
        state[path] = nextValues;
        resetDestinationDependentState(state, path);
        if (path === "countries") {
          state.country = state.countries.length
            ? state.countries.join("、")
            : hadCanonicalCountries
              ? null
              : state.country;
        }
      }
      applied.push(operation);
      continue;
    }

    if (operation.op === "unset") {
      if (path === "travel_order") {
        if (state.travel_order.length > 0) {
          state.selected_flights = [];
          state.selected_hotels = [];
        }
        state.travel_order = [];
      } else if (path === "destination_confirmed") {
        state.destination_confirmed = false;
      } else if (path === "departure_date") {
        if (state.departure_date !== null || state.date_flexibility !== null) {
          state.selected_flights = [];
          state.selected_hotels = [];
        }
        state.departure_date = null;
        state.date_flexibility = null;
      } else if (path === "date_flexibility") {
        if (state.date_flexibility !== null) {
          state.selected_flights = [];
          state.selected_hotels = [];
        }
        state.date_flexibility = null;
      } else if (path === "travel_days") {
        if (state.travel_days !== null || Object.keys(state.city_days).length > 0) {
          state.selected_flights = [];
          state.selected_hotels = [];
        }
        state.travel_days = null;
        state.city_days = {};
      } else if (
        path === "travelers" ||
        path === "origin_country" ||
        path === "origin_city" ||
        path === "return_country" ||
        path === "return_city"
      ) {
        if (state[path] !== null) {
          state.selected_flights = [];
          state.selected_hotels = [];
        }
        state[path] = null;
      } else {
        state[path] = null;
      }
      applied.push(operation);
      continue;
    }

    if (operation.op !== "set") {
      rejected.push(operation);
      continue;
    }

    if (path === "travel_days" || path === "travelers") {
      const value = positiveInteger(operation.valueNumber);
      if (value === null) {
        rejected.push(operation);
        continue;
      }
      if (path === "travel_days") {
        const nextTravelDays = Math.max(value, state.cities.length || 1);
        const nextCityDays = distributeDays(state.cities, nextTravelDays);
        const changed =
          state.travel_days !== nextTravelDays ||
          JSON.stringify(state.city_days) !== JSON.stringify(nextCityDays);
        state.travel_days = nextTravelDays;
        state.city_days = nextCityDays;
        if (changed) {
          state.selected_flights = [];
          state.selected_hotels = [];
        }
      } else {
        if (state.travelers !== value) {
          state.selected_flights = [];
          state.selected_hotels = [];
        }
        state.travelers = value;
      }
    } else if (path === "budget") {
      const value = positiveNumber(operation.valueNumber);
      if (value === null) {
        rejected.push(operation);
        continue;
      }
      state.budget = value;
    } else if (path === "destination_confirmed") {
      if (operation.valueBoolean === null) {
        rejected.push(operation);
        continue;
      }
      state.destination_confirmed = operation.valueBoolean;
    } else if (path === "departure_date") {
      const value = normalizeIsoDate(operation.valueText);
      if (!value) {
        rejected.push(operation);
        continue;
      }
      const nextFlexibility = state.date_flexibility ?? "fixed";
      const changed =
        state.departure_date !== value ||
        state.date_flexibility !== nextFlexibility;
      state.departure_date = value;
      // A directly stated calendar date is fixed unless the same turn also
      // explicitly marks it flexible. This keeps paired date state complete
      // even when the model emits only the literal date operation.
      state.date_flexibility = nextFlexibility;
      if (changed) {
        state.selected_flights = [];
        state.selected_hotels = [];
      }
    } else if (path === "date_flexibility") {
      if (
        operation.valueText !== "flexible" &&
        operation.valueText !== "fixed"
      ) {
        rejected.push(operation);
        continue;
      }
      const nextDepartureDate =
        operation.valueText === "flexible"
          ? state.departure_date ?? getDefaultFlexibleDepartureDate()
          : state.departure_date;
      const changed =
        state.date_flexibility !== operation.valueText ||
        state.departure_date !== nextDepartureDate;
      state.date_flexibility = operation.valueText;
      if (operation.valueText === "flexible") {
        // Flexible travel is a complete date choice, not an instruction to
        // keep asking for a date. Mirror applyFormPayload so a model that
        // emits only the flexibility operation still advances the planner.
        state.departure_date = nextDepartureDate;
      }
      if (changed) {
        state.selected_flights = [];
        state.selected_hotels = [];
      }
    } else if (path === "travel_order") {
      const order = parseTravelOrder(operation.valueText ?? "", state.cities);
      if (!order.length) {
        rejected.push(operation);
        continue;
      }
      if (JSON.stringify(state.travel_order) !== JSON.stringify(order)) {
        state.selected_flights = [];
        state.selected_hotels = [];
      }
      state.travel_order = order;
    } else if (path === "final_note") {
      state.final_note = operation.valueText?.trim() ?? "";
    } else {
      const value = operation.valueText?.trim();
      if (!value) {
        rejected.push(operation);
        continue;
      }
      if (
        path === "origin_country" ||
        path === "origin_city" ||
        path === "return_country" ||
        path === "return_city"
      ) {
        if (state[path] !== value) {
          state.selected_flights = [];
          state.selected_hotels = [];
        }
      }
      state[path] = value;
    }
    applied.push(operation);
  }

  return { state, applied, rejected };
}
