import { describe, expect, it, vi } from "vitest";
import { BoundedSingleFlightCache } from "@/lib/static-visa-metadata-cache";

describe("BoundedSingleFlightCache", () => {
  it("coalesces one hundred identical cold misses", async () => {
    const cache = new BoundedSingleFlightCache<string>(8, 60_000);
    const factory = vi.fn(async () => {
      await Promise.resolve();
      return "schema";
    });

    const results = await Promise.all(
      Array.from({ length: 100 }, () => cache.getOrCreate("VN_E_VISA", factory)),
    );

    expect(factory).toHaveBeenCalledTimes(1);
    expect(results.filter((result) => result.source === "created")).toHaveLength(1);
    expect(results.filter((result) => result.source === "shared")).toHaveLength(99);
    expect(results.every((result) => result.value === "schema")).toBe(true);
  });

  it("does not cache a rejected factory", async () => {
    const cache = new BoundedSingleFlightCache<string>(8, 60_000);
    const factory = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockResolvedValueOnce("recovered");

    await expect(cache.getOrCreate("schema", factory)).rejects.toThrow("temporary failure");
    await expect(cache.getOrCreate("schema", factory)).resolves.toMatchObject({
      source: "created",
      value: "recovered",
    });
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it("expires entries and refreshes them", async () => {
    let now = 0;
    const cache = new BoundedSingleFlightCache<string>(8, 10, () => now);
    const factory = vi.fn(async () => `value-${now}`);

    const first = await cache.getOrCreate("schema", factory);
    now = 5;
    const cached = await cache.getOrCreate("schema", factory);
    now = 10;
    const refreshed = await cache.getOrCreate("schema", factory);

    expect(first.source).toBe("created");
    expect(cached.source).toBe("cache");
    expect(refreshed.source).toBe("created");
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it("evicts the least recently used entry at the bound", async () => {
    const cache = new BoundedSingleFlightCache<string>(2, 60_000);
    const factory = vi.fn(async () => "value");

    await cache.getOrCreate("a", factory);
    await cache.getOrCreate("b", factory);
    await cache.getOrCreate("a", factory);
    await cache.getOrCreate("c", factory);
    const b = await cache.getOrCreate("b", factory);

    expect(b.source).toBe("created");
    expect(factory).toHaveBeenCalledTimes(4);
  });
});
