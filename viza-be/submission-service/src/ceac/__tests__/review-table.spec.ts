import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { chromium } from "@playwright/test";
import { captureOfficialReviewPage, verifyOfficialReview, type ReviewExpectation, type ReviewSnapshot } from "../review-verification";
import type { ReviewTableRow } from "../review-table-contract";

const appId = "AA00TEST1234";
const personal = "Edit Personal Information";
const passport = "Edit Passport/Travel Document Information";
const row = (group: string, label: string, value: string, container = ""): ReviewTableRow => ({group, label, value, container});
const snapshot = (rows: ReviewTableRow[], page = "personal"): ReviewSnapshot => ({
  url: `https://ceac.state.gov/GenNIV/General/review/review_review${page}.aspx`, applicationId: appId, values: [], rows,
});
const field = (section: string, fieldName: string, value: string, controlId = `ctl00_tbx${fieldName}`): ReviewExpectation => ({section, fieldName, value, controlId});

test("compares idless name and date composites atomically", () => {
  const expected = [field("personal_information_1", "surname", "TESTER"), field("personal_information_1", "given_names", "ALICE"),
    field("personal_information_1", "date_of_birth_day", "7"), field("personal_information_1", "date_of_birth_month", "FEB"), field("personal_information_1", "date_of_birth_year", "2000")];
  const rows = [row(personal, "Name Provided:", "TESTER, ALICE"), row(personal, "Date of Birth:", "07 FEBRUARY 2000")];
  assert.deepEqual(verifyOfficialReview(expected, [snapshot(rows)]), {status: "passed", matched: 5, issues: []});
  assert.equal(verifyOfficialReview(expected, [snapshot([rows[0], {...rows[1], value: "08 FEBRUARY 2000"}])]).status, "failed");
  assert.equal(verifyOfficialReview(expected.slice(1), [snapshot(rows)]).status, "unverified");
});

test("duplicate, wrong-section and wrong-page table rows cannot establish a match", () => {
  const expected = [field("passport", "passport_number", "TEST123")];
  const matching = row(passport, "Passport/Travel Document Number:", "TEST123");
  for (const evidence of [snapshot([matching, matching]), snapshot([{...matching, group: personal}]), snapshot([matching], "travel")]) {
    assert.equal(verifyOfficialReview(expected, [evidence]).status, "unverified");
  }
});

test("NA checkbox display is specific, and an unchecked expiry NA requires the matching date", () => {
  const ssn = field("personal_information_2", "us_social_security_number_na", "Yes", "ctl00_cbexAPP_SSN_NA");
  assert.equal(verifyOfficialReview([ssn], [snapshot([row(personal, "U.S. Social Security Number:", "DOES NOT APPLY")])]).status, "passed");
  assert.equal(verifyOfficialReview([ssn], [snapshot([row(personal, "U.S. Social Security Number:", "YES")])]).status, "failed");
  const expiry = [field("passport", "passport_expiry_day", "1"), field("passport", "passport_expiry_month", "JAN"),
    field("passport", "passport_expiry_year", "2030"), field("passport", "passport_expiry_na", "No", "ctl00_cbxPPT_EXPIRE_NA")];
  assert.equal(verifyOfficialReview(expiry, [snapshot([row(passport, "Expiration Date:", "01 JANUARY 2030")])]).status, "passed");
  assert.equal(verifyOfficialReview(expiry, [snapshot([row(passport, "Expiration Date:", "DOES NOT APPLY")])]).status, "failed");
  assert.equal(verifyOfficialReview([expiry[3]], [snapshot([row(passport, "Expiration Date:", "01 JANUARY 2030")])]).status, "unverified");
});

test("an address continuation must immediately follow its scoped label", () => {
  const expected = [field("address_and_phone", "home_address_line2", "UNIT 8")];
  const group = "Edit Address and Phone Information";
  const rows = [{...row(group, "Home Address:", "10 TEST STREET"), position: 1}, {...row(group, "", "UNIT 8"), position: 2}];
  assert.equal(verifyOfficialReview(expected, [snapshot(rows)]).status, "passed");
  assert.equal(verifyOfficialReview(expected, [snapshot([rows[0], row(group, "City:", "TEST CITY"), rows[1]])]).status, "unverified");
  assert.equal(verifyOfficialReview(expected, [snapshot([rows[0], {...rows[1], position: 3}])]).status, "unverified");
});

