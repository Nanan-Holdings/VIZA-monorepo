import assert from "node:assert/strict";
import { test } from "node:test";

test("appointment wake HTTP endpoint enforces authentication, exact ID and explicit result codes", async () => {
  process.env.SUPABASE_URL ??= "https://fixture.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "fixture-only-key";
  const oldToken = process.env.SUBMISSION_QUEUE_INTERNAL_TOKEN;
  const oldAppointmentToken = process.env.US_APPOINTMENT_INTERNAL_TOKEN;
  delete process.env.US_APPOINTMENT_INTERNAL_TOKEN;
  process.env.SUBMISSION_QUEUE_INTERNAL_TOKEN = "fixture-wake-token";
  const { startHealthServer } = await import("../../health-server");
  const calls: string[] = [];
  let busy = false;
  const server = startHealthServer({ port: 0, isWorkerStarted: () => true,
    wakeUSAppointmentJob: async (id) => { calls.push(id); return busy ? { outcome: "busy" } : { outcome: "accepted", duplicate: false }; } });
  try {
    if (!server.listening) await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address(); assert.ok(address && typeof address !== "string");
    const url = `http://127.0.0.1:${address.port}/internal/us-appointment/wake`;
    const id = "11111111-1111-4111-8111-111111111111";
    const post = (body: unknown, token?: string) => fetch(url, { method: "POST", headers: {
      "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}),
    }, body: JSON.stringify(body) });
    assert.equal((await post({ jobId: id })).status, 403);
    assert.equal((await post({ jobId: "invalid" }, "fixture-wake-token")).status, 400);
    assert.deepEqual(calls, []);
    const accepted = await post({ jobId: id }, "fixture-wake-token");
    assert.equal(accepted.status, 202); assert.deepEqual(await accepted.json(), { ok: true, accepted: true, duplicate: false });
    busy = true; assert.equal((await post({ jobId: id }, "fixture-wake-token")).status, 409);
    assert.deepEqual(calls, [id, id]);
    process.env.US_APPOINTMENT_INTERNAL_TOKEN = "fixture-appointment-token";
    assert.equal((await post({ jobId: id }, "fixture-wake-token")).status, 403);
    assert.equal((await post({ jobId: id }, "fixture-appointment-token")).status, 409);
    assert.deepEqual(calls, [id, id, id]);
  } finally {
    if (oldToken === undefined) delete process.env.SUBMISSION_QUEUE_INTERNAL_TOKEN;
    else process.env.SUBMISSION_QUEUE_INTERNAL_TOKEN = oldToken;
    if (oldAppointmentToken === undefined) delete process.env.US_APPOINTMENT_INTERNAL_TOKEN;
    else process.env.US_APPOINTMENT_INTERNAL_TOKEN = oldAppointmentToken;
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
