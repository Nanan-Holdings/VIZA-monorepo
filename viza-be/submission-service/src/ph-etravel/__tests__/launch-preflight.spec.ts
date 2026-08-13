import assert from "node:assert/strict";
import test from "node:test";

import { evaluatePhEtravelArrivalLaunchPreflight } from "../launch-preflight";
import { safePhEtravelErrorSummary } from "../error-safety";
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
      has_recent_travel_history_30d: "no",
      has_exposure_to_sick_person_30d: "no",
      has_been_sick_30d: "no",
      ...countrySpecific,
    },
    metadata: {},
  };
}

function blockingCodes(result: ReturnType<typeof evaluatePhEtravelArrivalLaunchPreflight>): string[] {
  assert.notEqual(result.status, "allowed");
  return result.blockingCodes;
}

function missingKeys(result: ReturnType<typeof evaluatePhEtravelArrivalLaunchPreflight>): string[] {
  assert.notEqual(result.status, "allowed");
  return result.missingKeys;
}

test("E17 AIR baseline remains fail-closed only on applicable P0 groups", () => {
  const result = evaluatePhEtravelArrivalLaunchPreflight({
    payload: arrivalPayload(),
    finalSubmitEnabled: false,
  });

  assert.equal(result.status, "action_required");
  assert.ok(blockingCodes(result).includes("ph_etravel_launch_profile_persona_review_required"));
  assert.ok(blockingCodes(result).includes("ph_etravel_launch_residence_review_required"));
  assert.ok(blockingCodes(result).includes("ph_etravel_launch_air_travel_review_required"));
  assert.equal(blockingCodes(result).includes("ph_etravel_launch_health_positive_review_required"), false);
  assert.equal(blockingCodes(result).includes("ph_etravel_launch_sea_customs_flow_review_required"), false);
  assert.equal(blockingCodes(result).includes("ph_etravel_launch_currency_positive_review_required"), false);
  assert.equal(result.officialResubmitAllowed, false);
  for (const code of blockingCodes(result)) {
    assert.equal(safePhEtravelErrorSummary({ code }).code, code);
  }
});

test("E17 blocks AIR Special Flight and positive Health with canonical keys only", () => {
  const result = evaluatePhEtravelArrivalLaunchPreflight({
    payload: arrivalPayload({
      is_special_flight: "yes",
      special_flight_number: "synthetic-flight-value",
      has_recent_travel_history_30d: "yes",
      visited_country_30d: "synthetic-country-value",
    }),
    finalSubmitEnabled: false,
  });

  assert.ok(blockingCodes(result).includes("ph_etravel_launch_air_special_flight_review_required"));
  assert.ok(blockingCodes(result).includes("ph_etravel_launch_health_positive_review_required"));
  assert.ok(missingKeys(result).includes("air.special_flight_number"));
  assert.ok(missingKeys(result).includes("health.visited_countries_30d"));
  assert.doesNotMatch(JSON.stringify(result), /synthetic-flight-value|synthetic-country-value/);
});

test("E17 SEA false/manual-or-electronic and positive customs paths remain isolated and deduplicated", () => {
  const result = evaluatePhEtravelArrivalLaunchPreflight({
    payload: arrivalPayload({
      transport_type: "SEA",
      traveller_type: "VESSEL_PASSENGER",
      is_disembarking: "no",
      has_baggage_or_currency_to_declare: "yes",
      has_currency_to_declare: "yes",
      customs_checklist_1: "yes",
      customs_checklist_12: "yes",
      customs_signature_file: "synthetic-file-marker",
    }),
    finalSubmitEnabled: false,
  });

  assert.ok(blockingCodes(result).includes("ph_etravel_launch_sea_disembarking_review_required"));
  assert.ok(blockingCodes(result).includes("ph_etravel_launch_sea_customs_flow_review_required"));
  assert.ok(blockingCodes(result).includes("ph_etravel_launch_sea_electronic_positive_review_required"));
  assert.ok(blockingCodes(result).includes("ph_etravel_launch_currency_positive_review_required"));
  assert.ok(blockingCodes(result).includes("ph_etravel_launch_attachment_review_required"));
  assert.equal(new Set(blockingCodes(result)).size, blockingCodes(result).length);
  assert.equal(new Set(missingKeys(result)).size, missingKeys(result).length);
  assert.doesNotMatch(JSON.stringify(result), /synthetic-file-marker/);
});

test("E17 diverts crew, cruise, special, and official-exemption personas before any launch", () => {
  for (const countrySpecific of [
    { traveller_type: "FLIGHT CREW" },
    { is_crew_member: "yes" },
    { traveller_type: "CRUISE PASSENGER" },
    { is_cruise_registration: "yes" },
    { is_special_registration: "yes" },
    { foreign_diplomat_or_dependent: "yes" },
    { is_foreign_diplomat_or_dependent: "yes" },
    { foreign_dignitary_delegation: "yes" },
    { is_foreign_dignitary_or_delegation: "yes" },
    { has_9e_visa: "yes" },
    { diplomatic_passport_holder: "yes" },
    { has_diplomatic_passport: "yes" },
    { service_passport_holder: "yes" },
    { has_official_or_service_passport: "yes" },
  ] as Array<Record<string, string>>) {
    const result = evaluatePhEtravelArrivalLaunchPreflight({
      payload: arrivalPayload(countrySpecific),
      finalSubmitEnabled: false,
    });
    assert.equal(result.status, "diverted");
    assert.equal(result.code, "ph_etravel_arrival_diverted_unsupported");
    assert.equal(result.officialResubmitAllowed, false);
  }
});

test("E17 keeps FOR OTHER, final-result recovery, restart, and non-arrival scope fail-closed without a resubmit", () => {
  const input = {
    payload: arrivalPayload({ registration_for: "FOR_OTHER" }),
    finalSubmitEnabled: true,
    existingResultRequiresRecovery: true,
  };
  const first = evaluatePhEtravelArrivalLaunchPreflight(input);
  const restarted = evaluatePhEtravelArrivalLaunchPreflight(input);
  assert.deepEqual(restarted, first);
  assert.ok(blockingCodes(first).includes("ph_etravel_arrival_for_other_action_required"));
  assert.ok(blockingCodes(first).includes("ph_etravel_launch_final_result_recovery_required"));
  assert.equal(first.officialResubmitAllowed, false);

  const departure = evaluatePhEtravelArrivalLaunchPreflight({
    payload: { ...arrivalPayload(), visaType: "PH_ETRAVEL_DEPARTURE_CARD" },
    finalSubmitEnabled: true,
  });
  assert.deepEqual(departure, {
    status: "allowed",
    blockingCodes: [],
    missingKeys: [],
    officialResubmitAllowed: false,
  });
});

test("E17 preflight output never includes PII-shaped answer values", () => {
  const result = evaluatePhEtravelArrivalLaunchPreflight({
    payload: arrivalPayload({
      email_address: "synthetic@example.test",
      passport_number: "SYNTHETICPASSPORT",
      currency_owner_first_name: "synthetic-owner",
      has_currency_to_declare: "yes",
    }),
    finalSubmitEnabled: false,
  });
  assert.doesNotMatch(JSON.stringify(result), /synthetic@example\.test|SYNTHETICPASSPORT|synthetic-owner/i);
});
