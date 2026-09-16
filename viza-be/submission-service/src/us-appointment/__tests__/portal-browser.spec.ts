import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import {
  loadUSAppointmentRunnerConfig,
  type AppointmentSlotRow,
  type USAppointmentJobRow,
} from "../runner";
import { PlaywrightUSVisaSchedulingPortalClient } from "../usvisascheduling-portal";

// These tests drive the production client in Chromium against a loopback-only
// portal. They verify browser behavior; they are not official booking evidence.
const job: USAppointmentJobRow = {
  id: "browser-fixture-job",
  application_id: "browser-fixture-application",
  user_id: "browser-fixture-user",
  appointment_account_id: null,
  applying_country_code: "CN",
  applying_post_city: "Beijing",
  scheduling_provider: "usvisascheduling",
  status: "appointment_booked",
  mode: "assisted_live",
  user_preferences_json: null,
  requires_user_action: false,
  current_manual_action: null,
  updated_at: null,
};

const selectedSlot: AppointmentSlotRow = {
  id: "browser-fixture-slot",
  job_id: job.id,
  appointment_date: "2027-08-18",
  appointment_time: "13:30:00",
  appointment_location: "Beijing",
  appointment_type: "interview",
  metadata_redacted_json: null,
};

async function withPortal(
  calendarHtml: string,
  run: (client: PlaywrightUSVisaSchedulingPortalClient, counters: { home: number; booked: number }) => Promise<void>,
  confirmationHtml = '<h1>APPOINTMENT CONFIRMATION</h1><div data-confirmation-number="US12345678">Confirmation Number: US12345678</div>',
): Promise<void> {
  const counters = { home: 0, booked: 0 };
  const server = createServer((request, response) => {
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    if (request.url === "/") {
      counters.home += 1;
      response.end('<h1>Applicant Home</h1><nav>MRV Payment Receipt</nav><a href="/calendar">Schedule Appointment</a>');
    } else if (request.url === "/calendar") {
      response.end(calendarHtml);
    } else if (request.url === "/book" && request.method === "POST") {
      counters.booked += 1;
      response.end(confirmationHtml);
    } else {
      response.statusCode = 404;
      response.end("Not found");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const client = new PlaywrightUSVisaSchedulingPortalClient({
    ...loadUSAppointmentRunnerConfig({}),
    playwrightEnabled: true,
    playwrightHeadless: true,
    baseUrl: `http://127.0.0.1:${address.port}/`,
  });
  try {
    await run(client, counters);
  } finally {
    await client.close();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

const calendar = `<h1>Interview Calendar</h1>
  <div class="slot" hidden>2027-08-19 14:00 Beijing</div>
  <button class="slot" disabled>2027-08-20 14:00 Beijing</button>
  <button class="slot" aria-disabled="true">2027-08-21 14:00 Beijing</button>
  <button class="slot" onclick="document.querySelector('#book').hidden=false">2027/8/18 1:30 PM Beijing</button>
  <button hidden>Confirm hidden template</button>
  <form id="book" hidden method="post" action="/book"><button>Confirm Appointment</button></form>`;

test("production browser keeps the prepared calendar through observation and one approved booking", async () => {
  await withPortal(calendar, async (client, counters) => {
    assert.deepEqual(await client.prepareAppointmentFlow(job, null), { readyForSlotCapture: true });
    const slots = await client.observeSlots(job);
    assert.equal(slots.length, 1, "hidden and disabled slots must never be offered");
    assert.equal(slots[0]?.appointment_date, "2027-08-18");
    assert.equal(slots[0]?.appointment_time, "13:30");
    assert.equal(counters.home, 1, "observation must not navigate away from the calendar");
    const confirmation = await client.captureConfirmation(job, selectedSlot);
    assert.equal(confirmation?.confirmation_number, "US12345678");
    assert.equal(counters.home, 1, "booking must not navigate away from the calendar");
    assert.equal(counters.booked, 1);
    await assert.rejects(client.captureConfirmation(job, selectedSlot), /must be prepared/);
    assert.equal(counters.booked, 1, "repeated capture must not click the final control again");
  });
});

test("production browser recognizes an explicit empty calendar", async () => {
  await withPortal("<h1>Interview Calendar</h1><p>No appointments available.</p>", async (client, counters) => {
    assert.equal((await client.prepareAppointmentFlow(job, null)).readyForSlotCapture, true);
    assert.deepEqual(await client.observeSlots(job), []);
    assert.equal(counters.home, 1);
    assert.equal(counters.booked, 0);
  });
});

test("production browser rejects unknown calendar markup instead of claiming no slots", async () => {
  await withPortal("<h1>Interview Calendar</h1><table><tbody><tr><td>Still fetching data</td></tr></tbody></table>", async (client) => {
    const result = await client.prepareAppointmentFlow(job, null);
    assert.equal(result.readyForSlotCapture, false);
    assert.equal(result.gate?.errorCode, "unknown_official_state");
    await assert.rejects(client.observeSlots(job), /must be prepared/);
  });
});

test("production browser distinguishes access denial and transport failure before slot capture", async () => {
  const checkpoints = [
    {
      body: "<h1>Sorry, you have been blocked</h1><p>You are unable to access usvisascheduling.com</p><footer>Cloudflare</footer>",
      code: "portal_access_blocked",
    },
    {
      body: "<h1>This site can’t be reached</h1><p>www.usvisascheduling.com unexpectedly closed the connection.</p><p>ERR_CONNECTION_CLOSED</p>",
      code: "portal_connection_interrupted",
    },
  ];
  for (const checkpoint of checkpoints) {
    await withPortal(checkpoint.body, async (client, counters) => {
      const result = await client.prepareAppointmentFlow(job, null);
      assert.equal(result.readyForSlotCapture, false);
      assert.equal(result.gate?.errorCode, checkpoint.code);
      assert.equal(result.gate?.actionType, "site_policy_review");
      assert.equal(counters.home, 1);
      assert.equal(counters.booked, 0);
      await assert.rejects(client.observeSlots(job), /must be prepared/);
    });
  }
});

test("unknown-page diagnostics omit OAuth query and fragment credentials", async () => {
  const html = `<h1>Unmapped portal page</h1>
    <script>history.replaceState({}, "", "/calendar?code=fixture-secret-code&state=fixture-secret-state#access_token=fixture-secret-token")</script>`;
  await withPortal(html, async (client) => {
    const result = await client.prepareAppointmentFlow(job, null);
    assert.equal(result.readyForSlotCapture, false);
    assert.equal(result.gate?.errorCode, "unknown_official_state");
    assert.match(String(result.gate?.metadata.current_url), /\/calendar$/);
    assert.doesNotMatch(JSON.stringify(result), /fixture-secret|code=|state=|access_token/);
  });
});

test("production browser rejects another job or an unapproved booking before clicking", async () => {
  await withPortal(calendar, async (client, counters) => {
    await client.prepareAppointmentFlow(job, null);
    await assert.rejects(client.observeSlots({ ...job, id: "another-job" }), /must be prepared/);
    await assert.rejects(client.captureConfirmation({ ...job, status: "appointment_slot_selection_required" }, selectedSlot), /approved job/);
    await assert.rejects(client.captureConfirmation(job, { ...selectedSlot, job_id: "another-job" }), /approved job/);
    assert.equal(counters.booked, 0);
  });
});

test("production browser refuses a stale or ambiguous selected slot", async () => {
  await withPortal(calendar, async (client, counters) => {
    await client.prepareAppointmentFlow(job, null);
    await assert.rejects(client.captureConfirmation(job, { ...selectedSlot, appointment_date: "2027-08-19" }), /missing or ambiguous/);
    assert.equal(counters.booked, 0);
  });
  await withPortal(`${calendar}<button class="slot">2027/8/18 1:30 PM Beijing</button>`, async (client, counters) => {
    await client.prepareAppointmentFlow(job, null);
    await assert.rejects(client.captureConfirmation(job, selectedSlot), /missing or ambiguous/);
    assert.equal(counters.booked, 0);
  });
});

test("production browser requires an actual confirmation reference after the final click", async () => {
  await withPortal(calendar, async (client, counters) => {
    await client.prepareAppointmentFlow(job, null);
    assert.equal(await client.captureConfirmation(job, selectedSlot), null);
    assert.equal(counters.booked, 1);
  }, "<h1>APPOINTMENT CONFIRMATION</h1><p>REQUEST PENDING</p>");
});
