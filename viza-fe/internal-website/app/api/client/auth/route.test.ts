import { beforeEach, describe, expect, it, vi } from "vitest";

const signInWithPasswordMock = vi.hoisted(() => vi.fn());
const signInWithOtpMock = vi.hoisted(() => vi.fn());
const verifyOtpMock = vi.hoisted(() => vi.fn());
const getUserFromSupabaseSessionMock = vi.hoisted(() => vi.fn());
const createClientSessionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      signInWithPassword: signInWithPasswordMock,
      signInWithOtp: signInWithOtpMock,
      verifyOtp: verifyOtpMock,
    },
  })),
}));

vi.mock("@/lib/client-session", () => ({
  getUserFromSupabaseSession: getUserFromSupabaseSessionMock,
  createClientSession: createClientSessionMock,
}));

import { POST } from "./route";

function passwordRequest(): Request {
  return new Request("http://localhost/api/client/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      operation: "password",
      email: "applicant@example.com",
      password: "test-password",
    }),
  });
}

function verifyOtpRequest(): Request {
  return new Request("http://localhost/api/client/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      operation: "verify_otp",
      email: "applicant@example.com",
      token: "123456",
    }),
  });
}

describe("POST /api/client/auth", () => {
  beforeEach(() => {
    signInWithPasswordMock.mockReset();
    signInWithOtpMock.mockReset();
    verifyOtpMock.mockReset();
    getUserFromSupabaseSessionMock.mockReset();
    createClientSessionMock.mockReset();
  });

  it("bootstraps the signed client session after a successful password login", async () => {
    signInWithPasswordMock.mockResolvedValue({ error: null });
    getUserFromSupabaseSessionMock.mockResolvedValue({
      userId: "applicant-profile-id",
      email: "applicant@example.com",
    });

    const response = await POST(passwordRequest());

    await expect(response.json()).resolves.toEqual({ success: true });
    expect(getUserFromSupabaseSessionMock).toHaveBeenCalledWith({ requestTimeoutMs: 6_000 });
    expect(createClientSessionMock).toHaveBeenCalledWith(
      "applicant-profile-id",
      "applicant@example.com",
    );
  });

  it("bootstraps the signed client session after a successful OTP verification", async () => {
    verifyOtpMock.mockResolvedValue({ error: null });
    getUserFromSupabaseSessionMock.mockResolvedValue({
      userId: "applicant-profile-id",
      email: "applicant@example.com",
    });

    const response = await POST(verifyOtpRequest());

    await expect(response.json()).resolves.toEqual({ success: true });
    expect(getUserFromSupabaseSessionMock).toHaveBeenCalledWith({ requestTimeoutMs: 6_000 });
    expect(createClientSessionMock).toHaveBeenCalledWith(
      "applicant-profile-id",
      "applicant@example.com",
    );
  });

  it("keeps authentication successful when the client session bootstrap has no profile", async () => {
    signInWithPasswordMock.mockResolvedValue({ error: null });
    getUserFromSupabaseSessionMock.mockResolvedValue(null);

    const response = await POST(passwordRequest());

    await expect(response.json()).resolves.toEqual({ success: true });
    expect(createClientSessionMock).not.toHaveBeenCalled();
  });

  it("does not expose a client session bootstrap failure after authentication succeeds", async () => {
    signInWithPasswordMock.mockResolvedValue({ error: null });
    getUserFromSupabaseSessionMock.mockRejectedValue(new Error("profile lookup timed out"));

    const response = await POST(passwordRequest());

    await expect(response.json()).resolves.toEqual({ success: true });
  });

  it("maps a plain Supabase timeout error to provider_unavailable", async () => {
    signInWithPasswordMock.mockResolvedValue({
      error: { name: "AuthRetryableFetchError", message: "Supabase request timed out" },
    });

    const response = await POST(passwordRequest());

    await expect(response.json()).resolves.toEqual({
      success: false,
      code: "provider_unavailable",
      error: "The authentication provider is temporarily unavailable.",
    });
  });
});
