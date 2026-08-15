import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizePhEtravelPortalPayload,
  PhEtravelPortalValidationError,
} from "../normalize";
import type { SubmissionPayload } from "../../country-submissions/types";

function basePayload(overrides: Partial<SubmissionPayload> = {}): SubmissionPayload {
  return {
    payloadVersion: "test",
    countryCode: "PH",
    visaType: "PH_ETRAVEL_ARRIVAL_CARD",
    applicationId: "app_ph_etravel_test",
    dryRun: false,
    idempotencyKey: "ph-etravel-test",
    personal: {
      fullName: "TEST USER",
      dateOfBirth: "1990-01-01",
      gender: "female",
      nationality: "China",
      passportIssueDate: "2020-01-01",
      passportNumber: "E12345678",
      passportIssuingCountry: "China",
      passportExpiryDate: "2030-12-31",
      email: "test@example.com",
      phone: "+86 13800138000",
    },
    trip: {
      destinationCountry: "Philippines",
      arrivalDate: "2026-06-13",
      departureDate: "2026-06-18",
      purpose: "holiday",
      accommodationAddress: "Test Hotel, Manila",
    },
    countrySpecific: {
      registration_for: "FOR_ME",
      travel_type: "ARRIVAL",
      transport_type: "AIR",
      passport_holder_type: "FOREIGNER",
      first_name: "TEST",
      last_name: "USER",
      passport_issuing_authority: "China",
      residence_address_line1: "Hunan",
      purpose_of_travel: "POV001",
      traveller_type: "AIRCRAFT PASSENGER",
      airline_name: "TC002",
      flight_number: "PR101",
      airport_of_origin: "Singapore Changi Airport",
      flight_departure_date: "2026-06-13",
      flight_arrival_date: "2026-06-13",
      port_of_entry: "TP1000",
      destination_port_code: "TP1000",
      country_of_birth: "CN",
      country_of_residence: "CN",
      occupation: "OCC007",
      destination_type: "HOTEL",
      destination_hotel_name: "Test Hotel",
      destination_hotel_address: "Test Hotel, Manila",
      has_recent_travel_history_30d: "no",
      has_exposure_to_sick_person_30d: "no",
      has_been_sick_30d: "no",
      has_accompanied_family_members: "no",
      checked_baggage_count: "1",
      handcarry_baggage_count: "1",
      first_time_visiting_philippines: "no",
      customs_information_acknowledgement: "yes",
      has_baggage_or_currency_to_declare: "no",
      has_dutiable_goods: "no",
      has_currency_over_threshold: "no",
      customs_signature_file: "submission-artifacts/ph-signature.png",
      customs_signature_declaration: "yes",
      final_declaration: "yes",
    },
    metadata: {},
    ...overrides,
  };
}

test("normalizePhEtravelPortalPayload maps VIZA answers into official eTravel payload fields", () => {
  const payload = normalizePhEtravelPortalPayload(basePayload(), {
    now: new Date("2026-06-12T08:00:00+08:00"),
  });

  assert.equal(payload.visaType, "PH_ETRAVEL_ARRIVAL_CARD");
  assert.equal(payload.travelType, "ARRIVAL");
  assert.equal(payload.transportType, "AIR");
  assert.deepEqual(payload.arrivalBranch, {
    transportType: "AIR",
    passportHolderType: "FOREIGNER",
    travellerType: "AIRCRAFT_PASSENGER",
  });
  assert.equal(payload.flightNumber, "PR101");
  assert.equal(payload.travellerType, "AIRCRAFT_PASSENGER");
  assert.equal(payload.airlineOrVesselName, "TC002");
  assert.equal(payload.airportOfOrigin, "Singapore Changi Airport");
  assert.equal(payload.portOfEntry, "TP1000");
  assert.equal(payload.hasHealthSymptoms, false);
  assert.equal(payload.customs.hasCheckedBaggage, true);
  assert.equal(payload.customs.checkedBaggageCount, "1");
  assert.equal(payload.customs.hasDutiableGoods, false);
  assert.equal(payload.customs.hasCurrencyOverThreshold, false);
  assert.deepEqual(payload.residence, {
    country: { code: "CN", label: null },
    regionCode: null,
    province: null,
    municipality: null,
    barangay: null,
    line1: "Hunan",
    line2: null,
    isPhilippines: false,
  });
});

