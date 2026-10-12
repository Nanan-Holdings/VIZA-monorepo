import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { chromium, type Page } from "@playwright/test";
import {
  fillUSVisaSchedulingApplicantDetails,
  type FillUSVisaSchedulingApplicantDetailsResult,
} from "../applicant-details";
import type { USAppointmentApplicantDetailsResult } from "../applicant-details-data";

const applicant: USAppointmentApplicantDetailsResult = {
  state: "ready",
  data: {
    firstName: "Wei",
    lastName: "Zhang",
    birthCountry: "China",
    homePhone: { callingCode: "+86", nationalNumber: "01012345678" },
    mobilePhone: { callingCode: "+86", nationalNumber: "13800138000" },
    email: "wei@example.com",
    mailingStreet: "1 Example Road",
    mailingCity: "Beijing",
    mailingState: "Beijing",
    mailingPostalCode: "100000",
    passportNumber: "E12345678",
    passportIssueDate: "2020-01-02",
    passportPlaceOfIssue: "Beijing",
    passportExpiryDate: "2030-12-31",
    dateOfBirth: "1990-02-03",
    nationality: "China",
    nationalId: "110105199002030011",
  },
};

interface FixtureOptions {
  duplicateVisibleCallingCode?: boolean;
  initialValue?: string;
}

function applicantDetailsHtml(options: FixtureOptions = {}): string {
  const initial = options.initialValue ?? "";
  const duplicateCallingCode = options.duplicateVisibleCallingCode
    ? "<option value='cn-duplicate'>China (+86)</option>"
    : "";
  return `<!doctype html>
    <html><body>
      <h1 id="pagetitle">Applicant Details:</h1>
      <form id="applicant-form">
        <select id="atlas_country" disabled><option value="cn">China</option></select>
        <input id="atlas_first_name" value="${initial}">
        <input id="atlas_last_name" value="${initial}">
        <select id="atlas_pob_country">
          <option value="" selected>Select</option>
          <option value="cn-hidden" hidden>China</option>
          <option value="cn"> China </option>
          <option value="us">United States</option>
        </select>
        <select id="atlas_home_phone_country_code">
          <option value="" selected>Select</option>
          <option value="cn-hidden" hidden>China (+86)</option>
          <option value="cn">China (+86)</option>
          ${duplicateCallingCode}
          <option value="us">United States (+1)</option>
        </select>
        <input id="atlas_home_phone" value="${initial}">
        <select id="atlas_mobile_phone_country_code">
          <option value="" selected>Select</option>
          <option value="cn-hidden" hidden>China (+86)</option>
          <option value="cn">China (+86)</option>
          ${duplicateCallingCode}
          <option value="us">United States (+1)</option>
        </select>
        <input id="atlas_mobile_phone" value="${initial}">
        <input id="atlas_email" value="${initial}">
        <input id="atlas_mailing_street" value="${initial}">
        <input id="atlas_mailing_city" value="${initial}">
        <input id="atlas_mailing_state" value="${initial}">
        <input id="atlas_mailing_postal_code" value="${initial}">
        <input id="atlas_passport_number" value="${initial}">
        <input id="atlas_passport_issuance_date_datepicker_description" value="${initial}">
        <input id="atlas_passport_place_of_issue" value="${initial}">
        <input id="atlas_passport_expiration_date_datepicker_description" value="${initial}">
        <input id="atlas_birthdate_datepicker_description" value="${initial}">
        <select id="atlas_nationality">
          <option value="" selected>Select</option>
          <option value="cn-hidden" hidden>China</option>
          <option value="cn">China</option>
          <option value="us">United States</option>
        </select>
        <input id="atlas_national_id" value="${initial}">
        <input id="frm_pref_fixture" value="honeypot-untouched" style="display:none">
        <button id="next" type="button">Next</button>
      </form>
      <script>
        window.nextClicks = 0;
        document.querySelector('#next').addEventListener('click', () => { window.nextClicks += 1; });
      </script>
    </body></html>`;
}

