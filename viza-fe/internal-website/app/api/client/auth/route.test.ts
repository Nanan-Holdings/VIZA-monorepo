import { beforeEach, describe, expect, it, vi } from "vitest";

const signInWithPasswordMock = vi.hoisted(() => vi.fn());
const signInWithOtpMock = vi.hoisted(() => vi.fn());
const verifyOtpMock = vi.hoisted(() => vi.fn());
const createClientMock = vi.hoisted(() => vi.fn());
const getUserFromSupabaseSessionMock = vi.hoisted(() => vi.fn());
const createClientSessionMock = vi.hoisted(() => vi.fn());
const clearClientSessionMock = vi.hoisted(() => vi.fn());
const cacheContinuityIdentityMock = vi.hoisted(() => vi.fn());
const sendContinuityOtpMock = vi.hoisted(() => vi.fn());
const verifyContinuityOtpMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock.mockImplementation(async () => ({
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
  clearClientSession: clearClientSessionMock,
}));

vi.mock("@/lib/resilience/continuity-auth", () => ({
  cacheContinuityIdentity: cacheContinuityIdentityMock,
  sendContinuityOtp: sendContinuityOtpMock,
  verifyContinuityOtp: verifyContinuityOtpMock,
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

function sendOtpRequest(): Request {
  return new Request("http://localhost/api/client/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      operation: "send_otp",
      email: "applicant@example.com",
    }),
  });
}