test("normalizePhEtravelPortalPayload preserves official PH residence codes", () => {
  const payload = normalizePhEtravelPortalPayload(basePayload({
    countrySpecific: {
      ...basePayload().countrySpecific,
      country_of_residence: "PH",
      country_of_residence_name: "Philippines",
      residence_region_code: "1400000000",
      residence_province_code: "1400100000",
      residence_province_name: "ABRA",
      residence_municipality_code: "1400101000",
      residence_municipality_name: "BANGUED",
      residence_barangay_code: "1400101001",
      residence_barangay_name: "AGTANGAO",
      residence_address_line1: "House 1, Test Street",
      residence_address_line2: "Unit 2",
    },
  }), { now: new Date("2026-06-12T08:00:00+08:00") });

  assert.equal(payload.residence.province?.code, "1400100000");
  assert.equal(payload.residence.municipality?.code, "1400101000");
  assert.equal(payload.residence.barangay?.code, "1400101001");
  assert.equal(payload.residence.line1, "House 1, Test Street");
  assert.equal(payload.residence.line2, "Unit 2");
});

test("normalizePhEtravelPortalPayload makes incomplete PH residence action-required", () => {
  assert.throws(
    () => normalizePhEtravelPortalPayload(basePayload({
      countrySpecific: {
        ...basePayload().countrySpecific,
        country_of_residence: "PH",
        residence_address_line1: "AGTANGAO, BANGUED, ABRA",
      },
    }), { now: new Date("2026-06-12T08:00:00+08:00") }),
    (error: unknown) => {
      assert.ok(error instanceof PhEtravelPortalValidationError);
      assert.ok(error.missingFields.includes("residence.province_code"));
      assert.ok(error.missingFields.includes("residence.municipality_code"));
      assert.ok(error.missingFields.includes("residence.barangay_code"));
      return true;
    },
  );
});

test("normalizePhEtravelPortalPayload preserves distinct onboarding name fields and extension alias", () => {
  const payload = normalizePhEtravelPortalPayload(basePayload({
    countrySpecific: {
      ...basePayload().countrySpecific,
      first_name: "GIVEN",
      middle_name: "MIDDLE",
      last_name: "",
      extension_name: "SUFFIX",
    },
  }), { now: new Date("2026-06-12T08:00:00+08:00") });

  assert.equal(payload.firstName, "GIVEN");
  assert.equal(payload.middleName, "MIDDLE");
  assert.equal(payload.lastName, null);
  assert.equal(payload.suffix, "SUFFIX");
});

test("normalizePhEtravelPortalPayload does not derive a first name by splitting full_name", () => {
  const input = basePayload({
    countrySpecific: {
      ...basePayload().countrySpecific,
      first_name: "",
      full_name: "SYNTHETIC FULL NAME",
    },
  });

  assert.throws(
    () => normalizePhEtravelPortalPayload(input, { now: new Date("2026-06-12T08:00:00+08:00") }),
    (error: unknown) => error instanceof PhEtravelPortalValidationError && error.missingFields.includes("first_name"),
  );
});

test("normalizePhEtravelPortalPayload keeps Special Flight as UI state and maps only its detail key", () => {
  const payload = normalizePhEtravelPortalPayload(basePayload({
    countrySpecific: {
      ...basePayload().countrySpecific,
      is_special_flight: "yes",
      flight_number: "SPECIAL FLIGHT",
      flight_number_special: "SPECIAL123",
    },
  }), { now: new Date("2026-06-12T08:00:00+08:00") });

  assert.equal(payload.isSpecialFlight, true);
  assert.equal(payload.flightNumber, "SPECIAL123");
});

