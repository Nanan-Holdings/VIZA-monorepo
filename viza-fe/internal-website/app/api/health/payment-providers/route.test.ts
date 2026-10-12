import { afterEach, describe, expect, it, vi } from "vitest";

const { requireRole } = vi.hoisted(() => ({ requireRole: vi.fn() }));
vi.mock("@/lib/rbac", () => ({ requireRole }));

import { GET } from "./route";

afterEach(() => {
  vi.unstubAllEnvs();
  requireRole.mockReset();
});

describe("GET /api/health/payment-providers", () => {
  it("requires an authenticated admin or staff user", async () => {
    requireRole.mockRejectedValue(new Error("Authentication required"));
    const response = await GET();
    expect(response.status).toBe(401);
    expect(requireRole).toHaveBeenCalledWith("admin", "staff");
  });

  it("returns 503 for incomplete production configuration without exposing values", async () => {
    requireRole.mockResolvedValue({ id: "staff-id", role: "staff" });
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PHOTONPAY_ENABLED", "false");
    vi.stubEnv("VIZA_ENABLED_PAYMENT_PROVIDERS", "stripe");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_must-not-leak");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "");

    const response = await GET();
    const body = await response.json() as { ready: boolean; enabledProviders: string[] };
    expect(response.status).toBe(503);
    expect(body.ready).toBe(false);
    expect(body.enabledProviders).toEqual(["stripe"]);
    expect(JSON.stringify(body)).not.toContain("sk_live_must-not-leak");
  });

  it("reports incomplete development configuration with HTTP 200", async () => {
    requireRole.mockResolvedValue({ id: "admin-id", role: "admin" });
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("PHOTONPAY_ENABLED", "false");
    vi.stubEnv("VIZA_ENABLED_PAYMENT_PROVIDERS", "stripe");
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "");

    const response = await GET();
    expect(response.status).toBe(200);
    expect((await response.json() as { ready: boolean }).ready).toBe(false);
  });
});
