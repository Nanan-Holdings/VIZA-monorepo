import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireOwnedApplication, loadAssistantAnswers } = vi.hoisted(() => ({
  requireOwnedApplication: vi.fn(),
  loadAssistantAnswers: vi.fn(),
}));

vi.mock("@/lib/form-assistant/server-context", () => ({
  requireOwnedApplication,
  loadAssistantAnswers,
}));

import {
  InterviewContextError,
  loadInterviewApplicationContext,
  mapDs160AnswersToInterviewProfile,
} from "./application-context";

function answer(value: string) {
  return { value, source: "user" };
}

describe("interview application context", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps saved DS-160 answers without inventing missing facts", () => {
    const mapped = mapDs160AnswersToInterviewProfile({
      purpose_of_trip_specify: answer("B1/B2"),
      planned_location: answer("Seattle"),
      intended_arrival_date: answer("2026-10-01"),
      intended_length_of_stay_value: answer("10"),
      intended_length_of_stay_unit: answer("DAY(S)"),
      trip_payer_type: answer("self"),
      primary_occupation: answer("student"),
      employer_name: answer("Example University"),
      companion_group_travel: answer("no"),
      us_contact_relationship: answer("OTHER"),
      has_been_in_us: answer("no"),
      has_been_refused: answer("no"),
    });

    expect(mapped.profile).toMatchObject({
      purpose: "other",
      destinations: "Seattle",
      duration: "10 DAY(S)",
      occupation: "student",
      employer: "Example University",
      homeTies: "",
    });
    expect(mapped.missingFields).toContain("homeTies");
    expect(mapped.verifiedFields).toContain("refusalHistory");
  });

  it("enforces the existing ownership boundary before loading answers", async () => {
    requireOwnedApplication.mockResolvedValue({ status: 403, error: "Unauthorized" });
    await expect(loadInterviewApplicationContext("00000000-0000-4000-8000-000000000001"))
      .rejects.toMatchObject({ code: "APPLICATION_FORBIDDEN", status: 403 });
    expect(loadAssistantAnswers).not.toHaveBeenCalled();
  });

  it("fails closed for an owned non-US or non-DS-160 application", async () => {
    requireOwnedApplication.mockResolvedValue({
      admin: {},
      user: { id: "owner" },
      application: { id: "app", applicant_id: "owner", country: "taiwan", visa_type: "TW_ENTRY_PERMIT" },
    });
    await expect(loadInterviewApplicationContext("00000000-0000-4000-8000-000000000002"))
      .rejects.toBeInstanceOf(InterviewContextError);
    expect(loadAssistantAnswers).not.toHaveBeenCalled();
  });

  it("loads only the owned US DS-160 application's answers", async () => {
    const admin = {};
    requireOwnedApplication.mockResolvedValue({
      admin,
      user: { id: "owner" },
      application: { id: "app", applicant_id: "applicant", country: "United States", visa_type: "B1/B2" },
    });
    loadAssistantAnswers.mockResolvedValue({ purpose_of_trip_specify: answer("B2") });
    const result = await loadInterviewApplicationContext("00000000-0000-4000-8000-000000000003");
    expect(loadAssistantAnswers).toHaveBeenCalledWith(admin, "00000000-0000-4000-8000-000000000003", {
      applicantId: "applicant",
      authUserId: "owner",
    });
    expect(result.context.source).toBe("application");
    expect(result.context.missingFields).toContain("destinations");
    expect(result.cacheScope).toContain("owner");
  });
});
