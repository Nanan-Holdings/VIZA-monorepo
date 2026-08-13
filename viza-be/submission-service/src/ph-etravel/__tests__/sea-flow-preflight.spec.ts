import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPhEtravelSeaFlowActionPlan,
  PH_ETRAVEL_SEA_FLOW_NEEDS_REVIEW_KEYS,
} from "../sea-flow-preflight";
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
      transport_type: "SEA",
      traveller_type: "VESSEL_PASSENGER",
      has_baggage_or_currency_to_declare: "no",
      has_currency_to_declare: "no",
      has_currency_over_threshold: "no",
      ...countrySpecific,
    },
    metadata: {},
  };
}

test("E24 SEA action plan keeps false/default, port keys, dynamic gate, and route selection action-required", () => {
  const plan = buildPhEtravelSeaFlowActionPlan({
    transportType: "SEA",
    answers: {
      is_disembarking: "no",
      destination_port_code: "synthetic-destination-port",
      disembarking_port_code: "synthetic-disembarking-port",
    },
  });

  assert.equal(plan.status, "action_required");
  if (plan.status !== "action_required") throw new Error("SEA action plan must be applicable");
  assert.deepEqual(plan.canonicalKeys, [...PH_ETRAVEL_SEA_FLOW_NEEDS_REVIEW_KEYS]);
  assert.deepEqual(plan.actions, []);
  assert.deepEqual(plan.externalActions, {
    queue: "not_started",
    account: "not_started",
    browser: "not_started",
  });
  assert.equal(plan.officialResubmitAllowed, false);
  assert.equal(plan.disembarking.state, "false_or_default");
  assert.equal(plan.disembarking.staticDefault, false);
  assert.equal(plan.disembarking.visibleOnlyForSeaArrival, true);
  assert.equal(plan.disembarking.explicitFalseLiveServerAccepted, false);
  assert.deepEqual(plan.ports, {
    destinationPortKey: "destination_port_code",
    disembarkingPortKey: "disembarking_port_code",
    keysAreAliases: false,
    disembarkingPortDynamicOptionsLiveSemanticsUnverified: true,
    destinationPortToCustomsFlowMappingUnverified: true,
  });
  assert.equal(plan.dynamicPageGate.onlyControlsDynamicPageArrayInsertion, true);
  assert.equal(plan.dynamicPageGate.determinesManualOrElectronicCustomsFlow, false);
  assert.equal(plan.routes.routeSelectionLiveVerified, false);
  assert.equal(plan.routes.regularAndShortcutSequencesInterchangeable, false);
  assert.equal(plan.serverAcceptance, "unknown_do_not_infer");
  assert.doesNotMatch(JSON.stringify(plan), /synthetic-destination-port|synthetic-disembarking-port/i);
});

test("E24 SEA plan isolates AIR and preserves true/unknown disembarking as non-submitting states", () => {
  const air = buildPhEtravelSeaFlowActionPlan({ transportType: "AIR", answers: {} });
  const seaTrue = buildPhEtravelSeaFlowActionPlan({ transportType: "SEA", answers: { is_disembarking: "yes" } });
  const seaUnknown = buildPhEtravelSeaFlowActionPlan({ transportType: "SEA", answers: { is_disembarking: "maybe" } });

  assert.equal(air.status, "not_applicable");
  assert.deepEqual(air.actions, []);
  assert.equal(air.externalActions.browser, "not_started");
  assert.equal(seaTrue.status, "action_required");
  assert.equal(seaUnknown.status, "action_required");
  if (seaTrue.status === "action_required" && seaUnknown.status === "action_required") {
    assert.equal(seaTrue.disembarking.state, "true");
    assert.equal(seaUnknown.disembarking.state, "unknown");
    assert.equal(seaTrue.officialResubmitAllowed, false);
    assert.equal(seaUnknown.officialResubmitAllowed, false);
  }
});

test("E24 SEA preflight and envelope block false/default and route-port uncertainty without external action or PII", () => {
  const input = {
    payload: arrivalPayload({
      is_disembarking: "no",
      destination_port_code: "synthetic-destination-port",
      disembarking_port_code: "synthetic-disembarking-port",
      email_address: "synthetic@example.test",
      passport_number: "SYNTHETICPASSPORT",
    }),
    finalSubmitEnabled: false,
  };
  const preflight = evaluatePhEtravelArrivalLaunchPreflight(input);
  assert.notEqual(preflight.status, "allowed");
  if (preflight.status === "allowed") throw new Error("SEA S4 preflight must block");
  assert.ok(preflight.blockingCodes.includes("ph_etravel_launch_sea_disembarking_review_required"));
  assert.ok(preflight.blockingCodes.includes("ph_etravel_launch_sea_customs_flow_review_required"));
  assert.equal(PH_ETRAVEL_SEA_FLOW_NEEDS_REVIEW_KEYS.every((key) => preflight.missingKeys.includes(key)), true);
  assert.equal(preflight.officialResubmitAllowed, false);
  assert.doesNotMatch(JSON.stringify(preflight), /synthetic-destination-port|synthetic-disembarking-port|synthetic@example\.test|SYNTHETICPASSPORT/i);

  const envelope = evaluatePhEtravelArrivalLaunchPreflightEnvelope(input);
  assert.equal(envelope.status, "action_required");
  assert.equal(envelope.officialResubmitAllowed, false);
  assert.equal("queue" in envelope, false);
  assert.equal("browser" in envelope, false);
  assert.equal("submitted" in envelope, false);
  assert.doesNotMatch(JSON.stringify(envelope), /synthetic-destination-port|synthetic-disembarking-port|synthetic@example\.test|SYNTHETICPASSPORT/i);
});
