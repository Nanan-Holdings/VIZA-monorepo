// @vitest-environment node

import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";

const { getClientSessionWithFallback, getImpersonationSession } = vi.hoisted(() => ({
  getClientSessionWithFallback: vi.fn(),
  getImpersonationSession: vi.fn(),
}));
vi.mock("@/lib/client-session", () => ({ getClientSessionWithFallback }));
vi.mock("@/lib/impersonation-session", () => ({ getImpersonationSession }));
vi.mock("@/lib/rbac", () => ({ requireAdmin: vi.fn() }));

import { getSessionMessages } from "@/app/actions/companion-sessions";

const OWNER = "11111111-1111-4111-8111-111111111111";
const SESSION = "22222222-2222-4222-8222-222222222222";
const OTHER_SESSION = "33333333-3333-4333-8333-333333333333";
const FOREIGN_SESSION = "44444444-4444-4444-8444-444444444444";
const BLOCK = { blockType: "application_redirect", redirectUrl: "/client/application?country=synthetic" };

type FixtureMessage = {
  id: string;
  session_id: string;
  role: string;
  content: string;
  created_at: string;
  block_data: Record<string, unknown> | null;
};
type ObservedRead = { table: string; method: string | undefined; query: URLSearchParams; returnedRows: number };

async function withLocalMessageApi(
  fail: boolean,
  run: (reads: ObservedRead[], ownMessages: FixtureMessage[]) => Promise<void>,
): Promise<void> {
  const ownership = new Map([[SESSION, OWNER], [OTHER_SESSION, OWNER], [FOREIGN_SESSION, "foreign-owner"]]);
  const ownMessages: FixtureMessage[] = Array.from({ length: 100 }, (_, index) => ({
    id: `synthetic-message-${index}`,
    session_id: SESSION,
    role: index === 99 ? "block" : index % 3 === 0 ? "system" : index % 3 === 1 ? "user" : "assistant",
    content: `Synthetic message ${index}`,
    created_at: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
    block_data: index === 99 ? BLOCK : null,
  }));
  const allMessages = [
    ...ownMessages,
    { ...ownMessages[99], id: "other-owned-session-message", session_id: OTHER_SESSION },
    { ...ownMessages[99], id: "foreign-session-message", session_id: FOREIGN_SESSION },
  ];
  const reads: ObservedRead[] = [];
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const query = url.searchParams;
    const table = url.pathname.replace("/rest/v1/", "");
    if (table !== "visa_chat_messages") {
      response.writeHead(404).end();
      reads.push({ table, method: request.method, query, returnedRows: 0 });
      return;
    }
    if (fail) {
      reads.push({ table, method: request.method, query, returnedRows: 0 });
      response.writeHead(400, { "content-type": "application/json" });
      response.end(JSON.stringify({ code: "PGRST200", message: "Synthetic relation error" }));
      return;
    }
    // Local protocol fixture only. Query execution/ownership is simulated;
    // the test separately asserts that the SDK sends the required inner join.
    let selected = allMessages.filter((message) => query.get("session_id") === `eq.${message.session_id}`);
    if (query.get("select")?.includes("visa_chat_sessions!inner(")) {
      selected = selected.filter((message) =>
        query.get("visa_chat_sessions.applicant_id") === `eq.${ownership.get(message.session_id)}`);
    }
    if (query.get("role") === "neq.system") selected = selected.filter((message) => message.role !== "system");
    if (query.get("order") === "created_at.desc") {
      selected = selected.toSorted((a, b) => b.created_at.localeCompare(a.created_at));
    }
    if (query.has("limit")) selected = selected.slice(0, Number(query.get("limit")));
    reads.push({ table, method: request.method, query, returnedRows: selected.length });
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(selected.map((message) => ({
      ...message,
      visa_chat_sessions: { applicant_id: ownership.get(message.session_id) },
    }))));
  });

  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", `http://127.0.0.1:${(server.address() as AddressInfo).port}`);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "local-message-fixture-service-key");
    getImpersonationSession.mockResolvedValue(null);
    getClientSessionWithFallback.mockResolvedValue({ userId: OWNER });
    await run(reads, ownMessages);
  } finally {
    server.closeAllConnections();
    if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("session message reads through the Supabase SDK", () => {
  it("uses one ownership-filtered HTTP read for the latest 50 messages and preserves blocks", async () => {
    await withLocalMessageApi(false, async (reads, ownMessages) => {
      const result = await getSessionMessages(SESSION, OWNER);
      const expected = ownMessages.filter((message) => message.role !== "system").slice(-50);
      expect(result.map((message) => message.id)).toEqual(expected.map((message) => message.id));
      expect(result).toHaveLength(50);
      expect(result.at(-1)?.senderType).toBe("block");
      expect(result.at(-1)?.blockData).toEqual(BLOCK);
      expect(result[0].blockData).toBeNull();
      expect(result.some((message) => message.senderType === "agent")).toBe(true);
      expect(result.every((message) => !("visa_chat_sessions" in message))).toBe(true);
      expect(reads).toHaveLength(1);
      const read = reads[0];
      expect(read.method).toBe("GET");
      expect(read.table).toBe("visa_chat_messages");
      expect(read.query.get("select")).toBe(
        "id,session_id,role,content,created_at,block_data,visa_chat_sessions!inner(applicant_id)",
      );
      expect(read.query.get("session_id")).toBe(`eq.${SESSION}`);
      expect(read.query.get("visa_chat_sessions.applicant_id")).toBe(`eq.${OWNER}`);
      expect(read.query.get("role")).toBe("neq.system");
      expect(read.query.get("order")).toBe("created_at.desc");
      expect(read.query.get("limit")).toBe("50");
      expect(read.returnedRows).toBe(50);

      expect(await getSessionMessages(FOREIGN_SESSION, OWNER)).toEqual([]);
      expect(await getSessionMessages("missing-session", OWNER)).toEqual([]);
      expect(reads).toHaveLength(3);
      expect(reads.slice(1).every((request) => request.returnedRows === 0)).toBe(true);
    });
  });

  it("fails closed on a query error without a second ownership or fallback read", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await withLocalMessageApi(true, async (reads) => {
      expect(await getSessionMessages(SESSION, OWNER)).toEqual([]);
      expect(reads).toHaveLength(1);
      expect(reads[0].query.get("visa_chat_sessions.applicant_id")).toBe(`eq.${OWNER}`);
    });
  });
});
