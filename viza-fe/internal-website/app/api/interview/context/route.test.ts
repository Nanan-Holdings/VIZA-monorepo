import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { loadInterviewApplicationContext } = vi.hoisted(() => ({
  loadInterviewApplicationContext: vi.fn(),
}));

vi.mock("@/lib/interview/application-context", () => {
  class InterviewContextError extends Error {
    constructor(public code: string, public status: number, message: string) {
      super(message);
    }
  }
  return { InterviewContextError, loadInterviewApplicationContext };
});

import { GET } from "./route";

const applicationId = "00000000-0000-4000-8000-000000000030";

describe("GET /api/interview/context", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the owned application's mapped profile and field states", async () => {
    loadInterviewApplicationContext.mockResolvedValue({
      profile: {
        purpose: "tourism",
        purposeDetails: "短期旅游",
        destinations: "Seattle",
        travelDates: "",
        duration: "10 days",
        funding: "本人承担",
        budget: "",
        occupation: "student",
        employer: "Example University",
        homeTies: "",
        previousTravel: "无赴美记录",
        companions: "",
        usContact: "",
        refusalHistory: "无拒签记录",
      },
      context: {
        source: "application",
        applicationId,
        missingFields: ["travelDates", "budget", "homeTies", "companions", "usContact"],
        verifiedFields: ["destinations"],
        needsConfirmationFields: ["purposeDetails", "funding"],
        fieldStates: [
          { field: "destinations", status: "confirmed", source: "saved_application" },
          { field: "funding", status: "needs_confirmation", source: "saved_application" },
          { field: "homeTies", status: "missing", source: null },
        ],
      },
      cacheScope: "application:owned",
    });

    const response = await GET(new NextRequest(`http://localhost/api/interview/context?applicationId=${applicationId}`));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      profile: { destinations: "Seattle", homeTies: "" },
      context: {
        source: "application",
        verifiedFields: ["destinations"],
        needsConfirmationFields: ["purposeDetails", "funding"],
      },
    });
  });

  it("returns a clear retryable load error instead of an empty profile", async () => {
    const { InterviewContextError } = await import("@/lib/interview/application-context");
    loadInterviewApplicationContext.mockRejectedValue(
      new InterviewContextError("CONTEXT_LOAD_FAILED", 500, "暂时无法读取申请资料，请稍后重试。"),
    );
    const response = await GET(new NextRequest(`http://localhost/api/interview/context?applicationId=${applicationId}`));
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ code: "CONTEXT_LOAD_FAILED", retryable: true });
  });
});
