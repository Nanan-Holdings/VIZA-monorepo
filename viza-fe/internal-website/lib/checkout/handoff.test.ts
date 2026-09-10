import { describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { openCheckoutHandoff, sealCheckoutHandoff } from "./handoff";

vi.mock("server-only", () => ({}));

const key = Buffer.alloc(32, 7).toString("base64");
const payload = {
  paymentMethod: "card" as const,
  country: "indonesia",
  visaType: "evisa",
  locale: "zh-CN" as const,
  email: "person@example.com",
  fullName: "Example Person",
  prefill: "sensitive-prefill",
  betaToken: "VIZA50-SECRET",
};

describe("checkout handoff", () => {
  it("round-trips sensitive checkout state without plaintext leakage", () => {
    const sealed = sealCheckoutHandoff(payload, key);
    expect(sealed).not.toContain(payload.email);
    expect(sealed).not.toContain(payload.prefill);
    expect(sealed).not.toContain(payload.betaToken);
    expect(openCheckoutHandoff(sealed, key)).toMatchObject(payload);
  });

  it("rejects tampering and the wrong key", () => {
    const sealed = sealCheckoutHandoff(payload, key);
    expect(openCheckoutHandoff(`${sealed.slice(0, -2)}aa`, key)).toBeNull();
    expect(openCheckoutHandoff(sealed, Buffer.alloc(32, 8).toString("base64"))).toBeNull();
  });

  it("rejects expired handoffs", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-09T00:00:00Z"));
    const sealed = sealCheckoutHandoff(payload, key);
    vi.advanceTimersByTime(11 * 60 * 1_000);
    expect(openCheckoutHandoff(sealed, key)).toBeNull();
    vi.useRealTimers();
  });

  it("keeps the maximum accepted prefill inside a browser-safe cookie budget", () => {
    const sealed = sealCheckoutHandoff({
      ...payload,
      email: "a".repeat(300) + "@example.com",
      fullName: "N".repeat(200),
      prefill: randomBytes(1_950).toString("base64url"),
      betaToken: "B".repeat(128),
    }, key);
    expect(sealed.length).toBeLessThan(4_000);
    expect(openCheckoutHandoff(sealed, key)?.prefill).toHaveLength(2_600);
  });
});
