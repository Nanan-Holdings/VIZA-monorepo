import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium, type Page } from "@playwright/test";
import type { USAppointmentApplicantDetailsResult } from "../applicant-details-data";
import {
  loadUSAppointmentRunnerConfig,
  type USAppointmentJobRow,
} from "../runner";
import { PlaywrightUSVisaSchedulingPortalClient } from "../usvisascheduling-portal";

const job: USAppointmentJobRow = {
  id: "applicant-submit-fixture-job",
  application_id: "applicant-submit-fixture-application",
  user_id: "applicant-submit-fixture-user",
  appointment_account_id: null,
  applying_country_code: "CN",
  applying_post_city: "Beijing",
  scheduling_provider: "usvisascheduling",
  status: "appointment_payment_completed",
  mode: "assisted_live",
  user_preferences_json: null,
  requires_user_action: false,
  current_manual_action: null,
  updated_at: null,
};

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

type FixtureMode = "calendar" | "calendar-gate" | "error" | "unmapped" | "duplicate-submit";

function applicantDetailsHtml(mode: FixtureMode): string {
  const duplicateSubmit = mode === "duplicate-submit"
    ? "<input type='button' value='Submit'>"
    : "";
  return `<!doctype html>
    <html><body>
      <h1>Applicant Details:</h1>
      <form>
        <input id="atlas_first_name">
        <input id="atlas_last_name">
        <select id="atlas_pob_country">
          <option value="">Select</option><option value="cn">China</option>
        </select>
        <select id="atlas_home_phone_country_code">
          <option value="">Select</option><option value="cn">China (+86)</option>
        </select>
        <input id="atlas_home_phone">
        <select id="atlas_mobile_phone_country_code">
          <option value="">Select</option><option value="cn">China (+86)</option>
        </select>
        <input id="atlas_mobile_phone">
        <input id="atlas_email">
        <input id="atlas_mailing_street">
        <input id="atlas_mailing_city">
        <input id="atlas_mailing_state">
        <input id="atlas_mailing_postal_code">
        <input id="atlas_passport_number">
        <input id="atlas_passport_issuance_date_datepicker_description">
        <input id="atlas_passport_place_of_issue">
        <input id="atlas_passport_expiration_date_datepicker_description">
        <input id="atlas_birthdate_datepicker_description">
        <select id="atlas_nationality">
          <option value="">Select</option><option value="cn">China</option>
        </select>
        <input id="atlas_national_id">
        <input type="button" value="Submit">
        ${duplicateSubmit}
      </form>
      <div id="application-error" class="error" role="alert" hidden>Application update failed.</div>
      <script>
        const mode = ${JSON.stringify(mode)};
        const submit = document.querySelector("input[type='button'][value='Submit']");
        submit?.addEventListener("click", () => {
          const count = Number(sessionStorage.getItem("applicantSubmitClicks") || "0") + 1;
          sessionStorage.setItem("applicantSubmitClicks", String(count));
          if (mode === "calendar" || mode === "calendar-gate") {
            location.href = "/en-US/calendar/";
          } else if (mode === "unmapped") {
            location.href = "/en-US/fixture-visa-options/";
          } else if (mode === "error") {
            document.querySelector("#application-error")?.removeAttribute("hidden");
          }
        });
      </script>
    </body></html>`;
}

