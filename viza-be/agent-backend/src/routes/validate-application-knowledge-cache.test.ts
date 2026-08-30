import { describe, expect, it, vi } from "vitest";
import {
  ValidationKnowledgeContextCache,
  createValidationKnowledgeCacheKey,
  type ValidationKnowledgeCacheKeyInput,
} from "./validate-application-knowledge-cache.js";

const baseKey: ValidationKnowledgeCacheKeyInput = {
  releaseId: "release-id-1",
  releaseKey: "release-2026-08-30",
  query: "Indonesia B211A tourist visa requirements",
  embeddingModel: "text-embedding-3-small",
  matchCount: 5,
  filterVisaType: "tourist_b211a",
};

describe("validation knowledge cache", () => {
  it("coalesces 100 simultaneous retrievals into one embedding and RPC lookup", async () => {
    let release: ((value: string) => void) | undefined;
    const retrieve = vi.fn(
      () => new Promise<string>((resolve) => {
        release = resolve;
      }),
    );
    const cache = new ValidationKnowledgeContextCache(8, 60_000);

    const requests = Array.from({ length: 100 }, () =>
      cache.getOrCreate(baseKey, retrieve),
    );
    release?.("official knowledge");

    const results = await Promise.all(requests);
    expect(results.filter((result) => result.source === "created")).toHaveLength(1);
    expect(results.filter((result) => result.source === "shared")).toHaveLength(99);
    expect(results.every((result) => result.value === "official knowledge")).toBe(true);
    expect(retrieve).toHaveBeenCalledTimes(1);
  });

  it("invalidates naturally when the active knowledge release changes", async () => {
    const retrieve = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce("release one")
      .mockResolvedValueOnce("release two");
    const cache = new ValidationKnowledgeContextCache(8, 60_000);

    await expect(cache.getOrCreate(baseKey, retrieve)).resolves.toMatchObject({
      value: "release one",
    });
    await expect(cache.getOrCreate({
      ...baseKey,
      releaseId: "release-id-2",
      releaseKey: "release-2026-08-31",
    }, retrieve)).resolves.toMatchObject({ value: "release two" });
    expect(retrieve).toHaveBeenCalledTimes(2);
  });

  it("does not cache a failed embedding or RPC lookup", async () => {
    const retrieve = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("temporary provider failure"))
      .mockResolvedValueOnce("recovered");
    const cache = new ValidationKnowledgeContextCache(8, 60_000);

    await expect(cache.getOrCreate(baseKey, retrieve)).rejects.toThrow(
      "temporary provider failure",
    );
    await expect(cache.getOrCreate(baseKey, retrieve)).resolves.toMatchObject({
      source: "created",
      value: "recovered",
    });
    expect(retrieve).toHaveBeenCalledTimes(2);
  });

  it("keys every public retrieval parameter and never accepts applicant data", () => {
    const first = createValidationKnowledgeCacheKey(baseKey);
    const second = createValidationKnowledgeCacheKey({
      ...baseKey,
      matchCount: 6,
    });
    const withUnexpectedApplicantData = createValidationKnowledgeCacheKey({
      ...baseKey,
      applicantAnswers: { passportNumber: "must-not-enter-cache-key" },
    } as ValidationKnowledgeCacheKeyInput);

    expect(first).toMatch(/^[a-f0-9]{64}$/u);
    expect(second).not.toBe(first);
    expect(withUnexpectedApplicantData).toBe(first);
  });
});
