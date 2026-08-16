import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyPhEtravelPortalWorkflowState,
  resolvePhEtravelProfileCheckpoint,
} from "../runner";

test("classifies Personal Information Review as profile save, not registration final review", () => {
  assert.equal(
    classifyPhEtravelPortalWorkflowState("Personal Information Review\nKindly double check your information\nSubmit"),
    "profile_review_ready",
  );
});

test("keeps profile dashboard and eTravel registration review as distinct states", () => {
  assert.equal(
    classifyPhEtravelPortalWorkflowState("Dashboard\nNew Travel Declaration\nTravel History"),
    "profile_saved_dashboard",
  );
  assert.equal(
    classifyPhEtravelPortalWorkflowState("eTravel Registration Review\nFinal Declaration\nSubmit"),
    "etravel_registration_review_ready",
  );
});

test("a restart can resume only from a profile-saved dashboard, never from profile review", () => {
  assert.equal(
    resolvePhEtravelProfileCheckpoint("Dashboard\nNew Travel Declaration\nTravel History"),
    "profile_saved",
  );
  assert.equal(
    resolvePhEtravelProfileCheckpoint("Personal Information Review\nSubmit"),
    "profile_review_ready",
  );
  assert.equal(resolvePhEtravelProfileCheckpoint("Submit"), "unknown");
});

test("an HTTP status or generic Submit label cannot classify a workflow as submitted", () => {
  assert.equal(classifyPhEtravelPortalWorkflowState("HTTP 200\nSubmit"), "other");
  assert.equal(classifyPhEtravelPortalWorkflowState("Success\nRedirected"), "other");
});
