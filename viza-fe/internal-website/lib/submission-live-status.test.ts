import { describe, expect, it } from "vitest";
import { runnerJobToLiveSubmissionSummary } from "./submission-live-status";
import { statusVisibleRunnerFlowForApplication } from "./status/runner-job-visibility";

const finishedAt = "2026-08-18T00:02:00.000Z";

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
