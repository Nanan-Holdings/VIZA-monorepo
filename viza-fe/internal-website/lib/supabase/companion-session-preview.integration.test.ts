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

import { getUserSessions } from "@/app/actions/companion-sessions";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const TITLE_PREFIX = "__viza_session_title__:";

type FixtureSession = {
  id: string;
  applicant_id: string;
  created_at: string;
  updated_at: string;
};
type FixtureMessage = {
  session_id: string;
  role: string;
  content: string;
  created_at: number;
};
type ObservedRead = {
  table: string;
  method: string | undefined;
  query: URLSearchParams;
  returnedRows: number;
  returnedUserMessages: number;
};

function inValues(filter: string | null): string[] {
  return filter?.slice(4, -1).split(",").map((value) => value.replaceAll('"', "")) ?? [];
}

async function withLocalHistoryApi(
  failPreview: boolean,
  run: (reads: ObservedRead[]) => Promise<void>,
): Promise<void> {
  const sessions: FixtureSession[] = Array.from({ length: 32 }, (_, index) => ({
    id: `synthetic-session-${index.toString().padStart(2, "0")}`,
    applicant_id: OWNER_ID,
    created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, 32 - index)).toISOString(),
    updated_at: new Date(Date.UTC(2026, 0, 2, 0, 0, 32 - index)).toISOString(),
  }));
  sessions.push({ ...sessions[0], id: "foreign-session", applicant_id: "foreign-owner" });
  const messages: FixtureMessage[] = sessions.flatMap((session) =>
    Array.from({ length: 100 }, (_, index) => ({
      session_id: session.id,
      role: "user",
      content: `User ${index.toString().padStart(3, "0")} in ${session.id}`,
      created_at: index,
    })),
  );
  messages.push(
    { session_id: sessions[0].id, role: "assistant", content: "Earlier assistant", created_at: -1 },
    { session_id: sessions[0].id, role: "system", content: `${TITLE_PREFIX}Old valid title`, created_at: 200 },
    { session_id: sessions[0].id, role: "system", content: `${TITLE_PREFIX}   `, created_at: 201 },
  );
  const reads: ObservedRead[] = [];
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const query = url.searchParams;
    const table = url.pathname.replace("/rest/v1/", "");
    const embedPreview = query.get("select")?.includes("first_user_message:") ?? false;
    let result: unknown[];
    let returnedUserMessages = 0;

    // This fixture interprets the actual SDK query. It is deliberately local;
    // it does not claim to execute PostgREST or measure a PostgreSQL plan.
    if (table === "visa_chat_sessions") {
      let selected = sessions.filter((session) =>
        query.get("applicant_id") === `eq.${session.applicant_id}`);
      if (query.has("id")) {
        const ids = inValues(query.get("id"));
        selected = selected.filter((session) => ids.includes(session.id));
      }
      if (query.get("order") === "updated_at.desc,created_at.desc") {
        selected = selected.toSorted((a, b) =>
          b.updated_at.localeCompare(a.updated_at) || b.created_at.localeCompare(a.created_at));
      }
      if (query.has("limit")) selected = selected.slice(0, Number(query.get("limit")));

      if (embedPreview && failPreview) {
        reads.push({ table, method: request.method, query, returnedRows: 0, returnedUserMessages });
        response.writeHead(400, { "content-type": "application/json" });
        response.end(JSON.stringify({ code: "PGRST200", message: "Synthetic embed failure" }));
        return;
      }
      result = embedPreview ? selected.map((session) => {
        let children = messages.filter((message) =>
          message.session_id === session.id && query.get("first_user_message.role") === `eq.${message.role}`);
        if (query.get("first_user_message.order") === "created_at.asc") {
          children = children.toSorted((a, b) => a.created_at - b.created_at);
        }
        if (query.has("first_user_message.limit")) {
          children = children.slice(0, Number(query.get("first_user_message.limit")));
        }
        returnedUserMessages += children.length;
        return { id: session.id, first_user_message: children.map(({ content }) => ({ content })) };
      }) : selected;
    } else if (table === "visa_chat_messages") {
      const ids = inValues(query.get("session_id"));
      result = messages.filter((message) =>
        ids.includes(message.session_id) && query.get("role") === `eq.${message.role}`)
        .toSorted((a, b) => b.created_at - a.created_at)
        .map(({ session_id, content }) => ({ session_id, content }));
    } else {
      response.writeHead(404).end();
      return;
    }
    reads.push({ table, method: request.method, query, returnedRows: result.length, returnedUserMessages });
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(result));
  });

  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", `http://127.0.0.1:${(server.address() as AddressInfo).port}`);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "local-history-fixture-service-key");
    getImpersonationSession.mockResolvedValue(null);
    getClientSessionWithFallback.mockResolvedValue({ userId: OWNER_ID });
    await run(reads);
  } finally {
    server.closeAllConnections();
    if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("chat sidebar preview through the Supabase SDK", () => {
  it("requests one user message for each of 30 owned sessions with three HTTP reads", async () => {
    await withLocalHistoryApi(false, async (reads) => {
      const result = await getUserSessions(OWNER_ID);
      expect(result).toHaveLength(10);
      expect(result[0].title).toBe("Old valid title");
      result.forEach((session, index) => {
        const id = `synthetic-session-${index.toString().padStart(2, "0")}`;
        expect(session.id).toBe(id);
        expect(session.firstMessagePreview).toBe(`User 000 in ${id}`.slice(0, 30));
      });
      expect(reads).toHaveLength(3);
      expect(reads.every((read) => read.method === "GET")).toBe(true);
      expect(reads[0].query.get("select")).toBe("id,applicant_id,created_at,updated_at");
      expect(reads[0].query.get("limit")).toBe("30");
      expect(reads[0].returnedRows).toBe(30);
      const preview = reads[1];
      expect(preview.table).toBe("visa_chat_sessions");
      expect(preview.query.get("select")).toBe("id,first_user_message:visa_chat_messages(content)");
      expect(preview.query.get("select")).not.toContain("!inner");
      expect(preview.query.get("applicant_id")).toBe(`eq.${OWNER_ID}`);
      expect(inValues(preview.query.get("id"))).toHaveLength(30);
      expect(inValues(preview.query.get("id"))).not.toContain("foreign-session");
      expect(preview.query.get("first_user_message.role")).toBe("eq.user");
      expect(preview.query.get("first_user_message.order")).toBe("created_at.asc");
      expect(preview.query.get("first_user_message.limit")).toBe("1");
      expect(preview.returnedUserMessages).toBe(30);
      expect(reads[2].table).toBe("visa_chat_messages");
      expect(reads[2].query.get("role")).toBe("eq.system");
      expect(reads[2].query.get("content")).toBe(`like.${TITLE_PREFIX}%`);
      expect(reads[2].query.get("order")).toBe("created_at.desc");
      expect(reads[2].query.has("limit")).toBe(false);
    });
  });

  it("keeps valid titles when the bounded preview query fails without expanding reads", async () => {
    await withLocalHistoryApi(true, async (reads) => {
      const result = await getUserSessions(OWNER_ID);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Old valid title");
      expect(result[0].firstMessagePreview).toBeUndefined();
      expect(reads).toHaveLength(3);
      expect(reads.reduce((sum, read) => sum + read.returnedUserMessages, 0)).toBe(0);
      expect(reads[2].query.get("role")).toBe("eq.system");
    });
  });
});
