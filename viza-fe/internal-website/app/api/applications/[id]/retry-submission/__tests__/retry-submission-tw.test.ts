import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../route";

const applicationId = "app_tw_entry";
const profile = {
  id: "profile_tw",
  auth_user_id: "auth_tw",
  full_name: "Zhang San",
  date_of_birth: "1990-01-01",
  place_of_birth: "Shanghai",
  gender: "male",
  nationality: "China",
  passport_number: "E12345678",
  passport_issue_date: "2022-01-01",
  passport_expiry_date: "2032-01-01",
  email: "test@example.com",
  phone: "+886900000000",
  address: "Taipei",
  inbox_alias: "tw-entry@example.test",
};

const baseApplication = {
  id: applicationId,
  applicant_id: profile.id,
  country: "taiwan",
  visa_type: "TW_ENTRY_PERMIT",
  arrival_date: "2026-09-01",
  departure_date: "2026-09-10",
  purpose: "tourism",
  accommodation_name: "Hotel",
  accommodation_address: "Taipei",
  submission_result: null,
  submission_result_status: null,
};

type TestApplication = Omit<typeof baseApplication, "submission_result" | "submission_result_status"> & {
  submission_result: Record<string, unknown> | null;
  submission_result_status: string | null;
};

let currentApplication: TestApplication = { ...baseApplication };
let lastRpcArgs: Record<string, unknown> | null = null;
let lastApplicationUpdate: Record<string, unknown> | null = null;
let enqueueRunnerJobResult = { id: "runner_tw_live_001", created: true };
let lastRunnerJobArgs: { applicationId: string; country: string; opts: Record<string, unknown> } | null = null;
let activeRunnerJob: Record<string, unknown> | null = null;
let activeHandoff: Record<string, unknown> | null = null;
let runnerJobQueryError: { message: string } | null = null;
let handoffQueryError: { message: string } | null = null;
let mockCompleteness: any = {
  complete: true,
  missingInfoCount: 0,
  missingDocumentCount: 0,
  missingInfo: [],
  missingDocuments: [],
};

