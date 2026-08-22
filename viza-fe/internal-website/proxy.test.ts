// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getClientSessionFromRequest: vi.fn(),
  getImpersonationSessionFromRequest: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient,
}));

vi.mock("@/lib/client-session", () => ({
  getClientSessionFromRequest: mocks.getClientSessionFromRequest,
}));

vi.mock("@/lib/impersonation-session", () => ({
  getImpersonationSessionFromRequest: mocks.getImpersonationSessionFromRequest,
}));

vi.mock("@/lib/supabase/env", () => ({
  normalizeSupabaseEnvValue: () => "test-value",
}));

vi.mock("@/lib/supabase/fetch-with-timeout", () => ({
  createFetchWithTimeout: () => fetch,
}));

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: vi.fn(),
}));

vi.mock("@/app/client/about-me-form/redirect-target", () => ({
  getAboutMeRedirectTarget: () => "/client/application",
  isRetiredAboutMeRoute: () => false,
}));

import { proxy } from "./proxy";

const rotatedCookie = {
  name: "sb-test-auth-token",
  value: "rotated-session",
  options: { httpOnly: true, path: "/", sameSite: "lax" as const },
};

describe("client Supabase session cookie propagation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getClientSessionFromRequest.mockResolvedValue(null);
    mocks.getImpersonationSessionFromRequest.mockResolvedValue(null);
    mocks.createServerClient.mockImplementation((_url, _key, options) => ({
      auth: {
        getClaims: async () => {
          options.cookies.setAll([rotatedCookie]);
          return {
            data: {
              claims: {
                sub: "00000000-0000-4000-8000-000000000001",
                email: "client@example.com",
              },
            },
          };
        },
      },
    }));
  });

  it("returns rotated cookies on protected client routes", async () => {
    const response = await proxy(
      new NextRequest("https://app.viza.it.com/client/home"),
    );

    expect(response.status).toBe(200);
    expect(response.cookies.get(rotatedCookie.name)?.value).toBe(
      rotatedCookie.value,
    );
  });

  it("copies rotated cookies onto the authenticated login redirect", async () => {
    const response = await proxy(
      new NextRequest("https://app.viza.it.com/client/login"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://app.viza.it.com/client/home",
    );
    expect(response.cookies.get(rotatedCookie.name)?.value).toBe(
      rotatedCookie.value,
    );
  });

  it("copies session cleanup cookies onto an unauthenticated redirect", async () => {
    mocks.createServerClient.mockImplementationOnce((_url, _key, options) => ({
      auth: {
        getClaims: async () => {
          options.cookies.setAll([{ ...rotatedCookie, value: "" }]);
          return { data: { claims: null } };
        },
      },
    }));

    const response = await proxy(
      new NextRequest("https://app.viza.it.com/client/home"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://app.viza.it.com/client/login",
    );
    expect(response.cookies.get(rotatedCookie.name)?.value).toBe("");
  });
});
