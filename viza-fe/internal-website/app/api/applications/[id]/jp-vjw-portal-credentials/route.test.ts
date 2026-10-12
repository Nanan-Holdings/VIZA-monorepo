import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, getUser, getSession } = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { POST } from "./route";

describe("Visit Japan Web portal credential proxy", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    createClient.mockReset();
    getUser.mockReset();
    getSession.mockReset();
    createClient.mockResolvedValue({ auth: { getUser, getSession } });
  });

  it("rejects unauthenticated requests without contacting the backend", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: "application-id" }),
    });

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards the owner bearer token only on an explicit POST and disables caching", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-id" } }, error: null });
    getSession.mockResolvedValue({ data: { session: { access_token: "owner-token" } } });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      email: "application@viza.it.com",
      password: "TestPassword2!",
      portalUrl: "https://www.vjw.digital.go.jp/",
      revealedAt: "2026-08-27T00:00:00.000Z",
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ id: "application-id" }),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/applications/application-id/jp-vjw/account/reveal"),
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        headers: { Authorization: "Bearer owner-token" },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    await expect(response.json()).resolves.toMatchObject({
      email: "application@viza.it.com",
      password: "TestPassword2!",
    });
  });

  it("uses the canonical production backend when no backend URL is configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AGENT_BACKEND_URL", "");
    vi.stubEnv("NEXT_PUBLIC_AGENT_BACKEND_URL", "");
    getUser.mockResolvedValue({ data: { user: { id: "user-id" } }, error: null });
    getSession.mockResolvedValue({ data: { session: { access_token: "owner-token" } } });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      email: "application@viza.it.com",
      password: "TestPassword2!",
      portalUrl: "https://www.vjw.digital.go.jp/",
      revealedAt: "2026-08-27T00:00:00.000Z",
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ id: "application-id" }),
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://viza-agent-backend-gqix.onrender.com/api/applications/application-id/jp-vjw/account/reveal",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("retries one transient network failure for the read-only reveal request", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AGENT_BACKEND_URL", "https://configured-backend.example.com/");
    getUser.mockResolvedValue({ data: { user: { id: "user-id" } }, error: null });
    getSession.mockResolvedValue({ data: { session: { access_token: "owner-token" } } });
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        email: "application@viza.it.com",
        password: "TestPassword2!",
        portalUrl: "https://www.vjw.digital.go.jp/",
        revealedAt: "2026-08-27T00:00:00.000Z",
      }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ id: "application-id" }),
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://configured-backend.example.com/api/applications/application-id/jp-vjw/account/reveal",
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://viza-agent-backend-gqix.onrender.com/api/applications/application-id/jp-vjw/account/reveal",
    );
  });

  it("returns a no-store 503 when both reveal attempts fail", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AGENT_BACKEND_URL", "");
    vi.stubEnv("NEXT_PUBLIC_AGENT_BACKEND_URL", "");
    getUser.mockResolvedValue({ data: { user: { id: "user-id" } }, error: null });
    getSession.mockResolvedValue({ data: { session: { access_token: "owner-token" } } });
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ id: "application-id" }),
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});
