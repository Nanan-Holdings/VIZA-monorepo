import { describe, expect, it } from "vitest";
import { countryCode, referrerHost, sessionHash, userAgentFamily } from "../tracking";

describe("privacy-safe short-link tracking", () => {
  it("retains only the referrer hostname and coarse user agent family", () => {
    expect(referrerHost("https://search.example/path?q=private")).toBe("search.example");
    expect(userAgentFamily("Mozilla/5.0 secret Chrome/130.0.0.0 Safari/537.36")).toBe("Chrome");
  });

  it("validates country and hashes only the dedicated session cookie when salted", () => {
    expect(countryCode("sg")).toBe("SG");
    expect(countryCode("Singapore")).toBeNull();
    const hash = sessionHash("other=secret; viza_marketing_session=abcdefghijklmnop", "separate-viza-salt");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain("abcdefghijklmnop");
    expect(sessionHash("viza_marketing_session=abcdefghijklmnop", undefined)).toBeNull();
  });
});
