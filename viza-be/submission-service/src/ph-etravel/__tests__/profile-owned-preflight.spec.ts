import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPhEtravelProfileOwnedActionPlan,
  PH_ETRAVEL_ARRIVAL_EVIDENCE_COUNTS,
  PH_ETRAVEL_PROFILE_OWNED_NEEDS_REVIEW_KEYS,
  PH_ETRAVEL_RESIDENCE_NEEDS_REVIEW_KEYS,
} from "../profile-owned-preflight";
import { evaluatePhEtravelArrivalLaunchPreflight } from "../launch-preflight";
import { evaluatePhEtravelArrivalLaunchPreflightEnvelope } from "../launch-preflight-envelope";
import { fillPhEtravelOfficialDeclaration, PhEtravelFormFillError } from "../form-filler";
import type { SubmissionPayload } from "../../country-submissions/types";
import type { Page } from "@playwright/test";
import type { PhEtravelPortalPayload } from "../normalize";

function arrivalPayload(): SubmissionPayload {
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
    },
    metadata: {},
  };
}

test("E21 profile-owned action plan preserves the 56/19/36/8 evidence fixture", () => {
  assert.deepEqual(PH_ETRAVEL_ARRIVAL_EVIDENCE_COUNTS, {
    canonical: 111,
    confirmedLive: 56,
    verifiedPublicBundle: 19,
    needsReview: 36,
    divertedUnsupported: 8,
  });
  assert.equal(new Set(PH_ETRAVEL_PROFILE_OWNED_NEEDS_REVIEW_KEYS).size, 3);
  assert.equal(new Set(PH_ETRAVEL_RESIDENCE_NEEDS_REVIEW_KEYS).size, 7);
  const profileKeys: readonly string[] = PH_ETRAVEL_PROFILE_OWNED_NEEDS_REVIEW_KEYS;
  assert.equal(profileKeys.includes("traveller.first_name"), false);
  assert.equal(profileKeys.includes("traveller.sex"), false);
});

test("E21 profile-owned client wiring remains action-required with zero queue, account, browser, or submit actions", () => {
  const plan = buildPhEtravelProfileOwnedActionPlan();

  assert.equal(plan.owner, "profile_owned");
  assert.equal(plan.evidence, "verified_public_bundle");
  assert.equal(plan.status, "action_required");
  assert.deepEqual(plan.actions, []);
  assert.deepEqual(plan.externalActions, {
    queue: "not_started",
    account: "not_started",
    browser: "not_started",
  });
  assert.equal(plan.officialResubmitAllowed, false);
  assert.equal(plan.photoUploadResultIsApplicantAnswer, false);
  assert.equal(plan.genericFiveMbDefaultIsProfileServerRule, false);
  assert.equal(plan.mobilePhPresetIsServerAcceptance, false);
  assert.equal(plan.residenceCascadeIsServerAcceptance, false);
  assert.equal("finalSubmit" in plan, false);
  assert.equal("photoFile" in plan, false);
});

test("E21 unknown profile-owned gaps remain P0 preflight blockers and produce a PII-free envelope", () => {
  const input = { payload: arrivalPayload(), finalSubmitEnabled: false };
  const preflight = evaluatePhEtravelArrivalLaunchPreflight(input);
  assert.notEqual(preflight.status, "allowed");
  if (preflight.status === "allowed") throw new Error("profile-owned P0 gate must block");
  assert.ok(preflight.blockingCodes.includes("ph_etravel_launch_profile_persona_review_required"));
  assert.ok(preflight.blockingCodes.includes("ph_etravel_launch_residence_review_required"));
  assert.deepEqual(
    preflight.missingKeys.filter((key) =>
      key.startsWith("profile.") || key.startsWith("traveller.mobile") || key === "traveller.passenger_type" || key.startsWith("residence."),
    ),
    [...PH_ETRAVEL_PROFILE_OWNED_NEEDS_REVIEW_KEYS, ...PH_ETRAVEL_RESIDENCE_NEEDS_REVIEW_KEYS].sort(),
  );

  const envelope = evaluatePhEtravelArrivalLaunchPreflightEnvelope(input);
  assert.equal(envelope.officialResubmitAllowed, false);
  assert.doesNotMatch(JSON.stringify(envelope), /synthetic-app|@|passport|selector|upload/i);
});

test("E21 direct arrival filler guard stops before reading a browser page", async () => {
  const page = new Proxy({}, {
    get() {
      throw new Error("browser must not be read");
    },
  }) as Page;
  const payload = { travelType: "ARRIVAL" } as PhEtravelPortalPayload;

  await assert.rejects(
    () => fillPhEtravelOfficialDeclaration(page, payload, { stopBeforeSubmit: true }),
    (error: unknown) => error instanceof PhEtravelFormFillError &&
      error.code === "ph_etravel_launch_profile_persona_review_required",
  );
});
