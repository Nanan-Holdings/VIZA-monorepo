import assert from "node:assert/strict";
import { test } from "node:test";
import { USAppointmentDispatcher, type USAppointmentDispatchOptions } from "../dispatch";
import { loadUSAppointmentRunnerConfig, type USAppointmentJobRow } from "../runner";

const job: USAppointmentJobRow = {
  id: "job-1", application_id: "app-1", user_id: "user-1", appointment_account_id: "account-1",
  applying_country_code: "CN", applying_post_city: "Beijing", scheduling_provider: "usvisascheduling",
  status: "appointment_login_required", mode: "assisted_live", user_preferences_json: {},
  requires_user_action: false, current_manual_action: null, updated_at: null,
};
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}
function fixture(overrides: Partial<USAppointmentDispatchOptions> = {}) {
  const held = new Set<string>();
  const finished: string[] = [];
  const failures: string[] = [];
  const options: USAppointmentDispatchOptions = {
    getJob: async (id) => ({ ...job, id }), workerId: "worker-1",
    config: { ...loadUSAppointmentRunnerConfig({}), enabled: true, playwrightEnabled: true },
    claims: {
      claim: async (id) => { if (held.has(id)) return null; held.add(id); return { claimId: id }; },
      finish: async (id, _worker, outcome) => { held.delete(id); finished.push(outcome); },
    },
    runJob: async () => "processed", onFailure: (code) => failures.push(code), ...overrides,
  };
  return { options, held, finished, failures, dispatcher: new USAppointmentDispatcher(options) };
}

test("same-job wakes coalesce before database awaits and track activity through settlement", async () => {
  const lookup = deferred(); const work = deferred(); let runs = 0; let starts = 0; let finishes = 0;
  const f = fixture({ getJob: async () => { await lookup.promise; return job; },
    runJob: async () => { runs++; await work.promise; return "processed"; },
    onWorkStart: () => { starts++; }, onWorkFinish: () => { finishes++; } });
  const first = f.dispatcher.wake(job.id);
  assert.equal(f.dispatcher.activeCount, 1);
  let duplicateSettled = false;
  const duplicate = f.dispatcher.wake(job.id).then((result) => { duplicateSettled = true; return result; });
  await Promise.resolve();
  assert.equal(duplicateSettled, false);
  lookup.resolve(); assert.deepEqual(await first, { outcome: "accepted", duplicate: false });
  assert.deepEqual(await duplicate, { outcome: "accepted", duplicate: true });
  work.resolve(); await f.dispatcher.drain();
  assert.equal(runs, 1); assert.equal(starts, 1); assert.equal(finishes, 1);
  assert.deepEqual(f.finished, ["completed"]); assert.equal(f.dispatcher.activeCount, 0);
});

test("separate worker instances respect the same durable active claim", async () => {
  const work = deferred(); const f = fixture({ runJob: async () => { await work.promise; return "processed"; } });
  const second = new USAppointmentDispatcher({ ...f.options, workerId: "worker-2" });
  assert.equal((await f.dispatcher.wake(job.id)).outcome, "accepted");
  assert.deepEqual(await second.wake(job.id), { outcome: "busy" });
  work.resolve(); await Promise.all([f.dispatcher.drain(), second.drain()]);
  assert.deepEqual(f.finished, ["completed"]);
});

test("non-live, foreign, fixture and manual-blocked jobs never claim or open a browser", async () => {
  for (const changed of [
    { mode: "dry_run" }, { applying_country_code: "IN" },
    { user_preferences_json: { portalFixture: {} } },
    { requires_user_action: true, current_manual_action: "payment" },
  ]) {
    const f = fixture({ getJob: async () => ({ ...job, ...changed }), runJob: async () => { assert.fail("browser opened"); } });
    assert.deepEqual(await f.dispatcher.wake(job.id), { outcome: "ineligible" });
    await f.dispatcher.drain(); assert.equal(f.held.size, 0);
  }
});

test("changed account binding after claim settles as skipped without browser work", async () => {
  let reads = 0;
  const f = fixture({ getJob: async () => ({ ...job, appointment_account_id: ++reads === 1 ? "account-1" : "other" }),
    runJob: async () => { assert.fail("browser opened"); } });
  assert.deepEqual(await f.dispatcher.wake(job.id), { outcome: "ineligible" });
  await f.dispatcher.drain(); assert.deepEqual(f.finished, ["skipped"]);
});

test("uncertain portal errors retain the claim and expose only fixed error codes", async () => {
  const f = fixture({ runJob: async () => { throw new Error("password=SECRET endpoint=SECRET"); } });
  await f.dispatcher.wake(job.id); await f.dispatcher.drain();
  assert.equal(f.held.has(job.id), true); assert.deepEqual(f.finished, []);
  assert.deepEqual(f.failures, ["us_appointment_dispatch_failed"]);
});

test("execution timeout aborts browser work and retains its ambiguous claim", async () => {
  let aborted = false;
  const f = fixture({ timeoutMs: 10, runJob: async (_job, signal) => {
    await new Promise<void>((resolve) => signal.addEventListener("abort", () => { aborted = true; resolve(); }, { once: true }));
    return "processed";
  } });
  await f.dispatcher.wake(job.id); await f.dispatcher.drain();
  assert.equal(aborted, true); assert.equal(f.dispatcher.activeCount, 0);
  assert.equal(f.held.has(job.id), true); assert.deepEqual(f.finished, []);
  assert.deepEqual(f.failures, ["us_appointment_execution_timeout_reconciliation_required"]);
});

