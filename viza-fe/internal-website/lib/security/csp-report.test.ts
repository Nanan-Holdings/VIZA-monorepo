import { describe, expect, it } from "vitest";
import { createCspReportCollector } from "./csp-report";

function reportRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://app.viza.it.com/api/csp-report", {
    method: "POST",
    headers: { "content-type": "application/csp-report", ...headers },
    body: JSON.stringify(body),
  });
}

describe("CSP report collector", () => {
  it("stores and logs only bounded aggregate dimensions", async () => {
    const logs: unknown[] = [];
    const collector = createCspReportCollector({ log: (summary) => logs.push(summary) });
    const result = await collector.handle(reportRequest({
      "csp-report": {
        "document-uri": "https://app.viza.it.com/client/application?email=secret@example.com",
        "blocked-uri": "https://tracker.example/pixel?token=secret",
        "effective-directive": "script-src-elem",
        disposition: "report",
        sample: "applicant secret",
        referrer: "https://private.example/",
      },
    }, { origin: "https://app.viza.it.com" }));

    expect(result.status).toBe(204);
    expect(collector.snapshot()).toEqual([{ directive: "script-src-elem", blockedKind: "external", disposition: "report", count: 1 }]);
    expect(JSON.stringify(logs)).not.toContain("secret");
    expect(JSON.stringify(logs)).not.toContain("tracker.example");
  });

  it("rejects explicit cross-origin and oversized submissions", async () => {
    const collector = createCspReportCollector({ log: () => undefined });
    expect((await collector.handle(reportRequest({ "csp-report": {} }, { origin: "https://evil.example" }))).status).toBe(403);
    expect((await collector.handle(reportRequest({ "csp-report": {} }, { "content-length": "20000" }))).status).toBe(413);
  });

  it("rate limits requests without using client identity", async () => {
    const collector = createCspReportCollector({ log: () => undefined });
    for (let index = 0; index < 60; index += 1) {
      expect((await collector.handle(reportRequest({ "csp-report": {} }))).status).toBe(204);
    }
    expect((await collector.handle(reportRequest({ "csp-report": {} }))).status).toBe(429);
  });
});
