import { describe, expect, it } from "vitest";

import { AUTH_REQUEST_TIMEOUT_MS } from "@/app/client/(auth)/login/page";
import { SUPABASE_AUTH_TIMEOUT_MS } from "./route";

describe("client auth timeout budget", () => {
  it("allows production Supabase auth calls to exceed the old 6 second cutoff", () => {
    expect(SUPABASE_AUTH_TIMEOUT_MS).toBeGreaterThanOrEqual(18_000);
  });

  it("keeps the browser request window longer than the server auth window", () => {
    expect(AUTH_REQUEST_TIMEOUT_MS).toBeGreaterThan(SUPABASE_AUTH_TIMEOUT_MS);
  });
});
