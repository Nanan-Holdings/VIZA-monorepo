import { describe, expect, it } from "vitest";
import { clearInterviewSession, createInterviewSession, INTERVIEW_SESSION_KEY, readInterviewSession, reportIdempotencyKey, writeInterviewSession } from "./session";

function storage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) };
}

describe("interview session", () => {
  it("round-trips a valid browser session and clears it", () => {
    const local = storage(); const session = createInterviewSession("2026-08-22T00:00:00.000Z");
    writeInterviewSession(local, session);
    expect(readInterviewSession(local)).toMatchObject({ id: session.id, phase: "setup" });
    clearInterviewSession(local);
    expect(local.getItem(INTERVIEW_SESSION_KEY)).toBeNull();
  });
  it("uses the session and last exchange to make report requests idempotent", () => {
    expect(reportIdempotencyKey({ id: "session", exchanges: [] })).toBe("session:0:empty");
  });
});
