import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getClientSessionMock,
  getUserFromSupabaseSessionMock,
  getImpersonationSessionMock,
} = vi.hoisted(() => ({
  getClientSessionMock: vi.fn(),
  getUserFromSupabaseSessionMock: vi.fn(),
  getImpersonationSessionMock: vi.fn(),
}));

vi.mock("@/lib/client-session", () => ({
  getClientSession: getClientSessionMock,
  getUserFromSupabaseSession: getUserFromSupabaseSessionMock,
}));

vi.mock("@/lib/impersonation-session", () => ({
  getImpersonationSession: getImpersonationSessionMock,
}));

import {
  clientSessionOwnsApplicant,
  getApplicationApiApplicantProfileId,
  getOwnedApplicantSession,
} from "@/lib/application-api-auth";

describe("application applicant session ownership", () => {
  const owner = {
    id: "profile-owner",
    auth_user_id: "auth-owner",
    dependant_of_user_id: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    getImpersonationSessionMock.mockResolvedValue(null);
    getClientSessionMock.mockResolvedValue(null);
    getUserFromSupabaseSessionMock.mockResolvedValue(null);
  });

  it("bounds the Supabase fallback used by application API ownership checks", async () => {
    getUserFromSupabaseSessionMock.mockResolvedValue({
      userId: "profile-owner",
      email: "owner@example.com",
    });

    await expect(getApplicationApiApplicantProfileId()).resolves.toBe("profile-owner");
    expect(getUserFromSupabaseSessionMock).toHaveBeenCalledWith({
      requestTimeoutMs: 4_000,
      retryDelaysMs: [],
    });
  });

  it("allows an interactive API to extend the Supabase identity timeout", async () => {
    getUserFromSupabaseSessionMock.mockResolvedValue({
      userId: "profile-owner",
      email: "owner@example.com",
    });

    await expect(getApplicationApiApplicantProfileId({
      supabaseRequestTimeoutMs: 8_000,
    })).resolves.toBe("profile-owner");
    expect(getUserFromSupabaseSessionMock).toHaveBeenCalledWith({
      requestTimeoutMs: 8_000,
      retryDelaysMs: [],
    });
  });

  it("accepts profile-id and auth-user-id ownership", () => {
    expect(clientSessionOwnsApplicant(owner, {
      userId: "profile-owner",
      email: "owner@example.com",
    })).toBe(true);
    expect(clientSessionOwnsApplicant(owner, {
      userId: "different-profile",
      authUserId: "auth-owner",
      email: "owner@example.com",
    })).toBe(true);
  });

  it("uses the preferred session without consulting another identity", async () => {
    const preferred = {
      userId: "profile-owner",
      email: "owner@example.com",
    };

    await expect(getOwnedApplicantSession(owner, preferred)).resolves.toEqual(preferred);
    expect(getClientSessionMock).not.toHaveBeenCalled();
    expect(getUserFromSupabaseSessionMock).not.toHaveBeenCalled();
  });

  it("falls back to a Supabase session that independently owns the target", async () => {
    getClientSessionMock.mockResolvedValue({
      userId: "stale-profile",
      email: "stale@example.com",
    });
    const supabaseOwner = {
      userId: "profile-owner",
      authUserId: "auth-owner",
      email: "owner@example.com",
    };
    getUserFromSupabaseSessionMock.mockResolvedValue(supabaseOwner);

    await expect(getOwnedApplicantSession(owner, {
      userId: "stale-profile",
      email: "stale@example.com",
    })).resolves.toEqual(supabaseOwner);
  });

  it("fails closed when neither current session owns the target", async () => {
    getClientSessionMock.mockResolvedValue({
      userId: "profile-a",
      email: "a@example.com",
    });
    getUserFromSupabaseSessionMock.mockResolvedValue({
      userId: "profile-b",
      authUserId: "auth-b",
      email: "b@example.com",
    });

    await expect(getOwnedApplicantSession(owner)).resolves.toBeNull();
  });
});
