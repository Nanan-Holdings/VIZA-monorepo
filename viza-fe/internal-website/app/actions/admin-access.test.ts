import { describe, expect, it } from "vitest";
import { hashAdminInviteToken } from "@/lib/admin-invite-token";

describe("admin access invitation primitives", () => {
  it("stores only a deterministic SHA-256 digest", () => {
    const digest = hashAdminInviteToken("one-use-token");
    expect(digest).toHaveLength(64);
    expect(digest).toMatch(/^[a-f0-9]+$/);
    expect(hashAdminInviteToken("one-use-token")).toBe(digest);
    expect(hashAdminInviteToken("one-use-token-2")).not.toBe(digest);
  });
});