test("school review values remain scoped to the numbered record and known container", () => {
  const group = "Edit Previous Work Information";
  const expected = [field("work_education_previous", "education_city", "FIRST CITY"), field("work_education_previous", "education_city__2", "SECOND CITY")];
  const rows = [row(group, "Name of Institution (1):", "FIRST SCHOOL", "EDUCYs"), row(group, "City:", "FIRST CITY", "EDUCYs"),
    row(group, "Name of Institution (2):", "SECOND SCHOOL", "EDUCYs"), row(group, "City:", "SECOND CITY", "EDUCYs")];
  assert.equal(verifyOfficialReview(expected, [snapshot(rows, "workeducation")]).status, "passed");
  assert.equal(verifyOfficialReview(expected, [snapshot(rows.map(entry => ({...entry, container: "OTHER"})), "workeducation")]).status, "unverified");
  assert.equal(verifyOfficialReview(expected, [snapshot(rows.map((entry, index) => index === 3 ? {...entry, value: "FIRST CITY"} : entry), "workeducation")]).status, "failed");
});

test("unknown fields and divergent payer aliases remain unverified", () => {
  assert.equal(verifyOfficialReview([field("passport", "unmapped_field", "VALUE")], [snapshot([row(passport, "Something:", "VALUE")])]).status, "unverified");
  const expected = [field("travel_information", "who_is_paying", "SELF"), field("travel_information", "travel_payer", "OTHER")];
  assert.equal(verifyOfficialReview(expected, [snapshot([row("Edit Travel Information", "Person/Entity Paying for Your Trip:", "SELF")], "travel")]).status, "unverified");
});

test("captures real idless ReviewSection tables without hidden or aggregate duplicates", async () => {
  const browser = await chromium.launch({headless: true});
  const page = await browser.newPage();
  const output = await mkdtemp(path.join(tmpdir(), "ceac-idless-review-"));
  try {
    await page.route("https://ceac.state.gov/**", route => route.fulfill({contentType: "text/html", body: `
      <h2>Personal, Address, Phone, and Passport Information</h2><span id="lblAppID">Application ID ${appId}</span>
      <div class="ReviewSection"><table class="title"><tr><td></td><td>Edit Address and Phone Information</td></tr></table>
      <table class="mainstyle"><tr><td>Home Address:</td><td><div class="data">10 TEST STREET</div></td></tr>
      <tr><td></td><td><div class="data">UNIT 8</div></td></tr>
      <tr style="display:none"><td>Home Address:</td><td><div class="data">HIDDEN</div></td></tr>
      <tr><td colspan="2"><div id="SOCIALMEDIAs"><table class="mainstyle"><tr><td>Social Media Provider/Platform (1):</td><td><div class="data">None</div></td></tr></table></div></td></tr></table></div>
      <div style="opacity:0"><div class="ReviewSection"><table class="title"><tr><td>Edit Address and Phone Information</td></tr></table>
      <table class="mainstyle"><tr><td>Home Address:</td><td><div class="data">INVISIBLE</div></td></tr></table></div></div>`}));
    await page.goto(snapshot([]).url);
    const actual = await captureOfficialReviewPage(page, appId, output, 0);
    assert.deepEqual(actual.rows?.map(({position: _position, ...entry}) => entry), [row("Edit Address and Phone Information", "Home Address:", "10 TEST STREET"),
      row("Edit Address and Phone Information", "", "UNIT 8"), row("Edit Address and Phone Information", "Social Media Provider/Platform (1):", "None", "SOCIALMEDIAs")]);
    assert.equal(actual.rows?.[1].position, (actual.rows?.[0].position ?? -1) + 1);
  } finally {
    await browser.close();
    // The target is the exact newly-created test directory beneath OS temp.
    await rm(output, {recursive: true, force: true});
  }
});
