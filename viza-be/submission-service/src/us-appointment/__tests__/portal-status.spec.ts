import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import {
  inferStatusFromText,
  PlaywrightUSVisaSchedulingPortalClient,
} from "../usvisascheduling-portal";
import {
  loadUSAppointmentRunnerConfig,
  processUSAppointmentJob,
  type StatusCheckInsert,
  type USAppointmentJobRow,
  type USAppointmentPortalClient,
  type USAppointmentRunnerRepository,
} from "../runner";

const job: USAppointmentJobRow = {
  id: "status-fixture-job",
  application_id: "status-fixture-application",
  user_id: "status-fixture-user",
  appointment_account_id: null,
  applying_country_code: "CN",
  applying_post_city: "Beijing",
  scheduling_provider: "usvisascheduling",
  status: "appointment_status_check_in_progress",
  mode: "assisted_live",
  user_preferences_json: null,
  requires_user_action: false,
  current_manual_action: null,
  updated_at: null,
};

async function withStatusFixture(
  body: string,
  run: (client: PlaywrightUSVisaSchedulingPortalClient, requests: string[]) => Promise<void>,
): Promise<void> {
  const requests: string[] = [];
  const server = createServer((request, response) => {
    requests.push(request.url ?? "");
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end(body);
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
    await run(client, requests);
  } finally {
    await client.close();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("status inference checks explicit absence before scheduled evidence", () => {
  assert.equal(inferStatusFromText("No appointments scheduled"), "appointment_not_found");
  assert.equal(inferStatusFromText("Appointment Cancelled"), "appointment_cancelled");
  assert.equal(inferStatusFromText("Appointment Scheduled"), "appointment_exists");
  assert.equal(inferStatusFromText("Appointment Confirmed"), "appointment_exists");
  assert.equal(inferStatusFromText("Appointment"), "unknown");
});

test("production status capture prepares a booked page without a calendar", async () => {
  await withStatusFixture(
    "<h1>Appointment</h1><div data-appointment-status>Appointment Scheduled</div>",
    async (client) => {
      const prepared = await client.prepareAppointmentFlow(job, null);
      assert.equal(prepared.readyForSlotCapture, false);
      assert.equal(prepared.readyForStatusCapture, true);
      const status = await client.captureStatusCheck(job);
      assert.equal(status.status, "appointment_exists");
    },
  );
});

test("runner accepts status readiness without calendar readiness", async () => {
  const statusChecks: StatusCheckInsert[] = [];
  const repository: USAppointmentRunnerRepository = {
    listCandidateJobs: async () => [],
    hasPendingManualAction: async () => false,
    getAppointmentAccountCredentials: async () => null,
    insertManualAction: async () => undefined,
    updateJobForManualAction: async () => undefined,
    updateJobStatus: async () => undefined,
    insertAuditEvent: async () => undefined,
    insertSlots: async () => undefined,
    getSelectedSlot: async () => null,
    hasCompletedFinalApproval: async () => false,
    insertConfirmation: async () => ({ id: null }),
    insertStatusCheck: async (input) => { statusChecks.push(input); },
    updateApplicationAppointmentState: async () => undefined,
  };
  const portalClient: USAppointmentPortalClient = {
    prepareAppointmentFlow: async () => ({
      readyForSlotCapture: false,
      readyForStatusCapture: true,
    }),
    observeSlots: async () => { throw new Error("slot capture must not run"); },
    captureConfirmation: async () => null,
    captureStatusCheck: async (statusJob) => ({
      job_id: statusJob.id,
      application_id: statusJob.application_id,
      user_id: statusJob.user_id,
      status: "appointment_exists",
      result_redacted_json: { provider: "fixture" },
    }),
  };

  const result = await processUSAppointmentJob(
    job,
    repository,
    loadUSAppointmentRunnerConfig({ US_APPOINTMENT_ASSISTED_LIVE_ENABLED: "true" }),
    portalClient,
  );
  assert.equal(result, "processed");
  assert.equal(statusChecks.length, 1);
  assert.equal(statusChecks[0]?.status, "appointment_exists");
});

test("generic appointment headings do not create a prepared status session", async () => {
  await withStatusFixture("<h1>Appointment</h1>", async (client) => {
    const prepared = await client.prepareAppointmentFlow(job, null);
    assert.equal(prepared.readyForSlotCapture, false);
    assert.equal(prepared.readyForStatusCapture, undefined);
    assert.equal(prepared.gate?.errorCode, "unknown_official_state");
    await assert.rejects(client.captureStatusCheck(job), /must be prepared/);
  });
});

test("status checks never start a new application when status evidence is missing", async () => {
  await withStatusFixture(
    "<h1>Home</h1><a id='start_application' href='/en-US/applicant_details/'>Start Application</a>",
    async (client, requests) => {
      const prepared = await client.prepareAppointmentFlow(job, null);
      assert.equal(prepared.readyForSlotCapture, false);
      assert.equal(prepared.readyForStatusCapture, undefined);
      assert.equal(prepared.gate?.errorCode, "unknown_official_state");
      assert.ok(!requests.some((path) => path.includes("applicant_details")));
    },
  );
});
