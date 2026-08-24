import { describe, expect, it } from "vitest";
import {
  hasPersistedOfficialSubmissionProof,
  presentRunnerJobStatus,
  statusVisibleRunnerFlowForApplication,
} from "./runner-job-visibility";

describe("statusVisibleRunnerFlowForApplication", () => {
  it.each([
    ["CA", "CA_TRV", "canada"],
    ["turkey", "TR_E_VISA", "turkey"],
    ["IN", "IN_E_VISA", "india"],
    ["Saudi Arabia", "SA_E_VISA", "saudi_arabia"],
    ["UAE", "AE_TOURIST_VISA", "united_arab_emirates"],
  ])("accepts the exact supported product %s/%s", (country, visaType, canonical) => {
    expect(statusVisibleRunnerFlowForApplication(country, visaType)?.country).toBe(
      canonical,
    );
  });

  it("rejects unrelated products even when the country has a supported runner", () => {
    expect(statusVisibleRunnerFlowForApplication("canada", "CA_STUDY_PERMIT")).toBeNull();
    expect(statusVisibleRunnerFlowForApplication("singapore", "SG_VISITOR_VISA")).toBeNull();
  });
});

describe("presentRunnerJobStatus", () => {
  it("surfaces queued and running tourist jobs without Singapore copy", () => {
    const flow = statusVisibleRunnerFlowForApplication("turkey", "TR_E_VISA")!;
    expect(presentRunnerJobStatus("queued", flow)).toMatchObject({
      state: "pending",
      provider: "turkey_evisa_runner_job",
      currentStage: "waiting_for_turkiye_runner",
    });
    expect(presentRunnerJobStatus("running", flow)).toMatchObject({
      state: "running",
      currentStage: "turkiye_official_portal_session",
    });
  });

  it("requires both a terminal application status and matching result proof", () => {
    expect(
      hasPersistedOfficialSubmissionProof("action_required", { status: "submitted" }),
    ).toBe(false);
    expect(
      hasPersistedOfficialSubmissionProof("submitted", {
        status: "submitted_pending_pay",
      }),
    ).toBe(false);
    expect(
      hasPersistedOfficialSubmissionProof("submitted", { status: "submitted" }),
    ).toBe(true);
  });
});
