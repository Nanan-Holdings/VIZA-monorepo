import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type MessageFixture = {
  id: string;
  session_id: string;
  owner_id: string;
  role: "user" | "assistant" | "system" | "block";
  content: string;
  created_at: string;
  block_data?: Record<string, unknown> | null;
};

type QueryResult = {
  data: MessageFixture[] | null;
  error: { message: string } | null;
};

type QueryCall = {
  table: string;
  select: string | null;
  eq: Array<[string, string]>;
  neq: Array<[string, string]>;
  order: Array<{ column: string; ascending: boolean }>;
  limit: number[];
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

import { getSessionMessages } from "./companion-sessions";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";
const SESSION_ID = "session-own";
const OTHER_SESSION_ID = "session-other";

function messageRow(
  id: string,
  sessionId = SESSION_ID,
  role: MessageFixture["role"] = "user",
  createdAt = "2026-09-09T10:00:00.000Z",
  ownerId = USER_ID,
  blockData?: Record<string, unknown> | null,
): MessageFixture {
  return {
    id,
    session_id: sessionId,
    owner_id: ownerId,
    role,
    content: `${role}-${id}`,
    created_at: createdAt,
    ...(blockData === undefined ? {} : { block_data: blockData }),
  };
}

function createAdminClientMock(
  response: QueryResult = { data: [], error: null },
): { calls: QueryCall[]; client: { from: (table: string) => unknown } } {
  const calls: QueryCall[] = [];

  const client = {
    from(table: string) {
      const call: QueryCall = {
        table,
        select: null,
        eq: [],
        neq: [],
        order: [],
        limit: [],
      };
      calls.push(call);

      const getResponse = (): QueryResult => {
        if (response.error) return response;

        const sessionId = call.eq.find(([column]) => column === "session_id")?.[1];
        const ownerId = call.eq.find(
          ([column]) => column === "visa_chat_sessions.applicant_id",
        )?.[1];
        const excludedRole = call.neq.find(([column]) => column === "role")?.[1];
        const maxRows = call.limit[0];

        const rows = (response.data ?? [])
          .filter((row) => !sessionId || row.session_id === sessionId)
          .filter((row) => !ownerId || row.owner_id === ownerId)
          .filter((row) => !excludedRole || row.role !== excludedRole);

        return {
          data: maxRows === undefined ? rows : rows.slice(0, maxRows),
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
        neq(column: string, value: string) {
          call.neq.push([column, value]);
          return query;
        },
        order(column: string, options: { ascending: boolean }) {
          call.order.push({ column, ascending: options.ascending });
          return query;
        },
        limit(value: number) {
          call.limit.push(value);
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
          return Promise.resolve(getResponse()).then(onfulfilled, onrejected);
        },
      };

      return query;
    },
  };

  return { calls, client };
}

function useAdminMock(response: QueryResult = { data: [], error: null }) {
  const fake = createAdminClientMock(response);
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

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getSessionMessages authorization", () => {
  it.each([
    ["without authentication", null],
    ["with another authenticated user", { userId: OTHER_USER_ID, email: "other@example.test" }],
  ])("returns no database rows %s", async (_caseName, session) => {
    mocks.getClientSessionWithFallback.mockResolvedValue(session);

    await expect(getSessionMessages(SESSION_ID, USER_ID)).resolves.toEqual([]);

    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("uses impersonation identity before the client session", async () => {
    mocks.getImpersonationSession.mockResolvedValue({ userId: USER_ID });
    const fake = useAdminMock({
      data: [messageRow("message-1")],
      error: null,
    });

    await expect(getSessionMessages(SESSION_ID, USER_ID)).resolves.toHaveLength(1);

    expect(mocks.getClientSessionWithFallback).not.toHaveBeenCalled();
    expect(fake.calls).toHaveLength(1);
  });
});

describe("getSessionMessages bounded owner-scoped read", () => {
  it("loads messages with one joined owner-scoped query", async () => {
    const fake = useAdminMock({
      data: [messageRow("message-1")],
      error: null,
    });

    await expect(getSessionMessages(SESSION_ID, USER_ID)).resolves.toMatchObject([
      { id: "message-1", sessionId: SESSION_ID },
    ]);

    expect(fake.calls).toHaveLength(1);
    const call = fake.calls[0];
    expect(call?.table).toBe("visa_chat_messages");
    expect(call?.select?.replace(/\s+/g, " ").trim()).toBe(
      "id, session_id, role, content, created_at, block_data, visa_chat_sessions!inner(applicant_id)",
    );
    expect(call?.eq).toEqual([
      ["session_id", SESSION_ID],
      ["visa_chat_sessions.applicant_id", USER_ID],
    ]);
    expect(call?.neq).toEqual([["role", "system"]]);
    expect(call?.order).toEqual([{ column: "created_at", ascending: false }]);
    expect(call?.limit).toEqual([50]);
  });

  it("fails closed for a missing or other-user session", async () => {
    const fake = useAdminMock({
      data: [messageRow("foreign-message", SESSION_ID, "user", undefined, OTHER_USER_ID)],
      error: null,
    });

    await expect(getSessionMessages(SESSION_ID, USER_ID)).resolves.toEqual([]);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.eq).toContainEqual([
      "visa_chat_sessions.applicant_id",
      USER_ID,
    ]);
  });

  it("does not mix another session belonging to the same user", async () => {
    const fake = useAdminMock({
      data: [
        messageRow("target-message", SESSION_ID),
        messageRow("other-session-message", OTHER_SESSION_ID),
      ],
      error: null,
    });

    const result = await getSessionMessages(SESSION_ID, USER_ID);

    expect(result.map((message) => message.id)).toEqual(["target-message"]);
    expect(fake.calls[0]?.eq).toContainEqual(["session_id", SESSION_ID]);
  });
});

describe("getSessionMessages mapping and pagination", () => {
  it("returns the latest fifty messages in chronological order", async () => {
    const rows = Array.from({ length: 55 }, (_, index) => {
      const createdAt = new Date(Date.UTC(2026, 8, 9, 10, index, 0)).toISOString();
      return messageRow(`message-${index}`, SESSION_ID, "user", createdAt);
    }).reverse();
    const fake = useAdminMock({ data: rows, error: null });

    const result = await getSessionMessages(SESSION_ID, USER_ID);

    expect(result).toHaveLength(50);
    expect(result[0]?.id).toBe("message-5");
    expect(result.at(-1)?.id).toBe("message-54");
    expect(result.map((message) => message.createdAt)).toEqual(
      [...result].sort((left, right) =>
        String(left.createdAt).localeCompare(String(right.createdAt)),
      ).map((message) => message.createdAt),
    );
    expect(fake.calls[0]?.limit).toEqual([50]);
  });

  it("hides system messages and preserves user, assistant, and block DTO data", async () => {
    const blockData = { type: "application_card", applicationId: "app-1" };
    const fake = useAdminMock({
      data: [
        messageRow("system-message", SESSION_ID, "system", "2026-09-09T10:03:00.000Z"),
        messageRow("block-message", SESSION_ID, "block", "2026-09-09T10:02:00.000Z", USER_ID, blockData),
        messageRow("assistant-message", SESSION_ID, "assistant", "2026-09-09T10:01:00.000Z"),
        messageRow("user-message", SESSION_ID, "user", "2026-09-09T10:00:00.000Z"),
        messageRow("missing-block-data", SESSION_ID, "block", "2026-09-09T09:59:00.000Z", USER_ID, null),
      ],
      error: null,
    });

    const result = await getSessionMessages(SESSION_ID, USER_ID);

    expect(result.map((message) => [message.id, message.senderType])).toEqual([
      ["missing-block-data", "block"],
      ["user-message", "user"],
      ["assistant-message", "agent"],
      ["block-message", "block"],
    ]);
    expect(result.find((message) => message.id === "block-message")?.blockData).toEqual(blockData);
    expect(result.find((message) => message.id === "missing-block-data")?.blockData).toBeNull();
    expect(fake.calls[0]?.neq).toEqual([["role", "system"]]);
  });

  it("returns an empty list when the message query fails", async () => {
    const fake = useAdminMock({ data: null, error: { message: "database unavailable" } });

    await expect(getSessionMessages(SESSION_ID, USER_ID)).resolves.toEqual([]);

    expect(fake.calls).toHaveLength(1);
  });
});

describe("getSessionMessages request isolation", () => {
  it("uses the current user scope on each call without caching", async () => {
    const first = createAdminClientMock({
      data: [messageRow("first-user-message")],
      error: null,
    });
    const second = createAdminClientMock({
      data: [messageRow("second-user-message", SESSION_ID, "user", undefined, OTHER_USER_ID)],
      error: null,
    });
    mocks.createAdminClient
      .mockReturnValueOnce(first.client)
      .mockReturnValueOnce(second.client);

    await expect(getSessionMessages(SESSION_ID, USER_ID)).resolves.toEqual([
      expect.objectContaining({ id: "first-user-message" }),
    ]);
    mocks.getClientSessionWithFallback.mockResolvedValue({
      userId: OTHER_USER_ID,
      email: "other@example.test",
    });
    await expect(getSessionMessages(SESSION_ID, OTHER_USER_ID)).resolves.toEqual([
      expect.objectContaining({ id: "second-user-message" }),
    ]);

    expect(first.calls[0]?.eq).toContainEqual([
      "visa_chat_sessions.applicant_id",
      USER_ID,
    ]);
    expect(second.calls[0]?.eq).toContainEqual([
      "visa_chat_sessions.applicant_id",
      OTHER_USER_ID,
    ]);
  });
});
