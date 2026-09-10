import assert from "node:assert/strict";
import test from "node:test";
import { createCspReportCollector } from "./csp-report.ts";

function reportRequest(body, headers = {}) {
  return new Request("https://viza.it.com/api/csp-report", {
    method: "POST",
    headers: { "content-type": "application/reports+json", ...headers },
    body: JSON.stringify(body),
  });
}

test("collector discards URLs, samples, referrers, and user data", async () => {
  const logs = [];
  const collector = createCspReportCollector({ log: (summary) => logs.push(summary) });
  const result = await collector.handle(reportRequest([{
    type: "csp-violation",
    body: {
      documentURL: "https://viza.it.com/apply?email=secret@example.com",
      blockedURL: "https://tracker.example/pixel?secret=1",
      effectiveDirective: "connect-src",
      disposition: "report",
      sample: "private form input",
      referrer: "https://private.example",
    },
  }], { origin: "https://viza.it.com" }));

  assert.equal(result.status, 204);
  assert.deepEqual(collector.snapshot(), [{ directive: "connect-src", blockedKind: "external", disposition: "report", count: 1 }]);
  assert.equal(JSON.stringify(logs).includes("secret"), false);
  assert.equal(JSON.stringify(logs).includes("tracker.example"), false);
});

test("collector rejects cross-origin, malformed, and oversized reports", async () => {
  const collector = createCspReportCollector({ log: () => undefined });
  assert.equal((await collector.handle(reportRequest([], { "sec-fetch-site": "cross-site" }))).status, 403);
  assert.equal((await collector.handle(reportRequest({ nope: true }))).status, 400);
  assert.equal((await collector.handle(reportRequest([], { "content-length": "20000" }))).status, 413);
});
