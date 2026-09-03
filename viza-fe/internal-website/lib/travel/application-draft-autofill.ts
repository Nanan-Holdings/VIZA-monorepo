import type {
  SelectedFlightOption,
  SelectedHotelOption,
  TravelState,
} from "@/lib/travel/planner";

export type TravelAutofillField = {
  fieldName: string;
  fieldType: string;
  options: unknown;
};

export type TravelAutofillApplication = {
  id: string;
  country: string;
  visaType: string;
  fields: TravelAutofillField[];
  existingAnswers: Record<string, string>;
};

export type TravelAutofillPatch = {
  fieldName: string;
  value: string;
  sourceFact:
    | "trip_date"
    | "destination_city"
    | "travel_purpose"
    | "live_flight"
    | "live_hotel";
};

export type TravelAutofillApplicationPreview = {
  applicationId: string;
  country: string;
  visaType: string;
  city: string | null;
  patches: TravelAutofillPatch[];
  skippedExisting: string[];
  warnings: string[];
};

const ARRIVAL_DATE_FIELDS = new Set([
  "arrival_date",
  "expected_arrival_date",
  "intended_arrival_date",
  "uk_arrival_date",
  "visa_valid_from",
]);

const DEPARTURE_DATE_FIELDS = new Set([
  "departure_date",
  "intended_departure_date",
  "uk_departure_date",
  "visa_valid_to",
]);

const ACCOMMODATION_NAME_FIELDS = new Set([
  "accommodation_name",
  "destination_hotel_name",
  "hotel_name",
  "uk_accommodation_name",
]);

const ACCOMMODATION_ADDRESS_FIELDS = new Set([
  "accommodation_address",
  "accommodation_address_line_1",
  "destination_hotel_address",
  "hotel_address",
  "uk_accommodation_address_line_1",
  "address_in_korea",
]);

const ACCOMMODATION_CITY_FIELDS = new Set([
  "accommodation_city",
  "hotel_city",
  "uk_accommodation_city",
]);

const ACCOMMODATION_PHONE_FIELDS = new Set([
  "accommodation_phone",
  "hotel_phone",
]);

const PURPOSE_FIELDS = new Set([
  "purpose_of_visit",
  "purpose_of_journey",
  "purpose_of_entry",
  "purpose_of_trip",
  "tourist_purpose",
  "tourism_sub_purpose",
]);

