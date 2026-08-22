import assert from "node:assert/strict";
import test from "node:test";
import { RunnerJobOwnershipLostError } from "../../queue/execution-context.js";
import type { ArrivalCardBrowserSession } from "../../arrival-card-browser.js";

process.env.SUPABASE_URL ??= "https://vn-prearrival-launch-test.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "vn-prearrival-launch-test-key";

function fakeSession(close: () => Promise<void>): ArrivalCardBrowserSession {
  return {
    browser: {} as ArrivalCardBrowserSession["browser"],
    context: {} as ArrivalCardBrowserSession["context"],
    page: {} as ArrivalCardBrowserSession["page"],
    provider: "local",
    nativeCloudflareUnblock: false,
    diagnostics: [],
    close,
  };
}

test("delayed Vietnam Pre-Arrival session launch closes the session after lease cancellation", async () => {
  const { launchVnPrearrivalBrowserSession } = await import("../runner.js");
  const controller = new AbortController();
  const ownershipLost = new RunnerJobOwnershipLostError("lease lost during delayed Vietnam browser launch");
  let resolveLaunch: ((session: ArrivalCardBrowserSession) => void) | null = null;
  let closeCount = 0;
  let continuationReached = false;
  const launch = launchVnPrearrivalBrowserSession(
    controller.signal,
    undefined,
    async () => new Promise<ArrivalCardBrowserSession>((resolve) => {
      resolveLaunch = resolve;
    }),
  ).then(
    () => {
      continuationReached = true;
    },
    (error: unknown) => {
      throw error;
    },
  );

  controller.abort(ownershipLost);
  (resolveLaunch as ((session: ArrivalCardBrowserSession) => void) | null)?.(fakeSession(async () => {
    closeCount += 1;
  }));

  await assert.rejects(() => launch, (error: unknown) => error === ownershipLost);
  assert.equal(closeCount, 1);
  assert.equal(continuationReached, false);
});
