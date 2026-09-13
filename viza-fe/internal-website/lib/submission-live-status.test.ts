import { describe, expect, it } from "vitest";
import {
  loadLiveSubmissionSummaries,
  runnerJobToLiveSubmissionSummary,
} from "./submission-live-status";
import { statusVisibleRunnerFlowForApplication } from "./status/runner-job-visibility";

const finishedAt = "2026-08-18T00:02:00.000Z";

type QueryResponse = { data: unknown; error: unknown };

class MockQuery implements PromiseLike<QueryResponse> {
  constructor(
    private readonly response: QueryResponse,
    private readonly onSelect?: (columns: string | undefined) => void,
  ) {}

  select(columns?: string): this {
    this.onSelect?.(columns);
    return this;
  }

  in(): this {
    return this;
  }

  order(): this {
    return this;
  }

  limit(): this {
    return this;
  }

  then<TResult1 = QueryResponse, TResult2 = never>(
    onfulfilled?: ((value: QueryResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.response).then(onfulfilled, onrejected);
  }
}

function createMockAdminClient(responses: Record<string, QueryResponse> = {}) {
  const calls: string[] = [];
  const selections: Array<{ tableName: string; columns: string | undefined }> = [];
  const client = {
    from(tableName: string) {
      calls.push(tableName);
      return new MockQuery(
        responses[tableName] ?? { data: [], error: null },
        (columns) => selections.push({ tableName, columns }),
      );
    },
  } as unknown as Parameters<typeof loadLiveSubmissionSummaries>[0];
  return { client, calls, selections };
}

const applicationId = "00000000-0000-0000-0000-000000000001";
const secondApplicationId = "00000000-0000-0000-0000-000000000002";
const queueRow = {
  id: "queue-1",
  application_id: applicationId,
  status: "running",
  mode: "live_assisted",
  provider: null,
  current_stage: null,
  live_checkpoint: null,
  manual_action_status: null,
  error_code: null,
  error_message: null,
  official_portal_url: null,
  official_status: null,
  payment_status: null,
  live_submitted_at: null,
  updated_at: "2026-08-18T00:02:00.000Z",
  created_at: "2026-08-18T00:01:00.000Z",
};

describe("runner_job live-submission summaries", () => {
  it.each([
    ["canada", "CA_TRV", "canada_trv_runner_job"],
    ["turkey", "TR_E_VISA", "turkey_evisa_runner_job"],
    ["india", "IN_E_VISA", "india_evisa_runner_job"],
    ["saudi_arabia", "SA_E_VISA", "saudi_evisa_runner_job"],
    ["united_arab_emirates", "AE_TOURIST_VISA", "uae_tourist_runner_job"],
  ])("surfaces %s/%s needs_human country-accurately", (country, visaType, provider) => {
    const flow = statusVisibleRunnerFlowForApplication(country, visaType)!;
    const summary = runnerJobToLiveSubmissionSummary(
      {
        id: `runner_${country}`,
        application_id: `application_${country}`,
        country,
        status: "needs_human",
        last_error: "Applicant confirmation is required",
        enqueued_at: "2026-08-18T00:00:00.000Z",
        started_at: "2026-08-18T00:01:00.000Z",
        finished_at: finishedAt,
      },
      flow,
    );

    expect(summary).toMatchObject({
      state: "action_required",
      provider,
      currentStage: "applicant_action_required",
      manualActionStatus: "pending",
      officialStatus: null,
    });
  });

  it("keeps an unproven tourist succeeded row at a safe action checkpoint", () => {
    const flow = statusVisibleRunnerFlowForApplication("canada", "CA_TRV")!;
    const summary = runnerJobToLiveSubmissionSummary(
      {
        id: "runner_ca",
        application_id: "application_ca",
        country: "canada",
        status: "succeeded",
        last_error: null,
        enqueued_at: "2026-08-18T00:00:00.000Z",
        started_at: "2026-08-18T00:01:00.000Z",
        finished_at: finishedAt,
      },
      flow,
    );

    expect(summary).toMatchObject({
      status: "ca_trv_runner_blocked",
      state: "action_required",
      currentStage: "safe_checkpoint_reached",
      officialStatus: null,
      liveSubmittedAt: null,
    });
  });

  it("preserves the established Singapore summary contract", () => {
    const flow = statusVisibleRunnerFlowForApplication(
      "singapore",
      "SG_ARRIVAL_CARD",
    )!;
    const summary = runnerJobToLiveSubmissionSummary(
      {
        id: "runner_sg",
        application_id: "application_sg",
        country: "singapore",
        status: "succeeded",
        last_error: null,
        enqueued_at: "2026-08-18T00:00:00.000Z",
        started_at: "2026-08-18T00:01:00.000Z",
        finished_at: finishedAt,
      },
      flow,
    );

    expect(summary).toMatchObject({
      status: "succeeded",
      state: "completed",
      provider: "sg_arrival_card_runner_job",
      officialStatus: "submitted",
      liveSubmittedAt: finishedAt,
    });
  });
});

describe("prefetched submission queue summaries", () => {
  it("reuses a validated single-application prefetch and keeps manual-action reads", async () => {
    const { client, calls, selections } = createMockAdminClient();

    const summaries = await loadLiveSubmissionSummaries(
      client,
      [applicationId],
      [],
      { prefetchedQueueResult: { data: [queueRow], error: null } },
    );

    expect(summaries.get(applicationId)).toMatchObject({
      jobId: "queue-1",
      state: "running",
    });
    expect(calls).not.toContain("submission_queue");
    expect(calls).toEqual(expect.arrayContaining([
      "submission_manual_actions",
      "vietnam_live_manual_actions",
      "france_live_manual_actions",
      "ds160_live_manual_actions",
    ]));
    expect(selections.every(({ columns }) => !columns?.match(
      /official_application_reference_encrypted|vn_registration_code_encrypted/,
    ))).toBe(true);
  });

  it("falls back to the bounded queue GET for a foreign child row", async () => {
    const { client, calls, selections } = createMockAdminClient({
      submission_queue: { data: [queueRow], error: null },
    });

    const summaries = await loadLiveSubmissionSummaries(
      client,
      [applicationId],
      [],
      {
        prefetchedQueueResult: {
          data: [{ ...queueRow, application_id: secondApplicationId }],
          error: null,
        },
      },
    );

    expect(summaries.get(applicationId)?.jobId).toBe("queue-1");
    expect(calls.filter((tableName) => tableName === "submission_queue")).toHaveLength(1);
    expect(selections.find(({ tableName }) => tableName === "submission_queue")?.columns).not.toMatch(
      /official_application_reference_encrypted|vn_registration_code_encrypted/,
    );
  });

  it("does not reuse a prefetch when the loader has multiple application targets", async () => {
    const { client, calls } = createMockAdminClient({
      submission_queue: { data: [queueRow], error: null },
    });

    await loadLiveSubmissionSummaries(
      client,
      [applicationId, secondApplicationId],
      [],
      { prefetchedQueueResult: { data: [queueRow], error: null } },
    );

    expect(calls.filter((tableName) => tableName === "submission_queue")).toHaveLength(1);
  });
});
