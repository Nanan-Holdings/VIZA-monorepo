// @vitest-environment node

import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getClientSessionWithFallback, getImpersonationSession } = vi.hoisted(() => ({
  getClientSessionWithFallback: vi.fn(),
  getImpersonationSession: vi.fn(),
}));

vi.mock("@/lib/client-session", () => ({ getClientSessionWithFallback }));
vi.mock("@/lib/impersonation-session", () => ({ getImpersonationSession }));

import { getVisaFormSteps } from "./visa-form-fields";
import { clearStaticVisaMetadataCache } from "@/lib/static-visa-metadata-cache";

const AUTH_USER_ID = "11111111-1111-4111-8111-111111111111";
const DS160_ROW = {
  id: "22222222-2222-4222-8222-222222222222",
  visa_type: "DS160",
  field_name: "synthetic_ds160_field",
  label: "Synthetic DS-160 field",
  field_type: "text",
  required: false,
  step_number: 1,
  step_name: "Personal Information",
  display_order: 1,
  placeholder: null,
  validation_rules: null,
  options: null,
  conditional_logic: null,
  created_at: null,
  updated_at: null,
};

let server: Server | undefined;
let timers: Set<ReturnType<typeof setTimeout>>;

afterEach(async () => {
  for (const timer of timers ?? []) clearTimeout(timer);
  server?.closeAllConnections();
  if (server?.listening) {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
  }
  server = undefined;
  timers = new Set();
  clearStaticVisaMetadataCache();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("getVisaFormSteps through the real Supabase SDK transport", () => {
  beforeEach(() => {
    timers = new Set();
    clearStaticVisaMetadataCache();
    getImpersonationSession.mockResolvedValue(null);
    getClientSessionWithFallback.mockResolvedValue({
      userId: AUTH_USER_ID,
      email: "synthetic@viza.test",
    });
  });

  it("survives a transient 503 and a slow cold DS160 schema read", async () => {
    let attempts = 0;
    const requests: string[] = [];
    server = createServer((request, response) => {
      requests.push(request.url ?? "/");
      if (request.method !== "GET" || !request.url?.startsWith("/rest/v1/visa_form_fields")) {
        response.writeHead(404).end();
        return;
      }

      attempts += 1;
      if (attempts === 1) {
        response.writeHead(503, { "content-type": "application/json" });
        response.end(JSON.stringify({ code: "PGRST002", message: "temporary schema cache failure" }));
        return;
      }

      const timer = setTimeout(() => {
        timers.delete(timer);
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify([DS160_ROW]));
      }, 4_200);
      timers.add(timer);
    });

    await new Promise<void>((resolve, reject) => {
      server!.once("error", reject);
      server!.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address() as AddressInfo;
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", `http://127.0.0.1:${address.port}`);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "synthetic-ds160-fixture-key");

    const startedAt = Date.now();
    const steps = await getVisaFormSteps("DS160", { country: "united_states" });
    const elapsedMs = Date.now() - startedAt;

    expect(steps.flatMap((step) => step.fields).map((field) => field.fieldName)).toContain(
      "synthetic_ds160_field",
    );
    expect(attempts).toBe(2);
    expect(requests).toHaveLength(2);
    expect(requests.every((url) => url.includes("visa_type=eq.DS160"))).toBe(true);
    expect(getImpersonationSession).toHaveBeenCalledTimes(1);
    expect(getClientSessionWithFallback).toHaveBeenCalledTimes(1);
    expect(elapsedMs).toBeGreaterThanOrEqual(4_000);
    expect(elapsedMs).toBeLessThan(15_000);
  }, 15_000);
});
