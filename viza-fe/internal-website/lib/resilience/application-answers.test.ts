import { beforeEach, describe, expect, it, vi } from "vitest";

const enqueueResilienceEventMock = vi.hoisted(() => vi.fn());
const getResilienceCacheMock = vi.hoisted(() => vi.fn());
const putResilienceCacheMock = vi.hoisted(() => vi.fn());

vi.mock("./gateway", () => ({
  enqueueResilienceEvent: enqueueResilienceEventMock,
  getResilienceCache: getResilienceCacheMock,
  putResilienceCache: putResilienceCacheMock,
  sha256Hex: (value: string) => `digest:${value.length}`,
}));

import { queueApplicationAnswers } from "./application-answers";

describe("application answer resilience", () => {
  beforeEach(() => {
    enqueueResilienceEventMock.mockReset();
    enqueueResilienceEventMock.mockResolvedValue({ accepted: true, duplicate: false });
    getResilienceCacheMock.mockReset();
    putResilienceCacheMock.mockReset();
    putResilienceCacheMock.mockResolvedValue(undefined);
  });

  it("merges a partial autosave into the encrypted read cache", async () => {
    getResilienceCacheMock.mockResolvedValue({
      version: 1,
      applicantId: "applicant-1",
      applicationId: "application-1",
      answers: { surname: "Chen", nationality: "China" },
      savedAt: "2026-08-12T00:00:00.000Z",
    });

    await queueApplicationAnswers({
      version: 1,
      applicantId: "applicant-1",
      applicationId: "application-1",
      answers: { surname: "Tan", nationality: "" },
      savedAt: "2026-08-12T01:00:00.000Z",
    });

    expect(enqueueResilienceEventMock).toHaveBeenCalledOnce();
    expect(putResilienceCacheMock).toHaveBeenCalledWith(expect.objectContaining({
      value: expect.objectContaining({ answers: { surname: "Tan" } }),
    }));
  });

  it("keeps a durable outbox success even when cache refresh cannot read", async () => {
    getResilienceCacheMock.mockRejectedValue(new Error("cache read unavailable"));

    await expect(queueApplicationAnswers({
      version: 1,
      applicantId: "applicant-1",
      applicationId: "application-1",
      answers: { surname: "Chen" },
      savedAt: "2026-08-12T01:00:00.000Z",
    })).resolves.toBeUndefined();

    expect(putResilienceCacheMock).toHaveBeenCalledWith(expect.objectContaining({
      value: expect.objectContaining({ answers: { surname: "Chen" } }),
    }));
  });
});
