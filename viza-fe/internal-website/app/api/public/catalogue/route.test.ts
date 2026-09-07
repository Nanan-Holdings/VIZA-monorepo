import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminClient } = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));

type QueryResult = {
  data: Array<Record<string, unknown>> | null;
  error: { message: string } | null;
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function catalogueQuery(result: Promise<QueryResult>) {
  const builder: Record<string, unknown> = {};
  for (const method of ["eq", "not", "order", "select"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.then = (
    resolve: (value: QueryResult) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => result.then(resolve, reject);
  return builder;
}

function publicEntry(overrides: Record<string, unknown> = {}) {
  return {
    slug: "singapore-tourist",
    portalCountry: "Singapore",
    name: "Singapore Tourist Visa",
    city: "Singapore",
    flagCode: "SG",
    type: "Tourist visa",
    visaType: "SG_TOURIST",
    validity: "30 days",
    image: "/singapore.png",
    tag: "evisa",
    featured: true,
    pricing: {
      currency: "SGD",
      governmentFeeMinor: 3000,
      agencyFeeMinor: 5000,
      firstTimeDiscountMinor: 0,
    },
    ...overrides,
  };
}

describe("public catalogue route", () => {
  beforeEach(() => {
    createAdminClient.mockReset();
    vi.resetModules();
  });

  it("coalesces a cold burst into one bounded Supabase read", async () => {
    const { GET } = await import("./route");
    const read = deferred<QueryResult>();
    const query = catalogueQuery(read.promise);
    const from = vi.fn(() => query);
    createAdminClient.mockReturnValue({ from });

    const responses = Array.from({ length: 100 }, () => GET());
    await Promise.resolve();
    expect(createAdminClient).toHaveBeenCalledTimes(1);
    expect(createAdminClient).toHaveBeenCalledWith({
      requestTimeoutMs: 4_000,
      retryDelaysMs: [],
    });
    expect(from).toHaveBeenCalledTimes(1);

    read.resolve({
      data: [{ version: 7, published_payload: publicEntry(), published_at: "2026-09-07T00:00:00.000Z" }],
      error: null,
    });

    const results = await Promise.all(responses);
    expect(results.every((response) => response.status === 200)).toBe(true);
    const payload = await results[0]!.json() as { entries: Array<{ slug: string; version: number }> };
    expect(payload.entries).toEqual([{ ...publicEntry(), version: 7, publishedAt: "2026-09-07T00:00:00.000Z" }]);
  });

  it("does not cache failures, allowing the next request to recover", async () => {
    const { GET } = await import("./route");
    const firstQuery = catalogueQuery(Promise.resolve({ data: null, error: { message: "temporary outage" } }));
    const secondQuery = catalogueQuery(Promise.resolve({
      data: [{ version: 8, published_payload: publicEntry({ featured: false }), published_at: null }],
      error: null,
    }));
    const from = vi.fn()
      .mockReturnValueOnce(firstQuery)
      .mockReturnValueOnce(secondQuery);
    createAdminClient.mockImplementation(() => ({ from }));

    await expect(GET()).resolves.toMatchObject({ status: 503 });
    const recovered = await GET();
    expect(recovered.status).toBe(200);
    expect(from).toHaveBeenCalledTimes(2);
    expect((await recovered.json()).entries[0].version).toBe(8);
  });

  it("refreshes the snapshot after the short cache TTL expires", async () => {
    const { GET } = await import("./route");
    let readCount = 0;
    const from = vi.fn(() => {
      readCount += 1;
      return catalogueQuery(Promise.resolve({
        data: [{ version: readCount, published_payload: publicEntry(), published_at: null }],
        error: null,
      }));
    });
    createAdminClient.mockReturnValue({ from });

    vi.useFakeTimers();
    try {
      const first = await GET();
      const firstPayload = await first.json() as { entries: Array<{ version: number }> };
      expect(firstPayload.entries[0]?.version).toBe(1);

      const warm = await GET();
      const warmPayload = await warm.json() as { entries: Array<{ version: number }> };
      expect(warmPayload.entries[0]?.version).toBe(1);
      expect(from).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(60_000);

      const refreshed = await GET();
      const refreshedPayload = await refreshed.json() as { entries: Array<{ version: number }> };
      expect(refreshedPayload.entries[0]?.version).toBe(2);
      expect(from).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
