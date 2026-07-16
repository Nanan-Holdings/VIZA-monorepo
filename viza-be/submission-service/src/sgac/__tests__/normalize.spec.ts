import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSgacPortalPayload, SgacPortalValidationError } from "../normalize";
import { SGAC_HOTEL_OPTIONS } from "../official-options";
import type { SubmissionPayload } from "../../country-submissions/types";

function basePayload(overrides: Partial<SubmissionPayload> = {}): SubmissionPayload {
  return {
    payloadVersion: "test",
    countryCode: "SG",
    visaType: "SG_ARRIVAL_CARD",
    applicationId: "app_sgac_test",
    dryRun: false,
    idempotencyKey: "sgac-test",
    personal: {
      fullName: "TEST USER",
      dateOfBirth: "1990-01-01",
      gender: "male",
      nationality: "China",
      passportNumber: "E12345678",
      passportExpiryDate: "2030-12-31",
      email: "test@example.com",
      phone: "+86 13800138000",
    },
    trip: {
      destinationCountry: "Singapore",
      arrivalDate: "2026-06-13",
      departureDate: "2026-06-14",
      purpose: "holiday",
      accommodationAddress: "Transit",
    },
    countrySpecific: {
      purpose_of_travel: "holiday",
      mode_of_travel: "air",
      transport_number: "SQ317",
      place_of_birth_country: "China",
      place_of_residence: "CHINA, BEIJING, BEIJING",
      last_city_or_port_before_singapore: "Kuala Lumpur",
      next_city_or_port_after_singapore: "Bangkok",
      accommodation_type: "others",
      accommodation_other_type: "transit",
      recent_country_visit_history: "none",
      has_health_symptoms: "no",
      has_used_different_name_to_enter_singapore: "no",
      final_declaration: "yes",
    },
    metadata: {},
    ...overrides,
  };
}

test("SGAC hotel snapshot preserves every current ICA record", () => {
  assert.equal(SGAC_HOTEL_OPTIONS.length, 472);
  assert.equal(new Set(SGAC_HOTEL_OPTIONS.map((option) => option.label)).size, 469);
  assert.deepEqual(
    SGAC_HOTEL_OPTIONS.filter((option) => option.label === "ASCOTT ORCHARD SINGAPORE").map((option) => option.code),
    ["M0082", "M0106"],
  );
  assert.deepEqual(
    SGAC_HOTEL_OPTIONS.filter((option) => option.label === "JIN DONG HOTEL").map((option) => option.code),
    ["S0079", "S0531"],
  );
  assert.deepEqual(
    SGAC_HOTEL_OPTIONS.filter((option) => option.label === "LODGE 41").map((option) => option.code),
    ["S0221", "S0534"],
  );
});

test("normalizeSgacPortalPayload maps purpose_of_travel and transport number into ICA fields", () => {
  const payload = normalizeSgacPortalPayload(basePayload(), {
    now: new Date("2026-06-12T08:00:00+08:00"),
  });

  assert.equal(payload.purposeOfTravelLabel, "Holiday/Sightseeing/Leisure");
  assert.equal(payload.transport.mode, "air");
  assert.equal(payload.transport.airTransportType, "commercial");
  assert.equal(payload.transport.carrierCodeQuery, "SQ");
  assert.equal(payload.transport.flightNo, "317");
  assert.equal(payload.nationalityLabel, "CHINESE");
  assert.equal(payload.placeOfBirthLabel, "CHINA");
  assert.equal(payload.residenceCityQuery, "CHINA, BEIJING, BEIJING");
  assert.equal(payload.lastCityQuery, "MALAYSIA, KUALA LUMPUR, KUALA LUMPUR");
  assert.equal(payload.nextCityQuery, "THAILAND, BANGKOK, BANGKOK");
  assert.equal(payload.phoneCountryCode, "86");
  assert.equal(payload.phoneNumber, "13800138000");
});

test("normalizeSgacPortalPayload treats standard airline flight numbers as commercial flights", () => {
  const payload = normalizeSgacPortalPayload(
    basePayload({
      countrySpecific: {
        ...basePayload().countrySpecific,
        air_transport_type: "private",
        carrier_name: "Singapore Airlines",
        transport_number: "SQ121",
      },
    }),
    { now: new Date("2026-06-12T08:00:00+08:00") },
  );

  assert.equal(payload.transport.mode, "air");
  assert.equal(payload.transport.airTransportType, "commercial");
  assert.equal(payload.transport.carrierCodeQuery, "SQ");
  assert.equal(payload.transport.flightNo, "121");
});

test("normalizeSgacPortalPayload maps land transport branch into ICA vehicle fields", () => {
  const payload = normalizeSgacPortalPayload(
    basePayload({
      countrySpecific: {
        ...basePayload().countrySpecific,
        mode_of_travel: "land",
        land_transport_type: "car",
        vehicle_number: "SBA1234A",
      },
    }),
    { now: new Date("2026-06-12T08:00:00+08:00") },
  );

  assert.deepEqual(payload.transport, {
    mode: "land",
    landTransportType: "car",
    transportNumber: "SBA1234A",
  });
});

