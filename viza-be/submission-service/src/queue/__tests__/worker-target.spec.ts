import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { before, describe, it } from "node:test";

process.env.SUPABASE_URL ??= "http://localhost";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-key";

type Row = {
  id: string;
  application_id: string;
  country: string;
  status: string;
  attempts: number;
  max_attempts: number;
  correlation_id: string | null;
  metadata: Record<string, unknown> | null;
  leased_by?: string | null;
  leased_until?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  last_error?: string | null;
};

class FakeRunnerJobClient {
  readonly updates: Array<{ filters: Array<{ column: string; value: unknown }>; patch: Record<string, unknown> }> = [];

  constructor(readonly rows: Row[]) {}

  from(table: string): FakeQuery {
    assert.equal(table, "runner_job");
    return new FakeQuery(this.rows, this.updates);
  }
}

class FakeQuery {
  private filters: Array<{ column: string; value: unknown }> = [];
  private patch: Record<string, unknown> | null = null;
  private countOnly = false;
  private maxRows: number | null = null;

  constructor(
    private readonly rows: Row[],
    private readonly updates: Array<{ filters: Array<{ column: string; value: unknown }>; patch: Record<string, unknown> }>,
  ) {}

  select(_columns: string, options?: { count?: string; head?: boolean }): this {
    this.countOnly = options?.head === true;
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push({ column, value });
    return this;
  }

  order(): this {
    return this;
  }

  limit(count: number): this {
    this.maxRows = count;
    return this;
  }

  update(values: Record<string, unknown>): this {
    this.patch = values;
    return this;
  }

  async maybeSingle(): Promise<{ data: Row | null; error: null }> {
    const rows = this.apply();
    if (this.patch && rows[0]) {
      this.updates.push({ filters: [...this.filters], patch: this.patch });
      Object.assign(rows[0], this.patch);
    }
    return { data: rows[0] ?? null, error: null };
  }

  then<TResult1 = { data: Row[] | null; error: null; count: number | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: Row[] | null; error: null; count: number | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    const rows = this.apply();
    if (this.patch) {
      this.updates.push({ filters: [...this.filters], patch: this.patch });
      for (const row of rows) Object.assign(row, this.patch);
    }
    const result = {
      data: this.countOnly ? null : rows,
      error: null,
      count: rows.length,
    };
    return Promise.resolve(result).then(onfulfilled, onrejected);
  }

  private apply(): Row[] {
    let rows = this.rows.filter((row) =>
      this.filters.every(({ column, value }) => (row as Record<string, unknown>)[column] === value),
    );
    if (this.maxRows != null) rows = rows.slice(0, this.maxRows);
    return rows;
  }
}

function row(overrides: Partial<Row>): Row {
  return {
    id: "job-target",
    application_id: "app-target",
    country: "taiwan",
    status: "queued",
    attempts: 0,
    max_attempts: 3,
    correlation_id: null,
    metadata: null,
    ...overrides,
  };
}

let claimTargetJob: typeof import("../worker.js").claimTargetJob;
let claimNextJob: typeof import("../worker.js").claimNextJob;
let pollAndRun: typeof import("../worker.js").pollAndRun;
let TargetRunnerJobError: typeof import("../worker.js").TargetRunnerJobError;
let normalizeCountry: typeof import("../dispatch.js").normalizeCountry;

before(async () => {
  const worker = await import("../worker.js");
  const dispatch = await import("../dispatch.js");
  claimNextJob = worker.claimNextJob;
  claimTargetJob = worker.claimTargetJob;
  pollAndRun = worker.pollAndRun;
  TargetRunnerJobError = worker.TargetRunnerJobError;
  normalizeCountry = dispatch.normalizeCountry;
});

