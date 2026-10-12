// @vitest-environment node

import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/rbac", () => ({ requireAdmin: vi.fn() }));

import { loadStatusRelatedRows } from "@/app/client/status/status-related-rows";
import { loadLiveSubmissionSummaries } from "@/lib/submission-live-status";
import { createAdminClient } from "./admin";

const APP_A = "11111111-1111-4111-8111-111111111111";
const APP_B = "22222222-2222-4222-8222-222222222222";
const FOREIGN_APP = "99999999-9999-4999-8999-999999999999";

const EMBEDDED_SELECT = [
  "id",
  "consents:consent_events!consent_events_application_id_fkey(application_id,accepted,created_at)",
  "signatures:application_signatures!application_signatures_application_id_fkey(application_id,signed_at,created_at)",
  "answers:visa_application_answers!visa_application_answers_application_id_fkey(application_id,field_name,value_text,value_json)",
  "packets:application_packets!application_packets_application_id_fkey(application_id,status,storage_path,generated_at,created_at,updated_at)",
].join(",");

const DOCUMENT_SELECT = "documents:application_documents!application_documents_application_id_fkey(application_id,status,required)";
const FULL_DOCUMENT_SELECT = "documents:application_documents!application_documents_application_id_fkey(id,application_id,document_type,status,required,created_at,updated_at)";
const QUEUE_SELECT = "live_queue:submission_queue!submission_queue_application_id_fkey(id,application_id,status,mode,provider,current_stage,live_checkpoint,manual_action_status,error_code,error_message,official_portal_url,official_status,payment_status,live_submitted_at,updated_at,created_at)";

type Row = Record<string, unknown>;
type ChildTable =
  | "consent_events"
  | "application_signatures"
  | "visa_application_answers"
  | "application_packets"
  | "application_documents";

type ObservedRead = {
  method: string | undefined;
  table: string;
  query: URLSearchParams;
  status: number;
};

type FixtureMode = {
  embeddedError?: boolean;
  embeddedHang?: boolean;
  embeddedQueueRows?: Row[];
  embeddedRows?: Row[];
  failedTable?: ChildTable;
  submissionQueueError?: boolean;
  submissionQueueHang?: boolean;
  submissionQueueRows?: Row[];
  childDelayMs?: number;
};

type LocalStatusApi = {
  baseUrl: string;
  reads: ObservedRead[];
  abortedRequestCount: () => number;
  waitFor: (condition: () => boolean, description: string) => Promise<void>;
  close: () => Promise<void>;
};

function parseInFilter(value: string | null): string[] {
  if (!value?.startsWith("in.(") || !value.endsWith(")")) return [];
  return value.slice(4, -1).split(",").filter(Boolean);
}

function consent(applicationId: string, accepted = true): Row {
  return { application_id: applicationId, accepted, created_at: "2026-09-01T00:00:00.000Z" };
}

function signature(applicationId: string): Row {
  return { application_id: applicationId, signed_at: "2026-09-01T00:00:00.000Z", created_at: "2026-09-01T00:00:00.000Z" };
}

function answer(applicationId: string): Row {
  return { application_id: applicationId, field_name: "synthetic_field", value_text: "synthetic", value_json: null };
}

function packet(applicationId: string): Row {
  return {
    application_id: applicationId,
    status: "ready",
    storage_path: `synthetic/${applicationId}/packet.pdf`,
    generated_at: "2026-09-01T00:00:00.000Z",
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
  };
}

function document(applicationId: string): Row {
  return { application_id: applicationId, status: "uploaded", required: true };
}

function homeDocument(applicationId: string, id = "document-a"): Row {
  return {
    id,
    application_id: applicationId,
    document_type: "passport",
    status: "uploaded",
    required: true,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
  };
}

function submissionQueue(applicationId: string, id: string, createdAt: string): Row {
  return {
    id,
    application_id: applicationId,
    status: "queued",
    mode: "queued",
    provider: null,
    current_stage: null,
    live_checkpoint: null,
    manual_action_status: null,
    error_code: null,
    error_message: null,
    official_portal_url: null,
    official_status: null,
    payment_status: null,
    live_submitted_at: null,
    updated_at: createdAt,
    created_at: createdAt,
  };
}

