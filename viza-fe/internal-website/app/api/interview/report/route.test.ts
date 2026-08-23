import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { ApplicantProfile } from "../types";

const { loadInterviewApplicationContext } = vi.hoisted(() => ({ loadInterviewApplicationContext: vi.fn() }));

vi.mock("@/lib/interview/application-context", () => {
  class InterviewContextError extends Error {
    constructor(public code: string, public status: number, message: string) {
      super(message);
    }
  }
  return {
    InterviewContextError,
    loadInterviewApplicationContext,
    standaloneInterviewContext: (profile: ApplicantProfile) => ({
      profile,
      context: { source: "standalone", missingFields: [], verifiedFields: [] },
      cacheScope: "standalone",
    }),
  };
});

import { getQuestion } from "../engine";
import { POST } from "./route";

const profile: ApplicantProfile = {
  purpose: "tourism",
  purposeDetails: "short tourism trip",
  destinations: "Seattle",
  travelDates: "October 2026",
  duration: "10 days",
  funding: "self funded with savings",
  budget: "USD 3000",
  occupation: "student",
  employer: "Example University",
  homeTies: "return to university",
  previousTravel: "visited Japan",
  companions: "alone",
  usContact: "hotel",
  refusalHistory: "no refusal",
};

function request(body: unknown) {
  return new NextRequest("http://localhost/api/interview/report", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const exchange = {
  question: getQuestion(profile, 0)!,
  answer: "I will take a short tourism trip and visit museums.",
  submittedAt: "2026-08-23T00:00:00.000Z",
};

describe("POST /api/interview/report", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks standalone consistency as unverified instead of inventing a score", async () => {
    const response = await POST(request({ idempotencyKey: "report-standalone-0001", profile, exchanges: [exchange] }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.dimensions.consistency).toBeNull();
    expect(body.dimensions.consistencyStatus).toBe("unverified");
    expect(body.context.source).toBe("standalone");
    expect(body.disclaimer).toContain("不预测");
  });

  it("recomputes assessment against the owned application profile", async () => {
    loadInterviewApplicationContext.mockResolvedValue({
      profile,
      context: { source: "application", applicationId: "00000000-0000-4000-8000-000000000020", missingFields: [], verifiedFields: ["purposeDetails"] },
      cacheScope: "application:owned-report",
    });
    const response = await POST(request({
      idempotencyKey: "report-linked-000001",
      applicationId: "00000000-0000-4000-8000-000000000020",
      profile: { ...profile, purposeDetails: "ATTACKER VALUE" },
      exchanges: [{ ...exchange, assessment: { score: 100 } }],
    }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.context.source).toBe("application");
    expect(body.dimensions.consistencyStatus).toBe("verified");
    expect(body.questionAnalysis[0].score).toBeLessThan(100);
  });

  it("rejects more than one follow-up for the same topic", async () => {
    const followUp = { ...exchange.question, id: "purpose-follow-up", parentId: "purpose", isFollowUp: true };
    const response = await POST(request({
      idempotencyKey: "report-followups-0001",
      profile,
      exchanges: [{ ...exchange, question: followUp }, { ...exchange, question: followUp }],
    }));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "TRANSCRIPT_CONTEXT_MISMATCH" });
  });

  it("returns an idempotency conflict for a changed transcript", async () => {
    const key = "report-idempotency-0001";
    const first = await POST(request({ idempotencyKey: key, profile, exchanges: [exchange] }));
    const second = await POST(request({ idempotencyKey: key, profile, exchanges: [{ ...exchange, answer: "Changed answer with a different fact." }] }));
    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    expect(await second.json()).toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  });
});
