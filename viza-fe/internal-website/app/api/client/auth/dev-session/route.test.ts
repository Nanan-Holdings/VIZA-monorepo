import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientSessionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/client-session", () => ({
  createClientSession: createClientSessionMock,
}));

import { LOCAL_TEST_SESSION_COOKIE_NAME } from "@/lib/client-dev-session";
import { POST } from "./route";

function request(host = "localhost:3000") {
  return new Request("http://localhost:3000/api/client/auth/dev-session", {
    method: "POST",
    headers: { host },
  });
}

describe("POST /api/client/auth/dev-session", () => {
  beforeEach(() => {
    createClientSessionMock.mockReset();
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ENABLE_LOCAL_TEST_SESSION", "true");
    vi.stubEnv("LOCAL_TEST_CLIENT_ID", "00000000-0000-4000-8000-000000000777");
    vi.stubEnv("LOCAL_TEST_CLIENT_EMAIL", "mock-interview@example.invalid");
  });

  it("creates a signed local test session and marks the browser as a local dev session", async () => {
    const response = await POST(request());

    await expect(response.json()).resolves.toEqual({
      success: true,
      redirectTo: "/client/home",
    });
    expect(createClientSessionMock).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000777",
      "mock-interview@example.invalid",
    );
    expect(response.headers.get("set-cookie")).toContain(
      `${LOCAL_TEST_SESSION_COOKIE_NAME}=1`,
    );
  });

  it("stays unavailable outside the explicit local development gate", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const response = await POST(request("app.viza.it.com"));

    expect(response.status).toBe(404);
    expect(createClientSessionMock).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it.each([
    { host: "preview.viza.it.com", nodeEnv: "production", enabled: "true" },
    { host: "localhost:3000", nodeEnv: "production", enabled: "true" },
    { host: "localhost:3000", nodeEnv: "development", enabled: "false" },
    { host: "192.168.0.14:3000", nodeEnv: "development", enabled: "true" },
  ])("fails closed for %#", async ({ host, nodeEnv, enabled }) => {
    vi.stubEnv("NODE_ENV", nodeEnv);
    vi.stubEnv("ENABLE_LOCAL_TEST_SESSION", enabled);

    const response = await POST(request(host));

    expect(response.status).toBe(404);
    expect(createClientSessionMock).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