describe("POST /api/client/auth", () => {
  beforeEach(() => {
    signInWithPasswordMock.mockReset();
    signInWithOtpMock.mockReset();
    verifyOtpMock.mockReset();
    createClientMock.mockClear();
    getUserFromSupabaseSessionMock.mockReset();
    createClientSessionMock.mockReset();
    clearClientSessionMock.mockReset();
    cacheContinuityIdentityMock.mockReset();
    cacheContinuityIdentityMock.mockResolvedValue(undefined);
    sendContinuityOtpMock.mockReset();
    sendContinuityOtpMock.mockResolvedValue(false);
    verifyContinuityOtpMock.mockReset();
  });

  it("allows hosted email delivery enough time to return its real result", async () => {
    signInWithOtpMock.mockResolvedValue({ error: null });

    const response = await POST(sendOtpRequest());

    await expect(response.json()).resolves.toEqual({ success: true });
    expect(createClientMock).toHaveBeenCalledWith({
      requestTimeoutMs: 20_000,
      retryDelaysMs: [],
      circuitBreakerScope: "auth",
    });
  });

  it("bootstraps the signed client session after a successful password login", async () => {
    signInWithPasswordMock.mockResolvedValue({ error: null });
    getUserFromSupabaseSessionMock.mockResolvedValue({
      userId: "applicant-profile-id",
      email: "applicant@example.com",
      authUserId: "supabase-auth-id",
    });

    const response = await POST(passwordRequest());

    await expect(response.json()).resolves.toEqual({ success: true });
    expect(clearClientSessionMock).toHaveBeenCalledOnce();
    expect(getUserFromSupabaseSessionMock).toHaveBeenCalledWith({
      requestTimeoutMs: 500,
      retryDelaysMs: [],
    });
    expect(clearClientSessionMock.mock.invocationCallOrder[0]).toBeLessThan(
      getUserFromSupabaseSessionMock.mock.invocationCallOrder[0],
    );
    expect(createClientSessionMock).toHaveBeenCalledWith(
      "applicant-profile-id",
      "applicant@example.com",
      "supabase-auth-id",
    );
  });

  it("bootstraps the signed client session after a successful OTP verification", async () => {
    verifyOtpMock.mockResolvedValue({ error: null });
    getUserFromSupabaseSessionMock.mockResolvedValue({
      userId: "applicant-profile-id",
      email: "applicant@example.com",
      authUserId: "supabase-auth-id",
    });

    const response = await POST(verifyOtpRequest());

    await expect(response.json()).resolves.toEqual({ success: true });
    expect(clearClientSessionMock).toHaveBeenCalledOnce();
    expect(getUserFromSupabaseSessionMock).toHaveBeenCalledWith({
      requestTimeoutMs: 500,
      retryDelaysMs: [],
    });
    expect(clearClientSessionMock.mock.invocationCallOrder[0]).toBeLessThan(
      getUserFromSupabaseSessionMock.mock.invocationCallOrder[0],
    );
    expect(createClientSessionMock).toHaveBeenCalledWith(
      "applicant-profile-id",
      "applicant@example.com",
      "supabase-auth-id",
    );
  });

  it("keeps authentication successful when the client session bootstrap has no profile", async () => {
    signInWithPasswordMock.mockResolvedValue({ error: null });
    getUserFromSupabaseSessionMock.mockResolvedValue(null);

    const response = await POST(passwordRequest());

    await expect(response.json()).resolves.toEqual({ success: true });
    expect(clearClientSessionMock).toHaveBeenCalledOnce();
    expect(createClientSessionMock).not.toHaveBeenCalled();
  });

  it("does not expose a client session bootstrap failure after authentication succeeds", async () => {
    signInWithPasswordMock.mockResolvedValue({ error: null });
    getUserFromSupabaseSessionMock.mockRejectedValue(new Error("profile lookup timed out"));

    const response = await POST(passwordRequest());

    await expect(response.json()).resolves.toEqual({ success: true });
    expect(clearClientSessionMock).toHaveBeenCalledOnce();
  });

  it("maps a plain Supabase timeout error to the continuity OTP path", async () => {
    signInWithPasswordMock.mockResolvedValue({
      error: { name: "AuthRetryableFetchError", message: "Supabase request timed out" },
    });

    const response = await POST(passwordRequest());

    expect(response.status).toBe(503);
    expect(response.headers.get("x-viza-request-id")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: "continuity_otp_sent",
      error: "A continuity sign-in code was sent because the authentication provider is unavailable.",
    });
    expect(sendContinuityOtpMock).toHaveBeenCalledWith("applicant@example.com");
    expect(clearClientSessionMock).not.toHaveBeenCalled();
  });

  it("maps an Auth 500 dependency failure to a continuity OTP", async () => {
    signInWithPasswordMock.mockResolvedValue({
      error: {
        name: "AuthApiError",
        message: "Database error querying schema",
        code: "unexpected_failure",
        status: 500,
      },
    });
    sendContinuityOtpMock.mockResolvedValue(true);

    const response = await POST(passwordRequest());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: "continuity_otp_sent",
      error: "A continuity sign-in code was sent because the authentication provider is unavailable.",
    });
    expect(sendContinuityOtpMock).toHaveBeenCalledWith("applicant@example.com");
  });

  it("preserves HTTP status semantics for invalid credentials and input", async () => {
    signInWithPasswordMock.mockResolvedValue({
      error: { name: "AuthApiError", message: "Invalid login credentials", status: 400 },
    });

    const authResponse = await POST(passwordRequest());
    const inputResponse = await POST(new Request("http://localhost/api/client/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation: "password", email: "invalid" }),
    }));

    expect(authResponse.status).toBe(401);
    expect(inputResponse.status).toBe(400);
  });

  it("falls back to an independent continuity OTP when Supabase Auth times out", async () => {
    signInWithOtpMock.mockResolvedValue({
      error: { name: "AuthRetryableFetchError", message: "request timed out" },
    });
    sendContinuityOtpMock.mockResolvedValue(true);

    const response = await POST(new Request("http://localhost/api/client/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation: "send_otp", email: "applicant@example.com" }),
    }));

    await expect(response.json()).resolves.toEqual({ success: true, continuity: true });
    expect(sendContinuityOtpMock).toHaveBeenCalledWith("applicant@example.com");
  });

  it("creates a VIZA session after an atomic continuity OTP verification", async () => {
    verifyOtpMock.mockResolvedValue({
      error: { name: "AuthRetryableFetchError", message: "request timed out" },
    });
    verifyContinuityOtpMock.mockResolvedValue({
      userId: "applicant-profile-id",
      email: "applicant@example.com",
      authUserId: "supabase-auth-id",
    });

    const response = await POST(verifyOtpRequest());

    await expect(response.json()).resolves.toEqual({ success: true, continuity: true });
    expect(createClientSessionMock).toHaveBeenCalledWith(
      "applicant-profile-id",
      "applicant@example.com",
      "supabase-auth-id",
    );
  });
});