test("normalizePhEtravelPortalPayload maps SEA Filipino arrival as its own branch", () => {
  const payload = normalizePhEtravelPortalPayload(basePayload({
    personal: {
      ...basePayload().personal,
      nationality: "Philippines",
      passportIssuingCountry: "Philippines",
    },
    countrySpecific: {
      ...basePayload().countrySpecific,
      transport_type: "SEA",
      passport_holder_type: "FILIPINO",
      nationality: "PH",
      passport_issuing_authority: "PH",
      traveller_type: "VESSEL_PASSENGER",
      flight_number: "",
      flight_departure_date: "",
      flight_arrival_date: "",
      voyage_departure_date: "2026-06-12",
      voyage_arrival_date: "2026-06-13",
      return_date: "2026-06-18",
      voyage_number: "VOY123",
      airline_name: "",
      vessel_name: "MV SAMPLE",
      airport_of_origin: "",
      origin_port: "Singapore Cruise Centre",
      is_disembarking: "yes",
      destination_type: "TRAVEL_PORT",
      disembarking_port_code: "TP2000",
      port_of_entry: "TP2000",
      destination_port_code: "TP0103",
    },
  }), { now: new Date("2026-06-12T08:00:00+08:00") });

  assert.deepEqual(payload.arrivalBranch, {
    transportType: "SEA",
    passportHolderType: "FILIPINO",
    travellerType: "VESSEL_PASSENGER",
  });
  assert.equal(payload.flightNumber, "VOY123");
  assert.equal(payload.isDisembarking, true);
  assert.equal(payload.airlineOrVesselName, "MV SAMPLE");
  assert.equal(payload.airportOfOrigin, "Singapore Cruise Centre");
  assert.equal(payload.returnDate, "2026-06-18");
  assert.equal(payload.destinationPort, "TP2000");
  assert.equal(payload.portOfEntry, "TP0103");
  assert.equal(payload.philippinesAddress, null);
});

test("normalizePhEtravelPortalPayload keeps SEA non-disembarking out of destination branch", () => {
  const payload = normalizePhEtravelPortalPayload(basePayload({
    countrySpecific: {
      ...basePayload().countrySpecific,
      transport_type: "SEA",
      traveller_type: "VESSEL_PASSENGER",
      flight_number: "",
      flight_departure_date: "",
      flight_arrival_date: "",
      voyage_departure_date: "2026-06-12",
      voyage_arrival_date: "2026-06-13",
      voyage_number: "VOY123",
      airline_name: "",
      vessel_name: "MV SAMPLE",
      airport_of_origin: "",
      origin_port: "Singapore Cruise Centre",
      port_of_entry: "TP2000",
      destination_port_code: "TP0103",
      is_disembarking: "no",
      destination_type: "",
      disembarking_port_code: "",
      destination_hotel_name: "",
      destination_hotel_address: "",
      philippines_address: "",
    },
  }), { now: new Date("2026-06-12T08:00:00+08:00") });

  assert.equal(payload.isDisembarking, false);
  assert.equal(payload.destinationType, null);
  assert.equal(payload.destinationPort, null);
  assert.equal(payload.philippinesAddress, null);
});

test("normalizePhEtravelPortalPayload never uses disembarking_port_code as the SEA arrival port", () => {
  assert.throws(
    () => normalizePhEtravelPortalPayload(basePayload({
      countrySpecific: {
        ...basePayload().countrySpecific,
        transport_type: "SEA",
        traveller_type: "VESSEL_PASSENGER",
        flight_number: "",
        flight_departure_date: "",
        flight_arrival_date: "",
        voyage_departure_date: "2026-06-12",
        voyage_arrival_date: "2026-06-13",
        voyage_number: "VOY123",
        vessel_name: "MV SAMPLE",
        origin_port: "Origin",
        destination_port_code: "",
        disembarking_port_code: "TP0103",
      },
    }), { now: new Date("2026-06-12T08:00:00+08:00") }),
    (error: unknown) => {
      assert.ok(error instanceof PhEtravelPortalValidationError);
      assert.ok(error.missingFields.includes("destination_port_code"));
      return true;
    },
  );
});

test("normalizePhEtravelPortalPayload uses SEA voyage dates and ignores flight/trip fallbacks when open", () => {
  const payload = normalizePhEtravelPortalPayload(basePayload({
    trip: {
      ...basePayload().trip,
      arrivalDate: "2026-07-01",
      departureDate: "2026-07-01",
    },
    countrySpecific: {
      ...basePayload().countrySpecific,
      transport_type: "SEA",
      traveller_type: "VESSEL_PASSENGER",
      flight_number: "",
      flight_departure_date: "",
      flight_arrival_date: "",
      voyage_departure_date: "2026-06-12",
      voyage_arrival_date: "2026-06-13",
      voyage_number: "VOY123",
      airline_name: "",
      vessel_name: "MV SAMPLE",
      airport_of_origin: "",
      origin_port: "Singapore Cruise Centre",
    },
  }), { now: new Date("2026-06-12T08:00:00+08:00") });

  assert.equal(payload.departureDate, "2026-06-12");
  assert.equal(payload.arrivalDate, "2026-06-13");
});

