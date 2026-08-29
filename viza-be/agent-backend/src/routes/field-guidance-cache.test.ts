import { describe, expect, it, vi } from "vitest";
import {
  BoundedSingleFlightCache,
  createFieldGuidanceCacheKey,
} from "./field-guidance-cache.js";

const field = {
  fieldName: "passport_type",
  label: "Passport type",
  fieldType: "select",
  required: true,
  options: [
    { value: "ordinary", text: "Ordinary" },
    { value: "diplomatic", text: "Diplomatic" },
  ],
  validationRules: { official: true, max_length: 20 },
};

describe("createFieldGuidanceCacheKey", () => {
  it("is stable for equivalent static metadata regardless of object key order", () => {
    const first = createFieldGuidanceCacheKey({
      country: " Vietnam ",
      visaType: "vn_e_visa",
      locale: "zh-CN",
      field,
    });
    const second = createFieldGuidanceCacheKey({
      country: "vietnam",
      visaType: "VN_E_VISA",
      locale: "zh",
      field: {
        ...field,
        validationRules: { max_length: 20, official: true },
      },
    });

    expect(first).toMatch(/^[a-f0-9]{64}$/u);
    expect(second).toBe(first);
  });

  it("separates fields when guidance-affecting metadata changes", () => {
    const first = createFieldGuidanceCacheKey({
      country: "vietnam",
      visaType: "VN_E_VISA",
      locale: "en",
      field,
    });
    const second = createFieldGuidanceCacheKey({
      country: "vietnam",
      visaType: "VN_E_VISA",
      locale: "en",
      field: { ...field, required: false },
    });

    expect(second).not.toBe(first);
  });
});

describe("BoundedSingleFlightCache", () => {
  it("coalesces a 100-request miss burst into one factory call", async () => {
    let release: ((value: string) => void) | undefined;
    const factory = vi.fn(
      () => new Promise<string>((resolve) => {
        release = resolve;
      }),
    );
    const cache = new BoundedSingleFlightCache<string>(8, 60_000);

    const requests = Array.from({ length: 100 }, () =>
      cache.getOrCreate("same", factory),
    );
    release?.("guidance");

    const results = await Promise.all(requests);
    expect(results.filter((result) => result.source === "created")).toHaveLength(1);
    expect(results.filter((result) => result.source === "shared")).toHaveLength(99);
    expect(results.every((result) => result.value === "guidance")).toBe(true);
    await expect(cache.getOrCreate("same", factory)).resolves.toEqual({
      source: "cache",
      value: "guidance",
    });
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("clears failed work so a later request can retry", async () => {
    const factory = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValueOnce("recovered");
    const cache = new BoundedSingleFlightCache<string>(8, 60_000);

    await expect(cache.getOrCreate("retry", factory)).rejects.toThrow("temporary");
    await expect(cache.getOrCreate("retry", factory)).resolves.toEqual({
      source: "created",
      value: "recovered",
    });
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it("expires entries and evicts the least recently used key", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-30T00:00:00Z"));
    try {
      const cache = new BoundedSingleFlightCache<string>(2, 1_000);
      await cache.getOrCreate("a", async () => "a1");
      await cache.getOrCreate("b", async () => "b1");
      await cache.getOrCreate("a", async () => "unused");
      await cache.getOrCreate("c", async () => "c1");

      await expect(cache.getOrCreate("b", async () => "b2")).resolves.toEqual({
        source: "created",
        value: "b2",
      });

      vi.advanceTimersByTime(1_001);
      await expect(cache.getOrCreate("b", async () => "b3")).resolves.toEqual({
        source: "created",
        value: "b3",
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
