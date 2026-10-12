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

test("accepts official partial dates without manufacturing a day", () => {
  const expected = [
    field("travel_information", "intended_arrival_date_month", "NOV"),
    field("travel_information", "intended_arrival_date_year", "2027"),
  ];
  const group = "Edit Travel Information";
  assert.equal(verifyOfficialReview(expected, [snapshot([row(group, "Intended Date of Arrival:", "NOVEMBER 2027")], "travel")]).status, "passed");
  assert.equal(verifyOfficialReview(expected, [snapshot([row(group, "Intended Date of Arrival:", "DECEMBER 2027")], "travel")]).status, "failed");
  const full = [
    field("travel_information", "intended_arrival_date_day", "7"),
    ...expected,
  ];
  assert.equal(verifyOfficialReview(full, [snapshot([row(group, "Intended Date of Arrival:", "08 NOVEMBER 2027")], "travel")]).status, "failed");
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

test("maps review-only companions and address continuations to their exact rows", () => {
  const expected = [
    field("address_and_phone", "secondary_phone_na", "Yes", "ctl00_cbexAPP_MOBILE_TEL_NA"),
    field("us_contact", "us_contact_email_na", "Yes", "ctl00_cbexUS_POC_EMAIL_ADDR_NA"),
    field("work_education_present", "employer_address_line2", "SUITE 200"),
    field("work_education_previous", "education_address_line2__2", "SECOND LINE 2"),
  ];
  const personalRows = [
    row("Edit Address and Phone Information", "Secondary Phone Number:", "DOES NOT APPLY"),
  ];
  const contactRows = [
    row("Edit U.S. Point of Contact Information", "Email Address:", "DOES NOT APPLY"),
  ];
  const workRows = [
    {...row("Edit Present Work Information", "Present Employer or School Address:", "1 TEST STREET"), position: 1},
    {...row("Edit Present Work Information", "", "SUITE 200"), position: 2},
    {...row("Edit Previous Work Information", "Name of Institution (1):", "FIRST SCHOOL", "EDUCYs"), position: 10},
    {...row("Edit Previous Work Information", "Address of Institution:", "FIRST LINE 1", "EDUCYs"), position: 11},
    {...row("Edit Previous Work Information", "", "FIRST LINE 2", "EDUCYs"), position: 12},
    {...row("Edit Previous Work Information", "Name of Institution (2):", "SECOND SCHOOL", "EDUCYs"), position: 20},
    {...row("Edit Previous Work Information", "Address of Institution:", "SECOND LINE 1", "EDUCYs"), position: 21},
    {...row("Edit Previous Work Information", "", "SECOND LINE 2", "EDUCYs"), position: 22},
  ];
  const result = verifyOfficialReview(expected, [
    snapshot(personalRows),
    snapshot(contactRows, "uscontact"),
    snapshot(workRows, "workeducation"),
  ]);
  assert.deepEqual(result, {status: "passed", matched: 4, issues: []});
});

test("compatibility mappings reject a row from the wrong scope and an actual wrong value", () => {
  const expected = [
    field("address_and_phone", "secondary_phone_na", "Yes", "ctl00_cbexAPP_MOBILE_TEL_NA"),
    field("us_contact", "us_contact_email_na", "Yes", "ctl00_cbexUS_POC_EMAIL_ADDR_NA"),
    field("work_education_present", "employer_address_line2", "SUITE 200"),
    field("work_education_previous", "education_address_line2__2", "SECOND LINE 2"),
  ];
  const wrongRows = verifyOfficialReview(expected, [
    snapshot([row("Edit Address and Phone Information", "Work Phone Number:", "DOES NOT APPLY")]),
    snapshot([row("Edit U.S. Point of Contact Information", "Phone Number:", "DOES NOT APPLY")], "uscontact"),
    snapshot([
      {...row("Edit Present Work Information", "Present Employer or School Address:", "1 TEST STREET"), position: 1},
      {...row("Edit Present Work Information", "City:", "TEST CITY"), position: 2},
      {...row("Edit Previous Work Information", "Name of Institution (2):", "SECOND SCHOOL", "OTHER"), position: 20},
      {...row("Edit Previous Work Information", "Address of Institution:", "SECOND LINE 1", "OTHER"), position: 21},
      {...row("Edit Previous Work Information", "", "SECOND LINE 2", "OTHER"), position: 22},
    ], "workeducation"),
  ]);
  assert.equal(wrongRows.status, "unverified");

  const wrongValues = verifyOfficialReview(expected, [
    snapshot([row("Edit Address and Phone Information", "Secondary Phone Number:", "YES")]),
    snapshot([row("Edit U.S. Point of Contact Information", "Email Address:", "synthetic@example.test")], "uscontact"),
    snapshot([
      {...row("Edit Present Work Information", "Present Employer or School Address:", "1 TEST STREET"), position: 1},
      {...row("Edit Present Work Information", "", "OTHER SUITE"), position: 2},
      {...row("Edit Previous Work Information", "Name of Institution (2):", "SECOND SCHOOL", "EDUCYs"), position: 20},
      {...row("Edit Previous Work Information", "Address of Institution:", "SECOND LINE 1", "EDUCYs"), position: 21},
      {...row("Edit Previous Work Information", "", "OTHER LINE 2", "EDUCYs"), position: 22},
    ], "workeducation"),
  ]);
  assert.equal(wrongValues.status, "failed");
  assert.deepEqual(wrongValues.issues.map(issue => issue.reason), [
    "review_value_mismatch",
    "review_value_mismatch",
    "review_value_mismatch",
    "review_value_mismatch",
  ]);
});

test("uses a captured unwrapped duties value only for job duties", () => {
  const expected = field("work_education_present", "job_duties", "SYNTHETICDUTIES");
  const layoutRow = {
    ...row("Edit Present Work Information", "Briefly Describe your Duties:", "SYNTHETIC DUTIES"),
    unwrappedValue: "SYNTHETICDUTIES",
  };
  assert.equal(verifyOfficialReview([expected], [snapshot([layoutRow], "workeducation")]).status, "passed");

  const wrongPunctuation = {
    ...layoutRow,
    unwrappedValue: "SYNTHETICDUTIES!",
  };
  assert.equal(verifyOfficialReview([expected], [snapshot([wrongPunctuation], "workeducation")]).status, "failed");

  const realSpaceChange = {
    ...layoutRow,
    unwrappedValue: "SYNTHETIC DUTIES",
  };
  assert.equal(verifyOfficialReview([expected], [snapshot([realSpaceChange], "workeducation")]).status, "failed");

  const otherField = field("work_education_present", "primary_occupation", "STUDENT");
  const unrelatedUnwrappedValue = {
    ...row("Edit Present Work Information", "Primary Occupation:", "OTHER"),
    unwrappedValue: "STUDENT",
  };
  assert.equal(verifyOfficialReview([otherField], [snapshot([unrelatedUnwrappedValue], "workeducation")]).status, "failed");
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
