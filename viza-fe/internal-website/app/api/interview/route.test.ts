import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { ApplicantProfile } from "./types";

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

import { POST } from "./route";

const standaloneProfile = {
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
};

function request(body: unknown) {
  return new NextRequest("http://localhost/api/interview", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function json(response: Response) {
  return response.json() as Promise<Record<string, any>>;
}

describe("POST /api/interview", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps standalone practice available without an applicationId", async () => {
    const response = await POST(request({ action: "start", profile: standaloneProfile }));
    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({ questionIndex: 0, context: { source: "standalone" } });
    expect(loadInterviewApplicationContext).not.toHaveBeenCalled();
  });

  it("uses the owned application context and ignores a client-supplied profile", async () => {
    loadInterviewApplicationContext.mockResolvedValue({
      profile: { ...standaloneProfile, destinations: "Boston", companions: "alone", usContact: "hotel", refusalHistory: "no refusal" },
      context: { source: "application", applicationId: "00000000-0000-4000-8000-000000000010", missingFields: ["homeTies"], verifiedFields: ["destinations"] },
      cacheScope: "application:owned",
    });
    const response = await POST(request({
      action: "start",
      applicationId: "00000000-0000-4000-8000-000000000010",
      profile: { ...standaloneProfile, destinations: "ATTACKER VALUE" },
    }));
    const body = await json(response);
    expect(body.context).toMatchObject({ source: "application", missingFields: ["homeTies"] });
    expect(body.question.prompt).not.toContain("ATTACKER VALUE");
  });

  it("returns an explicit ownership error without leaking application data", async () => {
    const { InterviewContextError } = await import("@/lib/interview/application-context");
    loadInterviewApplicationContext.mockRejectedValue(new InterviewContextError("APPLICATION_FORBIDDEN", 403, "你无权读取该申请。"));
    const response = await POST(request({ action: "start", applicationId: "00000000-0000-4000-8000-000000000011" }));
    expect(response.status).toBe(403);
    expect(await json(response)).toMatchObject({ code: "APPLICATION_FORBIDDEN", retryable: false });
  });

  it("is idempotent and rejects reuse of a key for a different answer", async () => {
    const start = await json(await POST(request({ action: "start", profile: standaloneProfile })));
    const base = {
      action: "answer",
      idempotencyKey: "route-idempotency-0001",
      profile: standaloneProfile,
      question: start.question,
      questionIndex: 0,
      followUpUsed: true,
    };
    const first = await POST(request({ ...base, answer: "I will take a short tourism trip and visit museums." }));
    const second = await POST(request({ ...base, answer: "I will take a short tourism trip and visit museums." }));
    const conflict = await POST(request({ ...base, answer: "A different answer for the same key." }));
    expect(first.headers.get("X-Interview-Turn-Cache")).toBe("MISS");
    expect(second.headers.get("X-Interview-Turn-Cache")).toBe("HIT");
    expect(conflict.status).toBe(409);
    expect(await json(conflict)).toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  });

  it("rejects raw audio fields rather than storing or logging them", async () => {
    const response = await POST(request({ action: "start", profile: standaloneProfile, audio: "raw-audio" }));
    expect(response.status).toBe(400);
    expect(await json(response)).toMatchObject({ code: "INVALID_REQUEST" });
  });
});