function emptyEmbeddedRow(id: string): Row {
  return { id, consents: [], signatures: [], answers: [], packets: [], documents: [] };
}

const DEFAULT_EMBEDDED_ROWS: Row[] = [
  {
    id: APP_A,
    consents: [consent(APP_A)],
    signatures: [signature(APP_A)],
    answers: [answer(APP_A)],
    packets: [packet(APP_A)],
    documents: [document(APP_A)],
  },
  emptyEmbeddedRow(APP_B),
];

const DEFAULT_CHILD_ROWS: Record<ChildTable, Row[]> = {
  consent_events: [consent(APP_A), consent(APP_B)],
  application_signatures: [signature(APP_A), signature(APP_B)],
  visa_application_answers: [answer(APP_A), answer(APP_B)],
  application_packets: [packet(APP_A), packet(APP_B)],
  application_documents: [document(APP_A), document(APP_B)],
};

const DEFAULT_SUBMISSION_QUEUE_ROWS: Row[] = [
  submissionQueue(APP_A, "queue-default", "2026-09-01T00:00:00.000Z"),
];

async function startLocalStatusApi(mode: FixtureMode = {}): Promise<LocalStatusApi> {
  const reads: ObservedRead[] = [];
  let abortedRequestCount = 0;
  const server: Server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const table = url.pathname.replace("/rest/v1/", "") as string;
    const query = url.searchParams;
    const observed = (status: number) => {
      reads.push({ method: request.method, table, query, status });
    };
    const send = (status: number, body: unknown, delayMs = 0) => {
      if (delayMs > 0) {
        setTimeout(() => send(status, body), delayMs);
        return;
      }
      observed(status);
      response.writeHead(status, { "content-type": "application/json", connection: "close" });
      response.end(JSON.stringify(body));
    };

    request.on("aborted", () => {
      abortedRequestCount += 1;
    });

    if (request.method !== "GET") {
      send(405, { code: "METHOD_NOT_ALLOWED" });
      return;
    }

    if (table === "applications") {
      if (mode.embeddedHang) {
        observed(200);
        response.writeHead(200, { "content-type": "application/json", connection: "keep-alive" });
        response.write("[");
        return;
      }
      if (mode.embeddedError) {
        send(400, { code: "PGRST200", message: "Synthetic relationship unavailable" });
        return;
      }
      const ids = parseInFilter(query.get("id"));
      const queueProjection = query.get("select")?.includes("live_queue:submission_queue") ?? false;
      const queueApplicationFilter = query.get("live_queue.application_id");
      const embeddedQueueRows = mode.embeddedQueueRows ?? [];
      const rows = (mode.embeddedRows ?? DEFAULT_EMBEDDED_ROWS)
        .filter((row) => ids.includes(String(row.id)))
        .map((row) => {
          if (!queueProjection || Object.prototype.hasOwnProperty.call(row, "live_queue")) return row;
          const liveQueue = embeddedQueueRows
            .filter((queueRow) => String(queueRow.application_id).toLowerCase() === String(row.id).toLowerCase())
            .filter((queueRow) => {
              if (!queueApplicationFilter?.startsWith("eq.")) return true;
              return String(queueRow.application_id).toLowerCase() === queueApplicationFilter.slice(3).toLowerCase();
            })
            .sort((left, right) => String(right.created_at ?? "").localeCompare(String(left.created_at ?? "")));
          return { ...row, live_queue: liveQueue };
        });
      send(200, rows);
      return;
    }

    if (table === "submission_queue") {
      if (mode.submissionQueueHang) {
        observed(200);
        response.writeHead(200, { "content-type": "application/json", connection: "keep-alive" });
        response.write("[");
        return;
      }
      if (mode.submissionQueueError) {
        send(503, { code: "PGRST002", message: "Synthetic queue read failure" });
        return;
      }
      const ids = parseInFilter(query.get("application_id"));
      const rows = (mode.submissionQueueRows ?? DEFAULT_SUBMISSION_QUEUE_ROWS)
        .filter((row) => ids.includes(String(row.application_id)));
      send(200, rows);
      return;
    }

    const childTable = table as ChildTable;
    if (Object.prototype.hasOwnProperty.call(DEFAULT_CHILD_ROWS, childTable)) {
      if (mode.failedTable === childTable) {
        send(503, { code: "PGRST002", message: "Synthetic child read failure" });
        return;
      }
      const ids = parseInFilter(query.get("application_id"));
      const rows = DEFAULT_CHILD_ROWS[childTable].filter((row) => ids.includes(String(row.application_id)));
      send(200, rows, mode.childDelayMs ?? 0);
      return;
    }

    send(404, { code: "PGRST404", message: "Unknown synthetic table" });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address() as AddressInfo | null;
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Local status fixture did not receive an ephemeral address");
  }

  const waitFor = async (condition: () => boolean, description: string) => {
    const deadline = Date.now() + 2_000;
    while (!condition()) {
      if (Date.now() >= deadline) throw new Error(`Timed out waiting for ${description}`);
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  };

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    reads,
    abortedRequestCount: () => abortedRequestCount,
    waitFor,
    close: async () => {
      server.closeAllConnections();
      if (server.listening) {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => error ? reject(error) : resolve());
        });
      }
    },
  };
}

