import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getImpersonationSession: vi.fn(),
  getUserFromSupabaseSession: vi.fn(),
  getClientSession: vi.fn(),
}));

vi.mock("@/lib/impersonation-session", () => ({
  getImpersonationSession: authMocks.getImpersonationSession,
}));

vi.mock("@/lib/client-session", () => ({
  getUserFromSupabaseSession: authMocks.getUserFromSupabaseSession,
  getClientSession: authMocks.getClientSession,
}));

import { getTravelUserSession } from "@/lib/travel/auth";

describe("Travel authenticated session resolver", () => {
  beforeEach(() => {
    authMocks.getImpersonationSession.mockReset().mockResolvedValue(null);
    authMocks.getUserFromSupabaseSession.mockReset().mockResolvedValue(null);
    authMocks.getClientSession.mockReset().mockResolvedValue(null);
  });

  it("prefers an active impersonation session", async () => {
    authMocks.getImpersonationSession.mockResolvedValue({
      userId: "impersonated-applicant",
    });

    await expect(getTravelUserSession()).resolves.toEqual({
      userId: "impersonated-applicant",
      sessionKind: "impersonation",
    });
    expect(authMocks.getUserFromSupabaseSession).not.toHaveBeenCalled();
    expect(authMocks.getClientSession).not.toHaveBeenCalled();
  });

  it("uses the Supabase applicant session when available", async () => {
    authMocks.getUserFromSupabaseSession.mockResolvedValue({
      userId: "supabase-applicant",
    });

    await expect(getTravelUserSession()).resolves.toEqual({
      userId: "supabase-applicant",
      sessionKind: "supabase",
    });
    expect(authMocks.getClientSession).toHaveBeenCalledOnce();
  });

  it("prefers the signed client session used by the portal", async () => {
    authMocks.getClientSession.mockResolvedValue({
      userId: "legacy-applicant",
    });

    await expect(getTravelUserSession()).resolves.toEqual({
      userId: "legacy-applicant",
      sessionKind: "client_session",
    });
    expect(authMocks.getUserFromSupabaseSession).not.toHaveBeenCalled();
  });

  it("returns null when no accepted client identity exists", async () => {
    await expect(getTravelUserSession()).resolves.toBeNull();
  });
});
