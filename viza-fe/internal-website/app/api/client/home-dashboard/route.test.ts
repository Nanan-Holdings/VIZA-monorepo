import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ClientHomeDashboardReadResult,
} from "@/lib/client/home-dashboard-reader.server";

const mocks = vi.hoisted(() => ({
  loadClientHomeDashboard: vi.fn(),
  recordPortalReadOutcome: vi.fn(),
}));

vi.mock("@/lib/client/home-dashboard-reader.server", async () => {
  const actual = await vi.importActual<typeof import("@/lib/client/home-dashboard-reader.server")>(
    "@/lib/client/home-dashboard-reader.server",
  );
  return {
    ...actual,
    loadClientHomeDashboard: mocks.loadClientHomeDashboard,
  };
});

vi.mock("@/lib/observability/portal-read", async () => {
  const actual = await vi.importActual<typeof import("@/lib/observability/portal-read")>(
    "@/lib/observability/portal-read",
  );
  return {
    ...actual,
    recordPortalReadOutcome: mocks.recordPortalReadOutcome,
  };
});

import { GET } from "./route";

const APPLICATION_ID = "11111111-1111-4111-8111-111111111111";

function readResult(
  overrides: Partial<ClientHomeDashboardReadResult["data"]> = {},
): ClientHomeDashboardReadResult {
  return {
    data: {
      authenticated: true,
      authEmail: "applicant@viza.test",
      profile: null,
      applications: [],
      documents: [],
      payments: [],
      ...overrides,
    },
    timeline: null,
    timelineApplicationId: null,
    timelinePartialData: false,
  };
}

afterEach(() => {
  mocks.loadClientHomeDashboard.mockReset();
  mocks.recordPortalReadOutcome.mockReset();
});

describe("GET /api/client/home-dashboard", () => {
  it("passes bounded selection hints and the request signal to the shared reader", async () => {
    const result = readResult();
    mocks.loadClientHomeDashboard.mockResolvedValue(result);
    const request = new Request(
      `http://127.0.0.1/api/client/home-dashboard?applicationId=${APPLICATION_ID}&country=SG&visaType=SG_ARRIVAL_CARD`,
    );

    const response = await GET(request);

    expect(mocks.loadClientHomeDashboard).toHaveBeenCalledWith(
      {
        includeTimeline: true,
        selection: {
          applicationId: APPLICATION_ID,
          country: "SG",
          visaType: "SG_ARRIVAL_CARD",
        },
      },
      request.signal,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    await expect(response.json()).resolves.toEqual({
      ...result.data,
      timeline: null,
      timelineApplicationId: null,
      timelinePartialData: false,
    });
  });

  it("ignores malformed or oversized hints without widening the read", async () => {
    const result = readResult();
    mocks.loadClientHomeDashboard.mockResolvedValue(result);
    const request = new Request(
      `http://127.0.0.1/api/client/home-dashboard?applicationId=not-a-uuid&country=${"x".repeat(129)}&visaType=SG_ARRIVAL_CARD`,
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mocks.loadClientHomeDashboard).toHaveBeenCalledWith(
      {
        includeTimeline: true,
        selection: { visaType: "SG_ARRIVAL_CARD" },
      },
      request.signal,
    );
  });

  it.each([
    readResult({ authenticated: false, authEmail: null }),
    readResult({
      authenticated: false,
      authEmail: null,
      error: "session_unavailable",
      unavailable: true,
    }),
  ])("returns the shared unauthenticated/unavailable DTO unchanged", async (result) => {
    mocks.loadClientHomeDashboard.mockResolvedValue(result);

    const response = await GET(new Request("http://127.0.0.1/api/client/home-dashboard"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ...result.data,
      timeline: null,
      timelineApplicationId: null,
      timelinePartialData: false,
    });
  });

  it("converts an unexpected reader failure to a fixed safe error DTO", async () => {
    mocks.loadClientHomeDashboard.mockRejectedValue(new Error("private provider detail"));

    const response = await GET(new Request("http://127.0.0.1/api/client/home-dashboard"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      authenticated: false,
      error: "dashboard_read_failed",
      unavailable: true,
      timeline: null,
      timelineApplicationId: null,
      timelinePartialData: false,
    });
    expect(JSON.stringify(body)).not.toContain("private provider detail");
  });

  it("keeps upstream cancellation visible in read telemetry", async () => {
    const controller = new AbortController();
    controller.abort(new DOMException("caller cancelled", "AbortError"));
    mocks.loadClientHomeDashboard.mockResolvedValue(readResult({
      authenticated: false,
      authEmail: null,
      error: "session_unavailable",
      unavailable: true,
    }));

    const request = {
      url: "http://127.0.0.1/api/client/home-dashboard",
      signal: controller.signal,
    } as Request;
    await GET(request);

    expect(mocks.recordPortalReadOutcome).toHaveBeenCalledWith("cancelled");
  });
});