test("normalizePhEtravelPortalPayload schedules SEA only from voyage arrival date", () => {
  assert.throws(
    () => normalizePhEtravelPortalPayload(basePayload({
      trip: {
        ...basePayload().trip,
        arrivalDate: "2026-06-13",
        departureDate: "2026-06-13",
      },
      countrySpecific: {
        ...basePayload().countrySpecific,
        transport_type: "SEA",
        traveller_type: "VESSEL_PASSENGER",
        flight_number: "",
        flight_departure_date: "",
        flight_arrival_date: "",
        voyage_departure_date: "2026-06-17",
        voyage_arrival_date: "2026-06-20",
        voyage_number: "VOY123",
        airline_name: "",
        vessel_name: "MV SAMPLE",
        airport_of_origin: "",
        origin_port: "Singapore Cruise Centre",
      },
    }), { now: new Date("2026-06-12T08:00:00+08:00") }),
    (error: unknown) => {
      assert.ok(error instanceof PhEtravelPortalValidationError);
      assert.deepEqual(error.missingFields, ["voyage_arrival_date"]);
      assert.match(error.message, /72 hours/);
      return true;
    },
  );
});

test("normalizePhEtravelPortalPayload rejects past SEA voyage arrival date", () => {
  assert.throws(
    () => normalizePhEtravelPortalPayload(basePayload({
      trip: {
        ...basePayload().trip,
        arrivalDate: "2026-06-20",
        departureDate: "2026-06-20",
      },
      countrySpecific: {
        ...basePayload().countrySpecific,
        transport_type: "SEA",
        traveller_type: "VESSEL_PASSENGER",
        flight_number: "",
        flight_departure_date: "",
        flight_arrival_date: "",
        voyage_departure_date: "2026-06-09",
        voyage_arrival_date: "2026-06-10",
        voyage_number: "VOY123",
        airline_name: "",
        vessel_name: "MV SAMPLE",
        airport_of_origin: "",
        origin_port: "Singapore Cruise Centre",
      },
    }), { now: new Date("2026-06-12T08:00:00+08:00") }),
    (error: unknown) => {
      assert.ok(error instanceof PhEtravelPortalValidationError);
      assert.deepEqual(error.missingFields, ["voyage_arrival_date"]);
      assert.match(error.message, /already past/);
      return true;
    },
  );
});

test("normalizePhEtravelPortalPayload rejects SEA when only flight or trip dates are present", () => {
  assert.throws(
    () => normalizePhEtravelPortalPayload(basePayload({
      trip: {
        ...basePayload().trip,
        arrivalDate: "2026-06-13",
        departureDate: "2026-06-13",
      },
      countrySpecific: {
        ...basePayload().countrySpecific,
        transport_type: "SEA",
        traveller_type: "VESSEL_PASSENGER",
        flight_departure_date: "2026-06-12",
        flight_arrival_date: "2026-06-13",
        voyage_departure_date: "",
        voyage_arrival_date: "",
        voyage_number: "VOY123",
        airline_name: "",
        vessel_name: "MV SAMPLE",
        airport_of_origin: "",
        origin_port: "Singapore Cruise Centre",
      },
    }), { now: new Date("2026-06-12T08:00:00+08:00") }),
    (error: unknown) => {
      assert.ok(error instanceof PhEtravelPortalValidationError);
      assert.ok(error.missingFields.includes("voyage_arrival_date"));
      return true;
    },
  );
});

test("normalizePhEtravelPortalPayload blocks unsupported arrival personas before the official runner", () => {
  for (const [key, value] of [
    ["traveller_type", "FLIGHT_CREW"],
    ["traveller_type", "CRUISE_PASSENGER"],
    ["is_special_registration", "yes"],
    ["passport_type", "DIPLOMATIC PASSPORT"],
    ["visa_category", "9(e)"],
  ] as const) {
    assert.throws(
      () => normalizePhEtravelPortalPayload(basePayload({
        countrySpecific: {
          ...basePayload().countrySpecific,
          [key]: value,
        },
      }), { now: new Date("2026-06-12T08:00:00+08:00") }),
      (error: unknown) => error instanceof PhEtravelPortalValidationError,
      `${key}=${value} should be blocked`,
    );
  }
});

