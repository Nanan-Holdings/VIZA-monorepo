import assert from "node:assert/strict";
import test from "node:test";

import {
  createPhEtravelLaunchPreflightEnvelope,
  evaluatePhEtravelArrivalLaunchPreflightEnvelope,
  parsePhEtravelLaunchPreflightEnvelope,
  PH_ETRAVEL_LAUNCH_PREFLIGHT_CONTRACT_VERSION,
} from "../launch-preflight-envelope";
import type { SubmissionPayload } from "../../country-submissions/types";

const fallback = {
  contractVersion: PH_ETRAVEL_LAUNCH_PREFLIGHT_CONTRACT_VERSION,
  status: "action_required",
  code: "ph_etravel_launch_final_result_recovery_required",
  blockingCodes: ["ph_etravel_launch_final_result_recovery_required"],
  canonicalKeys: ["result.official_reference", "result.reference_qr_render"],
  officialResubmitAllowed: false,
} as const;

function payload(countrySpecific: Record<string, string> = {}): SubmissionPayload {
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

test("PH preflight envelope publishes the PH-D v1 shape with stable, PII-free action-required fields", () => {
  const result = evaluatePhEtravelArrivalLaunchPreflightEnvelope({
    payload: payload({
      has_currency_to_declare: "yes",
      passport_number: "SYNTHETICPASSPORT",
      email_address: "synthetic@example.test",
    }),
    finalSubmitEnabled: false,
  });

  assert.equal(result.contractVersion, "ph_etravel_launch_preflight_v1");
  assert.equal(result.status, "action_required");
  assert.equal(result.code, "ph_etravel_launch_air_travel_review_required");
  assert.deepEqual(result.blockingCodes, [...result.blockingCodes].sort());
  assert.deepEqual(result.canonicalKeys, [...result.canonicalKeys].sort());
  assert.equal(new Set(result.blockingCodes).size, result.blockingCodes.length);
  assert.equal(new Set(result.canonicalKeys).size, result.canonicalKeys.length);
  assert.equal(result.officialResubmitAllowed, false);
  assert.doesNotMatch(JSON.stringify(result), /SYNTHETICPASSPORT|synthetic@example\.test/i);
});

test("PH preflight envelope preserves allowed as non-submitted, stop-before-submit data only", () => {
  const result = createPhEtravelLaunchPreflightEnvelope({
    status: "allowed",
    blockingCodes: [],
    missingKeys: [],
    officialResubmitAllowed: false,
  });

  assert.deepEqual(result, {
    contractVersion: PH_ETRAVEL_LAUNCH_PREFLIGHT_CONTRACT_VERSION,
    status: "allowed",
    code: undefined,
    blockingCodes: [],
    canonicalKeys: [],
    officialResubmitAllowed: false,
  });
  assert.equal("submitted" in result, false);
  assert.equal("queue" in result, false);
  assert.equal("browser" in result, false);
});

test("PH preflight envelope keeps diverted code and only its canonical eligibility key", () => {
  const result = createPhEtravelLaunchPreflightEnvelope({
    status: "diverted",
    code: "ph_etravel_arrival_diverted_unsupported",
    blockingCodes: ["ph_etravel_arrival_diverted_unsupported"],
    missingKeys: ["eligibility.ordinary_arrival"],
    officialResubmitAllowed: false,
  });

  assert.deepEqual(result, {
    contractVersion: PH_ETRAVEL_LAUNCH_PREFLIGHT_CONTRACT_VERSION,
    status: "diverted",
    code: "ph_etravel_arrival_diverted_unsupported",
    blockingCodes: ["ph_etravel_arrival_diverted_unsupported"],
    canonicalKeys: ["eligibility.ordinary_arrival"],
    officialResubmitAllowed: false,
  });
});

test("PH preflight envelope deterministically de-duplicates and sorts legacy action-required input", () => {
  const result = createPhEtravelLaunchPreflightEnvelope({
    status: "action_required",
    code: "ph_etravel_launch_air_travel_review_required",
    blockingCodes: [
      "ph_etravel_launch_residence_review_required",
      "ph_etravel_launch_air_travel_review_required",
      "ph_etravel_launch_air_travel_review_required",
    ],
    missingKeys: [
      "residence.country_code",
      "air.flight_number",
      "air.airline_code",
      "air.flight_number",
    ],
    officialResubmitAllowed: false,
  });

  assert.deepEqual(result.blockingCodes, [
    "ph_etravel_launch_air_travel_review_required",
    "ph_etravel_launch_residence_review_required",
  ]);
  assert.deepEqual(result.canonicalKeys, [
    "air.airline_code",
    "air.flight_number",
    "residence.country_code",
  ]);
});

test("PH preflight envelope fails closed for invalid version, status, code, keys, resubmit, or raw payload", () => {
  const invalid = [
    { ...fallback, contractVersion: "ph_etravel_launch_preflight_v0" },
    { ...fallback, status: "submitted" },
    { ...fallback, code: "unknown_code", blockingCodes: ["unknown_code"] },
    { ...fallback, canonicalKeys: ["unknown.key"] },
    { ...fallback, blockingCodes: [...fallback.blockingCodes, ...fallback.blockingCodes] },
    { ...fallback, canonicalKeys: [...fallback.canonicalKeys].reverse() },
    { ...fallback, officialResubmitAllowed: true },
    { ...fallback, rawOfficialMessage: "synthetic person passport P1234567" },
  ];

  for (const input of invalid) {
    const result = parsePhEtravelLaunchPreflightEnvelope(input);
    assert.deepEqual(result, fallback);
    assert.doesNotMatch(JSON.stringify(result), /P1234567|rawOfficialMessage/i);
  }
});

test("PH preflight envelope never calls external actions for a blocked preflight", () => {
  const result = createPhEtravelLaunchPreflightEnvelope({
    status: "action_required",
    code: "ph_etravel_launch_final_result_recovery_required",
    blockingCodes: ["ph_etravel_launch_final_result_recovery_required"],
    missingKeys: ["result.reference_qr_render", "result.official_reference"],
    officialResubmitAllowed: false,
  });

  assert.deepEqual(result, fallback);
  assert.equal("account" in result, false);
  assert.equal("browser" in result, false);
  assert.equal("rpc" in result, false);
  assert.equal(result.officialResubmitAllowed, false);
});
