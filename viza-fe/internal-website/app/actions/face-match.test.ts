import { beforeEach, describe, expect, it, vi } from "vitest";

const createAdminClientMock = vi.hoisted(() => vi.fn());
const createClientMock = vi.hoisted(() => vi.fn());
const compareFacesMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: createAdminClientMock }));
vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));
vi.mock("@/lib/face/match", () => ({
  compareFaces: compareFacesMock,
  decideFromScore: (score: number, threshold: number) => {
    if (score >= threshold) return "auto_approve";
    if (score >= threshold * 0.7) return "staff_review";
    return "reject";
  },
  DEFAULT_FACE_MATCH_THRESHOLD: 0.85,
}));

import { runFaceMatch } from "./face-match";

type QueryResult = { data: unknown; error: { message: string } | null };

function query(result: QueryResult) {
  const builder: Record<string, unknown> & { then?: unknown } = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.in = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.limit = vi.fn(() => builder);
  builder.update = vi.fn(() => builder);
  builder.insert = vi.fn(() => Promise.resolve(result));
  builder.maybeSingle = vi.fn().mockResolvedValue(result);
  builder.then = (resolve: (value: QueryResult) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return builder;
}

describe("runFaceMatch runner pause fencing", () => {
  beforeEach(() => {
    compareFacesMock.mockReset();
    createClientMock.mockReset();
    createAdminClientMock.mockReset();
    compareFacesMock.mockResolvedValue({ score: 0.4, provider: "mock" });
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "auth-user" } } }) },
    });
  });

  it("pauses runner jobs through the capability RPC while preserving queue pause", async () => {
    const appQuery = query({ data: { id: "app-1", applicant_id: "applicant-1" }, error: null });
    const profileQuery = query({ data: { id: "applicant-1" }, error: null });
    const documentQuery = query({ data: { storage_path: "doc/path" }, error: null });
    const auditQuery = query({ data: null, error: null });
    const appUpdateQuery = query({ data: null, error: null });
    const queueUpdateQuery = query({ data: null, error: null });
    const rpc = vi.fn().mockResolvedValue({ data: 1, error: null });
    const tables: string[] = [];
    let appCalls = 0;
    const admin = {
      rpc,
      from: vi.fn((table: string) => {
        tables.push(table);
        if (table === "applications") {
          appCalls += 1;
          return appCalls === 1 ? appQuery : appUpdateQuery;
        }
        if (table === "applicant_profiles") return profileQuery;
        if (table === "application_documents") return documentQuery;
        if (table === "face_match_audit") return auditQuery;
        if (table === "submission_queue") return queueUpdateQuery;
        throw new Error(`unexpected direct table access: ${table}`);
      }),
      storage: {
        from: vi.fn(() => ({
          download: vi.fn().mockResolvedValue({
            data: { arrayBuffer: vi.fn().mockResolvedValue(new TextEncoder().encode("image").buffer) },
            error: null,
          }),
        })),
      },
    };
    createAdminClientMock.mockReturnValue(admin);

    await expect(runFaceMatch("app-1")).resolves.toMatchObject({ ok: true, decision: "reject" });
    expect(rpc).toHaveBeenCalledWith("pause_runner_jobs_for_review", {
      p_application_id: "app-1",
      p_reason: "face_match_reject:0.40",
    });
    expect(tables).toContain("submission_queue");
    expect(tables).not.toContain("runner_job");
  });

  it("surfaces pause RPC errors instead of issuing a direct runner update", async () => {
    const appQuery = query({ data: { id: "app-1", applicant_id: "applicant-1" }, error: null });
    const profileQuery = query({ data: { id: "applicant-1" }, error: null });
    const documentQuery = query({ data: { storage_path: "doc/path" }, error: null });
    const auditQuery = query({ data: null, error: null });
    const appUpdateQuery = query({ data: null, error: null });
    const queueUpdateQuery = query({ data: null, error: null });
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "pause unavailable" } });
    const tables: string[] = [];
    let appCalls = 0;
    const admin = {
      rpc,
      from: vi.fn((table: string) => {
        tables.push(table);
        if (table === "applications") {
          appCalls += 1;
          return appCalls === 1 ? appQuery : appUpdateQuery;
        }
        if (table === "applicant_profiles") return profileQuery;
        if (table === "application_documents") return documentQuery;
        if (table === "face_match_audit") return auditQuery;
        if (table === "submission_queue") return queueUpdateQuery;
        throw new Error(`unexpected direct table access: ${table}`);
      }),
      storage: {
        from: vi.fn(() => ({
          download: vi.fn().mockResolvedValue({
            data: { arrayBuffer: vi.fn().mockResolvedValue(new TextEncoder().encode("image").buffer) },
            error: null,
          }),
        })),
      },
    };
    createAdminClientMock.mockReturnValue(admin);

    await expect(runFaceMatch("app-1")).rejects.toThrow("runner_job pause: pause unavailable");
    expect(tables).not.toContain("runner_job");
  });
});
