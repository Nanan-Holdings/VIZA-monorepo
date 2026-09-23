import { afterEach, describe, expect, it } from "vitest";
import { authorizeMarketingCron } from "../cron-auth";

const original = process.env.CRON_SECRET;
afterEach(() => { if (original === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = original; });

describe("marketing cron authorization", () => {
  it("fails closed when the secret is missing", () => {
    delete process.env.CRON_SECRET;
    expect(authorizeMarketingCron(new Request("https://example.com", { headers: { Authorization: "Bearer value" } }))).toBe(false);
  });

  it("accepts only an exact bearer token", () => {
    process.env.CRON_SECRET = "viza-cron-secret";
    expect(authorizeMarketingCron(new Request("https://example.com", { headers: { Authorization: "Bearer viza-cron-secret" } }))).toBe(true);
    expect(authorizeMarketingCron(new Request("https://example.com", { headers: { Authorization: "Bearer wrong" } }))).toBe(false);
  });
});
