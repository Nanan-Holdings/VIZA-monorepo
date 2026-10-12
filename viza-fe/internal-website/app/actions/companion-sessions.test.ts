import { beforeEach, describe, expect, it, vi } from "vitest";

type SessionRow = {
  id: string;
  applicant_id: string;
  created_at: string | null;
  updated_at: string | null;
};

type FirstMessageFixture = {
  session_id: string;
  role: string;
  content: string;
  created_at: string;
};

type TitleMessageFixture = {
  session_id: string;
  role: string;
  content: string;
  created_at: string;
};

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

type QueryCall = {
  table: string;
  select: string | null;
  eq: Array<[string, string]>;
  in: Array<[string, string[]]>;
  like: Array<[string, string]>;
  order: Array<{
    column: string;
    ascending: boolean;
    referencedTable?: string;
  }>;
  limit: Array<{ value: number; referencedTable?: string }>;
};

type FakeAdminOptions = {
  sessions?: QueryResult;
  firstMessages?: QueryResult;
  titleMessages?: QueryResult;
};

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  getClientSessionWithFallback: vi.fn(),
  getImpersonationSession: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

vi.mock("@/lib/client-session", () => ({
  getClientSessionWithFallback: mocks.getClientSessionWithFallback,
}));

vi.mock("@/lib/impersonation-session", () => ({
  getImpersonationSession: mocks.getImpersonationSession,
}));

import { getUserSessions } from "./companion-sessions";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";

function sessionRow(
  id: string,
  applicantId = USER_ID,
  updatedAt = "2026-09-09T10:00:00.000Z",
): SessionRow {
  return {
    id,
    applicant_id: applicantId,
    created_at: "2026-09-09T09:00:00.000Z",
    updated_at: updatedAt,
  };
}

function firstMessage(
  sessionId: string,
  content: string,
  createdAt: string,
  role = "user",
): FirstMessageFixture {
  return { session_id: sessionId, role, content, created_at: createdAt };
}

function titleMessage(
  sessionId: string,
  content: string,
  createdAt: string,
  role = "system",
): TitleMessageFixture {
  return { session_id: sessionId, role, content, created_at: createdAt };
}

