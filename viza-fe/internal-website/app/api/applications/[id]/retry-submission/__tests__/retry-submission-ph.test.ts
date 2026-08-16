import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../route";

const applicationId = "app_ph_arrival";
const profile = {
  id: "profile_ph",
  auth_user_id: "auth_ph",
  full_name: "Test Applicant",
  date_of_birth: "1990-01-01",
  place_of_birth: "Singapore",
  gender: "male",
  nationality: "Singapore",
  passport_number: "TEST1234",
  passport_issue_date: "2022-01-01",
  passport_expiry_date: "2032-01-01",
  email: "test@example.test",
  phone: "+6500000000",
  address: "Test address",
  inbox_alias: "ph-arrival@example.test",
};

const application = {
  id: applicationId,
  applicant_id: profile.id,
  country: "philippines",
  visa_type: "PH_ETRAVEL_ARRIVAL_CARD",
  visa_package_id: null,
  arrival_date: null,
  departure_date: null,
  purpose: null,
  accommodation_name: null,
  accommodation_address: null,
  submission_result: null,
  submission_result_status: null,
};

let liveEnabled = true;
let activeRunnerJob: Record<string, unknown> | null = null;
let completeness: any = { complete: true, missingInfo: [], missingDocuments: [] };
let enqueueResult = { id: "runner_ph_001", created: true };
let lastRunnerJobArgs: {
  applicationId: string;
  country: string;
  opts: Record<string, unknown>;
} | null = null;
let lastRpcArgs: Record<string, unknown> | null = null;
let lastApplicationUpdate: Record<string, unknown> | null = null;
let arrivalDate = "2026-08-18";

vi.mock("@/lib/client-session", () => ({
  getClientSessionFromRequest: vi.fn(async () => ({ userId: profile.id })),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/face/match", () => ({ compareFaces: vi.fn() }));

vi.mock("@/features/ph-etravel/status", () => ({
  createPhEtravelScheduledPortalSummary: vi.fn(() => "scheduled"),
  createPhEtravelStoredResultRecoveryPresentation: vi.fn(() => ({ state: "processing" })),
  isPhEtravelServerLiveSubmissionEnabled: vi.fn(() => liveEnabled),
  phEtravelUserFacingError: vi.fn(({ code }: { code?: string }) => code ?? "ph_error"),
}));

vi.mock("@/lib/queue/enqueue", () => ({
  enqueueRunnerJob: vi.fn(async (
    queuedApplicationId: string,
    country: string,
    opts: Record<string, unknown>,
  ) => {
    lastRunnerJobArgs = { applicationId: queuedApplicationId, country, opts };
    return enqueueResult;
  }),
}));

vi.mock("@/lib/application-completeness", () => ({
  loadApplicationCompleteness: vi.fn(async () => completeness),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => createAdminMock()),
}));

function maybeSingleQuery(row: unknown) {
  const query = {
    select: () => query,
    eq: () => query,
    in: () => query,
    order: () => query,
    limit: () => query,
    maybeSingle: async () => ({ data: row, error: null }),
  };
  return query;
}

function createAdminMock() {
  return {
    from(table: string) {
      if (table === "applicant_profiles") return maybeSingleQuery(profile);
      if (table === "applications") {
        return {
          select: () => maybeSingleQuery(application),
          update: (payload: Record<string, unknown>) => {
            lastApplicationUpdate = payload;
            return { eq: async () => ({ error: null }) };
          },
        };
      }
      if (table === "runner_job") return maybeSingleQuery(activeRunnerJob);
      if (table === "visa_application_answers") {
        const rows = [
          { field_name: "transport_type", value_text: "AIR" },
          { field_name: "flight_departure_date", value_text: "2026-08-17" },
          { field_name: "flight_arrival_date", value_text: arrivalDate },
        ];
        const query = {
          select: () => query,
          eq: () => query,
          in: async () => ({ data: rows, error: null }),
        };
        return query;
      }
      throw new Error(`Unexpected table: ${table}`);
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      lastRpcArgs = args;
      return {
        data: {
          queue_id: "scheduled_ph_001",
          queue_status: args.p_status,
          queue_mode: "live_assisted",
          queue_provider: "philippines_etravel_live",
          reused_existing: false,
          superseded_count: 0,
        },
        error: name === "enqueue_submission_retry" ? null : { message: `Unexpected RPC: ${name}` },
      };
    },
  };
}

function request(): Request {
  return new Request(`http://localhost/api/applications/${applicationId}/retry-submission`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "live_assisted",
      country: "philippines",
      visaType: "PH_ETRAVEL_ARRIVAL_CARD",
    }),
  });
}

