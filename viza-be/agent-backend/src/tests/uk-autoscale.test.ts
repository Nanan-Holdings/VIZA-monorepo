import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchLegacyQueueDepth } from "../../scripts/autoscale-runners.js";

describe("legacy UK recovery demand", () => {
  it.each(["uk_prefill_pending", "uk_live_assisted_pending"])("counts %s when immediate wake was missed", async (status) => {
    let statuses: string[] = [];
    let queries = 0;
    const count = {
      select: () => count,
      in: (_column: string, selected: string[]) => { statuses = selected; return count; },
      lt: () => Promise.resolve({ count: statuses.includes(status) ? 1 : 0, error: null }),
    };
    const scheduled = {
      select: () => scheduled,
      in: () => scheduled,
      lt: () => scheduled,
      limit: () => Promise.resolve({ data: [], error: null }),
    };
    const db = { from: () => ++queries === 1 ? count : scheduled } as unknown as SupabaseClient;
    expect(await fetchLegacyQueueDepth(db)).toBe(1);
    expect(statuses).not.toContain("uk_live_processing");
  });
});
