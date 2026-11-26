import assert from "node:assert/strict";
import test from "node:test";

import { isScheduledSubmissionDue } from "./scheduled-work.js";

test("scheduled arrival cards become due in their portal timezone", () => {
  const beforeSingaporeMidnight = new Date("2026-07-30T15:59:00.000Z");
  const afterSingaporeMidnight = new Date("2026-07-30T16:01:00.000Z");
  const row = {
    application_id: "application-1",
    status: "sgac_live_assisted_scheduled",
  };
  const result = { scheduledFor: "2026-07-31" };
  assert.equal(isScheduledSubmissionDue(row, result, beforeSingaporeMidnight), false);
  assert.equal(isScheduledSubmissionDue(row, result, afterSingaporeMidnight), true);
});

test("malformed scheduled metadata is treated as work", () => {
  assert.equal(
    isScheduledSubmissionDue(
      {
        application_id: "application-1",
        status: "tdac_live_assisted_scheduled",
      },
      {},
      new Date("2026-07-30T00:00:00.000Z"),
    ),
    true,
  );
});

async function scopedQueryParams(scope: import("./work-availability.js").LegacyWorkScope): Promise<URLSearchParams> {
  process.env.SUPABASE_URL ??= "http://127.0.0.1:9";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-key";
  const { scopeProviders } = await import("./work-availability.js");
  const { supabase } = await import("./supabase.js");
  const query = scopeProviders(supabase.from("submission_queue").select("id"), scope);
  return (query as unknown as { url: URL }).url.searchParams;
}

test("a dedicated worker counts only the providers it can claim", async () => {
  const params = await scopedQueryParams({
    providerAllowlist: new Set(["france_visas_live", "france_visas_dry_run"]),
  });
  assert.equal(params.get("provider"), "in.(france_visas_live,france_visas_dry_run)");
});

test("the Singapore worker ignores providers served by dedicated workers", async () => {
  const params = await scopedQueryParams({ providerDenylist: ["ceac_live", "france_visas_live"] });
  assert.equal(params.get("or"), "(provider.is.null,provider.not.in.(ceac_live,france_visas_live))");
  assert.equal(params.get("provider"), null);
});

test("an unscoped worker counts every provider", async () => {
  const params = await scopedQueryParams({});
  assert.equal(params.get("provider"), null);
  assert.equal(params.get("or"), null);
});