test("normalizePhEtravelPortalPayload blocks PH-A eligibility semantic and flat unsupported aliases", () => {
  const unsupportedAliases: Array<Record<string, string>> = [
    { eligibility_traveller_type: "VESSEL CREW" },
    { passenger_type: "CRUISE CREW" },
    { arrival_registration_type: "special_travel_declaration" },
    { foreign_diplomat_dependent: "yes" },
    { foreign_dignitary_delegation: "true" },
    { visa_9e: "1" },
    { travel_document_type: "OFFICIAL" },
    { passport_holder_type: "SERVICE PASSPORT HOLDER" },
    { diplomatic_passport_holder: "checked" },
  ];
  for (const countrySpecific of unsupportedAliases) {
    assert.throws(
      () => normalizePhEtravelPortalPayload(basePayload({
        countrySpecific: {
          ...basePayload().countrySpecific,
          ...countrySpecific,
        },
      }), { now: new Date("2026-06-12T08:00:00+08:00") }),
      (error: unknown) => error instanceof PhEtravelPortalValidationError,
      JSON.stringify(countrySpecific),
    );
  }
});

test("normalizePhEtravelPortalPayload maps official customs checklist and structured currency details", () => {
  const payload = normalizePhEtravelPortalPayload(basePayload({
    countrySpecific: {
      ...basePayload().countrySpecific,
      has_baggage_or_currency_to_declare: "yes",
      customs_checklist_1: "yes",
      customs_checklist_2: "no",
      customs_checklist_3: "yes",
      customs_checklist_3_details: "Plants",
      customs_checklist_12: "no",
      amount_of_goods_currency: "USD",
      amount_of_goods_amount: "1200",
      currency_type: "FOREIGN_CURRENCY",
      currency_amount: "15000",
      currency_monetary_instrument: "CASH",
      currency_source: "Salary",
      currency_source__2: "Business",
      currency_transport_purpose: "Travel",
      currency_transport_purpose__2: "Business",
      currency_transport_method: "physically transferred by person",
      no_of_days_in_philippines: "5",
      last_travel_to_philippines: "2026-01-02",
      currency_owner_not_applicable: "yes",
      currency_owner_first_name: "TEST",
      currency_owner_last_name: "OWNER",
      currency_owner_country: "CN",
      currency_recipient_business_name: "Recipient Co",
      currency_recipient_country: "PH",
      bsp_authorization_number: "BSP-TEST",
      bsp_authorization_date: "2026-06-12",
    },
  }), { now: new Date("2026-06-12T08:00:00+08:00") });

  assert.equal(payload.customs.hasBaggageOrCurrencyToDeclare, true);
  assert.equal(payload.customs.hasCurrencyToDeclare, true);
  assert.equal(payload.customs.hasCurrencyOverThreshold, true);
  assert.equal(payload.customs.hasGoodsToDeclare, true);
  assert.equal(payload.customs.hasDutiableGoods, true);
  assert.deepEqual(payload.customs.generalDeclarationResponses.map((item) => [item.key, item.response, item.details]), [
    ["customs_checklist_1", true, null],
    ["customs_checklist_2", false, null],
    ["customs_checklist_3", true, "Plants"],
    ["customs_checklist_12", false, null],
  ]);
  assert.equal(payload.customs.amountOfGoodsCurrency, "USD");
  assert.equal(payload.customs.currencyAmount, "15000");
  assert.deepEqual(payload.customs.currencyItems, [
    { currency: "FOREIGN_CURRENCY", monetaryInstrument: "CASH", amount: "15000" },
  ]);
  assert.deepEqual(payload.customs.currencySources, ["Salary", "Business"]);
  assert.deepEqual(payload.customs.currencyTransportPurposes, ["Travel", "Business"]);
  assert.equal(payload.customs.currencyTransportMethod, "is_physically_transferred_by_person");
  assert.equal(payload.customs.noOfDaysInPhilippines, "5");
  assert.equal(payload.customs.lastTravelToPhilippines, "2026-01-02");
  assert.equal(payload.customs.currencyOwnerNotApplicable, true);
  assert.equal(payload.customs.currencyOwner, null);
  assert.equal(payload.customs.currencyRecipient, null);
  assert.equal(payload.customs.bspAuthorizationNumber, "BSP-TEST");
});

