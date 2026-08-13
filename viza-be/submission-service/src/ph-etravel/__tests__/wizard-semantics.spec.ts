import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyPhEtravelPostSignatureSemantic,
  guardPhEtravelPostSignatureWizardStep,
  resolvePhEtravelWizardRoute,
} from "../wizard-semantics";

test("E15 resolves regular and declaration wizard routes without using wizard_page as a semantic key", () => {
  assert.equal(
    resolvePhEtravelWizardRoute("https://etravel.gov.ph/wizard/me?wizard_page=1"),
    "regular_me",
  );
  assert.equal(
    resolvePhEtravelWizardRoute("https://etravel.gov.ph/wizard/me?wizard_page=17"),
    "regular_me",
  );
  assert.equal(
    resolvePhEtravelWizardRoute("https://etravel.gov.ph/wizard/declaration?wizard_page=3"),
    "declaration",
  );
  assert.equal(resolvePhEtravelWizardRoute("https://etravel.gov.ph/wizard/unknown?wizard_page=6"), "unknown");
});

test("E15 regular SEA electronic No sequence is action-only and reaches Summary only in observed order", () => {
  const signature = guardPhEtravelPostSignatureWizardStep({
    route: "regular_me",
    evidencePath: "sea_electronic_no_live",
    semantic: "signature",
    previous: [],
  });
  const family = guardPhEtravelPostSignatureWizardStep({
    route: "regular_me",
    evidencePath: "sea_electronic_no_live",
    semantic: "family",
    previous: ["signature"],
  });
  const noCompanion = guardPhEtravelPostSignatureWizardStep({
    route: "regular_me",
    evidencePath: "sea_electronic_no_live",
    semantic: "no_companion_confirmation",
    previous: ["signature", "family"],
  });
  const summary = guardPhEtravelPostSignatureWizardStep({
    route: "regular_me",
    evidencePath: "sea_electronic_no_live",
    semantic: "summary",
    previous: ["signature", "family", "no_companion_confirmation"],
  });
  const directSummary = guardPhEtravelPostSignatureWizardStep({
    route: "regular_me",
    evidencePath: "sea_electronic_no_live",
    semantic: "summary",
    previous: [],
  });

  assert.deepEqual(signature, { status: "action_required", code: "ph_etravel_signature_required" });
  assert.deepEqual(family, { status: "action_required", code: "ph_etravel_family_member_action_required" });
  assert.deepEqual(noCompanion, { status: "action_required", code: "ph_etravel_family_companion_confirmation" });
  assert.deepEqual(summary, { status: "review_stop_only" });
  assert.deepEqual(directSummary, { status: "action_required", code: "ph_etravel_wizard_route_sequence_unverified" });
});

test("E15 declaration route never inherits regular Family flow and unknown route fails closed", () => {
  const declarationFamily = guardPhEtravelPostSignatureWizardStep({
    route: "declaration",
    evidencePath: "sea_electronic_no_live",
    semantic: "family",
    previous: ["signature"],
  });
  const unknownSummary = guardPhEtravelPostSignatureWizardStep({
    route: "unknown",
    evidencePath: "sea_electronic_no_live",
    semantic: "summary",
    previous: ["signature", "family", "no_companion_confirmation"],
  });

  assert.deepEqual(declarationFamily, { status: "action_required", code: "ph_etravel_wizard_route_sequence_unverified" });
  assert.deepEqual(unknownSummary, { status: "action_required", code: "ph_etravel_wizard_route_unverified" });
});

test("E15 SEA electronic positive post-signature remains evidence-pending and contract output is data-safe", () => {
  const pending = guardPhEtravelPostSignatureWizardStep({
    route: "regular_me",
    evidencePath: "sea_electronic_positive_pending",
    semantic: "family",
    previous: ["signature"],
  });
  const serialized = JSON.stringify(pending);

  assert.deepEqual(pending, {
    status: "action_required",
    code: "sea_electronic_positive_post_signature_evidence_pending",
  });
  for (const unsafe of ["@", "otp", "token", "cookie", "passport", "data:image/png"]) {
    assert.equal(serialized.toLowerCase().includes(unsafe), false);
  }
});

test("E15 page semantic classifier uses page meaning rather than a numeric wizard index", () => {
  assert.equal(
    classifyPhEtravelPostSignatureSemantic(
      "wizard_page=42 Family Member(s) Travel declarations will also be generated for selected family members.",
    ),
    "family",
  );
  assert.equal(
    classifyPhEtravelPostSignatureSemantic(
      "wizard_page=1 You haven't selected any family members. Are you sure you're not traveling with a companion?",
    ),
    "no_companion_confirmation",
  );
  assert.equal(
    classifyPhEtravelPostSignatureSemantic(
      "wizard_page=99 New Travel Declaration Summary Kindly double check the information before submitting. Submit",
    ),
    "summary",
  );
});
