import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  getClientSessionReadResult: vi.fn(),
}));

vi.mock("@/lib/client-session", () => ({
  getClientSessionReadResult: mocks.getClientSessionReadResult,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

import {
  getClientHomeDashboardData,
  getClientHomeDashboardWithTimeline,
} from "./client-home-dashboard";
import { loadClientHomeDashboard } from "@/lib/client/home-dashboard-reader.server";

type QueryCall = {
  table: string;
  eq: Array<[string, string]>;
  in: Array<[string, string[]]>;
  or: string[];
  select: string | null;
};

type FakeQueryResponse = {
  data: unknown;
  error: { message: string } | null;
};

type SupabaseReadOptions = {
  requestSignal?: AbortSignal;
};

const USER_ID = "00000000-0000-4000-8000-000000000001";
const APPLICATION_ID = "11111111-1111-4111-8111-111111111111";
const PACKAGE_ID = "22222222-2222-4222-8222-222222222222";

function applicationWithEmbeddedQueue(liveQueue: unknown) {
  return {
    id: APPLICATION_ID,
    applicant_id: USER_ID,
    status: "draft",
    country: "singapore",
    visa_type: "SG_ARRIVAL_CARD",
    purpose: "tourism",
    visa_package_id: PACKAGE_ID,
    submission_result_status: null,
    submitted_at: null,
    created_at: "2026-09-03T00:00:00.000Z",
    updated_at: "2026-09-03T00:00:00.000Z",
    consents: [],
    signatures: [],
    answers: [],
    packets: [],
    documents: [],
    live_queue: liveQueue,
  };
}

function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function createAdminClientMock(
  calls: QueryCall[],
  options: {
    packageId?: string | null;
    paymentError?: { message: string } | null;
    profileResponse?: FakeQueryResponse;
    applicationsResponse?: FakeQueryResponse;
    applicationDocumentsResponse?: FakeQueryResponse;
    embeddedApplicationsResponse?: FakeQueryResponse;
    combinedResponse?: FakeQueryResponse;
    submissionQueueResponse?: FakeQueryResponse;
    deferredResponses?: Partial<{
      embeddedApplications: PromiseLike<FakeQueryResponse>;
      application_documents: PromiseLike<FakeQueryResponse>;
      payment_records: PromiseLike<FakeQueryResponse>;
      consent_events: PromiseLike<FakeQueryResponse>;
    }>;
    onQueryStart?: (call: QueryCall) => void;
  } = {},
) {
  const packageId = options.packageId === undefined ? PACKAGE_ID : options.packageId;
  const responses: Record<
    string,
    { data: unknown; error: { message: string } | null }
  > = {
    applicant_profiles: {
      data: { full_name: "Test Applicant", email: "load-test@viza.test" },
      error: null,
    },
    applications: {
      data: [
        {
          id: APPLICATION_ID,
          applicant_id: USER_ID,
          status: "draft",
          country: "singapore",
          visa_type: "SG_ARRIVAL_CARD",
          purpose: "tourism",
          visa_package_id: packageId,
          submission_result_status: null,
          submitted_at: null,
          created_at: "2026-09-03T00:00:00.000Z",
          updated_at: "2026-09-03T00:00:00.000Z",
          consents: [],
          signatures: [],
          answers: [],
          packets: [],
          documents: [],
        },
      ],
      error: null,
    },
    application_documents: { data: [], error: null },
    payment_records: {
      data: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          application_id: APPLICATION_ID,
          visa_package_id: PACKAGE_ID,
          status: "paid",
          created_at: "2026-09-03T00:00:00.000Z",
          updated_at: "2026-09-03T00:00:00.000Z",
        },
      ],
      error: options.paymentError ?? null,
    },
    submission_queue: { data: [], error: null },
  };
  if (options.profileResponse) responses.applicant_profiles = options.profileResponse;
  if (options.applicationsResponse) responses.applications = options.applicationsResponse;
  if (options.applicationDocumentsResponse) responses.application_documents = options.applicationDocumentsResponse;
  if (options.submissionQueueResponse) responses.submission_queue = options.submissionQueueResponse;

  const decorateEmbeddedApplications = (
    data: unknown,
    includeDocuments: boolean,
  ): unknown => {
    if (!Array.isArray(data)) return data;
    return data.map((item) => {
      if (item === null || typeof item !== "object" || Array.isArray(item)) return item;
      const row = item as Record<string, unknown>;
      const withQueue = Object.prototype.hasOwnProperty.call(row, "live_queue")
        ? row
        : { ...row, live_queue: responses.submission_queue.data };
      return includeDocuments
        ? { ...withQueue, documents: responses.application_documents.data }
        : withQueue;
    });
  };

  return {
    from(table: string) {
      const call: QueryCall = { table, eq: [], in: [], or: [], select: null };
      calls.push(call);
      const response = responses[table] ?? { data: [], error: null };
      const query = {
        select(projection?: string) {
          call.select = projection ?? null;
          return query;
        },
        eq(column: string, value: string) {
          call.eq.push([column, value]);
          return query;
        },
        in(column: string, values: string[]) {
          call.in.push([column, values]);
          return query;
        },
        or(filter: string) {
          call.or.push(filter);
          return query;
        },
        order() {
          return query;
        },
        limit() {
          return query;
        },
        maybeSingle() {
          if (table === "applicant_profiles" && call.select?.includes("owned_applications:")) {
            const profile = responses.applicant_profiles;
            return Promise.resolve(options.combinedResponse ?? {
              data: profile.data === null ? null : {
                ...profile.data as Record<string, unknown>,
                id: USER_ID,
                owned_applications: responses.applications.data,
              },
              error: profile.error ?? responses.applications.error,
            });
          }
          return Promise.resolve(response);
        },
        then<TResult1 = typeof response, TResult2 = never>(
          onfulfilled?: ((value: typeof response) => TResult1 | PromiseLike<TResult1>) | null,
          onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
        ) {
          options.onQueryStart?.(call);
          const isEmbeddedApplicationRead =
            table === "applications" && call.select?.includes("consents:consent_events");
          const queueProjectionRequested = call.select?.includes("live_queue:submission_queue") ?? false;
          const documentProjectionRequested = call.select?.includes("documents:application_documents") ?? false;
          const embeddedResponse = options.embeddedApplicationsResponse ?? response;
          const responseForRead = queueProjectionRequested && isEmbeddedApplicationRead
            ? { ...embeddedResponse, data: decorateEmbeddedApplications(embeddedResponse.data, documentProjectionRequested) }
            : response;
          const deferredResponse = isEmbeddedApplicationRead
            ? options.deferredResponses?.embeddedApplications
            : options.deferredResponses?.[table as keyof NonNullable<typeof options.deferredResponses>];
          return (deferredResponse ?? Promise.resolve(responseForRead)).then(onfulfilled, onrejected);
        },
      };
      return query;
    },
  };
}

describe("getClientHomeDashboardData query budget", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    mocks.createAdminClient.mockReset();
    mocks.getClientSessionReadResult.mockReset();
    mocks.getClientSessionReadResult.mockResolvedValue({
      status: "authenticated",
      source: "cookie",
      session: {
        userId: USER_ID,
        authUserId: USER_ID,
        email: "load-test@viza.test",
      },
    });
  });

  it("uses one owner-scoped payment query per dashboard load", async () => {
    const calls: QueryCall[] = [];
    mocks.createAdminClient.mockImplementation(() => createAdminClientMock(calls));

    const result = await getClientHomeDashboardData();

    expect(result.authenticated).toBe(true);
    expect(result.payments).toHaveLength(1);
    expect(calls).toHaveLength(3);
    expect(calls.filter((call) => call.table === "applications")).toHaveLength(0);
    expect(calls[0]?.eq).toContainEqual(["id", USER_ID]);
    expect(calls[0]?.eq).toContainEqual(["owned_applications.applicant_id", USER_ID]);
    expect(result.profile).not.toHaveProperty("owned_applications");
    expect(result.profile).not.toHaveProperty("id");
    const sessionOptions = mocks.getClientSessionReadResult.mock.calls[0]?.[0] as SupabaseReadOptions;
    const adminOptions = mocks.createAdminClient.mock.calls[0]?.[0] as SupabaseReadOptions;
    expect(sessionOptions.requestSignal).toBeInstanceOf(AbortSignal);
    expect(adminOptions.requestSignal).toBe(sessionOptions.requestSignal);
    const paymentCalls = calls.filter((call) => call.table === "payment_records");
    expect(paymentCalls).toHaveLength(1);
    expect(paymentCalls[0]?.eq).toContainEqual(["applicant_id", USER_ID]);
    expect(paymentCalls[0]?.or).toEqual([
      `application_id.in.(${APPLICATION_ID}),visa_package_id.in.(${PACKAGE_ID})`,
    ]);
  });

  it("keeps 100 concurrent dashboard loads within 100 payment reads", async () => {
    const calls: QueryCall[] = [];
    mocks.createAdminClient.mockImplementation(() => createAdminClientMock(calls));

    const results = await Promise.all(
      Array.from({ length: 100 }, () => getClientHomeDashboardData()),
    );

    expect(results.every((result) => result.authenticated && result.payments.length === 1)).toBe(true);
    expect(calls.filter((call) => call.table === "payment_records")).toHaveLength(100);
    expect(calls).toHaveLength(300);
  });

  it("retains a profile without applications with one left-embedded read", async () => {
    const calls: QueryCall[] = [];
    mocks.createAdminClient.mockImplementation(() => createAdminClientMock(calls, {
      applicationsResponse: { data: [], error: null },
    }));
    const result = await getClientHomeDashboardData();
    expect(result.profile?.full_name).toBe("Test Applicant");
    expect(result.applications).toEqual([]);
    expect(result.error).toBeUndefined();
    expect(calls).toHaveLength(1);
  });

  it("keeps a missing profile as an authenticated empty dashboard", async () => {
    const calls: QueryCall[] = [];
    mocks.createAdminClient.mockImplementation(() => createAdminClientMock(calls, {
      profileResponse: { data: null, error: null },
    }));
    const result = await getClientHomeDashboardData();
    expect(result).toMatchObject({ authenticated: true, profile: null, applications: [] });
    expect(result.error).toBeUndefined();
    expect(calls).toHaveLength(1);
  });

  it("preserves profile error precedence when the combined read and both fallback reads fail", async () => {
    const calls: QueryCall[] = [];
    mocks.createAdminClient.mockImplementation(() => createAdminClientMock(calls, {
      profileResponse: { data: null, error: { message: "private profile failure" } },
      applicationsResponse: { data: null, error: { message: "private application failure" } },
    }));
    const result = await getClientHomeDashboardData();
    expect(result).toMatchObject({ authenticated: true, profile: null, error: "profile_read_failed" });
    expect(calls).toHaveLength(3);
    expect(JSON.stringify(result)).not.toContain("private");
  });

  it("retains the profile when only the fallback application read fails", async () => {
    const calls: QueryCall[] = [];
    mocks.createAdminClient.mockImplementation(() => createAdminClientMock(calls, {
      applicationsResponse: { data: null, error: { message: "private application failure" } },
    }));
    const result = await getClientHomeDashboardData();
    expect(result).toMatchObject({ authenticated: true, error: "applications_read_failed", applications: [] });
    expect(result.profile?.full_name).toBe("Test Applicant");
    expect(calls).toHaveLength(3);
    expect(JSON.stringify(result)).not.toContain("private");
  });

  it("recovers an unavailable relationship with one bounded fallback", async () => {
    const calls: QueryCall[] = [];
    mocks.createAdminClient.mockImplementation(() => createAdminClientMock(calls, {
      combinedResponse: { data: null, error: { message: "relationship unavailable" } },
    }));
    const result = await getClientHomeDashboardData();
    expect(result.applications).toHaveLength(1);
    expect(result.error).toBeUndefined();
    expect(calls).toHaveLength(5);
    expect(calls.filter((call) => call.select?.includes("owned_applications:"))).toHaveLength(1);
  });

  it("uses the same single query when an application has no package", async () => {
    const calls: QueryCall[] = [];
    mocks.createAdminClient.mockImplementation(() =>
      createAdminClientMock(calls, { packageId: null }),
    );

    const result = await getClientHomeDashboardData();

    expect(result.authenticated).toBe(true);
    const paymentCalls = calls.filter((call) => call.table === "payment_records");
    expect(paymentCalls).toHaveLength(1);
    expect(paymentCalls[0]?.or).toEqual([
      `application_id.in.(${APPLICATION_ID})`,
    ]);
  });

  it("preserves the existing partial dashboard response on payment errors", async () => {
    const calls: QueryCall[] = [];
    mocks.createAdminClient.mockImplementation(() =>
      createAdminClientMock(calls, { paymentError: { message: "payment read failed" } }),
    );

    const result = await getClientHomeDashboardData();

    expect(result).toMatchObject({
      authenticated: true,
      error: "payments_read_failed",
      payments: [],
    });
    expect(result.applications).toHaveLength(1);
    expect(calls.filter((call) => call.table === "payment_records")).toHaveLength(1);
  });

  it("preserves nullable document timestamps from the standalone document read", async () => {
    const calls: QueryCall[] = [];
    const documentId = "44444444-4444-4444-8444-444444444444";
    mocks.createAdminClient.mockImplementation(() => createAdminClientMock(calls, {
      applicationDocumentsResponse: {
        data: [{
          id: documentId,
          application_id: APPLICATION_ID,
          document_type: "passport",
          status: "uploaded",
          required: true,
          created_at: null,
          updated_at: null,
        }],
        error: null,
      },
    }));

    const result = await getClientHomeDashboardData();

    expect(result.documents).toEqual([{
      id: documentId,
      application_id: APPLICATION_ID,
      document_type: "passport",
      status: "uploaded",
      created_at: null,
      updated_at: null,
    }]);
    expect(calls.filter((call) => call.table === "application_documents")).toHaveLength(1);
  });

  it("includes the selected timeline without repeating owner, document, or payment reads", async () => {
    const calls: QueryCall[] = [];
    mocks.createAdminClient.mockImplementation(() => createAdminClientMock(calls));

    const result = await getClientHomeDashboardWithTimeline({
      applicationId: APPLICATION_ID,
    });

    expect(result.authenticated).toBe(true);
    expect(result.timelineApplicationId).toBe(APPLICATION_ID);
    expect(result.timeline?.id).toBe(APPLICATION_ID);
    expect(result.timeline?.documents).toEqual({
      total: 0,
      uploaded: 0,
      validated: 0,
      missing: 0,
      rejected: 0,
    });
    expect(calls.filter((call) => call.table === "applications")).toHaveLength(1);
    expect(calls.filter((call) => call.table === "applicant_profiles")).toHaveLength(1);
    const relatedApplicationCalls = calls.filter(
      (call) => call.table === "applications" && call.select?.includes("consents:consent_events"),
    );
    expect(relatedApplicationCalls).toHaveLength(1);
    expect(relatedApplicationCalls[0]?.in).toContainEqual(["id", [APPLICATION_ID]]);
    expect(relatedApplicationCalls[0]?.select).toContain(
      "live_queue:submission_queue!submission_queue_application_id_fkey",
    );
    expect(calls.filter((call) => call.table === "application_documents")).toHaveLength(0);
    expect(relatedApplicationCalls[0]?.select).toContain(
      "documents:application_documents!application_documents_application_id_fkey(id, application_id, document_type, status, required, created_at, updated_at)",
    );
    expect(calls.filter((call) => call.table === "payment_records")).toHaveLength(1);
    expect(calls.filter((call) => call.table === "submission_queue")).toHaveLength(0);
  });

  it("falls back to one bounded queue read when the embedded timeline queue is foreign", async () => {
    const calls: QueryCall[] = [];
    mocks.createAdminClient.mockImplementation(() => createAdminClientMock(calls, {
      applicationsResponse: {
        data: [applicationWithEmbeddedQueue([{
          id: "queue-foreign",
          application_id: "99999999-9999-4999-8999-999999999999",
        }])],
        error: null,
      },
      submissionQueueResponse: { data: [], error: null },
    }));

    const result = await getClientHomeDashboardWithTimeline({ applicationId: APPLICATION_ID });

    expect(result.timelineApplicationId).toBe(APPLICATION_ID);
    expect(result.timelinePartialData).toBe(false);
    expect(calls.filter((call) => call.table === "applications")).toHaveLength(1);
    expect(calls.filter((call) => call.table === "submission_queue")).toHaveLength(1);
  });

  it("starts timeline reads before dashboard payment reads and reuses embedded documents", async () => {
    const calls: QueryCall[] = [];
    const relatedDeferred = createDeferred<FakeQueryResponse>();
    const documentsDeferred = createDeferred<FakeQueryResponse>();
    const paymentsDeferred = createDeferred<FakeQueryResponse>();
    const timelineStarted = createDeferred<void>();
    const startedTables: string[] = [];
    mocks.createAdminClient.mockImplementation(() => createAdminClientMock(calls, {
      deferredResponses: {
        embeddedApplications: relatedDeferred.promise,
        application_documents: documentsDeferred.promise,
        payment_records: paymentsDeferred.promise,
      },
      onQueryStart: (call) => {
        const label = call.table === "applications" && call.select?.includes("consents:consent_events")
          ? "timeline"
          : call.table;
        startedTables.push(label);
        if (label === "timeline") timelineStarted.resolve();
      },
    }));

    const resultPromise = getClientHomeDashboardWithTimeline({ applicationId: APPLICATION_ID });
    await timelineStarted.promise;

    expect(startedTables.indexOf("timeline")).toBeGreaterThanOrEqual(0);
    expect(startedTables).not.toContain("application_documents");
    expect(startedTables.indexOf("timeline")).toBeLessThan(startedTables.indexOf("payment_records"));

    relatedDeferred.resolve({
      data: [{ id: APPLICATION_ID, consents: [], signatures: [], answers: [], packets: [], documents: [], live_queue: [] }],
      error: null,
    });
    documentsDeferred.resolve({ data: [], error: null });
    paymentsDeferred.resolve({ data: [], error: null });
    const result = await resultPromise;
    expect(result.timelineApplicationId).toBe(APPLICATION_ID);
  });

  it("starts the old Home document GET before a slow related-row fallback settles", async () => {
    const calls: QueryCall[] = [];
    const consentDeferred = createDeferred<FakeQueryResponse>();
    const documentStarted = createDeferred<void>();
    mocks.createAdminClient.mockImplementation(() => createAdminClientMock(calls, {
      embeddedApplicationsResponse: {
        data: null,
        error: { message: "relationship unavailable" },
      },
      deferredResponses: {
        consent_events: consentDeferred.promise,
      },
      onQueryStart: (call) => {
        if (call.table === "application_documents") documentStarted.resolve();
      },
    }));

    const resultPromise = getClientHomeDashboardWithTimeline({ applicationId: APPLICATION_ID });
    await documentStarted.promise;
    expect(calls.some((call) => call.table === "consent_events")).toBe(true);
    expect(calls.filter((call) => call.table === "application_documents")).toHaveLength(1);

    consentDeferred.resolve({ data: [], error: null });
    const result = await resultPromise;
    expect(result.timelineApplicationId).toBe(APPLICATION_ID);
    expect(result.timelinePartialData).toBe(false);
  });

  it("drains a started timeline read before returning a required payment error", async () => {
    const calls: QueryCall[] = [];
    const relatedDeferred = createDeferred<FakeQueryResponse>();
    const paymentsDeferred = createDeferred<FakeQueryResponse>();
    const timelineStarted = createDeferred<void>();
    let settled = false;
    mocks.createAdminClient.mockImplementation(() => createAdminClientMock(calls, {
      deferredResponses: {
        embeddedApplications: relatedDeferred.promise,
        payment_records: paymentsDeferred.promise,
      },
      onQueryStart: (call) => {
        if (call.table === "applications" && call.select?.includes("consents:consent_events")) {
          timelineStarted.resolve();
        }
      },
    }));

    const resultPromise = getClientHomeDashboardWithTimeline({ applicationId: APPLICATION_ID })
      .then((result) => {
        settled = true;
        return result;
      });
    await timelineStarted.promise;
    paymentsDeferred.resolve({ data: [], error: { message: "payment read failed" } });
    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBe(false);

    relatedDeferred.resolve({
      data: [{ id: APPLICATION_ID, consents: [], signatures: [], answers: [], packets: [], live_queue: [] }],
      error: null,
    });
    const result = await resultPromise;
    expect(result).toMatchObject({
      authenticated: true,
      error: "payments_read_failed",
      payments: [],
    });
  });

  it("expires a stalled identity read without treating it as a signed-out session", async () => {
    vi.useFakeTimers();
    mocks.getClientSessionReadResult.mockImplementation(({ requestSignal }: SupabaseReadOptions) =>
      new Promise((resolve) => {
        requestSignal?.addEventListener("abort", () => resolve({
          status: "unavailable",
          session: null,
          reason: "cancelled",
        }), { once: true });
      }),
    );

    const pendingRead = getClientHomeDashboardWithTimeline();
    await vi.advanceTimersByTimeAsync(8_000);
    const result = await pendingRead;

    expect(result).toMatchObject({
      authenticated: false,
      unavailable: true,
      error: "session_unavailable",
    });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears the aggregate timer when a read completes before its budget", async () => {
    vi.useFakeTimers();
    mocks.createAdminClient.mockImplementation(() => createAdminClientMock([]));

    const result = await getClientHomeDashboardData();
    const options = mocks.createAdminClient.mock.calls[0]?.[0] as SupabaseReadOptions;
    expect(result.authenticated).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(8_000);
    expect(options.requestSignal?.aborted).toBe(false);
  });

  it("keeps an unavailable identity read distinct from an unauthenticated session", async () => {
    mocks.getClientSessionReadResult.mockResolvedValue({
      status: "unavailable",
      session: null,
      reason: "provider",
    });

    const result = await getClientHomeDashboardWithTimeline();

    expect(result).toMatchObject({
      authenticated: false,
      unavailable: true,
      error: "session_unavailable",
    });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("returns a fixed error code when the dashboard provider throws", async () => {
    mocks.createAdminClient.mockImplementation(() => {
      throw new Error("secret provider details");
    });

    const result = await getClientHomeDashboardData();

    expect(result).toMatchObject({
      authenticated: false,
      unavailable: true,
      error: "dashboard_read_failed",
    });
    expect(JSON.stringify(result)).not.toContain("secret provider details");
  });

  it("does not start an identity or admin read for a pre-aborted caller", async () => {
    const upstream = new AbortController();
    upstream.abort(new DOMException("caller cancelled", "AbortError"));

    const result = await loadClientHomeDashboard({ includeTimeline: true }, upstream.signal);

    expect(result).toMatchObject({
      data: {
        authenticated: false,
        unavailable: true,
        error: "session_unavailable",
      },
      timeline: null,
      timelineApplicationId: null,
      timelinePartialData: false,
    });
    expect(mocks.getClientSessionReadResult).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("propagates caller cancellation through the shared eight-second read budget", async () => {
    const upstream = new AbortController();
    const readStarted = createDeferred<void>();
    mocks.getClientSessionReadResult.mockImplementation(({ requestSignal }: SupabaseReadOptions) =>
      new Promise((resolve) => {
        readStarted.resolve();
        requestSignal?.addEventListener("abort", () => resolve({
          status: "unavailable",
          session: null,
          reason: "cancelled",
        }), { once: true });
      }),
    );

    const pendingRead = loadClientHomeDashboard({}, upstream.signal);
    await readStarted.promise;
    upstream.abort(new DOMException("caller cancelled", "AbortError"));

    const result = await pendingRead;

    expect(result.data).toMatchObject({
      authenticated: false,
      unavailable: true,
      error: "session_unavailable",
    });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });
});