test("normalizeSgacPortalPayload maps sea cruise and vessel branches into ICA fields", () => {
  const cruisePayload = normalizeSgacPortalPayload(
    basePayload({
      countrySpecific: {
        ...basePayload().countrySpecific,
        mode_of_travel: "sea",
        sea_transport_type: "cruise",
        cruise_name: "ADONIA",
      },
    }),
    { now: new Date("2026-06-12T08:00:00+08:00") },
  );
  assert.deepEqual(cruisePayload.transport, {
    mode: "sea",
    seaTransportType: "cruise",
    transportNumber: "ADONIA",
  });

  const vesselPayload = normalizeSgacPortalPayload(
    basePayload({
      countrySpecific: {
        ...basePayload().countrySpecific,
        mode_of_travel: "sea",
        sea_transport_type: "commercial_vessel",
        vessel_name: "TEST VESSEL",
      },
    }),
    { now: new Date("2026-06-12T08:00:00+08:00") },
  );
  assert.deepEqual(vesselPayload.transport, {
    mode: "sea",
    seaTransportType: "commercial_vessel",
    transportNumber: "TEST VESSEL",
  });
});

test("normalizeSgacPortalPayload reads the ICA health follow-up shown after symptoms yes", () => {
  const payload = normalizeSgacPortalPayload(
    basePayload({
      countrySpecific: {
        ...basePayload().countrySpecific,
        has_health_symptoms: "yes",
        recent_country_visit_history: "no",
        recent_high_risk_region_visit_history: "yes",
      },
    }),
    { now: new Date("2026-06-12T08:00:00+08:00") },
  );

  assert.equal(payload.hasHealthSymptoms, true);
  assert.equal(payload.hasYellowFeverTravelHistory, true);
});

test("normalizeSgacPortalPayload requires vehicle number for land arrivals", () => {
  const input = basePayload({
    countrySpecific: {
      ...basePayload().countrySpecific,
      mode_of_travel: "land",
      land_transport_type: "bus",
      vehicle_number: "",
      transport_number: "",
    },
  });

  assert.throws(
    () => normalizeSgacPortalPayload(input, { now: new Date("2026-06-12T08:00:00+08:00") }),
    (error: unknown) => {
      assert.ok(error instanceof SgacPortalValidationError);
      assert.ok(error.missingFields.includes("vehicle_number"));
      return true;
    },
  );
});

test("normalizeSgacPortalPayload prefers mobile_number and splits it for ICA phone fields", () => {
  const payload = normalizeSgacPortalPayload(
    basePayload({
      personal: {
        ...basePayload().personal,
        phone: "+86 13312345678",
      },
      countrySpecific: {
        ...basePayload().countrySpecific,
        mobile_country_code: "86",
        mobile_number: "19974911995",
      },
    }),
    { now: new Date("2026-06-12T08:00:00+08:00") },
  );

  assert.equal(payload.phoneCountryCode, "86");
  assert.equal(payload.phoneNumber, "19974911995");
});

test("normalizeSgacPortalPayload rejects missing purpose_of_travel with a specific field error", () => {
  const input = basePayload({
    trip: { ...basePayload().trip, purpose: null },
    countrySpecific: {
      ...basePayload().countrySpecific,
      purpose_of_travel: "",
    },
  });

  assert.throws(
    () => normalizeSgacPortalPayload(input, { now: new Date("2026-06-12T08:00:00+08:00") }),
    (error: unknown) => {
      assert.ok(error instanceof SgacPortalValidationError);
      assert.deepEqual(error.missingFields, ["purpose_of_travel"]);
      assert.match(error.message, /Purpose of travel/);
      return true;
    },
  );
});

test("normalizeSgacPortalPayload rejects hotel names outside exposed ICA options before opening the portal", () => {
  const input = basePayload({
    countrySpecific: {
      ...basePayload().countrySpecific,
      accommodation_type: "hotel",
      accommodation_name: "American TV series",
    },
  });

  assert.throws(
    () => normalizeSgacPortalPayload(input, { now: new Date("2026-06-12T08:00:00+08:00") }),
    (error: unknown) => {
      assert.ok(error instanceof SgacPortalValidationError);
      assert.deepEqual(error.missingFields, ["accommodation_name"]);
      assert.match(error.message, /Hotel name/);
      assert.match(error.message, /official ICA hotel option/);
      return true;
    },
  );
});

test("normalizeSgacPortalPayload rejects city values outside ICA city/port options", () => {
  const input = basePayload({
    countrySpecific: {
      ...basePayload().countrySpecific,
      last_city_or_port_before_singapore: "sadxas",
    },
  });

  assert.throws(
    () => normalizeSgacPortalPayload(input, { now: new Date("2026-06-12T08:00:00+08:00") }),
    (error: unknown) => {
      assert.ok(error instanceof SgacPortalValidationError);
      assert.deepEqual(error.missingFields, ["last_city_or_port_before_singapore"]);
      assert.match(error.message, /official ICA city\/port option/);
      return true;
    },
  );
});

test("normalizeSgacPortalPayload accepts exposed ICA hotel options", () => {
  const payload = normalizeSgacPortalPayload(
    basePayload({
      countrySpecific: {
        ...basePayload().countrySpecific,
        accommodation_type: "hotel",
        accommodation_name: "MARINA BAY SANDS SINGAPORE",
      },
    }),
    { now: new Date("2026-06-12T08:00:00+08:00") },
  );

  assert.deepEqual(payload.accommodation, {
    type: "hotel",
    hotelNameQuery: "MARINA BAY SANDS SINGAPORE",
  });
});

test("normalizeSgacPortalPayload rejects arrival dates outside the ICA three-day SGAC window", () => {
  const input = basePayload({
    trip: {
      ...basePayload().trip,
      arrivalDate: "2026-06-20",
    },
  });

  assert.throws(
    () => normalizeSgacPortalPayload(input, { now: new Date("2026-06-12T08:00:00+08:00") }),
    (error: unknown) => {
      assert.ok(error instanceof SgacPortalValidationError);
      assert.deepEqual(error.missingFields, ["arrival_date"]);
      assert.match(error.message, /within three days/);
      return true;
    },
  );
});
