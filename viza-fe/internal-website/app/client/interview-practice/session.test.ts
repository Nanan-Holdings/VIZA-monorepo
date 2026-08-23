import { describe, expect, it } from "vitest";
import {
  INTERVIEW_SESSION_KEY,
  answerIdempotencyKey,
  clearInterviewSession,
  createInterviewSession,
  getInterviewSessionKey,
  normalizeStoredInterviewSession,
  readInterviewSession,
  reportIdempotencyKey,
  resetInterviewSession,
  writeInterviewSession,
} from "./session";

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

const question = {
  id: "q-purpose",
  topic: "Travel purpose",
  prompt: "Why are you visiting?",
  isFollowUp: false,
};

const assessment = {
  score: 82,
  status: "strong" as const,
  note: "Clear",
  missingRequirements: [],
};

describe("interview session", () => {
  it("round-trips a valid browser session and clears only the scoped key", () => {
    const local = storage();
    const a = createInterviewSession("2026-08-22T00:00:00.000Z");
    const b = createInterviewSession("2026-08-22T00:00:00.000Z");
    writeInterviewSession(local, a, { applicationId: "app-a", visaType: "B1B2" });
    writeInterviewSession(local, b, { applicationId: "app-b", visaType: "B1B2" });

    expect(readInterviewSession(local, { applicationId: "app-a", visaType: "B1B2" })).toMatchObject({
      id: a.id,
      applicationId: "app-a",
      visaType: "B1B2",
      phase: "setup",
      stage: "profile",
    });

    clearInterviewSession(local, { applicationId: "app-a", visaType: "B1B2" });

    expect(readInterviewSession(local, { applicationId: "app-a", visaType: "B1B2" })).toBeNull();
    expect(readInterviewSession(local, { applicationId: "app-b", visaType: "B1B2" })).toMatchObject({
      id: b.id,
    });
  });

  it("keeps different application IDs in different localStorage keys", () => {
    expect(getInterviewSessionKey()).toBe(INTERVIEW_SESSION_KEY);
    expect(getInterviewSessionKey({ applicationId: "app/1", visaType: "B1/B2" })).not.toBe(
      getInterviewSessionKey({ applicationId: "app/2", visaType: "B1/B2" }),
    );
  });

  it("migrates old v2 localStorage data into a safe v3 session", () => {
    const oldV2 = {
      version: 2,
      id: "legacy",
      phase: "interview",
      profile: createInterviewSession().profile,
      officer: createInterviewSession().officer,
      exchanges: [{ question, answer: "Tourism", assessment, submittedAt: "2026-08-22T00:00:00.000Z" }],
      currentQuestion: question,
      draftAnswer: "draft",
      questionIndex: 1,
      followUpQuestionIds: [],
      reportStatus: "idle",
      report: null,
      updatedAt: "2026-08-22T00:00:00.000Z",
    };

    expect(normalizeStoredInterviewSession(JSON.stringify(oldV2), { applicationId: "app-a" })).toMatchObject({
      version: 3,
      id: "legacy",
      applicationId: "app-a",
      language: "zh-CN",
      stage: "question",
      completedTopics: ["Travel purpose"],
      draftAnswer: "draft",
    });
  });

  it("drops corrupt storage instead of throwing during hydration", () => {
    expect(normalizeStoredInterviewSession("{not json")).toBeNull();
    expect(normalizeStoredInterviewSession(JSON.stringify({ version: 2 }))).toBeNull();
  });

  it("restores exact phase, stage, draft, report status, and recovery metadata", () => {
    const local = storage();
    const session = {
      ...createInterviewSession("2026-08-22T00:00:00.000Z"),
      phase: "complete" as const,
      stage: "complete" as const,
      draftAnswer: "saved draft",
      reportStatus: "failed" as const,
      errorRecovery: {
        lastError: "report_failed",
        retryable: true,
        lastFailedAction: "report" as const,
        recoveredAt: null,
      },
    };
    writeInterviewSession(local, session);

    expect(readInterviewSession(local)).toMatchObject({
      phase: "complete",
      stage: "complete",
      draftAnswer: "saved draft",
      reportStatus: "failed",
      errorRecovery: { retryable: true, lastFailedAction: "report" },
    });
  });

  it("uses stable idempotency keys for duplicate answer and report requests", () => {
    const session = {
      ...createInterviewSession("2026-08-22T00:00:00.000Z"),
      id: "session",
      currentQuestion: question,
      exchanges: [],
    };

    expect(answerIdempotencyKey(session)).toBe("session:q-purpose:0");
    expect(reportIdempotencyKey({ id: "session", exchanges: [] })).toBe("session:0:empty");
  });

  it("restarting practice keeps the current application identity only", () => {
    const session = {
      ...createInterviewSession("2026-08-22T00:00:00.000Z"),
      applicationId: "app-a",
      visaType: "B1B2",
      phase: "interview" as const,
      stage: "question" as const,
      currentQuestion: question,
      draftAnswer: "old",
    };

    expect(resetInterviewSession(session, "2026-08-23T00:00:00.000Z")).toMatchObject({
      applicationId: "app-a",
      visaType: "B1B2",
      phase: "setup",
      stage: "profile",
      currentQuestion: null,
      draftAnswer: "",
      updatedAt: "2026-08-23T00:00:00.000Z",
    });
  });
});