async function withLocalStatusApi(
  mode: FixtureMode,
  run: (fixture: LocalStatusApi) => Promise<void>,
): Promise<void> {
  const fixture = await startLocalStatusApi(mode);
  try {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", fixture.baseUrl);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "local-status-related-service-key");
    await run(fixture);
  } finally {
    await fixture.close();
  }
}

async function settleWithin<T>(promise: PromiseLike<T>, timeoutMs = 2_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("status related rows read did not settle")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("status related rows through the Supabase SDK", () => {
  it("embeds one selected queue with exact child filtering and reuses the valid result", async () => {
    const latest = submissionQueue(APP_A, "queue-latest", "2026-09-02T00:00:00.000Z");
    const older = submissionQueue(APP_A, "queue-older", "2026-09-01T00:00:00.000Z");
    await withLocalStatusApi({ embeddedQueueRows: [older, latest] }, async ({ reads }) => {
      const admin = createAdminClient({ requestTimeoutMs: 2_500, retryDelaysMs: [] });
      const result = await loadStatusRelatedRows(admin, [APP_A, APP_B], {
        submissionQueueApplicationId: APP_A,
      });

      expect(reads).toHaveLength(1);
      expect(reads[0]?.table).toBe("applications");
      expect(reads[0]?.query.get("select")).toBe(`${EMBEDDED_SELECT},${QUEUE_SELECT}`);
      expect(reads[0]?.query.get("live_queue.application_id")).toBe(`eq.${APP_A}`);
      expect(reads[0]?.query.get("live_queue.order")).toBe("created_at.desc.nullslast");
      expect(reads[0]?.query.get("live_queue.limit")).toBe("500");
      expect(result.submissionQueueResult).toEqual({ data: [latest, older], error: null });

      await loadLiveSubmissionSummaries(admin, [APP_A], [], {
        prefetchedQueueResult: result.submissionQueueResult,
      });
      expect(reads.filter((read) => read.table === "submission_queue")).toHaveLength(0);
    });
  });

  it("keeps an explicitly empty queue valid without issuing the original queue GET", async () => {
    await withLocalStatusApi({ embeddedQueueRows: [] }, async ({ reads }) => {
      const admin = createAdminClient({ requestTimeoutMs: 2_500, retryDelaysMs: [] });
      const result = await loadStatusRelatedRows(admin, [APP_A], {
        submissionQueueApplicationId: APP_A,
      });

      expect(result.submissionQueueResult).toEqual({ data: [], error: null });
      await loadLiveSubmissionSummaries(admin, [APP_A], [], {
        prefetchedQueueResult: result.submissionQueueResult,
      });
      expect(reads).toHaveLength(1);
      expect(reads.filter((read) => read.table === "submission_queue")).toHaveLength(0);
    });
  });

  it.each([
    {
      name: "a foreign queue row",
      embeddedRows: [
        {
          ...emptyEmbeddedRow(APP_A),
          live_queue: [{ ...submissionQueue(FOREIGN_APP, "queue-foreign", "2026-09-02T00:00:00.000Z") }],
        },
        emptyEmbeddedRow(APP_B),
      ],
      partialData: false,
    },
    {
      name: "a missing selected parent",
      embeddedRows: [emptyEmbeddedRow(APP_B)],
      partialData: true,
    },
  ])("uses one bounded queue GET after $name invalidates the prefetch", async ({ embeddedRows, partialData }) => {
    await withLocalStatusApi({ embeddedRows, submissionQueueRows: [] }, async ({ reads }) => {
      const admin = createAdminClient({ requestTimeoutMs: 2_500, retryDelaysMs: [] });
      const related = await loadStatusRelatedRows(admin, [APP_A, APP_B], {
        submissionQueueApplicationId: APP_A,
      });

      expect(related.submissionQueueResult).toBeUndefined();
      expect(related.partialData).toBe(partialData);
      await loadLiveSubmissionSummaries(admin, [APP_A], [], {
        prefetchedQueueResult: related.submissionQueueResult,
      });
      expect(reads.filter((read) => read.table === "submission_queue")).toHaveLength(1);
    });
  });

  it("uses the original queue GET after the embedded relation request fails", async () => {
    await withLocalStatusApi({ embeddedError: true, submissionQueueRows: [] }, async ({ reads }) => {
      const admin = createAdminClient({ requestTimeoutMs: 2_500, retryDelaysMs: [] });
      const related = await loadStatusRelatedRows(admin, [APP_A], {
        submissionQueueApplicationId: APP_A,
      });

      expect(related.submissionQueueResult).toBeUndefined();
      await loadLiveSubmissionSummaries(admin, [APP_A], [], {
        prefetchedQueueResult: related.submissionQueueResult,
      });
      expect(reads.filter((read) => read.table === "applications")).toHaveLength(1);
      expect(reads.filter((read) => read.table === "submission_queue")).toHaveLength(1);
    });
  });

  it("reports queue fallback before slow child reads finish", async () => {
    await withLocalStatusApi({
      embeddedError: true,
      childDelayMs: 100,
      submissionQueueRows: [],
    }, async ({ reads, waitFor }) => {
      const admin = createAdminClient({ requestTimeoutMs: 2_500, retryDelaysMs: [] });
      let callbackCount = 0;
      let callbackResult: { data: unknown; error: unknown } | undefined;
      const relatedPromise = loadStatusRelatedRows(admin, [APP_A], {
        submissionQueueApplicationId: APP_A,
        onSubmissionQueueResult: (result) => {
          callbackCount += 1;
          callbackResult = result;
        },
      });

      await waitFor(() => callbackCount === 1, "the early queue fallback notification");
      expect(callbackResult).toBeUndefined();
      expect(reads.some((read) => read.table === "consent_events")).toBe(false);

      await loadLiveSubmissionSummaries(admin, [APP_A], [], {
        prefetchedQueueResult: callbackResult,
      });
      const queueReadIndex = reads.findIndex((read) => read.table === "submission_queue");
      expect(queueReadIndex).toBeGreaterThanOrEqual(0);
      expect(reads.slice(0, queueReadIndex).some((read) => read.table === "consent_events")).toBe(false);

      await relatedPromise;
      expect(callbackCount).toBe(1);
      const firstChildReadIndex = reads.findIndex((read) => read.table === "consent_events");
      expect(firstChildReadIndex).toBeGreaterThan(queueReadIndex);
    });
  });

  it("uses one GET with one deduplicated owner filter and omits documents for Home", async () => {
    await withLocalStatusApi({}, async ({ reads }) => {
      const admin = createAdminClient({ requestTimeoutMs: 2_500, retryDelaysMs: [] });
      const result = await loadStatusRelatedRows(admin, [APP_A, APP_A, APP_B]);

      expect(reads).toHaveLength(1);
      expect(reads[0].method).toBe("GET");
      expect(reads[0].table).toBe("applications");
      expect(reads[0].query.get("id")).toBe(`in.(${APP_A},${APP_B})`);
      expect(reads[0].query.get("select")).toBe(EMBEDDED_SELECT);
      expect(reads[0].query.get("select")).not.toContain(DOCUMENT_SELECT);
      expect(result.consents.map((row) => row.application_id)).toEqual([APP_A]);
      expect(result.documents).toEqual([]);
      expect(result.partialData).toBe(false);
    });
  });

  it("filters foreign children and missing parents while marking the result partial", async () => {
    await withLocalStatusApi({
      embeddedRows: [{
        id: APP_A,
        consents: [consent(APP_A), consent(FOREIGN_APP)],
        signatures: [signature(APP_A), signature(FOREIGN_APP)],
        answers: [answer(FOREIGN_APP)],
        packets: [packet(APP_A), packet(FOREIGN_APP)],
        documents: [document(APP_A), document(FOREIGN_APP)],
      }],
    }, async ({ reads }) => {
      const admin = createAdminClient({ requestTimeoutMs: 2_500, retryDelaysMs: [] });
      const result = await loadStatusRelatedRows(admin, [APP_A, APP_B], { includeDocuments: true });

      expect(reads).toHaveLength(1);
      expect(reads[0].query.get("select")).toBe(`${EMBEDDED_SELECT},${DOCUMENT_SELECT}`);
      expect(result.consents.map((row) => row.application_id)).toEqual([APP_A]);
      expect(result.signatures.map((row) => row.application_id)).toEqual([APP_A]);
      expect(result.answers).toEqual([]);
      expect(result.packets.map((row) => row.application_id)).toEqual([APP_A]);
      expect(result.documents.map((row) => row.application_id)).toEqual([APP_A]);
      expect(result.partialData).toBe(true);
    });
  });

  it("accepts parents whose related tables are explicitly empty", async () => {
    await withLocalStatusApi({ embeddedRows: [emptyEmbeddedRow(APP_A), emptyEmbeddedRow(APP_B)] }, async ({ reads }) => {
      const admin = createAdminClient({ requestTimeoutMs: 2_500, retryDelaysMs: [] });
      const result = await loadStatusRelatedRows(admin, [APP_A, APP_B], { includeDocuments: true });

      expect(reads).toHaveLength(1);
      expect(result).toEqual({
        consents: [],
        signatures: [],
        answers: [],
        packets: [],
        documents: [],
        partialData: false,
      });
    });
  });

  it("validates the full Home document relation on the opt-in single-app path", async () => {
    const fullDocument = homeDocument(APP_A);
    await withLocalStatusApi({
      embeddedRows: [{ ...emptyEmbeddedRow(APP_A), documents: [fullDocument] }],
    }, async ({ reads }) => {
      const admin = createAdminClient({ requestTimeoutMs: 2_500, retryDelaysMs: [] });
      const result = await loadStatusRelatedRows(admin, [APP_A], {
        includeDocuments: true,
        documentColumns: "id,application_id,document_type,status,required,created_at,updated_at",
        prefetchDocuments: true,
      });

      expect(reads).toHaveLength(1);
      expect(reads[0]?.query.get("select")).toContain(FULL_DOCUMENT_SELECT);
      expect(reads[0]?.query.get("documents.limit")).toBe("1000");
      expect(result.documentsPrefetched).toBe(true);
      expect(result.documentPrefetchFailed).toBe(false);
      expect(result.documents).toEqual([fullDocument]);
      expect(result.partialData).toBe(false);
    });
  });

  it("rejects a full document relation at the PostgREST global row cap", async () => {
    const documents = Array.from({ length: 1_000 }, (_, index) =>
      homeDocument(APP_A, `document-${index}`),
    );
    await withLocalStatusApi({
      embeddedRows: [{ ...emptyEmbeddedRow(APP_A), documents }],
    }, async ({ reads }) => {
      const admin = createAdminClient({ requestTimeoutMs: 2_500, retryDelaysMs: [] });
      const result = await loadStatusRelatedRows(admin, [APP_A], {
        includeDocuments: true,
        documentColumns: "id,application_id,document_type,status,required,created_at,updated_at",
        prefetchDocuments: true,
      });

      expect(reads).toHaveLength(1);
      expect(reads[0]?.query.get("documents.limit")).toBe("1000");
      expect(result.documentsPrefetched).toBe(false);
      expect(result.documentPrefetchFailed).toBe(true);
      expect(result.documents).toEqual([]);
      expect(result.partialData).toBe(false);
    });
  });

  it("does not query for an empty or invalid ID batch", async () => {
    await withLocalStatusApi({}, async ({ reads }) => {
      const admin = createAdminClient({ requestTimeoutMs: 2_500, retryDelaysMs: [] });
      await expect(loadStatusRelatedRows(admin, [])).resolves.toEqual({
        consents: [], signatures: [], answers: [], packets: [], documents: [], partialData: false,
      });
      await expect(loadStatusRelatedRows(admin, [APP_A, "not-a-uuid"])).resolves.toEqual({
        consents: [], signatures: [], answers: [], packets: [], documents: [], partialData: true,
      });
      expect(reads).toHaveLength(0);
    });
  });

  it("falls back once to individual reads when the embedded relation is unavailable", async () => {
    await withLocalStatusApi({ embeddedError: true }, async ({ reads }) => {
      const admin = createAdminClient({ requestTimeoutMs: 2_500, retryDelaysMs: [] });
      const result = await loadStatusRelatedRows(admin, [APP_A, APP_B], { includeDocuments: true });

      expect(reads).toHaveLength(6);
      expect(reads.filter((read) => read.table === "applications")).toHaveLength(1);
      expect(new Set(reads.filter((read) => read.table !== "applications").map((read) => read.table))).toEqual(
        new Set([
          "consent_events",
          "application_signatures",
          "visa_application_answers",
          "application_packets",
          "application_documents",
        ]),
      );
      expect(reads.filter((read) => read.table !== "applications").every((read) =>
        read.query.get("application_id") === `in.(${APP_A},${APP_B})`)).toBe(true);
      expect(result.consents).toHaveLength(2);
      expect(result.signatures).toHaveLength(2);
      expect(result.answers).toHaveLength(2);
      expect(result.packets).toHaveLength(2);
      expect(result.documents).toHaveLength(2);
      expect(result.partialData).toBe(false);
    });
  });

  it("preserves successful fallback tables and marks one failed table partial", async () => {
    await withLocalStatusApi({ embeddedError: true, failedTable: "application_packets" }, async ({ reads }) => {
      const admin = createAdminClient({ requestTimeoutMs: 2_500, retryDelaysMs: [] });
      const result = await loadStatusRelatedRows(admin, [APP_A, APP_B], { includeDocuments: true });

      expect(reads).toHaveLength(6);
      expect(reads.filter((read) => read.table === "application_packets")).toHaveLength(1);
      expect(reads.find((read) => read.table === "application_packets")?.status).toBe(503);
      expect(result.consents).toHaveLength(2);
      expect(result.signatures).toHaveLength(2);
      expect(result.answers).toHaveLength(2);
      expect(result.packets).toEqual([]);
      expect(result.documents).toHaveLength(2);
      expect(result.partialData).toBe(true);
    });
  });

  it("does not start fallback reads after caller cancellation", async () => {
    await withLocalStatusApi({ embeddedHang: true }, async (fixture) => {
      const controller = new AbortController();
      const admin = createAdminClient({
        requestSignal: controller.signal,
        requestTimeoutMs: 10_000,
        retryDelaysMs: [],
      });
      const pending = loadStatusRelatedRows(admin, [APP_A], {
        includeDocuments: true,
        submissionQueueApplicationId: APP_A,
      });

      await fixture.waitFor(() => fixture.reads.length === 1, "the embedded status read");
      controller.abort(new DOMException("synthetic cancellation", "AbortError"));
      const result = await settleWithin(pending);

      expect(result.consents).toEqual([]);
      expect(result.signatures).toEqual([]);
      expect(result.answers).toEqual([]);
      expect(result.packets).toEqual([]);
      expect(result.documents).toEqual([]);
      await fixture.waitFor(() => fixture.abortedRequestCount() === 1, "the cancelled response");
      expect(fixture.reads).toHaveLength(1);
    });
  });
});