describe("runner_job single-target worker mode", () => {
  it("claims a Philippines queue row only through the country-scoped RPC", async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const claimed = row({ id: "job-ph", application_id: "app-ph", country: "philippines" });
    const client = {
      from(): never {
        throw new Error("country-scoped claims must not query runner_job directly");
      },
      async rpc(name: string, args: Record<string, unknown>) {
        calls.push({ name, args });
        return { data: [claimed], error: null };
      },
    };

    const result = await claimNextJob({
      workerId: "viza-runner-philippines",
      country: "PH",
      leaseMs: 900_000,
      client,
    });

    assert.equal(result?.id, "job-ph");
    assert.deepEqual(calls, [{
      name: "claim_runner_country_job",
      args: {
        p_worker_id: "viza-runner-philippines",
        p_country: "philippines",
        p_lease_ms: 900_000,
      },
    }]);
  });

  it("keeps the unscoped shared claim path on its existing query-and-CAS behavior", async () => {
    const rows = [row({ id: "job-shared", country: "taiwan" })];
    const client = new FakeRunnerJobClient(rows);

    const claimed = await claimNextJob({
      workerId: "shared-worker",
      client,
    });

    assert.equal(claimed?.id, "job-shared");
    assert.equal(rows[0].status, "running");
    assert.deepEqual(client.updates[0].filters, [
      { column: "id", value: "job-shared" },
      { column: "status", value: "queued" },
    ]);
  });

  it("claims only the configured target job and leaves other queued jobs untouched", async () => {
    const rows = [
      row({ id: "job-other", application_id: "app-other" }),
      row({ id: "job-target", application_id: "app-target" }),
    ];
    const client = new FakeRunnerJobClient(rows);
    const claimed = await claimTargetJob({
      workerId: "worker-1",
      country: "taiwan",
      jobId: "job-target",
      expectedApplicationId: "app-target",
      normalizeCountry,
      client,
    });

    assert.equal(claimed.id, "job-target");
    assert.equal(rows[1].status, "running");
    assert.equal(rows[1].leased_by, "worker-1");
    assert.equal(rows[0].status, "queued");
    assert.equal(rows[0].leased_by, undefined);
    assert.deepEqual(client.updates[0].filters, [
      { column: "id", value: "job-target" },
      { column: "country", value: "taiwan" },
      { column: "status", value: "queued" },
    ]);
  });

  it("does not mutate rows when the target country mismatches", async () => {
    const rows = [row({ id: "job-target", country: "vietnam" })];
    await assert.rejects(
      () => claimTargetJob({
        workerId: "worker-1",
        country: "taiwan",
        jobId: "job-target",
        normalizeCountry,
        client: new FakeRunnerJobClient(rows),
      }),
      (error) => error instanceof TargetRunnerJobError && error.reason === "target_country_mismatch",
    );
    assert.equal(rows[0].status, "queued");
  });

  it("does not mutate rows when the expected application id mismatches", async () => {
    const rows = [row({ id: "job-target", application_id: "app-other" })];
    await assert.rejects(
      () => claimTargetJob({
        workerId: "worker-1",
        country: "taiwan",
        jobId: "job-target",
        expectedApplicationId: "app-target",
        normalizeCountry,
        client: new FakeRunnerJobClient(rows),
      }),
      (error) => error instanceof TargetRunnerJobError && error.reason === "target_application_mismatch",
    );
    assert.equal(rows[0].status, "queued");
  });

  it("fails closed when the target is missing or not queued", async () => {
    await assert.rejects(
      () => claimTargetJob({
        workerId: "worker-1",
        country: "taiwan",
        jobId: "job-missing",
        normalizeCountry,
        client: new FakeRunnerJobClient([]),
      }),
      (error) => error instanceof TargetRunnerJobError && error.reason === "target_not_found",
    );

    const rows = [row({ id: "job-target", status: "running" })];
    await assert.rejects(
      () => claimTargetJob({
        workerId: "worker-1",
        country: "taiwan",
        jobId: "job-target",
        normalizeCountry,
        client: new FakeRunnerJobClient(rows),
      }),
      (error) => error instanceof TargetRunnerJobError && error.reason === "target_not_claimable",
    );
  });

  it("runs one target job, dispatches it to the handler, marks success, and returns", async () => {
    const rows = [row({ id: "job-target", application_id: "app-target" })];
    const handled: string[] = [];

    await pollAndRun("worker-1", async (job) => {
      handled.push(`${job.country}:${job.application_id}:${job.id}`);
    }, {
      country: "taiwan",
      targetJobId: "job-target",
      expectedApplicationId: "app-target",
      normalizeCountry,
      client: new FakeRunnerJobClient(rows),
    });

    assert.deepEqual(handled, ["taiwan:app-target:job-target"]);
    assert.equal(rows[0].status, "succeeded");
    assert.equal(rows[0].leased_by, null);
    assert.ok(rows[0].finished_at);
  });

  it("index startup gates targeted Taiwan and Philippines modes away from disabled/local-only workers", async () => {
    const source = await readFile(join(process.cwd(), "src", "index.ts"), "utf8");

    assert.match(source, /RUNNER_JOB_TARGET_ID/);
    assert.match(source, /RUNNER_JOB_EXPECTED_APPLICATION_ID/);
    assert.match(source, /SUBMISSION_SERVICE_LOCAL_ENDPOINTS_ONLY=true/);
    assert.match(source, /requires SUBMISSION_SERVICE_RUNNER_JOB_CONSUMER_ENABLED=true/);
    assert.match(source, /requires RUNNER_JOB_COUNTRY/);
    assert.match(source, /\["taiwan", "philippines"\]\.includes\(normalizeCountry\(RUNNER_JOB_COUNTRY\)\)/);
    assert.match(source, /targetJobId:\s*RUNNER_JOB_TARGET_ID/);
    assert.match(source, /expectedApplicationId:\s*RUNNER_JOB_EXPECTED_APPLICATION_ID/);
    assert.ok(
      (source.match(/country:\s*RUNNER_JOB_COUNTRY/g) ?? []).length >= 2,
      "both targeted and continuous runner_job consumers must receive RUNNER_JOB_COUNTRY",
    );
  });
});
