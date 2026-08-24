import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser } })),
}));

import { GET } from "./route";

describe("online capacity session probe", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    getUser.mockReset();
  });

  it("is unavailable unless the non-production capacity marker is enabled", async () => {
    const response = await GET();
    expect(response.status).toBe(404);
    expect(getUser).not.toHaveBeenCalled();
  });

  it("returns only the exact synthetic user proof without profile writes", async () => {
    vi.stubEnv("ONLINE_CAPACITY_TARGET_ENABLED", "true");
    getUser.mockResolvedValue({
      data: {
        user: {
          id: "11111111-1111-4111-8111-111111111111",
          email: "capacity@viza.test",
        },
      },
      error: null,
    });

    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      valid: true,
      sessionKind: "supabase",
      userId: "11111111-1111-4111-8111-111111111111",
      syntheticAccount: true,
    });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it("rejects ordinary applicant accounts", async () => {
    vi.stubEnv("ONLINE_CAPACITY_TARGET_ENABLED", "true");
    getUser.mockResolvedValue({
      data: { user: { id: "user-id", email: "applicant@example.com" } },
      error: null,
    });

    const response = await GET();
    expect(response.status).toBe(401);
    expect((await response.json()).valid).toBe(false);
  });
});
