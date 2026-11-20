import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, getUser, getSession, getProfileId, getImpersonationSession } = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  getSession: vi.fn(),
  getProfileId: vi.fn(),
  getImpersonationSession: vi.fn(),
}));

vi.mock("@/lib/application-api-auth", () => ({
  getApplicationApiApplicantProfileId: getProfileId,
}));
vi.mock("@/lib/impersonation-session", () => ({ getImpersonationSession }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { GET, POST } from "./route";

describe("UK portal credentials route", () => {
  beforeEach(() => {
    getProfileId.mockReset();
    getImpersonationSession.mockReset();
    createClient.mockReset();
    getUser.mockReset();
    getSession.mockReset();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    getImpersonationSession.mockResolvedValue(null);
    createClient.mockResolvedValue({ auth: { getUser, getSession } });
  });

  it("requires an authenticated applicant", async () => {
    getProfileId.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("never returns runner-managed UKVI credentials to a customer", async () => {
    getProfileId.mockResolvedValue("applicant-id");

    const response = await GET();
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(410);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(JSON.stringify(body)).not.toMatch(/password|cipher|resume/i);
  });

  it("rejects staff impersonation before reading a Supabase session", async () => {
    getImpersonationSession.mockResolvedValue({ userId: "impersonated-applicant" });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ id: "application-id" }),
    });

    expect(response.status).toBe(403);
    expect(createClient).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("forwards the owner bearer token only on explicit POST and returns sanitized credentials", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "owner-id" } }, error: null });
    getSession.mockResolvedValue({ data: { session: { access_token: "owner-token" } } });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      email: "application@viza.it.com",
      password: "TestPassword2!",
      resumeUrl: "https://visas-immigration.service.gov.uk/forceResume/example",
      revealedAt: "2026-11-20T00:00:00.000Z",
      passwordEncrypted: "must-not-cross-boundary",
      applicantId: "must-not-cross-boundary",
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ id: "application-id" }),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/applications/application-id/uk-account/reveal"),
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        headers: { Authorization: "Bearer owner-token" },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    await expect(response.json()).resolves.toEqual({
      email: "application@viza.it.com",
      password: "TestPassword2!",
      resumeUrl: "https://visas-immigration.service.gov.uk/forceResume/example",
      revealedAt: "2026-11-20T00:00:00.000Z",
    });
  });

  it("does not forward upstream secret-bearing errors", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "owner-id" } }, error: null });
    getSession.mockResolvedValue({ data: { session: { access_token: "owner-token" } } });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: "password=super-secret applicant-token",
    }), { status: 409, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ id: "application-id" }),
    });
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(409);
    expect(JSON.stringify(body)).not.toContain("super-secret");
    expect(JSON.stringify(body)).not.toContain("applicant-token");
    expect(body).toEqual({ error: "The UK managed account is not available" });
  });

  it("fails closed when the backend response is incomplete", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "owner-id" } }, error: null });
    getSession.mockResolvedValue({ data: { session: { access_token: "owner-token" } } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      email: "application@viza.it.com",
      password: "TestPassword2!",
    }), { status: 200, headers: { "Content-Type": "application/json" } })));

    const response = await POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ id: "application-id" }),
    });
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(502);
    expect(body).toEqual({ error: "UK managed account response was incomplete" });
    expect(JSON.stringify(body)).not.toContain("TestPassword2!");
  });

  it("returns a no-store 503 after bounded network failures", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "owner-id" } }, error: null });
    getSession.mockResolvedValue({ data: { session: { access_token: "owner-token" } } });
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ id: "application-id" }),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});
