import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import test from "node:test";
import { chromium } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  captureOfficialReviewPage,
  verifyOfficialReview,
  type ReviewExpectation,
  type ReviewSnapshot,
} from "../review-verification";

const APPLICATION_ID = "AA00TEST1234";

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

test("allows an explicitly verified empty expected value only when the observed value is empty", () => {
  const emptyExpectation: ReviewExpectation = {
    section: "address_and_phone",
    fieldName: "home_address_line2",
    controlId: "ctl00_cphMain_tbxAPP_ADDR_LN2",
    value: "",
    allowEmptyValue: true,
  };

  assert.deepEqual(
    verifyOfficialReview([emptyExpectation], [snapshot([
      { id: "ctl00_cphMain_lblAPP_ADDR_LN2", text: "" },
    ])]),
    { status: "passed", matched: 1, issues: [] },
  );

  const nonEmptyObserved = verifyOfficialReview([emptyExpectation], [snapshot([
    { id: "ctl00_cphMain_lblAPP_ADDR_LN2", text: "OLD VALUE" },
  ])]);
  assert.equal(nonEmptyObserved.status, "failed");
  assert.deepEqual(nonEmptyObserved.issues, [
    { fieldName: "home_address_line2", reason: "review_value_mismatch" },
  ]);

  const unmarkedEmpty = verifyOfficialReview([{
    ...emptyExpectation,
    allowEmptyValue: undefined,
  }], [snapshot([
    { id: "ctl00_cphMain_lblAPP_ADDR_LN2", text: "" },
  ])]);
  assert.equal(unmarkedEmpty.status, "unverified");
  assert.deepEqual(unmarkedEmpty.issues, [
    { fieldName: "home_address_line2", reason: "empty_expected_value" },
  ]);

  const missingObserved = verifyOfficialReview([emptyExpectation], [snapshot([])]);
  assert.equal(missingObserved.status, "unverified");
  assert.deepEqual(missingObserved.issues, [
    { fieldName: "home_address_line2", reason: "missing_observed_value" },
  ]);
});

test("shares one comparison for identical physical-control aliases", () => {
  const result = verifyOfficialReview([
    {
      section: "travel",
      fieldName: "who_is_paying",
      controlId: "ctl00_cphMain_ddlWhoIsPaying",
      value: " Self ",
    },
    {
      section: "travel",
      fieldName: "travel_payer",
      controlId: "ctl00_cphMain_ddlWhoIsPaying",
      value: "self",
    },
  ], [snapshot([
    { id: "ctl00_cphMain_lblWhoIsPaying", text: "SELF" },
  ])]);

  assert.deepEqual(result, { status: "passed", matched: 2, issues: [] });
});

test("keeps semantic-ID collisions blocked when an alias comparison differs", () => {
  const base: ReviewExpectation = {
    section: "travel",
    fieldName: "who_is_paying",
    controlId: "ctl00_cphMain_ddlWhoIsPaying",
    value: "self",
  };
  const observed = [snapshot([{ id: "ctl00_cphMain_lblWhoIsPaying", text: "self" }])];

  for (const [label, conflicting] of [
    ["value", { ...base, fieldName: "travel_payer", value: "sponsor" }],
    ["section", { ...base, fieldName: "travel_payer", section: "passport" }],
    ["raw control ID", { ...base, fieldName: "travel_payer", controlId: "ddlWhoIsPaying" }],
    ["allow-empty semantics", { ...base, fieldName: "travel_payer", value: "", allowEmptyValue: true }],
  ] as const) {
    const result = verifyOfficialReview([base, conflicting], observed);
    assert.equal(result.status, "unverified", label);
    assert.equal(result.matched, 1, label);
    assert.deepEqual(result.issues, [
      { fieldName: "travel_payer", reason: "duplicate_expectation_id" },
    ], label);
  }
});

async function openReviewFixture(
  page: import("@playwright/test").Page,
  body: string,
): Promise<void> {
  await page.route("https://ceac.state.gov/**", route => route.fulfill({
    status: 200,
    contentType: "text/html",
    body,
  }));
  await page.goto(
    "https://ceac.state.gov/GenNIV/General/review/review_reviewpersonal.aspx?node=ReviewPersonal",
    { waitUntil: "domcontentloaded" },
  );
}

test("waits for a delayed Review Application ID and keeps official identity", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const outputDir = mkdtempSync(join(tmpdir(), "ceac-review-capture-"));
  try {
    await openReviewFixture(page, `
      <h2>Personal, Address, Phone, and Passport Information</h2>
      <span id="lblAppID"></span>
      <span id="ctl00_cphMain_lblSURNAME">TESTER</span>
      <script>
        setTimeout(() => {
          document.querySelector("#lblAppID").textContent = "Application ID ${APPLICATION_ID}";
        }, 700);
      </script>
    `);

    const snapshotResult = await captureOfficialReviewPage(
      page,
      APPLICATION_ID,
      outputDir,
      0,
      { timeoutMs: 2_000, pollIntervalMs: 20 },
    );

    assert.equal(snapshotResult.applicationId, APPLICATION_ID);
    assert.equal(snapshotResult.url, page.url());
    assert.deepEqual(snapshotResult.values, [
      { id: "lblAppID", text: "Application ID " + APPLICATION_ID },
      { id: "ctl00_cphMain_lblSURNAME", text: "TESTER" },
    ]);
    assert.deepEqual(
      JSON.parse(readFileSync(join(outputDir, "review-0.json"), "utf8")),
      snapshotResult,
    );
  } finally {
    await browser.close();
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("rejects a wrong nonempty Review Application ID before a later DOM correction", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const outputDir = mkdtempSync(join(tmpdir(), "ceac-review-capture-"));
  try {
    await openReviewFixture(page, `
      <h2>Personal, Address, Phone, and Passport Information</h2>
      <span id="lblAppID">Application ID AA00OTHER123</span>
      <script>
        setTimeout(() => {
          document.querySelector("#lblAppID").textContent = "Application ID ${APPLICATION_ID}";
        }, 1_200);
      </script>
    `);

    await assert.rejects(
      captureOfficialReviewPage(
        page,
        APPLICATION_ID,
        outputDir,
        0,
        { timeoutMs: 2_000, pollIntervalMs: 20 },
      ),
      /CEAC review page Application ID did not match the expected application/,
    );
  } finally {
    await browser.close();
    rmSync(outputDir, { recursive: true, force: true });
  }
});