test("normalizePhEtravelPortalPayload maps all 12 customs checklist answers and other goods items", () => {
  const countrySpecific: Record<string, string> = {
    ...basePayload().countrySpecific,
    has_baggage_or_currency_to_declare: "yes",
    amount_of_goods_currency: "USD",
    amount_of_goods_amount: "2500",
    customs_checklist_12: "yes",
    goods_item_description: "Camera equipment",
    goods_item_quantity: "1",
    goods_item_value: "500",
    goods_item_description__2: "Samples",
    goods_item_quantity__2: "3",
    goods_item_value__2: "150",
  };
  for (let item = 1; item <= 11; item += 1) {
    countrySpecific[`customs_checklist_${item}`] = item > 2 && item % 2 === 0 ? "yes" : "no";
  }

  const payload = normalizePhEtravelPortalPayload({
    ...basePayload(),
    countrySpecific,
  }, { now: new Date("2026-06-12T08:00:00+08:00") });

  assert.deepEqual(payload.customs.generalDeclarationResponses.map((item) => item.itemNumber), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.equal(payload.customs.generalDeclarationResponses.filter((item) => item.response).length, 5);
  assert.deepEqual(payload.customs.goodsItems, [
    { description: "Camera equipment", quantity: "1", amountUsd: "500" },
    { description: "Samples", quantity: "3", amountUsd: "150" },
  ]);
});

test("normalizePhEtravelPortalPayload maps courier currency declaration branch", () => {
  const payload = normalizePhEtravelPortalPayload(basePayload({
    countrySpecific: {
      ...basePayload().countrySpecific,
      has_baggage_or_currency_to_declare: "yes",
      customs_checklist_1: "yes",
      currency_items: JSON.stringify([
        { currency: "USD", monetary_instrument: "Cash", amount: "12000" },
      ]),
      currency_sources: JSON.stringify(["Savings"]),
      currency_transport_purposes: JSON.stringify(["Investment"]),
      currency_transport_method: "shipped thru courier service",
      courier_name: "TEST COURIER",
      airway_bill_number: "AWB123",
      airway_bill_date: "2026-06-11",
    },
  }), { now: new Date("2026-06-12T08:00:00+08:00") });

  assert.deepEqual(payload.customs.currencyItems, [
    { currency: "USD", monetaryInstrument: "Cash", amount: "12000" },
  ]);
  assert.equal(payload.customs.currencyTransportMethod, "is_shipped_thru_courier_service");
  assert.equal(payload.customs.courierName, "TEST COURIER");
  assert.equal(payload.customs.airwayBillNumber, "AWB123");
  assert.equal(payload.customs.airwayBillDate, "2026-06-11");
});

test("normalizePhEtravelPortalPayload fail-closes positive customs/currency without structured fields", () => {
  assert.throws(
    () => normalizePhEtravelPortalPayload(basePayload({
      countrySpecific: {
        ...basePayload().countrySpecific,
        has_baggage_or_currency_to_declare: "yes",
        customs_checklist_1: "yes",
        customs_checklist_12: "yes",
        currency_type: "FOREIGN_CURRENCY",
        currency_amount: "15000",
      },
    }), { now: new Date("2026-06-12T08:00:00+08:00") }),
    (error: unknown) => {
      assert.ok(error instanceof PhEtravelPortalValidationError);
      assert.ok(error.missingFields.includes("goods_items"));
      assert.ok(error.missingFields.includes("currency_items"));
      assert.ok(error.missingFields.includes("currency_sources"));
      assert.ok(error.missingFields.includes("currency_transport_purposes"));
      assert.ok(error.missingFields.includes("currency_transport_method"));
      return true;
    },
  );
});

test("normalizePhEtravelPortalPayload derives ARRIVAL when the fixed travel type question is absent", () => {
  const base = basePayload();
  const { travel_type: _removedTravelType, ...countrySpecific } = base.countrySpecific;
  const payload = normalizePhEtravelPortalPayload({
    ...base,
    countrySpecific,
  }, {
    now: new Date("2026-06-12T08:00:00+08:00"),
  });

  assert.equal(payload.travelType, "ARRIVAL");
});

test("normalizePhEtravelPortalPayload keeps departure independent and evaluates the window from departure date", () => {
  const base = basePayload();
  const payload = normalizePhEtravelPortalPayload({
    ...base,
    visaType: "PH_ETRAVEL_DEPARTURE_CARD",
    trip: { ...base.trip, departureDate: "2026-06-13", arrivalDate: "2026-06-14" },
    countrySpecific: {
      ...base.countrySpecific,
      travel_type: "DEPARTURE",
      passport_holder_type: "FOREIGNER",
      departure_airport: "TP1000",
      destination_country: "SG",
      destination_port: "Singapore Changi Airport",
      destination_address: "1 Airport Boulevard, Singapore",
      flight_departure_date: "2026-06-13",
      flight_arrival_date: "2026-06-14",
      has_goods_to_declare: "no",
      has_currency_to_declare: "no",
    },
  }, { now: new Date("2026-06-12T08:00:00+08:00") });

  assert.equal(payload.visaType, "PH_ETRAVEL_DEPARTURE_CARD");
  assert.equal(payload.travelType, "DEPARTURE");
  assert.equal(payload.portOfEntry, "TP1000");
  assert.equal(payload.destinationCountry, "SG");
  assert.equal(payload.destinationPort, "Singapore Changi Airport");
  assert.equal(payload.destinationAddress, "1 Airport Boulevard, Singapore");
  assert.equal(payload.philippinesAddress, null);
});

test("departure rejects a past departure even when destination arrival is future", () => {
  const base = basePayload();
  assert.throws(() => normalizePhEtravelPortalPayload({
    ...base,
    visaType: "PH_ETRAVEL_DEPARTURE_CARD",
    countrySpecific: {
      ...base.countrySpecific,
      travel_type: "DEPARTURE",
      flight_departure_date: "2026-06-10",
      flight_arrival_date: "2026-06-13",
    },
  }, { now: new Date("2026-06-12T08:00:00+08:00") }), (error: unknown) =>
    error instanceof PhEtravelPortalValidationError && error.missingFields.includes("flight_departure_date"));
});

test("normalizePhEtravelPortalPayload keeps the three official health answers distinct", () => {
  const payload = normalizePhEtravelPortalPayload(basePayload({
    countrySpecific: {
      ...basePayload().countrySpecific,
      has_recent_travel_history_30d: "yes",
      visited_country_30d: "SG",
      visited_country_30d__2: "MY",
      has_exposure_to_sick_person_30d: "no",
      has_been_sick_30d: "yes",
      sickness_symptom: "SS002",
      sickness_symptom__2: "SS008",
    },
  }), { now: new Date("2026-06-12T08:00:00+08:00") });

  assert.equal(payload.hasRecentTravelHistory30d, true);
  assert.deepEqual(payload.visitedCountries30d, ["SG", "MY"]);
  assert.equal(payload.hasExposureToSickPerson30d, false);
  assert.equal(payload.hasBeenSick30d, true);
  assert.deepEqual(payload.sicknessSymptoms, ["SS002", "SS008"]);
});

test("normalizePhEtravelPortalPayload requires every Health Yes/No answer and a positive child selection", () => {
  const incompleteAnswers = basePayload().countrySpecific;
  assert.throws(
    () => normalizePhEtravelPortalPayload(basePayload({
      countrySpecific: {
        ...incompleteAnswers,
        has_recent_travel_history_30d: "",
        has_exposure_to_sick_person_30d: "",
        has_been_sick_30d: "",
      },
    }), { now: new Date("2026-06-12T08:00:00+08:00") }),
    (error: unknown) => error instanceof PhEtravelPortalValidationError
      && ["has_recent_travel_history_30d", "has_exposure_to_sick_person_30d", "has_been_sick_30d"]
        .every((key) => error.missingFields.includes(key)),
  );
  assert.throws(
    () => normalizePhEtravelPortalPayload(basePayload({
      countrySpecific: {
        ...incompleteAnswers,
        has_recent_travel_history_30d: "yes",
        visited_country_30d: "",
      },
    }), { now: new Date("2026-06-12T08:00:00+08:00") }),
    (error: unknown) => error instanceof PhEtravelPortalValidationError
      && error.missingFields.includes("visited_country_30d"),
  );
  assert.throws(
    () => normalizePhEtravelPortalPayload(basePayload({
      countrySpecific: {
        ...incompleteAnswers,
        has_been_sick_30d: "yes",
        sickness_symptom: "",
      },
    }), { now: new Date("2026-06-12T08:00:00+08:00") }),
    (error: unknown) => error instanceof PhEtravelPortalValidationError
      && error.missingFields.includes("sickness_symptom"),
  );
});

test("normalizePhEtravelPortalPayload keeps only positive Health arrays and retains country codes including PH", () => {
  const positive = normalizePhEtravelPortalPayload(basePayload({
    countrySpecific: {
      ...basePayload().countrySpecific,
      has_recent_travel_history_30d: "yes",
      visited_country_30d: "PH",
      visited_country_30d__2: "SG",
      visited_country_30d__3: "PH",
      has_been_sick_30d: "yes",
      sickness_symptom: "SYMPTOM_A",
      sickness_symptom__2: "SYMPTOM_B",
      sickness_symptom__3: "SYMPTOM_A",
    },
  }), { now: new Date("2026-06-12T08:00:00+08:00") });
  assert.deepEqual(positive.visitedCountries30d, ["PH", "SG"]);
  assert.deepEqual(positive.sicknessSymptoms, ["SYMPTOM_A", "SYMPTOM_B"]);

  const noBranches = normalizePhEtravelPortalPayload(basePayload({
    countrySpecific: {
      ...basePayload().countrySpecific,
      has_recent_travel_history_30d: "no",
      visited_country_30d: "PH",
      has_been_sick_30d: "no",
      sickness_symptom: "SYMPTOM_A",
    },
  }), { now: new Date("2026-06-12T08:00:00+08:00") });
  assert.deepEqual(noBranches.visitedCountries30d, []);
  assert.deepEqual(noBranches.sicknessSymptoms, []);
  assert.equal(noBranches.healthSymptomsDetails, null);
});

test("normalizePhEtravelPortalPayload carries conditional transit destination answers", () => {
  const payload = normalizePhEtravelPortalPayload(basePayload({
    countrySpecific: {
      ...basePayload().countrySpecific,
      destination_type: "TRANSIT",
      destination_transit_airport: "TP3000",
      destination_country: "HK",
    },
  }), { now: new Date("2026-06-12T08:00:00+08:00") });

  assert.equal(payload.destinationTransitAirport, "TP3000");
  assert.equal(payload.destinationCountry, "HK");
});

test("normalizePhEtravelPortalPayload rejects wrong country or visa type", () => {
  assert.throws(
    () =>
      normalizePhEtravelPortalPayload(
        basePayload({
          countryCode: "PH",
          visaType: "PH_TEMPORARY_VISITOR_VISA",
        }),
        { now: new Date("2026-06-12T08:00:00+08:00") },
      ),
    (error: unknown) => {
      assert.ok(error instanceof PhEtravelPortalValidationError);
      assert.deepEqual(error.missingFields, ["visaType"]);
      return true;
    },
  );
});

test("normalizePhEtravelPortalPayload requires final declaration before live submission", () => {
  assert.throws(
    () =>
      normalizePhEtravelPortalPayload(
        basePayload({
          countrySpecific: {
            ...basePayload().countrySpecific,
            final_declaration: "no",
          },
        }),
        { now: new Date("2026-06-12T08:00:00+08:00") },
      ),
    (error: unknown) => {
      assert.ok(error instanceof PhEtravelPortalValidationError);
      assert.deepEqual(error.missingFields, ["final_declaration"]);
      return true;
    },
  );
});

test("normalizePhEtravelPortalPayload rejects arrivals outside the official 72-hour window", () => {
  assert.throws(
    () =>
      normalizePhEtravelPortalPayload(
        basePayload({
          trip: {
            ...basePayload().trip,
            arrivalDate: "2026-06-20",
          },
          countrySpecific: {
            ...basePayload().countrySpecific,
            flight_arrival_date: "",
          },
        }),
        { now: new Date("2026-06-12T08:00:00+08:00") },
      ),
    (error: unknown) => {
      assert.ok(error instanceof PhEtravelPortalValidationError);
      assert.deepEqual(error.missingFields, ["flight_arrival_date"]);
      assert.match(error.message, /72 hours/);
      return true;
    },
  );
});

test("normalizePhEtravelPortalPayload normalizes slash dates to ISO dates", () => {
  const payload = normalizePhEtravelPortalPayload(
    basePayload({
      personal: {
        ...basePayload().personal,
        phone: "0086 13800138000",
      },
      trip: {
        ...basePayload().trip,
        arrivalDate: "06/20/2026",
      },
      countrySpecific: {
        ...basePayload().countrySpecific,
        flight_arrival_date: "",
      },
    }),
    { now: new Date("2026-06-20T08:00:00+08:00") },
  );

  assert.equal(payload.arrivalDate, "2026-06-20");
});

test("normalizePhEtravelPortalPayload derives mobile code and number from personal phone", () => {
  const payload = normalizePhEtravelPortalPayload(
    basePayload({
      personal: {
        ...basePayload().personal,
        phone: "+86 13800138000",
      },
      countrySpecific: {
        ...basePayload().countrySpecific,
        mobile_country_code: "",
        mobile_number: "",
      },
    }),
    { now: new Date("2026-06-12T08:00:00+08:00") },
  );

  assert.equal(payload.mobileCountryCode, "+86");
  assert.equal(payload.mobileNumber, "13800138000");
});