function createAdminClientMock(
  options: FakeAdminOptions = {},
): { calls: QueryCall[]; client: { from: (table: string) => unknown } } {
  const calls: QueryCall[] = [];
  const sessions = options.sessions ?? { data: [], error: null };
  const firstMessages = options.firstMessages ?? { data: [], error: null };
  const titleMessages = options.titleMessages ?? { data: [], error: null };

  const client = {
    from(table: string) {
      const call: QueryCall = {
        table,
        select: null,
        eq: [],
        in: [],
        like: [],
        order: [],
        limit: [],
      };
      calls.push(call);

      const response = (): QueryResult => {
        if (table === "visa_chat_sessions") {
          if (call.select?.includes("first_user_message:visa_chat_messages")) {
            const allowedIds = new Set(call.in.at(-1)?.[1] ?? []);
            if (firstMessages.error) return firstMessages;

            const firstBySession = new Map<string, FirstMessageFixture>();
            for (const message of (firstMessages.data ?? []) as FirstMessageFixture[]) {
              if (
                message.role === "user" &&
                allowedIds.has(message.session_id) &&
                !firstBySession.has(message.session_id)
              ) {
                firstBySession.set(message.session_id, message);
              }
            }

            return {
              data: [...firstBySession.entries()].map(([id, message]) => ({
                id,
                first_user_message: [{ content: message.content }],
              })),
              error: null,
            };
          }

          if (sessions.error) return sessions;
          const allowedSessions = (sessions.data ?? []) as SessionRow[];
          const applicantFilter = call.eq.find(
            ([column]) => column === "applicant_id",
          )?.[1];
          const maxRows = call.limit[0]?.value;
          return {
            data: allowedSessions
              .filter((session) => session.applicant_id === applicantFilter)
              .slice(0, maxRows),
            error: null,
          };
        }

        if (titleMessages.error) return titleMessages;
        const allowedIds = new Set(call.in.at(-1)?.[1] ?? []);
        return {
          data: ((titleMessages.data ?? []) as TitleMessageFixture[]).filter(
            (message) =>
              message.role === "system" && allowedIds.has(message.session_id),
          ),
          error: null,
        };
      };

      const query = {
        select(columns: string) {
          call.select = columns;
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
        like(column: string, value: string) {
          call.like.push([column, value]);
          return query;
        },
        order(
          column: string,
          options: {
            ascending: boolean;
            referencedTable?: string;
          },
        ) {
          call.order.push({ column, ...options });
          return query;
        },
        limit(value: number, options?: { referencedTable?: string }) {
          call.limit.push({ value, ...options });
          return query;
        },
        then<TResult1 = QueryResult, TResult2 = never>(
          onfulfilled?:
            | ((value: QueryResult) => TResult1 | PromiseLike<TResult1>)
            | null,
          onrejected?:
            | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
            | null,
        ) {
          return Promise.resolve(response()).then(onfulfilled, onrejected);
        },
      };

      return query;
    },
  };

  return { calls, client };
}

function useAdminMock(options: FakeAdminOptions = {}) {
  const fake = createAdminClientMock(options);
  mocks.createAdminClient.mockReturnValue(fake.client);
  return fake;
}

beforeEach(() => {
  mocks.createAdminClient.mockReset();
  mocks.getClientSessionWithFallback.mockReset();
  mocks.getImpersonationSession.mockReset();
  mocks.getImpersonationSession.mockResolvedValue(null);
  mocks.getClientSessionWithFallback.mockResolvedValue({
    userId: USER_ID,
    email: "user@example.test",
  });
});

describe("getUserSessions authorization", () => {
  it.each([
    ["without a session", null],
    ["for another user", { userId: OTHER_USER_ID, email: "other@example.test" }],
  ])("does zero database reads %s", async (_caseName, session) => {
    mocks.getClientSessionWithFallback.mockResolvedValue(session);

    await expect(getUserSessions(USER_ID)).resolves.toEqual([]);

    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("uses an impersonation identity and does not consult the client session", async () => {
    mocks.getImpersonationSession.mockResolvedValue({ userId: USER_ID });
    const fake = useAdminMock({
      sessions: { data: [sessionRow("session-impersonated")], error: null },
      firstMessages: {
        data: [firstMessage("session-impersonated", "hello", "2026-09-09T09:01:00.000Z")],
        error: null,
      },
    });

    await expect(getUserSessions(USER_ID)).resolves.toHaveLength(1);

    expect(mocks.getClientSessionWithFallback).not.toHaveBeenCalled();
    expect(fake.calls.map((call) => call.table)).toEqual([
      "visa_chat_sessions",
      "visa_chat_sessions",
      "visa_chat_messages",
    ]);
  });
});

describe("getUserSessions bounded reads", () => {
  it("selects only session columns and limits the first message to one per parent", async () => {
    const sessions = [sessionRow("session-a"), sessionRow("session-b")];
    const fake = useAdminMock({
      sessions: { data: sessions, error: null },
      firstMessages: {
        data: [
          firstMessage("session-a", "first A", "2026-09-09T09:01:00.000Z"),
          firstMessage("session-a", "later A", "2026-09-09T09:02:00.000Z"),
          firstMessage("session-b", "first B", "2026-09-09T09:01:00.000Z"),
          firstMessage("session-b", "later B", "2026-09-09T09:02:00.000Z"),
        ],
        error: null,
      },
    });

    const result = await getUserSessions(USER_ID);

    expect(result.map((session) => session.firstMessagePreview)).toEqual([
      "first A",
      "first B",
    ]);
    const [parent, preview] = fake.calls.filter(
      (call) => call.table === "visa_chat_sessions",
    );
    expect(parent?.select).toBe("id, applicant_id, created_at, updated_at");
    expect(parent?.eq).toEqual([["applicant_id", USER_ID]]);
    expect(parent?.order).toEqual([
      { column: "updated_at", ascending: false },
      { column: "created_at", ascending: false },
    ]);
    expect(parent?.limit).toEqual([{ value: 30 }]);
    expect(preview?.select).toBe(
      "id, first_user_message:visa_chat_messages(content)",
    );
    expect(preview?.eq).toEqual([
      ["applicant_id", USER_ID],
      ["first_user_message.role", "user"],
    ]);
    expect(preview?.in).toEqual([["id", ["session-a", "session-b"]]]);
    expect(preview?.order).toEqual([
      {
        column: "created_at",
        ascending: true,
        referencedTable: "first_user_message",
      },
    ]);
    expect(preview?.limit).toEqual([
      { value: 1, referencedTable: "first_user_message" },
    ]);
  });

  it("does not fall through from an empty first user message to a later message", async () => {
    const fake = useAdminMock({
      sessions: { data: [sessionRow("session-empty")], error: null },
      firstMessages: {
        data: [
          firstMessage("session-empty", "", "2026-09-09T09:01:00.000Z"),
          firstMessage("session-empty", "later nonempty", "2026-09-09T09:02:00.000Z"),
        ],
        error: null,
      },
    });

    await expect(getUserSessions(USER_ID)).resolves.toEqual([]);

    const preview = fake.calls.find(
      (call) =>
        call.table === "visa_chat_sessions" &&
        call.select?.includes("first_user_message"),
    );
    expect(preview?.limit).toEqual([
      { value: 1, referencedTable: "first_user_message" },
    ]);
  });

  it("omits sessions with no user message, including assistant-only sessions", async () => {
    const fake = useAdminMock({
      sessions: {
        data: [sessionRow("session-draft"), sessionRow("session-assistant")],
        error: null,
      },
      firstMessages: {
        data: [
          firstMessage(
            "session-assistant",
            "assistant response",
            "2026-09-09T09:01:00.000Z",
            "assistant",
          ),
        ],
        error: null,
      },
    });

    await expect(getUserSessions(USER_ID)).resolves.toEqual([]);

    expect(fake.calls.filter((call) => call.table === "visa_chat_messages")).toHaveLength(1);
  });

  it("keeps the newest valid title when a newer marker is blank or invalid", async () => {
    const sessionId = "session-titled";
    useAdminMock({
      sessions: { data: [sessionRow(sessionId)], error: null },
      titleMessages: {
        data: [
          titleMessage(sessionId, "__viza_session_title__:", "2026-09-09T09:03:00.000Z"),
          titleMessage(sessionId, "not-a-title", "2026-09-09T09:02:00.000Z"),
          titleMessage(sessionId, "__viza_session_title__:Older valid title", "2026-09-09T09:01:00.000Z"),
        ],
        error: null,
      },
    });

    await expect(getUserSessions(USER_ID)).resolves.toMatchObject([
      { id: sessionId, title: "Older valid title" },
    ]);
  });

  it("returns the first ten visible sessions from thirty candidates", async () => {
    const sessions = Array.from({ length: 31 }, (_, index) =>
      sessionRow(`session-${index}`, USER_ID, `2026-09-09T${String(10 - Math.floor(index / 60)).padStart(2, "0")}:00:00.000Z`),
    );
    const firstMessages = sessions.map((session, index) =>
      firstMessage(session.id, `message-${index}`, `2026-09-09T09:${String(index).padStart(2, "0")}:00.000Z`),
    );
    const fake = useAdminMock({
      sessions: { data: sessions, error: null },
      firstMessages: { data: firstMessages, error: null },
    });

    const result = await getUserSessions(USER_ID);

    expect(result).toHaveLength(10);
    expect(result.map((session) => session.id)).toEqual(
      Array.from({ length: 10 }, (_, index) => `session-${index}`),
    );
    expect(fake.calls.find((call) => call.table === "visa_chat_sessions")?.limit).toEqual([
      { value: 30 },
    ]);
  });
});

describe("getUserSessions partial failures and isolation", () => {
  it("returns no child reads when the parent query fails", async () => {
    const fake = useAdminMock({
      sessions: { data: null, error: { message: "session query failed" } },
    });

    await expect(getUserSessions(USER_ID)).resolves.toEqual([]);

    expect(fake.calls.map((call) => call.table)).toEqual(["visa_chat_sessions"]);
  });

  it("keeps title data when the preview query fails", async () => {
    const sessionId = "session-title-only";
    useAdminMock({
      sessions: { data: [sessionRow(sessionId)], error: null },
      firstMessages: { data: null, error: { message: "preview failed" } },
      titleMessages: {
        data: [titleMessage(sessionId, "__viza_session_title__:Saved title", "2026-09-09T09:01:00.000Z")],
        error: null,
      },
    });

    await expect(getUserSessions(USER_ID)).resolves.toMatchObject([
      { id: sessionId, title: "Saved title", firstMessagePreview: undefined },
    ]);
  });

  it("keeps preview data when the title query fails", async () => {
    const sessionId = "session-preview-only";
    useAdminMock({
      sessions: { data: [sessionRow(sessionId)], error: null },
      firstMessages: {
        data: [firstMessage(sessionId, "Saved preview", "2026-09-09T09:01:00.000Z")],
        error: null,
      },
      titleMessages: { data: null, error: { message: "title failed" } },
    });

    await expect(getUserSessions(USER_ID)).resolves.toMatchObject([
      { id: sessionId, firstMessagePreview: "Saved preview", title: undefined },
    ]);
  });

  it("keeps child queries constrained to the authorized session ids", async () => {
    const ownSession = sessionRow("own-session", USER_ID);
    const foreignSession = sessionRow("foreign-session", OTHER_USER_ID);
    const fake = useAdminMock({
      sessions: { data: [ownSession, foreignSession], error: null },
      firstMessages: {
        data: [
          firstMessage("own-session", "own message", "2026-09-09T09:01:00.000Z"),
          firstMessage("foreign-session", "foreign message", "2026-09-09T09:01:00.000Z"),
        ],
        error: null,
      },
    });

    const result = await getUserSessions(USER_ID);

    expect(result.map((session) => session.id)).toEqual(["own-session"]);
    const preview = fake.calls.find(
      (call) =>
        call.table === "visa_chat_sessions" &&
        call.select?.includes("first_user_message"),
    );
    expect(preview?.eq).toContainEqual(["applicant_id", USER_ID]);
    expect(preview?.in).toEqual([["id", ["own-session"]]]);
  });
});
