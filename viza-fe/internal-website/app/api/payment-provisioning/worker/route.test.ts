import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runPaymentProvisioningWorkerMock = vi.hoisted(() => vi.fn());
const runPaymentProvisioningAlertSweepMock = vi.hoisted(() => vi.fn());
const withAdminMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/checkout/payment-provisioning", () => ({
  runPaymentProvisioningWorker: runPaymentProvisioningWorkerMock,
}));

vi.mock("@/lib/checkout/payment-provisioning-alerts", () => ({
  runPaymentProvisioningAlertSweep: runPaymentProvisioningAlertSweepMock,
}));

vi.mock("@/lib/auth/with-admin", () => ({
  withAdmin: withAdminMock,
}));

import { GET, POST } from "./route";

const admin = { kind: "test-admin" };

function request(method: "GET" | "POST", token?: string, body?: unknown) {
  return new Request("https://app.viza.test/api/payment-provisioning/worker", {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("payment provisioning worker route", () => {
  beforeEach(() => {
    delete process.env.CRON_SECRET;
    delete process.env.PAYMENT_PROVISIONING_WORKER_TOKEN;
    runPaymentProvisioningWorkerMock.mockReset();
    runPaymentProvisioningAlertSweepMock.mockReset();
    withAdminMock.mockReset();
    withAdminMock.mockImplementation(
      async (_role: string, _action: string, callback: (client: unknown) => unknown) =>
        callback(admin),
    );
    runPaymentProvisioningWorkerMock.mockResolvedValue({
      claimed: 2,
      succeededOrRetried: 2,
    });
    runPaymentProvisioningAlertSweepMock.mockResolvedValue({
      opened: 1,
      reopened: 0,
      escalated: 0,
      resolved: 0,
    });
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
    delete process.env.PAYMENT_PROVISIONING_WORKER_TOKEN;
  });

  it("fails closed when the Vercel Cron secret is absent", async () => {
    const response = await GET(request("GET"));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "cron not configured" });
    expect(runPaymentProvisioningWorkerMock).not.toHaveBeenCalled();
    expect(runPaymentProvisioningAlertSweepMock).not.toHaveBeenCalled();
  });

  it("rejects an incorrect Vercel Cron bearer token", async () => {
    process.env.CRON_SECRET = "cron-secret";

    const response = await GET(request("GET", "wrong-secret"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
    expect(runPaymentProvisioningWorkerMock).not.toHaveBeenCalled();
    expect(runPaymentProvisioningAlertSweepMock).not.toHaveBeenCalled();
  });

  it("runs a bounded retry sweep for an authenticated Vercel Cron request", async () => {
    process.env.CRON_SECRET = "cron-secret";

    const response = await GET(request("GET", "cron-secret"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      claimed: 2,
      succeededOrRetried: 2,
      alerts: { opened: 1, reopened: 0, escalated: 0, resolved: 0 },
    });
    expect(withAdminMock).toHaveBeenCalledWith(
      "system",
      "api/payment-provisioning/worker",
      expect.any(Function),
    );
    expect(runPaymentProvisioningWorkerMock).toHaveBeenCalledWith(admin, 20);
    expect(runPaymentProvisioningAlertSweepMock).toHaveBeenCalledWith(admin);
  });

  it("preserves the separately authenticated manual POST contract", async () => {
    process.env.PAYMENT_PROVISIONING_WORKER_TOKEN = "worker-secret";

    const response = await POST(request("POST", "worker-secret", { limit: 3 }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ claimed: 2, succeededOrRetried: 2 });
    expect(runPaymentProvisioningWorkerMock).toHaveBeenCalledWith(admin, 3);
  });
});