test("different jobs run serially and recheck queued cancellation before opening a browser", async () => {
  const work = deferred(); let cancelled = false; const runs: string[] = [];
  const f = fixture({
    getJob: async (id) => ({ ...job, id, status: id === "job-2" && cancelled ? "appointment_cancelled" : job.status }),
    runJob: async (current) => { runs.push(current.id); await work.promise; return "processed"; },
  });
  await f.dispatcher.wake(job.id); await f.dispatcher.wake("job-2");
  assert.equal(f.dispatcher.activeCount, 2); cancelled = true; work.resolve();
  await f.dispatcher.drain(); assert.deepEqual(runs, ["job-1"]);
  assert.deepEqual(f.finished, ["completed", "skipped"]);
});

test("duplicate wake receives failed admission instead of a false accepted response", async () => {
  const lookup = deferred();
  const f = fixture({ getJob: async () => { await lookup.promise; return { ...job, mode: "dry_run" }; } });
  const first = f.dispatcher.wake(job.id);
  const duplicate = f.dispatcher.wake(job.id);
  lookup.resolve();
  assert.deepEqual(await Promise.all([first, duplicate]), [{ outcome: "ineligible" }, { outcome: "ineligible" }]);
  await f.dispatcher.drain();
  assert.equal(f.held.size, 0);
});

test("shutdown aborts active work, settles queued claims skipped and rejects new admissions", async () => {
  const started = deferred(); const runs: string[] = [];
  const f = fixture({ runJob: async (current, signal) => {
    runs.push(current.id); started.resolve();
    await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
    return "processed";
  } });
  await f.dispatcher.wake(job.id); await started.promise;
  await f.dispatcher.wake("job-2");
  await f.dispatcher.shutdown();
  assert.deepEqual(runs, ["job-1"]);
  assert.deepEqual(f.finished, ["skipped"]);
  assert.equal(f.held.has(job.id), true);
  assert.equal(f.held.has("job-2"), false);
  assert.equal(f.dispatcher.activeCount, 0);
  assert.equal(f.dispatcher.healthy, true);
  assert.deepEqual(await f.dispatcher.wake("job-3"), { outcome: "unavailable" });
});

test("uncooperative timed-out execution retains its gate and claim and makes the worker unhealthy", async () => {
  const stuck = deferred(); const started = deferred(); const runs: string[] = []; const fatal: string[] = [];
  const f = fixture({ timeoutMs: 40, cleanupTimeoutMs: 20, onFatal: (code) => fatal.push(code),
    runJob: async (current) => { runs.push(current.id); started.resolve(); await stuck.promise; return "processed"; } });
  await f.dispatcher.wake(job.id); await started.promise;
  await f.dispatcher.wake("job-2");
  await f.dispatcher.drain();
  assert.equal(f.dispatcher.healthy, false);
  assert.equal(f.dispatcher.activeCount, 1, "unsettled browser remains tracked after bounded drain");
  assert.deepEqual(fatal, ["us_appointment_cleanup_timeout_reconciliation_required"]);
  assert.deepEqual(runs, ["job-1"]);
  assert.equal(f.held.has(job.id), true);
  assert.equal(f.held.has("job-2"), false);
  assert.deepEqual(f.finished, ["skipped"]);
  assert.deepEqual(await f.dispatcher.wake("job-3"), { outcome: "unavailable" });
  stuck.resolve();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(f.dispatcher.activeCount, 0);
  assert.equal(f.held.has(job.id), true, "late completion must not settle an aborted official attempt");
  assert.deepEqual(runs, ["job-1"], "late completion must not start an orphaned queued browser");
});

test("total deadline covers stuck admission and a late lookup cannot acquire a claim", async () => {
  const lookup = deferred(); const fatal: string[] = []; let claims = 0;
  const f = fixture({ timeoutMs: 10, cleanupTimeoutMs: 10,
    getJob: async () => { await lookup.promise; return job; },
    claims: { claim: async () => { claims++; return { claimId: job.id }; }, finish: async () => undefined },
    onFatal: (code) => fatal.push(code), runJob: async () => { assert.fail("late browser opened"); } });
  const first = f.dispatcher.wake(job.id); const duplicate = f.dispatcher.wake(job.id);
  assert.deepEqual(await Promise.all([first, duplicate]), [{ outcome: "unavailable" }, { outcome: "unavailable" }]);
  await f.dispatcher.drain();
  assert.equal(f.dispatcher.healthy, false);
  assert.equal(fatal.length, 1);
  lookup.resolve();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(claims, 0);
  assert.equal(f.dispatcher.activeCount, 0);
});

test("shutdown reconciles a late successful claim without opening a browser", async () => {
  const claiming = deferred(); const finishClaim = deferred(); const settled: string[] = [];
  const f = fixture({ claims: {
    claim: async () => { claiming.resolve(); await finishClaim.promise; return { claimId: job.id }; },
    finish: async (id, owner, outcome) => {
      assert.equal(id, job.id); assert.equal(owner, "worker-1"); settled.push(outcome);
    },
  }, runJob: async () => { assert.fail("browser opened after shutdown"); } });
  const admission = f.dispatcher.wake(job.id); await claiming.promise;
  const stopped = f.dispatcher.shutdown(); finishClaim.resolve();
  assert.deepEqual(await admission, { outcome: "unavailable" });
  await stopped;
  assert.deepEqual(settled, ["skipped"]);
  assert.equal(f.dispatcher.activeCount, 0);
});