async function post() {
  const response = await POST(request() as never, {
    params: Promise.resolve({ id: applicationId }),
  });
  return { status: response.status, body: await response.json() };
}

describe("Philippines eTravel arrival canonical enqueue", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-16T10:00:00Z"));
    liveEnabled = true;
    activeRunnerJob = null;
    completeness = { complete: true, missingInfo: [], missingDocuments: [] };
    enqueueResult = { id: "runner_ph_001", created: true };
    lastRunnerJobArgs = null;
    lastRpcArgs = null;
    lastApplicationUpdate = null;
    arrivalDate = "2026-08-18";
  });

  it("enqueues an in-window complete arrival through runner_job", async () => {
    const result = await post();

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      ok: true,
      applicationId,
      jobId: "runner_ph_001",
      queueStatus: "phetravel_live_assisted_pending",
      mode: "live_assisted",
      provider: "philippines_etravel_live",
      queueBackend: "runner_job",
      scheduled: false,
    });
    expect(lastRpcArgs).toBeNull();
    expect(lastRunnerJobArgs).toMatchObject({
      applicationId,
      country: "philippines",
      opts: {
        maxAttempts: 1,
        metadata: {
          source: "retry-submission",
          visaType: "PH_ETRAVEL_ARRIVAL_CARD",
          mode: "live_assisted",
          queuedStage: "queued_for_ph_etravel_arrival_live",
        },
      },
    });
    expect(lastApplicationUpdate).toMatchObject({
      status: "processing",
      submission_result_status: "waiting",
      submission_result: null,
    });
  });

  it("keeps an out-of-window arrival scheduled without creating a runner_job", async () => {
    arrivalDate = "2026-08-25";

    const result = await post();

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      ok: true,
      queueBackend: "submission_queue",
      queueStatus: "phetravel_live_assisted_scheduled",
      scheduled: true,
      scheduledFor: "2026-08-22",
    });
    expect(lastRunnerJobArgs).toBeNull();
    expect(lastRpcArgs).toMatchObject({ p_status: "phetravel_live_assisted_scheduled" });
  });

  it("fails closed when the live feature flags are disabled", async () => {
    liveEnabled = false;

    const result = await post();

    expect(result.status).toBe(403);
    expect(result.body).toMatchObject({ code: "live_disabled" });
    expect(lastRunnerJobArgs).toBeNull();
    expect(lastRpcArgs).toBeNull();
  });

  it("rejects incomplete applications before enqueue", async () => {
    completeness = {
      complete: false,
      missingInfo: [{ key: "flight_number" }],
      missingDocuments: [],
    };

    const result = await post();

    expect(result.status).toBe(422);
    expect(result.body).toMatchObject({ code: "application_incomplete" });
    expect(lastRunnerJobArgs).toBeNull();
    expect(lastRpcArgs).toBeNull();
  });

  it("rejects an active PH runner_job before enqueue", async () => {
    activeRunnerJob = { id: "runner_ph_active", status: "running" };

    const result = await post();

    expect(result.status).toBe(409);
    expect(result.body).toMatchObject({
      code: "active_job_exists",
      jobId: "runner_ph_active",
    });
    expect(lastRunnerJobArgs).toBeNull();
    expect(lastRpcArgs).toBeNull();
  });

  it("reports idempotent reuse for repeated enqueue attempts", async () => {
    enqueueResult = { id: "runner_ph_existing", created: false };

    const result = await post();

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      jobId: "runner_ph_existing",
      queueBackend: "runner_job",
      alreadyQueued: true,
    });
    expect(lastRunnerJobArgs).toMatchObject({ country: "philippines" });
    expect(lastApplicationUpdate).toBeNull();
  });
});
