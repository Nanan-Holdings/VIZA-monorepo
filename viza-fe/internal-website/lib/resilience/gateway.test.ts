import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  createSignature,
  decryptResilienceValue,
  encryptResilienceValue,
} from "./gateway";

describe("resilience gateway cryptography", () => {
  it("round-trips an encrypted value without exposing plaintext", () => {
    const key = randomBytes(32).toString("base64");
    const value = { passportNumber: "E12345678", answers: { surname: "Chen" } };
    const blob = encryptResilienceValue(value, key);
    expect(blob).not.toContain("E12345678");
    expect(decryptResilienceValue(blob, key)).toEqual(value);
  });

  it("produces a stable canonical HMAC signature", () => {
    expect(createSignature({
      secret: "test-secret-that-is-at-least-thirty-two-characters",
      method: "post",
      path: "/v1/outbox/enqueue",
      timestamp: "1700000000",
      nonce: "nonce-1",
      rawBody: '{"ok":true}',
    })).toBe("1982e72fefbc080e7f04bfad4e2954785929e544b36f6e57156340c699cab387");
  });
});
