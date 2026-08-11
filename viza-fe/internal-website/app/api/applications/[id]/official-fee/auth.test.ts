import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getClientSessionFromRequest: vi.fn(),
  getUser: vi.fn(),
  maybeSingle: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/client-session", () => ({
  getClientSessionFromRequest: mocks.getClientSessionFromRequest,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mocks.getUser } })),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from: mocks.from })),
}));

import { createClient } from "@/lib/supabase/server";
import { resolveOfficialFeeApplicantAuth } from "./auth";

describe("resolveOfficialFeeApplicantAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
    mocks.select.mockReturnValue({ eq: mocks.eq });
    mocks.from.mockReturnValue({ select: mocks.select });
  });

  it("accepts the signed client_session without requiring a Supabase refresh", async () => {
    mocks.getClientSessionFromRequest.mockResolvedValue({
      userId: "profile-legacy",
      email: "managed@example.invalid",
    });
    mocks.maybeSingle.mockResolvedValue({
      data: { id: "profile-legacy", auth_user_id: "auth-linked" },
      error: null,
    });

    const result = await resolveOfficialFeeApplicantAuth({} as never);

    expect(result).toEqual({
      ok: true,
      profileId: "profile-legacy",
      actorId: "auth-linked",
      source: "client_session",
    });
    expect(createClient).not.toHaveBeenCalled();
    expect(mocks.eq).toHaveBeenCalledWith("id", "profile-legacy");
  });

  it("falls back to the Supabase user when no client_session exists", async () => {
    mocks.getClientSessionFromRequest.mockResolvedValue(null);
    mocks.getUser.mockResolvedValue({ data: { user: { id: "auth-supabase" } } });
    mocks.maybeSingle.mockResolvedValue({
      data: { id: "profile-supabase", auth_user_id: "auth-supabase" },
      error: null,
    });

    const result = await resolveOfficialFeeApplicantAuth({} as never);

    expect(result).toEqual({
      ok: true,
      profileId: "profile-supabase",
      actorId: "auth-supabase",
      source: "supabase",
    });
    expect(mocks.eq).toHaveBeenCalledWith("auth_user_id", "auth-supabase");
  });

  it("returns 401 only when neither supported session is valid", async () => {
    mocks.getClientSessionFromRequest.mockResolvedValue(null);
    mocks.getUser.mockResolvedValue({ data: { user: null } });

    await expect(resolveOfficialFeeApplicantAuth({} as never)).resolves.toEqual({
      ok: false,
      error: "Not authenticated",
      status: 401,
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
