import { createServer } from "node:http";
import { once } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { wakeUSAppointmentWorker } from "./worker-wake.js";

const JOB_ID = "11111111-1111-4111-8111-111111111111";
const env = {
  US_APPOINTMENT_SUBMISSION_SERVICE_URL: "https://viza-runner-pool.fly.dev",
  SUBMISSION_QUEUE_INTERNAL_TOKEN: "test-internal-token",
};
const flyEnv = {
  ...env,
  US_APPOINTMENT_FLY_APP: "viza-runner-pool",
  US_APPOINTMENT_FLY_MACHINE_ID: "abc123",
  FLY_SUBMISSION_ORG_TOKEN: "test-fly-token",
};
const accepted = () => Response.json({ ok: true, accepted: true, duplicate: false }, { status: 202 });
const idlePoolConfig = { env: { RUNNER_MACHINE_KIND: "pool", SUBMISSION_SERVICE_IDLE_EXIT_MS: "120000" } };

describe("US appointment worker wake", () => {
  it("prefers the dedicated US token and falls back to the shared token when it is unset or blank", async () => {
    for (const [usToken, expectedToken] of [
      ["  test-us-token  ", "test-us-token"],
      [undefined, "test-internal-token"],
      ["   ", "test-internal-token"],
    ] as const) {
      const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(accepted());
      const result = await wakeUSAppointmentWorker(JOB_ID, { env: { ...env, US_APPOINTMENT_INTERNAL_TOKEN: usToken }, fetchImpl });
      expect(result.ok).toBe(true);
      expect(fetchImpl.mock.calls[0][1]?.headers).toMatchObject({ Authorization: `Bearer ${expectedToken}` });
    }
  });

  it("fails closed before HTTP when unconfigured or partially configured", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    expect(await wakeUSAppointmentWorker(JOB_ID, { env: {}, fetchImpl })).toEqual({ ok: false, reason: "not_configured" });
    expect(await wakeUSAppointmentWorker(JOB_ID, { env: { ...env, US_APPOINTMENT_FLY_APP: "viza-runner-pool" }, fetchImpl })).toEqual({ ok: false, reason: "invalid_configuration" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    "https://other-app.fly.dev",
    "https://viza-runner-pool.fly.dev.evil.invalid",
    "http://viza-runner-pool.fly.dev",
    "https://viza-runner-pool.fly.dev/path",
    "https://user:password@viza-runner-pool.fly.dev",
    "https://viza-runner-pool.fly.dev?token=secret",
  ])("rejects a Fly URL not bound to the configured app: %s", async (url) => {
    const fetchImpl = vi.fn<typeof fetch>();
    expect(await wakeUSAppointmentWorker(JOB_ID, { env: { ...flyEnv, US_APPOINTMENT_SUBMISSION_SERVICE_URL: url }, fetchImpl })).toEqual({ ok: false, reason: "invalid_configuration" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each(["stopped", "suspended"])("starts the exact existing %s machine, then pins readiness and wake to it", async (state) => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ id: "abc123", state, config: idlePoolConfig }))
      .mockResolvedValueOnce(Response.json({ ok: true }))
      .mockResolvedValueOnce(Response.json({ ready: true }))
      .mockResolvedValueOnce(accepted());
    expect(await wakeUSAppointmentWorker(JOB_ID, { env: flyEnv, fetchImpl })).toEqual({ ok: true, duplicate: false, coldStart: "configured" });
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      "https://api.machines.dev/v1/apps/viza-runner-pool/machines/abc123",
      "https://api.machines.dev/v1/apps/viza-runner-pool/machines/abc123/start",
      `${env.US_APPOINTMENT_SUBMISSION_SERVICE_URL}/ready`,
      `${env.US_APPOINTMENT_SUBMISSION_SERVICE_URL}/internal/us-appointment/wake`,
    ]);
    expect(fetchImpl.mock.calls[1][1]).toMatchObject({ method: "POST", body: "{}", headers: { Authorization: "Bearer test-fly-token" }, redirect: "error" });
    expect(fetchImpl.mock.calls[2][1]).toMatchObject({ headers: { "Fly-Force-Instance-Id": "abc123" } });
    expect(fetchImpl.mock.calls[3][1]).toMatchObject({ method: "POST", body: JSON.stringify({ jobId: JOB_ID }), headers: { Authorization: "Bearer test-internal-token", "Fly-Force-Instance-Id": "abc123" }, redirect: "error" });
  });

  it.each(["started", "starting"])("never starts an already %s machine", async (state) => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ id: "abc123", state, config: idlePoolConfig }))
      .mockResolvedValueOnce(Response.json({ ready: true }))
      .mockResolvedValueOnce(accepted());
    expect((await wakeUSAppointmentWorker(JOB_ID, { env: flyEnv, fetchImpl })).ok).toBe(true);
    expect(fetchImpl.mock.calls.some(([url]) => String(url).endsWith("/start"))).toBe(false);
  });

  it("refuses missing or mismatched machines without provisioning a replacement", async () => {
    for (const response of [new Response(null, { status: 404 }), Response.json({ id: "different", state: "stopped" }), Response.json({ id: "abc123", state: "destroyed" })]) {
      const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(response);
      expect(await wakeUSAppointmentWorker(JOB_ID, { env: flyEnv, fetchImpl })).toEqual({ ok: false, reason: "machine_unavailable" });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    }
  });

  it("bounds readiness and does not dispatch before readiness", async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ id: "abc123", state: "starting", config: idlePoolConfig }))
      .mockRejectedValue(new Error("private upstream details"));
    expect(await wakeUSAppointmentWorker(JOB_ID, { env: flyEnv, fetchImpl, readinessTimeoutMs: 0 })).toEqual({ ok: false, reason: "readiness_timeout" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it.each([
    undefined,
    {},
    { env: { RUNNER_MACHINE_KIND: "pool" } },
    { env: { RUNNER_MACHINE_KIND: "pool", SUBMISSION_SERVICE_IDLE_EXIT_MS: "0" } },
    { env: { RUNNER_MACHINE_KIND: "pool", SUBMISSION_SERVICE_IDLE_EXIT_MS: "-1" } },
    { env: { RUNNER_MACHINE_KIND: "pool", SUBMISSION_SERVICE_IDLE_EXIT_MS: "Infinity" } },
    { env: { RUNNER_MACHINE_KIND: "pool", SUBMISSION_SERVICE_IDLE_EXIT_MS: "NaN" } },
    { env: { RUNNER_MACHINE_KIND: "pool", SUBMISSION_SERVICE_IDLE_EXIT_MS: "3600001" } },
    { env: { RUNNER_MACHINE_KIND: "pool", SUBMISSION_SERVICE_IDLE_EXIT_MS: true } },
    { env: { RUNNER_MACHINE_KIND: "legacy", SUBMISSION_SERVICE_IDLE_EXIT_MS: "120000" } },
  ])("refuses cold start without a bounded pool idle shutdown contract (%#)", async (config) => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ id: "abc123", state: "stopped", config }));
    expect(await wakeUSAppointmentWorker(JOB_ID, { env: flyEnv, fetchImpl })).toEqual({ ok: false, reason: "machine_lifecycle_unverified" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("accepts the documented maximum idle TTL without modifying the machine configuration", async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ id: "abc123", state: "stopped", config: { env: { RUNNER_MACHINE_KIND: "pool", SUBMISSION_SERVICE_IDLE_EXIT_MS: "3600000" } } }))
      .mockResolvedValueOnce(Response.json({ ok: true }))
      .mockResolvedValueOnce(Response.json({ ready: true }))
      .mockResolvedValueOnce(accepted());
    expect((await wakeUSAppointmentWorker(JOB_ID, { env: flyEnv, fetchImpl })).ok).toBe(true);
    expect(fetchImpl.mock.calls.filter(([, init]) => init?.method === "POST").map(([url]) => url)).toEqual([
      "https://api.machines.dev/v1/apps/viza-runner-pool/machines/abc123/start",
      `${env.US_APPOINTMENT_SUBMISSION_SERVICE_URL}/internal/us-appointment/wake`,
    ]);
  });

  it.each([
    [409, "worker_busy"],
    [422, "job_ineligible"],
    [503, "worker_disabled"],
    [401, "request_failed"],
    [200, "request_failed"],
  ])("reports worker HTTP %i using only a fixed code", async (status, reason) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ private: "upstream-secret" }, { status }));
    expect(await wakeUSAppointmentWorker(JOB_ID, { env, fetchImpl })).toEqual({ ok: false, reason });
  });

  it("requires the complete accepted acknowledgment and handles duplicate acceptance", async () => {
    const bad = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ ok: true }, { status: 202 }));
    expect(await wakeUSAppointmentWorker(JOB_ID, { env, fetchImpl: bad })).toEqual({ ok: false, reason: "invalid_response" });
    const duplicate = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ ok: true, accepted: true, duplicate: true }, { status: 202 }));
    expect(await wakeUSAppointmentWorker(JOB_ID, { env, fetchImpl: duplicate })).toEqual({ ok: true, duplicate: true, coldStart: "not_configured" });
  });

  it("performs the authenticated job handoff over real loopback HTTP", async () => {
    const requests: Array<{ url?: string; method?: string; authorization?: string; body: string }> = [];
    const server = createServer(async (request, response) => {
      let body = "";
      for await (const chunk of request) body += String(chunk);
      requests.push({ url: request.url, method: request.method, authorization: request.headers.authorization, body });
      response.writeHead(202, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ ok: true, accepted: true, duplicate: false }));
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Loopback server did not bind");
      const result = await wakeUSAppointmentWorker(JOB_ID, { env: { ...env, US_APPOINTMENT_SUBMISSION_SERVICE_URL: `http://127.0.0.1:${address.port}` } });
      expect(result).toEqual({ ok: true, duplicate: false, coldStart: "not_configured" });
      expect(requests).toEqual([{ url: "/internal/us-appointment/wake", method: "POST", authorization: "Bearer test-internal-token", body: JSON.stringify({ jobId: JOB_ID }) }]);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});
