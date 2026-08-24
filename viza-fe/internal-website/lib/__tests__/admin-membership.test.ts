import { describe, expect, it, vi } from "vitest";
import { hasActiveAdminMembership } from "../admin-membership";

function membershipClient(result: { data: Record<string, unknown> | null; error: { message: string } | null }) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    is: vi.fn(() => query),
    maybeSingle: vi.fn(async () => result),
  };
  return { from: vi.fn(() => query) };
}

describe("admin membership lookup", () => {
  it("requires an active membership row", async () => {
    const client = membershipClient({ data: { id: "membership-1" }, error: null });
    await expect(hasActiveAdminMembership(client, "admin-1")).resolves.toBe(true);
    expect(client.from).toHaveBeenCalledWith("admin_memberships");
  });

  it("fails closed on missing tables or query errors", async () => {
    const client = membershipClient({ data: null, error: { message: "relation does not exist" } });
    await expect(hasActiveAdminMembership(client, "admin-1")).resolves.toBe(false);
  });
});
