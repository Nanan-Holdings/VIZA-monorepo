import { describe, it, expect } from "vitest";
import { assertKnownCountry, normalizeCountry, LAUNCH_COUNTRIES } from "./countries";

/**
 * POR-009: the portal post-payment hook enqueues runner_job with a normalized
 * country code for all launch countries (QUE-004 contract). enqueueRunnerJob
 * calls assertKnownCountry(country) before insert, so these assertions cover
 * the normalization/validation that gates every enqueue. Idempotency
 * (no duplicate active jobs) is enforced in enqueueRunnerJob by reusing an
 * existing queued/running row for the same application_id.
 */
describe("runner_job country contract", () => {
  it("accepts and normalizes all launch countries", () => {
    for (const c of LAUNCH_COUNTRIES) {
      expect(assertKnownCountry(c)).toBe(c);
    }
  });

  it("normalizes ISO aliases to canonical codes (ID/SA/JP/US sample + more)", () => {
    expect(normalizeCountry("id")).toBe("indonesia");
    expect(normalizeCountry("sa")).toBe("saudi_arabia");
    expect(normalizeCountry("jp")).toBe("japan");
    expect(normalizeCountry("kr")).toBe("south_korea");
    expect(normalizeCountry("Korea")).toBe("south_korea");
    expect(normalizeCountry("us")).toBe("united_states");
    expect(normalizeCountry("GB")).toBe("united_kingdom");
    expect(normalizeCountry("United Kingdom")).toBe("united_kingdom");
  });

  it("assertKnownCountry maps aliases through to canonical before insert", () => {
    expect(assertKnownCountry("us")).toBe("united_states");
    expect(assertKnownCountry("jp")).toBe("japan");
    expect(assertKnownCountry("kr")).toBe("south_korea");
  });

  it("throws on an unknown country (never enqueues an unroutable job)", () => {
    expect(() => assertKnownCountry("narnia")).toThrow();
  });
});
