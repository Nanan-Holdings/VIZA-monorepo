import {
  createInitialTravelState,
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

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((item) => {
    if (typeof item !== "string") return [];
    const trimmed = item.trim();
    const key = trimmed.toLocaleLowerCase();
    if (!trimmed || seen.has(key)) return [];
    seen.add(key);
    return [trimmed];
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

function nonNegativeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

export function coerceTravelState(value: unknown): TravelState {
  const initial = createInitialTravelState();
  if (!isRecord(value)) return initial;

  const cities = stringArray(value.cities);
  const countries = stringArray(value.countries);
  const dateFlexibility: TravelDateFlexibility | null =
    value.date_flexibility === "flexible" ||
    value.date_flexibility === "fixed"
      ? value.date_flexibility
      : null;

  return {
    ...initial,
    country: nullableString(value.country),
    countries,
    cities,
    seed_country: nullableString(value.seed_country),
    seed_city: nullableString(value.seed_city),
    city_days: isRecord(value.city_days)
      ? Object.fromEntries(
          Object.entries(value.city_days).flatMap(([city, days]) => {
            const normalized = positiveInteger(days);
            return cities.includes(city) && normalized ? [[city, normalized]] : [];
          })
        )
      : {},
    destination_confirmed: value.destination_confirmed === true,
    departure_date: nullableString(value.departure_date),
    date_flexibility: dateFlexibility,
    travel_days: positiveInteger(value.travel_days),
    travelers: positiveInteger(value.travelers),
    budget: nonNegativeNumber(value.budget),
    origin_country: nullableString(value.origin_country),
    origin_city: nullableString(value.origin_city),
    return_country: nullableString(value.return_country),
    return_city: nullableString(value.return_city),
    travel_order: stringArray(value.travel_order).filter((city) =>
      cities.includes(city)
    ),
    selected_flights: Array.isArray(value.selected_flights)
      ? (value.selected_flights as TravelState["selected_flights"])
      : [],
    selected_hotels: Array.isArray(value.selected_hotels)
      ? (value.selected_hotels as TravelState["selected_hotels"])
      : [],
    final_note: nullableString(value.final_note),
    attached_files: stringArray(value.attached_files),
  };
}

function removeByName(items: string[], value: string): string[] {
  const key = value.toLocaleLowerCase();
  return items.filter((item) => item.toLocaleLowerCase() !== key);
}

function addByName(items: string[], value: string): string[] {
  const key = value.toLocaleLowerCase();
  return items.some((item) => item.toLocaleLowerCase() === key)
    ? items
    : [...items, value];
}

function resetDestinationDependentState(state: TravelState): void {
  const citySet = new Set(state.cities);
  state.city_days = Object.fromEntries(
    Object.entries(state.city_days).filter(([city]) => citySet.has(city))
  );
  state.travel_order = state.travel_order.filter((city) => citySet.has(city));
  state.selected_flights = [];
  state.selected_hotels = state.selected_hotels.filter((hotel) =>
    citySet.has(hotel.city)
  );
  state.country = state.countries.length ? state.countries.join("、") : null;
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
      state[path] =
        operation.op === "add"
          ? addByName(state[path], value)
          : removeByName(state[path], value);
      resetDestinationDependentState(state);
      applied.push(operation);
      continue;
    }

    if (operation.op === "unset") {
      if (path === "destination_confirmed") {
        state.destination_confirmed = false;
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
      state[path] = value;
    } else if (path === "budget") {
      const value = nonNegativeNumber(operation.valueNumber);
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
    } else if (path === "date_flexibility") {
      if (
        operation.valueText !== "flexible" &&
        operation.valueText !== "fixed"
      ) {
        rejected.push(operation);
        continue;
      }
      state.date_flexibility = operation.valueText;
    } else {
      const value = operation.valueText?.trim();
      if (!value) {
        rejected.push(operation);
        continue;
      }
      state[path] = value;
    }
    applied.push(operation);
  }

  return { state, applied, rejected };
}
