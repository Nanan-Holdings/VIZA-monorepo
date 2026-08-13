import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPhEtravelAirDestinationActionPlan,
  PH_ETRAVEL_AIR_DESTINATION_NEEDS_REVIEW_KEYS,
  PH_ETRAVEL_AIR_DESTINATION_S2_GAPS,
} from "../air-destination-preflight";
import { evaluatePhEtravelArrivalLaunchPreflight } from "../launch-preflight";
import { evaluatePhEtravelArrivalLaunchPreflightEnvelope } from "../launch-preflight-envelope";
import type { SubmissionPayload } from "../../country-submissions/types";

function arrivalPayload(countrySpecific: Record<string, string> = {}): SubmissionPayload {
  return {
    payloadVersion: "test",
    countryCode: "PH",
    visaType: "PH_ETRAVEL_ARRIVAL_CARD",
    applicationId: "synthetic-app",
    dryRun: false,
    idempotencyKey: "synthetic-key",
    personal: {},
    trip: {},
    countrySpecific: {
      registration_for: "FOR_ME",
      transport_type: "AIR",
      traveller_type: "AIRCRAFT_PASSENGER",
      has_baggage_or_currency_to_declare: "no",
      has_currency_to_declare: "no",
      has_currency_over_threshold: "no",
      ...countrySpecific,
    },
    metadata: {},
  };
}

test("E22 AIR action plan keeps all seven public-bundle gaps before zero external actions", () => {
  const plan = buildPhEtravelAirDestinationActionPlan({
    is_special_flight: "yes",
    with_transit: "yes",
    destination_type: "RESIDENCE",
    special_flight_number: "synthetic-flight-value",
    transit_country: "synthetic-country-value",
    destination_residence_address: "synthetic-address-value",
  });

  assert.equal(plan.status, "action_required");
  assert.equal(plan.gaps.length, 7);
  assert.deepEqual(plan.gaps.map((gap) => gap.id), PH_ETRAVEL_AIR_DESTINATION_S2_GAPS.map((gap) => gap.id));
  assert.deepEqual(plan.canonicalKeys, [...PH_ETRAVEL_AIR_DESTINATION_NEEDS_REVIEW_KEYS]);
  assert.deepEqual(plan.actions, []);
  assert.deepEqual(plan.externalActions, {
    queue: "not_started",
    account: "not_started",
    browser: "not_started",
  });
  assert.equal(plan.officialResubmitAllowed, false);
  assert.equal(plan.specialFlight.selected, true);
  assert.equal(plan.specialFlight.derivedUiStateOnly, true);
  assert.deepEqual(plan.specialFlight.forbiddenOfficialPayloadKeys, ["is_special_flight"]);
  assert.equal(plan.specialFlight.officialDetailKey, "flight_number_special");
  assert.equal(plan.transit.selected, true);
  assert.equal(plan.accommodation.selected, "RESIDENCE");
  assert.equal(plan.accommodation.inputState, "exclusive");
  assert.equal(plan.accommodation.dynamicHotelSourceLiveOptionValuesUnverified, true);
  assert.equal(plan.destinationPort.dynamicPortSourceLiveOptionValuesUnverified, true);
  assert.equal(plan.destinationPort.withCustomDeclarationAloneSelectsAirCustomsFlow, false);
  assert.doesNotMatch(JSON.stringify(plan), /synthetic-flight-value|synthetic-country-value|synthetic-address-value/i);
});

test("E22 destination Residence, Hotel, and Transit are mutually exclusive plan branches", () => {
  const residence = buildPhEtravelAirDestinationActionPlan({
    destination_type: "RESIDENCE",
    destination_residence_address: "synthetic-value",
  });
  const hotel = buildPhEtravelAirDestinationActionPlan({
    destination_type: "HOTEL",
    destination_hotel_name: "synthetic-value",
  });
  const transit = buildPhEtravelAirDestinationActionPlan({
    destination_type: "TRANSIT",
    destination_transit_airport: "synthetic-value",
  });
  const conflicting = buildPhEtravelAirDestinationActionPlan({
    destination_type: "HOTEL",
    destination_hotel_name: "synthetic-value",
    destination_transit_airport: "another-synthetic-value",
  });

  assert.equal(residence.accommodation.selected, "RESIDENCE");
  assert.equal(hotel.accommodation.selected, "HOTEL");
  assert.equal(transit.accommodation.selected, "TRANSIT");
  assert.equal(residence.accommodation.inputState, "exclusive");
  assert.equal(hotel.accommodation.inputState, "exclusive");
  assert.equal(transit.accommodation.inputState, "exclusive");
  assert.equal(conflicting.accommodation.inputState, "conflicting");
  for (const plan of [residence, hotel, transit, conflicting]) {
    assert.equal(plan.actions.length, 0);
    assert.equal(plan.externalActions.browser, "not_started");
  }
});

test("E22 preflight and envelope block AIR/destination client wiring without applicant values or resubmit", () => {
  const input = {
    payload: arrivalPayload({
      is_special_flight: "yes",
      special_flight_number: "synthetic-flight-value",
      with_transit: "yes",
      transit_country: "synthetic-country-value",
      email_address: "synthetic@example.test",
      passport_number: "SYNTHETICPASSPORT",
      destination_type: "TRANSIT",
    }),
    finalSubmitEnabled: false,
  };
  const preflight = evaluatePhEtravelArrivalLaunchPreflight(input);
  assert.notEqual(preflight.status, "allowed");
  if (preflight.status === "allowed") throw new Error("AIR S2 preflight must block");
  assert.ok(preflight.blockingCodes.includes("ph_etravel_launch_air_travel_review_required"));
  assert.ok(preflight.blockingCodes.includes("ph_etravel_launch_air_special_flight_review_required"));
  assert.deepEqual(
    PH_ETRAVEL_AIR_DESTINATION_NEEDS_REVIEW_KEYS.every((key) => preflight.missingKeys.includes(key)),
    true,
  );
  assert.equal(preflight.officialResubmitAllowed, false);
  assert.doesNotMatch(JSON.stringify(preflight), /synthetic-flight-value|synthetic-country-value|synthetic@example\.test|SYNTHETICPASSPORT/i);

  const envelope = evaluatePhEtravelArrivalLaunchPreflightEnvelope(input);
  assert.equal(envelope.status, "action_required");
  assert.equal(envelope.officialResubmitAllowed, false);
  assert.equal("queue" in envelope, false);
  assert.equal("browser" in envelope, false);
  assert.equal("submitted" in envelope, false);
  assert.doesNotMatch(JSON.stringify(envelope), /synthetic-flight-value|synthetic-country-value|synthetic@example\.test|SYNTHETICPASSPORT/i);
});
