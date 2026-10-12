// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  loadClientHomeTimelinePreload,
  type ClientStatusApplicationRow,
} from "./status-data";

type QueryResponse = { data: unknown; error: unknown };
type QueryResponseSource = QueryResponse | PromiseLike<QueryResponse>;

class MockQuery implements PromiseLike<QueryResponse> {
  constructor(
    private readonly response: QueryResponseSource,
    private readonly onStart: () => void,
    private readonly onSettled: () => void,
  ) {}

  select(): this {
    return this;
  }

  in(): this {
    return this;
  }

  eq(): this {
    return this;
  }

  order(): this {
    return this;
  }

  limit(): this {
    return this;
  }

  then<TResult1 = QueryResponse, TResult2 = never>(
    onfulfilled?: ((value: QueryResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    this.onStart();
    return Promise.resolve(this.response)
      .then(
        (value) => {
          this.onSettled();
          return value;
        },
        (reason) => {
          this.onSettled();
          return Promise.reject(reason);
        },
      )
      .then(onfulfilled, onrejected);
  }
}

const APPLICATION_ID = "11111111-1111-4111-8111-111111111111";
const FALLBACK_TABLES = [
  "consent_events",
  "application_signatures",
  "visa_application_answers",
  "application_packets",
  "application_documents",
] as const;

const queueRow = {
  id: "queue-fallback",
  application_id: APPLICATION_ID,
  status: "running",
  mode: "live_assisted",
  provider: "vietnam_evisa_live",
  current_stage: "official_portal_submission",
  live_checkpoint: null,
  manual_action_status: null,
  error_code: null,
  error_message: null,
  official_portal_url: "https://example.test/portal",
  official_status: null,
  payment_status: null,
  live_submitted_at: null,
  updated_at: "2026-09-12T00:02:00.000Z",
  created_at: "2026-09-12T00:01:00.000Z",
};

const application = {
  id: APPLICATION_ID,
  applicant_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  country: "vietnam",
  visa_type: "VN_E_VISA",
  purpose: null,
  status: "draft",
  created_at: "2026-09-12T00:00:00.000Z",
  updated_at: "2026-09-12T00:00:00.000Z",
  submitted_at: null,
  confirmation_number: null,
  receipt_url: null,
  visa_package_id: null,
  packet_status: null,
  packet_storage_path: null,
  packet_ready_at: null,
  external_status: null,
  external_reference: null,
  external_status_updated_at: null,
  result_status: null,
  result_storage_path: null,
  submission_result: null,
  submission_result_status: null,
  submission_result_updated_at: null,
  government_fee_cents: null,
  government_fee_currency: null,
  government_fee_mode: null,
  official_fee_status: null,
  official_fee_quote_id: null,
  official_fee_payment_intent_id: null,
  official_fee_receipt_id: null,
} satisfies ClientStatusApplicationRow;

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  return {
    promise: new Promise<T>((promiseResolve) => {
      resolve = promiseResolve;
    }),
    resolve,
  };
}

function createFallbackClient() {
  const startedTables: string[] = [];
  const settledTables: string[] = [];
  const calls: string[] = [];
  let childrenReleased = false;
  const children = deferred<QueryResponse>();
  const client = {
    from(tableName: string) {
      calls.push(tableName);
      let response: QueryResponseSource;
      if (tableName === "applications") {
        response = {
          data: null,
          error: { code: "PGRST200", message: "Synthetic relationship unavailable" },
        };
      } else if ((FALLBACK_TABLES as readonly string[]).includes(tableName)) {
        response = children.promise;
      } else if (tableName === "submission_queue") {
        response = { data: [queueRow], error: null };
      } else {
        response = { data: [], error: null };
      }
      return new MockQuery(
        response,
        () => startedTables.push(tableName),
        () => settledTables.push(tableName),
      );
    },
  } as unknown as Parameters<typeof loadClientHomeTimelinePreload>[0];

  return {
    client,
    calls,
    startedTables,
    settledTables,
    childrenReleased: () => childrenReleased,
    releaseChildren: () => {
      childrenReleased = true;
      children.resolve({
        data: [{ application_id: APPLICATION_ID }],
        error: null,
      });
    },
  };
}

async function waitFor(condition: () => boolean): Promise<void> {
  const deadline = Date.now() + 1_000;
  while (!condition()) {
    if (Date.now() >= deadline) throw new Error("Timed out waiting for the queue fallback");
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}

describe("Home/Status queue fallback handoff", () => {
  it("starts and completes a healthy queue read before delayed child fallback settles", async () => {
    const fixture = createFallbackClient();
    const preload = loadClientHomeTimelinePreload(fixture.client, application);

    await waitFor(() => fixture.startedTables.includes("submission_queue"));

    expect(fixture.startedTables).toContain("applications");
    expect(fixture.childrenReleased()).toBe(false);
    expect(fixture.settledTables.filter((table) => FALLBACK_TABLES.includes(table as typeof FALLBACK_TABLES[number]))).toEqual([]);

    expect(fixture.childrenReleased()).toBe(false);
    expect(fixture.settledTables).toContain("submission_queue");

    fixture.releaseChildren();
    const result = await preload;
    expect(result.partialData).toBe(false);
    expect(result.relatedRows.consents).toHaveLength(1);
    expect(result.relatedRows.signatures).toHaveLength(1);
    expect(result.relatedRows.answers).toHaveLength(1);
    expect(result.relatedRows.packets).toHaveLength(1);
    expect(result.liveSubmission).toMatchObject({
      jobId: queueRow.id,
      applicationId: APPLICATION_ID,
      status: "running",
      state: "running",
      mode: "live_assisted",
      provider: "vietnam_evisa_live",
      currentStage: "official_portal_submission",
      officialPortalUrl: queueRow.official_portal_url,
    });
    expect(fixture.calls.filter((table) => table === "submission_queue")).toHaveLength(1);
  });

  it("does not issue a queue fallback after Home preload cancellation", async () => {
    const fixture = createFallbackClient();
    const controller = new AbortController();
    controller.abort(new DOMException("synthetic cancellation", "AbortError"));

    const preload = loadClientHomeTimelinePreload(fixture.client, application, {
      signal: controller.signal,
    });
    fixture.releaseChildren();

    const result = await preload;
    expect(result.liveSubmission).toBeNull();
    expect(result.partialData).toBe(true);
    expect(fixture.calls.filter((table) => table === "submission_queue")).toHaveLength(0);
  });
});
