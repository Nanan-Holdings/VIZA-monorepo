import assert from "node:assert/strict";
import test from "node:test";
import { verifyOfficialReview, type ReviewExpectation, type ReviewSnapshot } from "../review-verification";

const expectations: ReviewExpectation[] = [
  { section: "previous_us_travel", fieldName: "has_been_in_us", controlId: "ctl00_cphMain_rblPREV_US_TRAVEL_IND_0", value: "No" },
  { section: "passport", fieldName: "passport_number", controlId: "ctl00_cphMain_tbxPASSPORT_NUMBER", value: "P1234567" },
];

const snapshot = (values: Array<{ id: string; text: string }>): ReviewSnapshot => ({
  url: "https://ceac.state.gov/GenNIV/General/review/review_reviewpersonal.aspx?node=ReviewPersonal",
  applicationId: "AA00000000",
  values,
});

test("matches exact semantic IDs across ASP.NET/input-kind prefixes and normalized display text", () => {
  const result = verifyOfficialReview(expectations, [snapshot([
    { id: "ctl00_cphMain_lblPREV_US_TRAVEL_IND", text: "  NO " },
    { id: "ctl00_cphMain_lblPASSPORT_NUMBER", text: "P1234567" },
  ])]);
  assert.deepEqual(result, { status: "passed", matched: 2, issues: [] });
});

test("fails closed for a known value mismatch", () => {
  const result = verifyOfficialReview(expectations, [snapshot([
    { id: "ctl00_cphMain_lblPREV_US_TRAVEL_IND", text: "Yes" },
    { id: "ctl00_cphMain_lblPASSPORT_NUMBER", text: "P1234567" },
  ])]);
  assert.equal(result.status, "failed");
  assert.equal(result.matched, 1);
  assert.deepEqual(result.issues, [{ fieldName: "has_been_in_us", reason: "review_value_mismatch" }]);
});

test("ignores decorative observed IDs but keeps missing and ambiguous expected fields unverified", () => {
  const result = verifyOfficialReview(expectations, [snapshot([
    { id: "layout_heading", text: "Review" },
    { id: "ctl00_cphMain_lblPREV_US_TRAVEL_IND", text: "No" },
  ])]);
  assert.equal(result.status, "unverified");
  assert.equal(result.matched, 1);
  assert.ok(!result.issues.some((issue) => issue.reason === "unknown_observed_id"));
  assert.ok(result.issues.some((issue) => issue.reason === "missing_observed_value"));
});

test("treats repeated radio suffixes as part of the rbl control kind only", () => {
  const result = verifyOfficialReview([
    { section: "previous_us_travel", fieldName: "has_been_in_us", controlId: "rblPREV_US_TRAVEL_IND_1", value: "No" },
  ], [snapshot([{ id: "lblPREV_US_TRAVEL_IND", text: "No" }])]);
  assert.deepEqual(result, { status: "passed", matched: 1, issues: [] });
  const textControl = verifyOfficialReview([
    { section: "passport", fieldName: "passport_number", controlId: "tbxPASSPORT_NUMBER_1", value: "P1234567" },
  ], [snapshot([{ id: "lblPASSPORT_NUMBER", text: "P1234567" }])]);
  assert.equal(textControl.status, "unverified");
});

test("empty expectations or snapshots can never pass", () => {
  assert.equal(verifyOfficialReview([], [snapshot([])]).status, "unverified");
  assert.equal(verifyOfficialReview(expectations, []).status, "unverified");
});
