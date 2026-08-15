import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPhEtravelInitialRegistrationPlan,
  PhEtravelInitialRegistrationError,
} from "../registration-start";
import type { PhEtravelPortalPayload } from "../normalize";

function payload(overrides: Partial<PhEtravelPortalPayload> = {}): PhEtravelPortalPayload {
  return {
    registrationFor: "FOR_ME",
    visaType: "PH_ETRAVEL_ARRIVAL_CARD",
    travelType: "ARRIVAL",
    transportType: "AIR",
    arrivalBranch: { transportType: "AIR", passportHolderType: "FOREIGNER", travellerType: "AIRCRAFT_PASSENGER" },
    registrationConsent: {
      accepted: true,
      acceptedAt: "2026-08-15T00:00:00.000Z",
      version: "ph-etravel-data-privacy-affidavit-v1",
      source: "viza_consent_audit_record",
    },
    ...overrides,
  } as PhEtravelPortalPayload;
}

test("Travel Registration selects the supplied ordinary AIR/ARRIVAL/FOR ME values", () => {
  const plan = buildPhEtravelInitialRegistrationPlan(payload());
  assert.deepEqual(plan.choices.map((choice) => [choice.key, choice.value]), [
    ["registration_for", "FOR_ME"],
    ["transport_type", "AIR"],
    ["travel_type", "ARRIVAL"],
  ]);
  assert.equal(plan.continuation, "ordinary_arrival");
});

test("Travel Registration selects FOR OTHER exactly, then requires an action checkpoint", () => {
  const plan = buildPhEtravelInitialRegistrationPlan(payload({
    registrationFor: "FOR_OTHER",
    transportType: "SEA",
    arrivalBranch: { transportType: "SEA", passportHolderType: "FOREIGNER", travellerType: "VESSEL_PASSENGER" },
  }));
  assert.equal(plan.choices[0]?.value, "FOR_OTHER");
  assert.equal(plan.choices[1]?.value, "SEA");
  assert.equal(plan.continuation, "for_other_action_required");
});

test("Travel Registration fails closed without audited Privacy/Affidavit consent or exact ARRIVAL", () => {
  assert.throws(
    () => buildPhEtravelInitialRegistrationPlan(payload({ registrationConsent: null })),
    (error: unknown) => error instanceof PhEtravelInitialRegistrationError && error.code === "ph_etravel_registration_consent_required",
  );
  assert.throws(
    () => buildPhEtravelInitialRegistrationPlan(payload({ travelType: "DEPARTURE" })),
    (error: unknown) => error instanceof PhEtravelInitialRegistrationError && error.code === "ph_etravel_arrival_choice_action_required",
  );
});
