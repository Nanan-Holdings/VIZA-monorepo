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
      openai: { configured: true, reachable: true, probed: true },
      travelService: { configured: true, reachable: false },
      sessionDatabase: { configured: true, reachable: true },
      places: { configured: true, reachable: true },
    });
    expect(payload.llmReachable).toBe(true);
    expect(JSON.stringify(payload)).not.toContain("test-openai-key");
    expect(JSON.stringify(payload)).not.toContain("test-service-role-key");
  });

  it("does not report Python success as OpenAI availability", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
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

  it("does not contact OpenAI during the passive page-load health check", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    vi.stubEnv("TRAVEL_BACKEND_URL", "http://travel-service.test");
    const fetchMock = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) =>
        new Response("", { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await getTravelHealth(
      new Request("http://127.0.0.1:3000/api/travel/health?probe=passive")
    );
    const payload = await response.json();

    expect(payload.services.openai).toEqual({
      configured: true,
      reachable: true,
      probed: false,
    });
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).includes("api.openai.com")
      )
    ).toBe(false);
  });
});