vi.mock("@/lib/client-session", () => ({
  getClientSessionFromRequest: vi.fn(async () => ({ userId: profile.id })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/face/match", () => ({
  compareFaces: vi.fn(),
}));

vi.mock("@/features/ph-etravel/status", () => ({
  createPhEtravelScheduledPortalSummary: vi.fn(() => "scheduled"),
  isPhEtravelServerLiveSubmissionEnabled: vi.fn(() => true),
  phEtravelUserFacingError: vi.fn(({ message }: { message?: string }) => message ?? "Philippines eTravel unavailable"),
}));

vi.mock("@/lib/queue/enqueue", () => ({
  enqueueRunnerJob: vi.fn(async (applicationId: string, country: string, opts: Record<string, unknown>) => {
    lastRunnerJobArgs = { applicationId, country, opts };
    return enqueueRunnerJobResult;
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => createAdminMock()),
}));

vi.mock("@/lib/application-completeness", () => ({
  loadApplicationCompleteness: vi.fn(async () => mockCompleteness),
}));

function createMaybeSingleQuery(row: unknown, error: { message: string } | null = null) {
  const query = {
    select: () => query,
    eq: () => query,
    in: () => query,
    order: () => query,
    limit: () => query,
    maybeSingle: async () => ({ data: error ? null : row, error }),
  };
  return query;
}

function createAdminMock() {
  return {
    from(table: string) {
      if (table === "applicant_profiles") return createMaybeSingleQuery(profile);
      if (table === "applications") {
        return {
          select: () => createMaybeSingleQuery(currentApplication),
          update: (payload: Record<string, unknown>) => {
            lastApplicationUpdate = payload;
            return {
              eq: async () => ({ error: null }),
            };
          },
        };
      }
      if (table === "runner_job") return createMaybeSingleQuery(activeRunnerJob, runnerJobQueryError);
      if (table === "takeover_session") return createMaybeSingleQuery(activeHandoff, handoffQueryError);
      throw new Error(`Unexpected table: ${table}`);
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      if (name !== "enqueue_submission_retry") {
        return { data: null, error: { message: `Unexpected RPC: ${name}` } };
      }
      lastRpcArgs = args;
      return {
        data: {
          queue_id: "unexpected_submission_queue_job",
          queue_status: "tw_live_assisted_pending",
          queue_mode: "live_assisted",
          queue_provider: "taiwan_overseas_cn_entry_permit_live",
          reused_existing: false,
          superseded_count: 0,
        },
        error: null,
      };
    },
  };
}

function request(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/applications/app_tw_entry/retry-submission", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function post(body: Record<string, unknown>) {
  const response = await POST(request({
    taiwanOfficialTermsConsent: {
      entryPromptAccepted: true,
      termsModalAccepted: true,
    },
    ...body,
  }) as never, {
    params: Promise.resolve({ id: applicationId }),
  });
  return {
    status: response.status,
    body: await response.json(),
  };
}

describe("Taiwan entry permit retry submission API", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    currentApplication = { ...baseApplication };
    lastRpcArgs = null;
    lastApplicationUpdate = null;
    lastRunnerJobArgs = null;
    activeRunnerJob = null;
    activeHandoff = null;
    runnerJobQueryError = null;
    handoffQueryError = null;
    mockCompleteness = {
      complete: true,
      missingInfoCount: 0,
      missingDocumentCount: 0,
      missingInfo: [],
      missingDocuments: [],
    };
    enqueueRunnerJobResult = { id: "runner_tw_live_001", created: true };
    delete process.env.TW_ENTRY_PERMIT_LIVE_SUBMISSION_ENABLED;
  });

  it("creates a live Taiwan runner_job instead of a submission_queue row", async () => {
    process.env.TW_ENTRY_PERMIT_LIVE_SUBMISSION_ENABLED = "true";

    const result = await post({
      mode: "live_assisted",
      country: "taiwan",
      visaType: "TW_ENTRY_PERMIT",
    });

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      ok: true,
      applicationId,
      jobId: "runner_tw_live_001",
      queueStatus: "tw_live_assisted_pending",
      mode: "live_assisted",
      provider: "taiwan_overseas_cn_entry_permit_live",
      queueBackend: "runner_job",
      scheduled: false,
    });
    expect(lastRpcArgs).toBeNull();
    expect(lastRunnerJobArgs).toMatchObject({
      applicationId,
      country: "taiwan",
    });
    expect(lastRunnerJobArgs?.opts).toMatchObject({
      maxAttempts: 1,
      metadata: {
        source: "retry-submission",
        visaType: "TW_ENTRY_PERMIT",
        mode: "live_assisted",
        queuedStage: "queued_for_tw_entry_permit_submit",
        taiwanOfficialTermsConsent: {
          version: "tw_official_terms_v1",
          entryPromptAccepted: true,
          termsModalAccepted: true,
          source: "viza_final_confirmation",
        },
      },
    });
    expect(lastApplicationUpdate).toMatchObject({
      status: "processing",
      submission_result_status: "waiting",
      submission_result: null,
    });
  });

  it("requires both official terms authorizations before enqueueing", async () => {
    process.env.TW_ENTRY_PERMIT_LIVE_SUBMISSION_ENABLED = "true";

    const missingEntryPrompt = await post({
      mode: "live_assisted",
      country: "taiwan",
      visaType: "TW_ENTRY_PERMIT",
      taiwanOfficialTermsConsent: {
        entryPromptAccepted: false,
        termsModalAccepted: true,
      },
    });
    expect(missingEntryPrompt.status).toBe(422);
    expect(missingEntryPrompt.body.code).toBe("tw_official_terms_consent_required");
    expect(lastRunnerJobArgs).toBeNull();

    const missingModal = await post({
      mode: "live_assisted",
      country: "taiwan",
      visaType: "TW_ENTRY_PERMIT",
      taiwanOfficialTermsConsent: {
        entryPromptAccepted: true,
        termsModalAccepted: false,
      },
    });
    expect(missingModal.status).toBe(422);
    expect(missingModal.body.code).toBe("tw_official_terms_consent_required");
    expect(lastRunnerJobArgs).toBeNull();
  });

  it("rejects live Taiwan submission by default when the server flag is missing", async () => {
    const result = await post({
      mode: "live_assisted",
      country: "taiwan",
      visaType: "TW_ENTRY_PERMIT",
    });

    expect(result.status).toBe(403);
    expect(result.body.error).toBe("Live assisted retry is disabled by environment configuration.");
    expect(lastRpcArgs).toBeNull();
    expect(lastRunnerJobArgs).toBeNull();
  });

  it("rejects mismatched Taiwan retry input before enqueueing", async () => {
    const result = await post({
      mode: "live_assisted",
      country: "taiwan",
      visaType: "VN_E_VISA",
    });

    expect(result.status).toBe(400);
    expect(result.body.error).toBe("Requested visa type does not match the application visa type.");
    expect(lastRpcArgs).toBeNull();
    expect(lastRunnerJobArgs).toBeNull();
  });

  it("rejects live Taiwan submission unless the server flag is exactly true", async () => {
    process.env.TW_ENTRY_PERMIT_LIVE_SUBMISSION_ENABLED = "";

    const result = await post({
      mode: "live_assisted",
      country: "taiwan",
      visaType: "TW_ENTRY_PERMIT",
    });

    expect(result.status).toBe(403);
    expect(result.body.error).toBe("Live assisted retry is disabled by environment configuration.");
    expect(lastRpcArgs).toBeNull();
    expect(lastRunnerJobArgs).toBeNull();

    process.env.TW_ENTRY_PERMIT_LIVE_SUBMISSION_ENABLED = "false";
    const falseFlagResult = await post({
      mode: "live_assisted",
      country: "taiwan",
      visaType: "TW_ENTRY_PERMIT",
    });

    expect(falseFlagResult.status).toBe(403);
    expect(falseFlagResult.body.error).toBe("Live assisted retry is disabled by environment configuration.");
    expect(lastRpcArgs).toBeNull();
    expect(lastRunnerJobArgs).toBeNull();

    process.env.TW_ENTRY_PERMIT_LIVE_SUBMISSION_ENABLED = "1";
    const numericFlagResult = await post({
      mode: "live_assisted",
      country: "taiwan",
      visaType: "TW_ENTRY_PERMIT",
    });

    expect(numericFlagResult.status).toBe(403);
    expect(numericFlagResult.body.error).toBe("Live assisted retry is disabled by environment configuration.");
    expect(lastRpcArgs).toBeNull();
    expect(lastRunnerJobArgs).toBeNull();
  });

  it("returns an already-submitted Taiwan result without creating another job", async () => {
    process.env.TW_ENTRY_PERMIT_LIVE_SUBMISSION_ENABLED = "true";
    currentApplication = {
      ...baseApplication,
      submission_result_status: "completed",
      submission_result: {
        country: "TW",
        status: "submitted",
        submitted: true,
        caseNumber: "TW-CASE-1",
        officialReceipt: {
          source: "official_success_page_with_application_number",
          caseNumber: "TW-CASE-1",
        },
      },
    };

    const result = await post({
      mode: "live_assisted",
      country: "taiwan",
      visaType: "TW_ENTRY_PERMIT",
    });

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      ok: true,
      applicationId,
      jobId: null,
      alreadySubmitted: true,
      provider: "taiwan_overseas_cn_entry_permit_live",
    });
    expect(lastRpcArgs).toBeNull();
    expect(lastRunnerJobArgs).toBeNull();
  });

  it("reuses an existing queued Taiwan runner_job for repeated clicks", async () => {
    process.env.TW_ENTRY_PERMIT_LIVE_SUBMISSION_ENABLED = "true";
    enqueueRunnerJobResult = { id: "runner_tw_existing", created: false };

    const result = await post({
      mode: "live_assisted",
      country: "taiwan",
      visaType: "TW_ENTRY_PERMIT",
    });

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      ok: true,
      applicationId,
      jobId: "runner_tw_existing",
      queueStatus: "tw_live_assisted_pending",
      provider: "taiwan_overseas_cn_entry_permit_live",
      queueBackend: "runner_job",
      alreadyQueued: true,
    });
    expect(lastRpcArgs).toBeNull();
    expect(lastRunnerJobArgs).toMatchObject({
      applicationId,
      country: "taiwan",
    });
  });

  it("blocks Taiwan retry when an active runner_job already exists", async () => {
    process.env.TW_ENTRY_PERMIT_LIVE_SUBMISSION_ENABLED = "true";
    activeRunnerJob = { id: "runner_tw_active", status: "running" };

    const result = await post({
      mode: "live_assisted",
      country: "taiwan",
      visaType: "TW_ENTRY_PERMIT",
    });

    expect(result.status).toBe(409);
    expect(result.body).toMatchObject({
      code: "tw_active_job_exists",
      jobId: "runner_tw_active",
      jobStatus: "running",
    });
    expect(lastRunnerJobArgs).toBeNull();
    expect(lastApplicationUpdate).toBeNull();
  });

  it("does not let a legacy applicant handoff block the formal submit path", async () => {
    process.env.TW_ENTRY_PERMIT_LIVE_SUBMISSION_ENABLED = "true";
    activeHandoff = {
      id: "handoff_active",
      status: "queued",
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };

    const result = await post({
      mode: "live_assisted",
      country: "taiwan",
      visaType: "TW_ENTRY_PERMIT",
    });

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      ok: true,
      queueBackend: "runner_job",
    });
    expect(lastRunnerJobArgs).not.toBeNull();
  });

  it("allows Taiwan retry after the previous applicant handoff expired", async () => {
    process.env.TW_ENTRY_PERMIT_LIVE_SUBMISSION_ENABLED = "true";
    activeHandoff = {
      id: "handoff_expired",
      status: "queued",
      expires_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    };

    const result = await post({
      mode: "live_assisted",
      country: "taiwan",
      visaType: "TW_ENTRY_PERMIT",
    });

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      ok: true,
      jobId: "runner_tw_live_001",
      queueBackend: "runner_job",
    });
    expect(lastRunnerJobArgs).toMatchObject({
      applicationId,
      country: "taiwan",
    });
  });

  it("fails closed when the Taiwan active-job guard cannot be checked", async () => {
    process.env.TW_ENTRY_PERMIT_LIVE_SUBMISSION_ENABLED = "true";
    runnerJobQueryError = { message: "runner_job unavailable" };

    const runnerResult = await post({
      mode: "live_assisted",
      country: "taiwan",
      visaType: "TW_ENTRY_PERMIT",
    });

    expect(runnerResult.status).toBe(500);
    expect(runnerResult.body).toMatchObject({
      code: "query_failed",
      error: "taiwan active-job guard: runner_job unavailable",
    });
    expect(lastRunnerJobArgs).toBeNull();

  });

  it("does not create a Taiwan runner_job when application completeness is missing", async () => {
    process.env.TW_ENTRY_PERMIT_LIVE_SUBMISSION_ENABLED = "true";
    mockCompleteness = {
      complete: false,
      missingInfoCount: 1,
      missingDocumentCount: 1,
      missingInfo: [
        {
          fieldName: "household_revoked",
          labelZh: "户籍是否已注销",
          labelEn: "Household registration revoked",
          stepNumber: 2,
          stepName: "Photo & Basic Status",
          stepLabelZh: "照片与基本状态",
        },
      ],
      missingDocuments: [
        {
          requirementKey: "mainland_id_card_scan",
          documentType: "identity_document",
          labelZh: "大陆身份证",
          labelEn: "Mainland ID card",
          description: "上传大陆身份证扫描件。",
          required: true,
        },
      ],
    };

    const result = await post({
      mode: "live_assisted",
      country: "taiwan",
      visaType: "TW_ENTRY_PERMIT",
    });

    expect(result.status).toBe(422);
    expect(result.body).toMatchObject({
      code: "application_incomplete",
      completeness: {
        complete: false,
        missingInfoCount: 1,
        missingDocumentCount: 1,
      },
    });
    expect(lastRpcArgs).toBeNull();
    expect(lastRunnerJobArgs).toBeNull();
    expect(lastApplicationUpdate).toBeNull();
  });
});