const VERIFIED_TRAVEL_PROVIDERS = new Set([
  "rapidapi-booking-com",
  "serpapi-google-flights",
  "serpapi-google-hotels",
]);

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\u3400-\u9fff]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function addDays(rawDate: string, days: number): string | null {
  const parsed = new Date(`${rawDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function optionRecords(options: unknown): Array<Record<string, unknown>> {
  return Array.isArray(options)
    ? options.filter(
        (option): option is Record<string, unknown> =>
          Boolean(option && typeof option === "object" && !Array.isArray(option))
      )
    : [];
}

function optionValueMatching(
  options: unknown,
  candidates: string[]
): string | null {
  const candidateKeys = candidates.map(normalizeKey);
  for (const option of optionRecords(options)) {
    const searchable = [
      option.value,
      option.text,
      option.label,
      option.label_en,
      option.label_zh,
      option.official_label,
    ]
      .filter((value): value is string => typeof value === "string")
      .map(normalizeKey);
    if (
      searchable.some((value) =>
        candidateKeys.some(
          (candidate) => value === candidate || value.includes(candidate)
        )
      )
    ) {
      const value = option.value;
      return typeof value === "string" && value.trim() ? value.trim() : null;
    }
  }
  return null;
}

function isLiveHotel(hotel: SelectedHotelOption | undefined): hotel is SelectedHotelOption {
  const option = hotel?.option;
  return Boolean(
    option &&
      Boolean(option.provider && VERIFIED_TRAVEL_PROVIDERS.has(option.provider)) &&
      option.estimated !== true &&
      option.provider_status !== "unavailable" &&
      option.name?.trim() &&
      option.address?.trim()
  );
}

function isLiveFlight(flight: SelectedFlightOption | undefined): flight is SelectedFlightOption {
  const option = flight?.option;
  return Boolean(
    flight &&
      !flight.skip &&
      option &&
      Boolean(option.provider && VERIFIED_TRAVEL_PROVIDERS.has(option.provider)) &&
      option.estimated !== true &&
      option.provider_status !== "unavailable" &&
      option.flight_number?.trim()
  );
}

function destinationCityForCountry(state: TravelState, country: string): string | null {
  const countryIndex = state.countries.findIndex(
    (candidate) => normalizeKey(candidate) === normalizeKey(country)
  );
  if (countryIndex < 0 || state.countries.length !== state.cities.length) return null;
  return state.cities[countryIndex] ?? null;
}

function tripDatesForCity(
  state: TravelState,
  city: string
): { arrival: string; departure: string } | null {
  if (!state.departure_date || state.date_flexibility !== "fixed") return null;
  const order = state.travel_order.length ? state.travel_order : state.cities;
  const cityIndex = order.findIndex(
    (candidate) => normalizeKey(candidate) === normalizeKey(city)
  );
  if (cityIndex < 0) return null;
  const offset = order
    .slice(0, cityIndex)
    .reduce((total, priorCity) => total + (state.city_days[priorCity] ?? 1), 0);
  const arrival = addDays(state.departure_date, offset);
  const departure = addDays(
    state.departure_date,
    offset + Math.max((state.city_days[order[cityIndex]] ?? 1) - 1, 0)
  );
  return arrival && departure ? { arrival, departure } : null;
}

function hotelForCity(state: TravelState, city: string): SelectedHotelOption | undefined {
  return state.selected_hotels.find(
    (hotel) => normalizeKey(hotel.city) === normalizeKey(city)
  );
}

function inboundFlightForCity(
  state: TravelState,
  city: string
): SelectedFlightOption | undefined {
  return state.selected_flights.find(
    (flight) => normalizeKey(flight.to) === normalizeKey(city)
  );
}

function outboundFlightForCity(
  state: TravelState,
  city: string
): SelectedFlightOption | undefined {
  return state.selected_flights.find(
    (flight) => normalizeKey(flight.from) === normalizeKey(city)
  );
}

export function previewTravelApplicationAutofill(
  application: TravelAutofillApplication,
  state: TravelState
): TravelAutofillApplicationPreview {
  const city = destinationCityForCountry(state, application.country);
  const warnings: string[] = [];
  const proposed = new Map<string, TravelAutofillPatch>();

  if (!city) {
    warnings.push("No unambiguous country-to-city mapping exists in this plan.");
  }

  const dates = city ? tripDatesForCity(state, city) : null;
  if (!dates) {
    warnings.push("A fixed, valid intended-travel date is required before date fields can be filled.");
  }

  const hotel = city ? hotelForCity(state, city) : undefined;
  if (hotel && !isLiveHotel(hotel)) {
    warnings.push("Estimated or incomplete hotel data was excluded.");
  }

  const inboundFlight = city ? inboundFlightForCity(state, city) : undefined;
  const outboundFlight = city ? outboundFlightForCity(state, city) : undefined;
  if (
    (inboundFlight && !isLiveFlight(inboundFlight)) ||
    (outboundFlight && !isLiveFlight(outboundFlight))
  ) {
    warnings.push("Estimated or incomplete flight data was excluded.");
  }

  const add = (patch: TravelAutofillPatch) => proposed.set(patch.fieldName, patch);
  for (const field of application.fields) {
    const fieldName = field.fieldName;
    if (dates && ARRIVAL_DATE_FIELDS.has(fieldName)) {
      add({ fieldName, value: dates.arrival, sourceFact: "trip_date" });
      continue;
    }
    if (dates && DEPARTURE_DATE_FIELDS.has(fieldName)) {
      add({ fieldName, value: dates.departure, sourceFact: "trip_date" });
      continue;
    }
    if (dates && fieldName === "departure_from_origin_date") {
      add({ fieldName, value: state.departure_date!, sourceFact: "trip_date" });
      continue;
    }
    if (dates && fieldName === "uk_accommodation_arrival_date") {
      add({ fieldName, value: dates.arrival, sourceFact: "trip_date" });
      continue;
    }
    if (dates && fieldName === "uk_accommodation_departure_date") {
      add({ fieldName, value: dates.departure, sourceFact: "trip_date" });
      continue;
    }
    if (city && ["arrival_city", "destination_city"].includes(fieldName)) {
      add({ fieldName, value: city, sourceFact: "destination_city" });
      continue;
    }
    if (PURPOSE_FIELDS.has(fieldName)) {
      const value = optionValueMatching(field.options, [
        "tourism",
        "tourist",
        "holiday",
        "leisure",
        "旅游",
      ]);
      if (value) add({ fieldName, value, sourceFact: "travel_purpose" });
      continue;
    }
    if (isLiveHotel(hotel)) {
      if (ACCOMMODATION_NAME_FIELDS.has(fieldName)) {
        add({ fieldName, value: hotel.option.name!.trim(), sourceFact: "live_hotel" });
      } else if (ACCOMMODATION_ADDRESS_FIELDS.has(fieldName)) {
        add({ fieldName, value: hotel.option.address!.trim(), sourceFact: "live_hotel" });
      } else if (city && ACCOMMODATION_CITY_FIELDS.has(fieldName)) {
        add({ fieldName, value: city, sourceFact: "live_hotel" });
      } else if (
        ACCOMMODATION_PHONE_FIELDS.has(fieldName) &&
        hotel.option.contact_phone?.trim()
      ) {
        add({
          fieldName,
          value: hotel.option.contact_phone.trim(),
          sourceFact: "live_hotel",
        });
      } else if (fieldName === "accommodation_type") {
        const value = optionValueMatching(field.options, ["hotel", "酒店"]);
        if (value) add({ fieldName, value, sourceFact: "live_hotel" });
      }
    }
    if (isLiveFlight(inboundFlight)) {
      if (["flight_number", "arrival_flight"].includes(fieldName)) {
        add({
          fieldName,
          value: inboundFlight.option!.flight_number!.trim(),
          sourceFact: "live_flight",
        });
      }
    }
    if (isLiveFlight(outboundFlight) && fieldName === "departure_flight") {
      add({
        fieldName,
        value: outboundFlight.option!.flight_number!.trim(),
        sourceFact: "live_flight",
      });
    }
  }

  const skippedExisting: string[] = [];
  const patches = [...proposed.values()].filter((patch) => {
    if (!application.existingAnswers[patch.fieldName]?.trim()) return true;
    skippedExisting.push(patch.fieldName);
    return false;
  });

  return {
    applicationId: application.id,
    country: application.country,
    visaType: application.visaType,
    city,
    patches,
    skippedExisting,
    warnings: [...new Set(warnings)],
  };
}
