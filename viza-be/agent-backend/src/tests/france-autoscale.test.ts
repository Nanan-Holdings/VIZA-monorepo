import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchFranceQueueDepth,
  fetchLegacyQueueDepth,
} from "../../scripts/autoscale-runners.js";

function depthClient(onStatuses: (statuses: string[]) => void): SupabaseClient {
  const query = {
    select: () => query,
    in: (_column: string, statuses: string[]) => {
      onStatuses(statuses);
      return query;
    },
    lt: () => Object.assign(Promise.resolve({ count: 1, error: null }), query),
    limit: () => Promise.resolve({ data: [], error: null }),
  };
  return { from: () => query } as unknown as SupabaseClient;
}

describe("France-Visas worker demand", () => {
  it("counts France-Visas pending jobs for the Frankfurt worker", async () => {
    const seen: string[][] = [];
    expect(await fetchFranceQueueDepth(depthClient((s) => seen.push(s)))).toBe(1);
    expect(seen[0]).toEqual(["fv_prefill_pending", "france_live_assisted_pending"]);
  });

  it("no longer wakes the Singapore legacy worker for France-Visas jobs", async () => {
    const seen: string[][] = [];
    await fetchLegacyQueueDepth(depthClient((s) => seen.push(s)));
    expect(seen[0]).not.toContain("fv_prefill_pending");
    expect(seen[0]).not.toContain("france_live_assisted_pending");
    expect(seen[0]).toContain("uk_live_assisted_pending");
  });
});
