import { beforeEach, describe, expect, it, vi } from "vitest";

const signInWithPasswordMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      signInWithPassword: signInWithPasswordMock,
    },
  })),
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

describe("POST /api/client/auth", () => {
  beforeEach(() => {
    signInWithPasswordMock.mockReset();
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