async function withApplicantFixture(
  mode: FixtureMode,
  run: (client: PlaywrightUSVisaSchedulingPortalClient, page: Page) => Promise<void>,
): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.route("https://www.usvisascheduling.com/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === "/") {
      await route.fulfill({
        contentType: "text/html",
        body: "<script>location.href='/en-US/applicant_details/';</script>",
      });
      return;
    }
    if (pathname === "/en-US/applicant_details/") {
      await route.fulfill({ contentType: "text/html", body: applicantDetailsHtml(mode) });
      return;
    }
    if (pathname === "/en-US/calendar/") {
      if (mode === "calendar-gate") {
        await route.fulfill({
          contentType: "text/html",
          body: "<h1>Verify you are human</h1><button class='slot'>2027/8/18 1:30 PM Beijing</button>",
        });
        return;
      }
      await route.fulfill({
        contentType: "text/html",
        body: "<h1>Interview Calendar</h1><button class='slot'>2027/8/18 1:30 PM Beijing</button>",
      });
      return;
    }
    if (pathname === "/en-US/fixture-visa-options/") {
      await route.fulfill({ contentType: "text/html", body: "<h1>Visa category</h1>" });
      return;
    }
    await route.fulfill({ status: 404, contentType: "text/plain", body: "Not found" });
  });

  const client = new PlaywrightUSVisaSchedulingPortalClient(
    {
      ...loadUSAppointmentRunnerConfig({}),
      playwrightEnabled: true,
      playwrightHeadless: true,
      playwrightCdpEndpoint: null,
      localCdpEndpoint: null,
      playwrightStorageStatePath: null,
      typingDelayMinMs: 0,
      typingDelayMaxMs: 0,
      baseUrl: "https://www.usvisascheduling.com/",
    },
    { page },
  );
  try {
    await run(client, page);
  } finally {
    await client.close();
    await browser.close();
  }
}

async function submitClickCount(page: Page): Promise<number> {
  return page.evaluate(() => Number(sessionStorage.getItem("applicantSubmitClicks") || "0"));
}

test("Applicant Details Submit advances to a ready calendar exactly once", async () => {
  await withApplicantFixture("calendar", async (client, page) => {
    const result = await client.prepareAppointmentFlow(job, null, applicant);
    assert.deepEqual(result, { readyForSlotCapture: true });
    assert.equal(await submitClickCount(page), 1);
    const slots = await client.observeSlots(job);
    assert.equal(slots.length, 1);
    assert.equal(slots[0]?.appointment_date, "2027-08-18");
    assert.equal(slots[0]?.appointment_time, "13:30");
  });
});

test("Applicant Details does not accept calendar-like content behind a gate", async () => {
  await withApplicantFixture("calendar-gate", async (client, page) => {
    const result = await client.prepareAppointmentFlow(job, null, applicant);
    assert.equal(result.readyForSlotCapture, false);
    assert.equal(result.gate?.errorCode, "captcha_checkpoint");
    assert.equal(new URL(page.url()).pathname, "/en-US/calendar/");
    assert.equal(await submitClickCount(page), 1);
  });
});

test("Applicant Details Submit maps the next unobserved official step to a gate", async () => {
  await withApplicantFixture("unmapped", async (client, page) => {
    const result = await client.prepareAppointmentFlow(job, null, applicant);
    assert.equal(result.readyForSlotCapture, false);
    assert.equal(result.gate?.errorCode, "appointment_application_step_unmapped");
    assert.equal(new URL(page.url()).pathname, "/en-US/fixture-visa-options/");
    assert.equal(await submitClickCount(page), 1);
  });
});

test("Applicant Details submission errors stop without claiming readiness or retrying", async () => {
  await withApplicantFixture("error", async (client, page) => {
    const result = await client.prepareAppointmentFlow(job, null, applicant);
    assert.equal(result.readyForSlotCapture, false);
    assert.equal(result.gate?.errorCode, "appointment_application_step_rejected");
    const retry = await client.prepareAppointmentFlow(job, null, applicant);
    assert.equal(retry.readyForSlotCapture, false);
    assert.equal(retry.gate?.errorCode, "appointment_application_submit_unconfirmed");
    assert.equal(await submitClickCount(page), 1);
  });
});

test("missing Applicant Details data never reaches Submit", async () => {
  await withApplicantFixture("calendar", async (client, page) => {
    const result = await client.prepareAppointmentFlow(job, null, {
      state: "missing",
      missingFields: ["passportNumber"],
    });
    assert.equal(result.readyForSlotCapture, false);
    assert.equal(result.gate?.errorCode, "applicant_details_data_missing");
    assert.equal(await submitClickCount(page), 0);
  });
});

test("Applicant Details requires one visible enabled Submit control", async () => {
  await withApplicantFixture("duplicate-submit", async (client, page) => {
    const result = await client.prepareAppointmentFlow(job, null, applicant);
    assert.equal(result.readyForSlotCapture, false);
    assert.equal(result.gate?.errorCode, "appointment_application_submit_control_unavailable");
    assert.equal(await submitClickCount(page), 0);
  });
});
