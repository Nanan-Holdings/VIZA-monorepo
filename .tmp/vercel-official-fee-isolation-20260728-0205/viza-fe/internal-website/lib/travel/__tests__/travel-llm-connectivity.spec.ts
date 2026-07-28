import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as getTravelHealth } from "@/app/api/travel/health/route";

describe("travel LLM connectivity health", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("reports configured LLM and reachable travel backend without exposing keys", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "test-google-key");
    vi.stubEnv("TRAVEL_BACKEND_URL", "http://travel-service.test");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 200 }))
    );

    const response = await getTravelHealth();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      llmConfigured: true,
      llmReachable: true,
      googlePlacesConfigured: true,
      cacheReachable: false,
      travelBackendReachable: true,
    });
    expect(JSON.stringify(payload)).not.toContain("test-openai-key");
    expect(JSON.stringify(payload)).not.toContain("test-google-key");
  });

  it("reports LLM unavailable when the key is missing", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "");
    vi.stubEnv("TRAVEL_BACKEND_URL", "http://travel-service.test");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 200 }))
    );

    const response = await getTravelHealth();
    const payload = await response.json();

    expect(payload.ok).toBe(false);
    expect(payload.llmConfigured).toBe(false);
    expect(payload.llmReachable).toBe(false);
    expect(payload.travelBackendReachable).toBe(true);
  });

  it("bounds the optional Supabase cache probe with an abort signal", async () => {
    vi.stubEnv("TRAVEL_BACKEND_URL", "http://travel-service.test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://supabase.test/");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
    const fetchMock = vi.fn(async () => new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await getTravelHealth();
    const payload = await response.json();
    const cacheRequest = fetchMock.mock.calls.find(([url]) =>
      String(url).includes("/rest/v1/travel_destinations")
    );

    expect(payload.cacheReachable).toBe(true);
    expect(cacheRequest?.[0]).toBe(
      "http://supabase.test/rest/v1/travel_destinations?select=id&limit=1"
    );
    expect(cacheRequest?.[1]).toMatchObject({
      signal: expect.any(AbortSignal),
    });
  });
});
