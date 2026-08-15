import { describe, expect, it } from "vitest";
import {
  applicationIdentityMatches,
  findOngoingApplicationByIdentity,
  isOngoingApplicationRecord,
} from "./ongoing-application";

describe("ongoing application identity", () => {
  it("keeps drafts and actionable processing rows ongoing", () => {
    expect(isOngoingApplicationRecord({ status: "draft" })).toBe(true);
    expect(
      isOngoingApplicationRecord({
        status: "processing",
        submission_result_status: "action_required",
      })
    ).toBe(true);
  });

  it("never treats isolated QA drafts as a customer's ongoing application", () => {
    expect(
      isOngoingApplicationRecord({
        status: "draft",
        purpose: "VIZA_PLACEHOLDER_DRY_RUN",
      })
    ).toBe(false);
  });

  it.each([
    { status: "submitted" },
    { status: "failed" },
    { status: "processing", submission_result_status: "completed" },
    { status: "processing", submission_result_status: "submitted" },
    { status: "processing", result_status: "issued" },
    { status: "processing", submission_result: { submitted: true } },
    { status: "processing", submission_result: { status: "submitted" } },
  ])("recognizes completed or terminal rows", (application) => {
    expect(isOngoingApplicationRecord(application)).toBe(false);
  });

  it("matches canonical country and visa aliases", () => {
    expect(
      applicationIdentityMatches(
        { country: "USA", visa_type: "B1/B2" },
        "united_states",
        "DS160"
      )
    ).toBe(true);
  });

  it("returns only the ongoing row when completed history exists", () => {
    const ongoing = {
      id: "draft",
      country: "united_states",
      visa_type: "DS160",
      status: "draft",
    };
    expect(
      findOngoingApplicationByIdentity(
        [
          {
            id: "history",
            country: "united_states",
            visa_type: "DS160",
            status: "submitted",
          },
          ongoing,
        ],
        "united_states",
        "DS160"
      )
    ).toBe(ongoing);
  });
});
