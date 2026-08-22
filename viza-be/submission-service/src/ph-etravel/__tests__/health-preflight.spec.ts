import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPhEtravelHealthActionPlan,
  phEtravelHealthPositiveBranchPresent,
  PH_ETRAVEL_HEALTH_S3_GAPS,
  PH_ETRAVEL_HEALTH_S3_NEEDS_REVIEW_KEYS,
} from "../health-preflight";
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

test("E23 Health plan preserves five S3 gaps and maps static rendered branches without actions", () => {
  const plan = buildPhEtravelHealthActionPlan({
    with_negative_antigen: "yes",
    has_recent_travel_history_30d: "yes",
    has_exposure_to_sick_person_30d: "yes",
    has_been_sick_30d: "yes",
    visited_country_30d: "synthetic-country-value",
    sickness_symptom: "synthetic-symptom-value",
  });

  assert.equal(plan.status, "action_required");
  assert.equal(plan.gaps.length, 5);
  assert.deepEqual(plan.gaps.map((gap) => gap.id), PH_ETRAVEL_HEALTH_S3_GAPS.map((gap) => gap.id));
  assert.deepEqual(plan.canonicalKeys, [...PH_ETRAVEL_HEALTH_S3_NEEDS_REVIEW_KEYS]);
  assert.deepEqual(plan.actions, []);
  assert.deepEqual(plan.externalActions, {
    queue: "not_started",
    account: "not_started",
    browser: "not_started",
  });
  assert.equal(plan.officialResubmitAllowed, false);
  assert.equal(plan.renderedControls.negativeAntigen.clientVisibility, "NOT_FULLY_VACCINATED_AND_AGE_AT_LEAST_15");
  assert.equal(plan.renderedControls.negativeAntigen.vaccinationAndAgeAreNotHealthApplicantQuestions, true);
  assert.equal(plan.renderedControls.negativeAntigen.noDocumentOrUploadAction, true);
  assert.equal(plan.renderedControls.recentTravel.positiveBranchPresent, true);
  assert.equal(plan.renderedControls.recentTravel.clientNoClearsVisitedCountries, true);
  assert.equal(plan.renderedControls.exposure.positiveBranchPresent, true);
  assert.equal(plan.renderedControls.sickness.positiveBranchPresent, true);
  assert.equal(plan.renderedControls.sickness.clientChangeClearsSymptoms, true);
  assert.equal(plan.staticHandlerPayloadMapping, "unknown_do_not_infer");
  assert.equal(plan.transportPersonaParity.airSeaLiveVerified, false);
  assert.equal(plan.transportPersonaParity.filipinoForeignerLiveVerified, false);
  assert.doesNotMatch(JSON.stringify(plan), /synthetic-country-value|synthetic-symptom-value/i);
});

test("E23 negative branches retain client clear facts while bats or sick animals stays translation-only", () => {
  const plan = buildPhEtravelHealthActionPlan({
    with_negative_antigen: "no",
    has_recent_travel_history_30d: "no",
    has_exposure_to_sick_person_30d: "no",
    has_been_sick_30d: "no",
    visited_country_30d: "stale-country-value",
    sickness_symptom: "stale-symptom-value",
    exposed_to_bats_or_sick_animals: "yes",
  });

  assert.equal(plan.renderedControls.recentTravel.positiveBranchPresent, false);
  assert.equal(plan.renderedControls.sickness.positiveBranchPresent, false);
  assert.deepEqual(plan.translationOnly.batsOrSickAnimals, {
    renderedCurrentComponent: false,
    generatesBrowserAction: false,
    generatesOfficialPayloadAction: false,
  });
  assert.equal(plan.gaps.find((gap) => gap.id === "bats_or_sick_animals_translation_only")?.status, "translation_only_not_actionable");
  assert.equal(phEtravelHealthPositiveBranchPresent({ exposed_to_bats_or_sick_animals: "yes" }), false);
  assert.equal(phEtravelHealthPositiveBranchPresent({ has_been_sick_30d: "yes" }), true);
  assert.doesNotMatch(JSON.stringify(plan), /stale-country-value|stale-symptom-value/i);
});

test("E23 Health positive preflight stays PII-free and cannot start queue, browser, submit, or resubmit", () => {
  const input = {
    payload: arrivalPayload({
      with_negative_antigen: "yes",
      has_recent_travel_history_30d: "yes",
      visited_country_30d: "synthetic-country-value",
      has_been_sick_30d: "yes",
      sickness_symptom: "synthetic-symptom-value",
      email_address: "synthetic@example.test",
      passport_number: "SYNTHETICPASSPORT",
    }),
    finalSubmitEnabled: false,
  };
  const preflight = evaluatePhEtravelArrivalLaunchPreflight(input);
  assert.notEqual(preflight.status, "allowed");
  if (preflight.status === "allowed") throw new Error("Health S3 preflight must block");
  assert.ok(preflight.blockingCodes.includes("ph_etravel_launch_health_positive_review_required"));
  assert.equal(
    PH_ETRAVEL_HEALTH_S3_NEEDS_REVIEW_KEYS.every((key) => preflight.missingKeys.includes(key)),
    true,
  );
  assert.equal(preflight.officialResubmitAllowed, false);
  assert.doesNotMatch(JSON.stringify(preflight), /synthetic-country-value|synthetic-symptom-value|synthetic@example\.test|SYNTHETICPASSPORT/i);

  const envelope = evaluatePhEtravelArrivalLaunchPreflightEnvelope(input);
  assert.equal(envelope.status, "action_required");
  assert.equal(envelope.officialResubmitAllowed, false);
  assert.equal("queue" in envelope, false);
  assert.equal("browser" in envelope, false);
  assert.equal("submitted" in envelope, false);
  assert.doesNotMatch(JSON.stringify(envelope), /synthetic-country-value|synthetic-symptom-value|synthetic@example\.test|SYNTHETICPASSPORT/i);
});
