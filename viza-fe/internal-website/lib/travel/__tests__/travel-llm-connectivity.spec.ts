import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as getTravelHealth } from "@/app/api/travel/health/route";

describe("travel service health boundaries", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("reports OpenAI, Python, session database, and Places independently", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    vi.stubEnv("CLIENT_SESSION_SECRET", "x".repeat(32));
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "test-google-key");
    vi.stubEnv("TRAVEL_BACKEND_URL", "http://travel-service.test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://supabase.test/");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL) =>
        new Response("", {
          status: String(url).includes("travel-service.test") ? 503 : 200,
        })
      )
    );

    const payload = await (await getTravelHealth()).json();
    expect(payload.ok).toBe(true);
    expect(payload.services).toEqual({
      openai: { configured: true, reachable: true },
      travelService: { configured: true, reachable: false },
      sessionDatabase: { configured: true, reachable: true },
      places: { configured: true, reachable: true },
      clientSession: { configured: true, reachable: true },
    });
    expect(payload.llmReachable).toBe(true);
    expect(JSON.stringify(payload)).not.toContain("test-openai-key");
    expect(JSON.stringify(payload)).not.toContain("test-service-role-key");
  });

  it("does not report Python success as OpenAI availability", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("CLIENT_SESSION_SECRET", "x".repeat(32));
    vi.stubEnv("TRAVEL_BACKEND_URL", "http://travel-service.test");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 200 }))
    );

    const payload = await (await getTravelHealth()).json();
    expect(payload.services.openai).toEqual({
      configured: false,
      reachable: false,
    });
    expect(payload.services.travelService.reachable).toBe(true);
    expect(payload.llmReachable).toBe(false);
  });

  it("probes the Travel session table with a bounded request", async () => {
    vi.stubEnv("CLIENT_SESSION_SECRET", "x".repeat(32));
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://supabase.test/");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
    const fetchMock = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) =>
        new Response("", { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const payload = await (await getTravelHealth()).json();
    const databaseRequest = fetchMock.mock.calls.find(([url]) =>
      String(url).includes("/rest/v1/travel_agent_sessions")
    );

    expect(payload.services.sessionDatabase.reachable).toBe(true);
    expect(databaseRequest?.[0]).toBe(
      "http://supabase.test/rest/v1/travel_agent_sessions?select=id&limit=1"
    );
    expect(databaseRequest?.[1]).toMatchObject({
      signal: expect.any(AbortSignal),
    });
  });

  it("reports an invalid client session secret without exposing it", async () => {
    vi.stubEnv("CLIENT_SESSION_SECRET", "too-short");
    const payload = await (await getTravelHealth()).json();

    expect(payload.ok).toBe(false);
    expect(payload.services.clientSession).toEqual({
      configured: false,
      reachable: false,
    });
    expect(JSON.stringify(payload)).not.toContain("too-short");
  });
});