async function withFixture(
  options: FixtureOptions,
  run: (page: Page, origin: string) => Promise<void>,
): Promise<void> {
  const server = createServer((request, response) => {
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    if (request.url === "/en-US/applicant_details/") {
      response.end(applicantDetailsHtml(options));
      return;
    }
    response.end("<!doctype html><html><body><h1>Other page</h1></body></html>");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto(`${origin}/en-US/applicant_details/`, { waitUntil: "domcontentloaded" });
    await run(page, origin);
  } finally {
    await browser.close();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

async function captureValues(page: Page): Promise<string[]> {
  const ids = [
    "atlas_first_name",
    "atlas_last_name",
    "atlas_pob_country",
    "atlas_home_phone_country_code",
    "atlas_home_phone",
    "atlas_mobile_phone_country_code",
    "atlas_mobile_phone",
    "atlas_email",
    "atlas_mailing_street",
    "atlas_mailing_city",
    "atlas_mailing_state",
    "atlas_mailing_postal_code",
    "atlas_passport_number",
    "atlas_passport_issuance_date_datepicker_description",
    "atlas_passport_place_of_issue",
    "atlas_passport_expiration_date_datepicker_description",
    "atlas_birthdate_datepicker_description",
    "atlas_nationality",
    "atlas_national_id",
    "frm_pref_fixture",
  ];
  return Promise.all(ids.map((id) => page.locator(`#${id}`).inputValue()));
}

function assertGate(
  result: FillUSVisaSchedulingApplicantDetailsResult,
  code: string,
): asserts result is FillUSVisaSchedulingApplicantDetailsResult & { state: "gate" } {
  assert.equal(result.state, "gate");
  assert.equal(result.code, code);
}

test("fills observed Applicant Details controls and leaves honeypot and Next untouched", async () => {
  await withFixture({}, async (page, origin) => {
    const result = await fillUSVisaSchedulingApplicantDetails({
      page,
      applicant,
      originOverride: origin,
      timeoutMs: 3_000,
    });
    assert.deepEqual(result, { state: "filled", code: "applicant_details_filled" });
    assert.equal(await page.locator("#atlas_first_name").inputValue(), "Wei");
    assert.equal(await page.locator("#atlas_last_name").inputValue(), "Zhang");
    assert.equal(await page.locator("#atlas_pob_country").inputValue(), "cn");
    assert.equal(await page.locator("#atlas_home_phone_country_code").inputValue(), "cn");
    assert.equal(await page.locator("#atlas_home_phone").inputValue(), "01012345678");
    assert.equal(await page.locator("#atlas_mobile_phone_country_code").inputValue(), "cn");
    assert.equal(await page.locator("#atlas_mobile_phone").inputValue(), "13800138000");
    assert.equal(await page.locator("#atlas_email").inputValue(), "wei@example.com");
    assert.equal(await page.locator("#atlas_mailing_street").inputValue(), "1 Example Road");
    assert.equal(await page.locator("#atlas_mailing_city").inputValue(), "Beijing");
    assert.equal(await page.locator("#atlas_mailing_state").inputValue(), "Beijing");
    assert.equal(await page.locator("#atlas_mailing_postal_code").inputValue(), "100000");
    assert.equal(await page.locator("#atlas_passport_number").inputValue(), "E12345678");
    assert.equal(await page.locator("#atlas_passport_issuance_date_datepicker_description").inputValue(), "01/02/2020");
    assert.equal(await page.locator("#atlas_passport_place_of_issue").inputValue(), "Beijing");
    assert.equal(await page.locator("#atlas_passport_expiration_date_datepicker_description").inputValue(), "12/31/2030");
    assert.equal(await page.locator("#atlas_birthdate_datepicker_description").inputValue(), "02/03/1990");
    assert.equal(await page.locator("#atlas_nationality").inputValue(), "cn");
    assert.equal(await page.locator("#atlas_national_id").inputValue(), "110105199002030011");
    assert.equal(await page.locator("#frm_pref_fixture").inputValue(), "honeypot-untouched");
    assert.equal(await page.evaluate(() => (window as unknown as { nextClicks: number }).nextClicks), 0);
  });
});

test("returns fixed missing-data gate before mutating any Applicant Details control", async () => {
  await withFixture({ initialValue: "preserved" }, async (page, origin) => {
    const before = await captureValues(page);
    const result = await fillUSVisaSchedulingApplicantDetails({
      page,
      applicant: undefined,
      originOverride: origin,
      timeoutMs: 3_000,
    });
    assertGate(result, "applicant_details_data_missing");
    assert.deepEqual(result.missingFields, [
      "firstName",
      "lastName",
      "birthCountry",
      "homePhone.callingCode",
      "homePhone.nationalNumber",
      "mobilePhone.callingCode",
      "mobilePhone.nationalNumber",
      "email",
      "mailingStreet",
      "mailingCity",
      "mailingState",
      "mailingPostalCode",
      "passportNumber",
      "passportIssueDate",
      "passportPlaceOfIssue",
      "passportExpiryDate",
      "dateOfBirth",
      "nationality",
      "nationalId",
    ]);
    assert.deepEqual(await captureValues(page), before);
    assert.equal(await page.evaluate(() => (window as unknown as { nextClicks: number }).nextClicks), 0);
  });
});

test("rejects a loopback page without an explicit origin override", async () => {
  await withFixture({ initialValue: "preserved" }, async (page, origin) => {
    const before = await captureValues(page);
    const result = await fillUSVisaSchedulingApplicantDetails({
      page,
      applicant,
      timeoutMs: 3_000,
    });
    assert.deepEqual(result, { state: "notapplicant", code: "not_applicant_details_path" });
    assert.deepEqual(await captureValues(page), before);
  });
});

test("requires one visible exact option for country and calling code", async () => {
  await withFixture({ duplicateVisibleCallingCode: true }, async (page, origin) => {
    const result = await fillUSVisaSchedulingApplicantDetails({
      page,
      applicant,
      originOverride: origin,
      timeoutMs: 3_000,
    });
    assertGate(result, "applicant_details_option_missing");
    assert.deepEqual(result.missingFields, ["homePhone.callingCode"]);
    assert.equal(await page.locator("#atlas_first_name").inputValue(), "");
    assert.equal(await page.locator("#frm_pref_fixture").inputValue(), "honeypot-untouched");
  });
});
