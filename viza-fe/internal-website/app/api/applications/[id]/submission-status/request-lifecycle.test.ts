import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route-handler";

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

type QueryPlan =
  | {
      result: QueryResult;
      abortOnSignal?: false;
    }
  | {
      deferred: Deferred<QueryResult>;
      abortOnSignal?: boolean;
    };

type QueryState = {
  table: string;
  filters: Array<readonly [string, unknown]>;
  signal: AbortSignal | undefined;
  abortCount: number;
};

type QueryBuilder = {
  select: (columns: string) => QueryBuilder;
  eq: (column: string, value: unknown) => QueryBuilder;
  order: (column: string, options: Record<string, unknown>) => QueryBuilder;
  limit: (value: number) => QueryBuilder;
  maybeSingle: () => Promise<QueryResult>;
  then: Promise<QueryResult>["then"];
};

type ClientOptions = {
  requestTimeoutMs?: number;
  retryDelaysMs?: number[];
  requestSignal?: AbortSignal;
};

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  getClientSessionFromRequest: vi.fn(),
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...actual, after: mocks.after };
});
vi.mock("@/lib/client-session", () => ({
  getClientSessionFromRequest: mocks.getClientSessionFromRequest,
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

const APPLICATION_ID = "application-1";
const PROFILE_ID = "profile-1";
const afterCallbacks: Array<() => Promise<void> | void> = [];

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

function result(data: unknown, error: { message: string } | null = null): QueryResult {
  return { data, error };
}

function makeBuilder(
  table: string,
  plan: QueryPlan,
  signal: AbortSignal | undefined,
  state: QueryState,
): QueryBuilder {
  const resultPromise = "result" in plan
    ? Promise.resolve(plan.result)
    : plan.deferred.promise;

  if (!("result" in plan) && plan.abortOnSignal && signal) {
    const rejectForAbort = () => {
      state.abortCount += 1;
      plan.deferred.reject(
        signal.reason ?? new DOMException(`${table} query aborted`, "AbortError"),
      );
    };
    if (signal.aborted) rejectForAbort();
    else signal.addEventListener("abort", rejectForAbort, { once: true });
    plan.deferred.promise.then(
      () => signal.removeEventListener("abort", rejectForAbort),
      () => signal.removeEventListener("abort", rejectForAbort),
    );
  }

  const builder = {} as QueryBuilder;
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn((column: string, value: unknown) => {
    state.filters.push([column, value]);
    return builder;
  });
  builder.order = vi.fn(() => builder);
  builder.limit = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(() => resultPromise);
  builder.then = ((onFulfilled, onRejected) =>
    resultPromise.then(onFulfilled, onRejected)) as QueryBuilder["then"];
  return builder;
}

function installAdminMock(plans: Record<string, QueryPlan>) {
  const states: QueryState[] = [];
  const options: ClientOptions[] = [];
  const from = vi.fn((table: string) => {
    const state: QueryState = {
      table,
      filters: [],
      signal: options[0]?.requestSignal,
      abortCount: 0,
    };
    states.push(state);
    const tablePlan = plans[table] ?? resultPlan([], null);
    return makeBuilder(table, tablePlan, state.signal, state);
  });

  mocks.createAdminClient.mockImplementation((clientOptions: ClientOptions) => {
    options.push(clientOptions);
    return { from };
  });

  return { from, states, options };
}

function resultPlan(data: unknown, error: { message: string } | null = null): QueryPlan {
  return { result: result(data, error) };
}

function deferredPlan(
  query: Deferred<QueryResult>,
  abortOnSignal = false,
): QueryPlan {
  return { deferred: query, abortOnSignal };
}

function makeRequest(applicationId: string, signal: AbortSignal): NextRequest {
  const request = new NextRequest(
    `https://viza.test/api/applications/${applicationId}/submission-status`,
    { method: "GET" },
  );
  Object.defineProperty(request, "signal", {
    configurable: true,
    value: signal,
  });
  return request;
}

function routeContext(applicationId = APPLICATION_ID) {
  return { params: Promise.resolve({ id: applicationId }) };
}

async function flushMicrotasks(count = 12) {
  for (let index = 0; index < count; index += 1) {
    await Promise.resolve();
  }
}

const baseApplication = {
  id: APPLICATION_ID,
  applicant_id: PROFILE_ID,
  country: "vietnam",
  visa_type: "VN_E_VISA",
  submitted_at: null,
  submission_result: null,
  submission_result_status: null,
  submission_result_updated_at: null,
  updated_at: null,
};

describe("submission status request lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    afterCallbacks.length = 0;
    mocks.after.mockImplementation((callback: () => Promise<void> | void) => {
      afterCallbacks.push(callback);
    });
    mocks.getClientSessionFromRequest.mockResolvedValue({ userId: PROFILE_ID });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 499 before auth or database work for a pre-aborted request", async () => {
    const controller = new AbortController();
    controller.abort(new DOMException("caller cancelled", "AbortError"));

    const response = await GET(makeRequest(APPLICATION_ID, controller.signal), routeContext());

    expect(response.status).toBe(499);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.getClientSessionFromRequest).not.toHaveBeenCalled();
    expect(afterCallbacks).toHaveLength(0);
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("waits for an abort-ignoring profile query before returning 499", async () => {
    const profileQuery = createDeferred<QueryResult>();
    const admin = installAdminMock({
      applicant_profiles: deferredPlan(profileQuery),
      applications: resultPlan(baseApplication),
      submission_queue: resultPlan([]),
    });
    const controller = new AbortController();
    const pending = GET(makeRequest(APPLICATION_ID, controller.signal), routeContext());

    await flushMicrotasks();
    expect(admin.states.map((state) => state.table)).toEqual(["applicant_profiles"]);
    expect(afterCallbacks).toHaveLength(1);
    const cleanupPromise = afterCallbacks[0]?.();
    expect(cleanupPromise).toBeDefined();

    let settled = false;
    let cleanupSettled = false;
    void cleanupPromise?.then(() => {
      cleanupSettled = true;
    });
    void pending.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    controller.abort(new DOMException("caller cancelled", "AbortError"));
    await flushMicrotasks();

    expect(settled).toBe(false);
    expect(cleanupSettled).toBe(false);
    expect(admin.states.map((state) => state.table)).toEqual(["applicant_profiles"]);

    profileQuery.resolve(result({ id: PROFILE_ID }));
    const response = await pending;

    expect(response.status).toBe(499);
    await cleanupPromise;
    expect(cleanupSettled).toBe(true);
    expect(admin.states.map((state) => state.table)).toEqual(["applicant_profiles"]);
  });

  it("turns the eight-second deadline into a retryable 503 and aborts the query", async () => {
    vi.useFakeTimers();
    const profileQuery = createDeferred<QueryResult>();
    const admin = installAdminMock({
      applicant_profiles: deferredPlan(profileQuery, true),
      applications: resultPlan(baseApplication),
      submission_queue: resultPlan([]),
    });
    const pending = GET(
      makeRequest(APPLICATION_ID, new AbortController().signal),
      routeContext(),
    );

    await flushMicrotasks();
    expect(admin.states).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(8_000);
    const response = await pending;
    const body = (await response.json()) as { retryable?: boolean };

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("3");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.retryable).toBe(true);
    expect(admin.states[0]?.abortCount).toBe(1);
    expect(admin.options[0]).toMatchObject({
      requestTimeoutMs: 4_000,
      retryDelaysMs: [250],
    });
    expect(admin.options[0]?.requestSignal).toBeDefined();
    expect(admin.states.map((state) => state.table)).toEqual(["applicant_profiles"]);
  });

  it("waits for an abort-ignoring query after the deadline before returning 503", async () => {
    vi.useFakeTimers();
    const profileQuery = createDeferred<QueryResult>();
    const admin = installAdminMock({
      applicant_profiles: deferredPlan(profileQuery),
      applications: resultPlan(baseApplication),
      submission_queue: resultPlan([]),
    });
    const requestController = new AbortController();
    const pending = GET(
      makeRequest(APPLICATION_ID, requestController.signal),
      routeContext(),
    );

    await flushMicrotasks();
    const profileState = admin.states[0];
    const requestSignal = admin.options[0]?.requestSignal;
    expect(profileState?.table).toBe("applicant_profiles");
    expect(requestSignal).toBeDefined();
    const cleanupPromise = afterCallbacks[0]?.();
    let settled = false;
    void pending.then(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(8_000);
    await flushMicrotasks();
    expect(requestSignal?.aborted).toBe(true);
    expect(settled).toBe(false);
    expect(admin.states.map((state) => state.table)).toEqual(["applicant_profiles"]);

    profileQuery.resolve(result({ id: PROFILE_ID }));
    const response = await pending;
    const body = (await response.json()) as { retryable?: boolean };

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("3");
    expect(body.retryable).toBe(true);
    await cleanupPromise;
  });

  it("passes one signal to parallel queue and runner reads and aborts both", async () => {
    const queueQuery = createDeferred<QueryResult>();
    const runnerQuery = createDeferred<QueryResult>();
    const admin = installAdminMock({
      applicant_profiles: resultPlan({ id: PROFILE_ID }),
      applications: resultPlan({
        ...baseApplication,
        country: "south_korea",
        visa_type: "KR_E_ARRIVAL_CARD",
      }),
      submission_queue: deferredPlan(queueQuery, true),
      runner_job: deferredPlan(runnerQuery, true),
    });
    const controller = new AbortController();
    const pending = GET(makeRequest(APPLICATION_ID, controller.signal), routeContext());

    await flushMicrotasks();
    const queueState = admin.states.find((state) => state.table === "submission_queue");
    const runnerState = admin.states.find((state) => state.table === "runner_job");
    expect(queueState).toBeDefined();
    expect(runnerState).toBeDefined();
    expect(queueState?.signal).toBe(runnerState?.signal);
    expect(admin.options[0]?.requestSignal).toBe(queueState?.signal);

    controller.abort(new DOMException("caller cancelled", "AbortError"));
    const response = await pending;

    expect(response.status).toBe(499);
    expect(queueState?.abortCount).toBe(1);
    expect(runnerState?.abortCount).toBe(1);
  });

  it("uses the Supabase auth fallback signal and does not create an admin client after cancellation", async () => {
    mocks.getClientSessionFromRequest.mockResolvedValue(null);
    const authQuery = createDeferred<{ data: { user: { id: string } | null } }>();
    const serverOptions: ClientOptions[] = [];
    const getUser = vi.fn(() => authQuery.promise);
    mocks.createClient.mockImplementation((options: ClientOptions) => {
      serverOptions.push(options);
      return { auth: { getUser } };
    });

    const controller = new AbortController();
    const pending = GET(makeRequest(APPLICATION_ID, controller.signal), routeContext());
    await flushMicrotasks();

    expect(getUser).toHaveBeenCalledOnce();
    expect(serverOptions[0]).toMatchObject({
      requestTimeoutMs: 3_000,
      retryDelaysMs: [250],
    });
    expect(serverOptions[0]?.requestSignal).toBeDefined();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();

    controller.abort(new DOMException("caller cancelled", "AbortError"));
    await flushMicrotasks();
    authQuery.resolve({ data: { user: { id: "auth-user-1" } } });
    const response = await pending;

    expect(response.status).toBe(499);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("returns 403 for an owned-profile mismatch before reading either queue", async () => {
    const admin = installAdminMock({
      applicant_profiles: resultPlan({ id: PROFILE_ID }),
      applications: resultPlan({ ...baseApplication, applicant_id: "other-profile" }),
      submission_queue: resultPlan([]),
      runner_job: resultPlan([]),
    });

    const response = await GET(
      makeRequest(APPLICATION_ID, new AbortController().signal),
      routeContext(),
    );

    expect(response.status).toBe(403);
    expect(admin.states.map((state) => state.table)).toEqual([
      "applicant_profiles",
      "applications",
    ]);
    expect(admin.states.find((state) => state.table === "applications")?.filters).toContainEqual([
      "id",
      APPLICATION_ID,
    ]);
  });

  it("returns the owned status payload while sanitizing private submission fields", async () => {
    const updatedAt = "2026-09-09T12:00:00.000Z";
    const admin = installAdminMock({
      applicant_profiles: resultPlan({ id: PROFILE_ID }),
      applications: resultPlan({
        ...baseApplication,
        country: "united_states",
        visa_type: "B1_B2",
        submitted_at: updatedAt,
        submission_result_status: "failed",
        submission_result_updated_at: updatedAt,
        updated_at: updatedAt,
        submission_result: {
          country: "US",
          status: "failed",
          error: "Safe failure",
          portalUsername: "do-not-leak",
          credentials: { password: "do-not-leak" },
        },
      }),
      submission_queue: resultPlan([]),
    });

    const response = await GET(
      makeRequest(APPLICATION_ID, new AbortController().signal),
      routeContext(),
    );
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      applicationId: APPLICATION_ID,
      country: "united_states",
      visaType: "B1_B2",
      status: "failed",
      queue: null,
    });
    expect(body.result).toEqual({
      country: "US",
      status: "failed",
      error: "Safe failure",
    });
    expect(JSON.stringify(body)).not.toContain("do-not-leak");
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(admin.states.map((state) => state.table)).toEqual([
      "applicant_profiles",
      "applications",
      "submission_queue",
    ]);
  });
});
