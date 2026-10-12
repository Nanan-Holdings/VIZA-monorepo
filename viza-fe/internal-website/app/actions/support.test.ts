import { beforeEach, describe, expect, it, vi } from "vitest";

const authGetUser = vi.hoisted(() => vi.fn());
const createClient = vi.hoisted(() => vi.fn());
const createAdminClient = vi.hoisted(() => vi.fn());
const supportStorage = vi.hoisted(() => ({
  createStoredSupportTicket: vi.fn(),
  isSupportTableMissing: vi.fn(),
  listStoredTicketMessages: vi.fn(),
  listStoredTicketsByApplicant: vi.fn(),
  postStoredTicketMessage: vi.fn(),
  readStoredSupportTicket: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("./support-storage", () => supportStorage);

import { loadTicketThread } from "./support";

type QueryResult = {
  data: unknown;
  error: { code?: string; message: string } | null;
};

type QueryCall = {
  table: string;
  select: string | null;
  eq: Array<[string, string]>;
  is: Array<[string, null]>;
  order: Array<{ column: string; ascending: boolean }>;
};

interface QueryBuilder extends PromiseLike<QueryResult> {
  select(columns: string): QueryBuilder;
  eq(column: string, value: string): QueryBuilder;
  is(column: string, value: null): QueryBuilder;
  order(column: string, options: { ascending: boolean }): QueryBuilder;
  maybeSingle(): Promise<QueryResult>;
}

interface AdminClient {
  from(table: string): QueryBuilder;
}

type HarnessOptions = {
  profile?: QueryResult;
  ticket?: QueryResult;
  staff?: QueryResult;
  messages?: QueryResult;
};

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";
const AUTH_USER_ID = "44444444-4444-4444-8444-444444444444";
const TICKET_ID = "ticket-1";

function queryResult(data: unknown, error: QueryResult["error"] = null): QueryResult {
  return { data, error };
}

function ticketRow(
  overrides: Partial<{
    id: string;
    applicant_id: string;
    application_id: string | null;
    subject: string;
    body: string;
    status: string;
    priority: string;
    created_at: string;
    updated_at: string;
  }> = {},
) {
  return {
    id: TICKET_ID,
    applicant_id: USER_ID,
    application_id: null,
    subject: "Need help",
    body: "Please help with my application.",
    status: "unresolved",
    priority: "p2",
    created_at: "2026-09-09T10:00:00.000Z",
    updated_at: "2026-09-09T10:00:00.000Z",
    ...overrides,
  };
}

function messageRow(id: string) {
  return {
    id,
    ticket_id: TICKET_ID,
    author_kind: "applicant",
    author_id: USER_ID,
    body: `Message ${id}`,
    created_at: "2026-09-09T10:01:00.000Z",
  };
}

function createAdminHarness(options: HarnessOptions = {}) {
  const calls: QueryCall[] = [];
  const configured: Required<HarnessOptions> = {
    profile: queryResult({ id: USER_ID }),
    ticket: queryResult(ticketRow()),
    staff: queryResult({ role: "staff" }),
    messages: queryResult([messageRow("message-1")]),
    ...options,
  };

  const responseFor = (table: string): QueryResult => {
    if (table === "applicant_profiles") return configured.profile;
    if (table === "support_ticket") return configured.ticket;
    if (table === "users") return configured.staff;
    if (table === "support_message") return configured.messages;
    return queryResult(null, { message: `Unexpected table ${table}` });
  };

  const client: AdminClient = {
    from(table: string): QueryBuilder {
      const call: QueryCall = {
        table,
        select: null,
        eq: [],
        is: [],
        order: [],
      };
      calls.push(call);

      const query: QueryBuilder = {
        select(columns: string) {
          call.select = columns;
          return query;
        },
        eq(column: string, value: string) {
          call.eq.push([column, value]);
          return query;
        },
        is(column: string, value: null) {
          call.is.push([column, value]);
          return query;
        },
        order(column: string, options: { ascending: boolean }) {
          call.order.push({ column, ascending: options.ascending });
          return query;
        },
        maybeSingle() {
          return Promise.resolve(responseFor(table));
        },
        then<TResult1 = QueryResult, TResult2 = never>(
          onfulfilled?:
            | ((value: QueryResult) => TResult1 | PromiseLike<TResult1>)
            | null,
          onrejected?:
            | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
            | null,
        ) {
          return Promise.resolve(responseFor(table)).then(onfulfilled, onrejected);
        },
      };

      return query;
    },
  };

  createAdminClient.mockReturnValue(client);
  return { calls, client };
}

function storedTicket(overrides: Partial<ReturnType<typeof ticketRow>> = {}) {
  return {
    ...ticketRow(overrides),
    assigned_to: null,
    first_response_at: null,
    sla_due_at: null,
    messages: [],
  };
}

beforeEach(() => {
  authGetUser.mockReset();
  createClient.mockReset();
  createAdminClient.mockReset();
  for (const mock of Object.values(supportStorage)) mock.mockReset();

  authGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
  createClient.mockResolvedValue({ auth: { getUser: authGetUser } });
  supportStorage.isSupportTableMissing.mockImplementation(
    (error: { code?: string } | null | undefined) => error?.code === "PGRST205",
  );
  supportStorage.readStoredSupportTicket.mockResolvedValue(null);
  supportStorage.listStoredTicketMessages.mockResolvedValue([]);
});

describe("loadTicketThread owner query budget", () => {
  it("skips the staff lookup for an authenticated owner, even if staff", async () => {
    authGetUser.mockResolvedValueOnce({ data: { user: { id: AUTH_USER_ID } } });
    const harness = createAdminHarness({
      ticket: queryResult(ticketRow({ applicant_id: USER_ID })),
      staff: queryResult({ role: "admin" }),
      messages: queryResult([messageRow("message-1")]),
    });

    await expect(loadTicketThread(TICKET_ID)).resolves.toEqual({
      ticket: ticketRow({ applicant_id: USER_ID }),
      messages: [messageRow("message-1")],
    });

    expect(harness.calls.map((call) => call.table)).toEqual([
      "applicant_profiles",
      "support_ticket",
      "support_message",
    ]);
    expect(harness.calls[0]?.eq).toContainEqual(["auth_user_id", AUTH_USER_ID]);
    expect(harness.calls.some((call) => call.table === "users")).toBe(false);
  });

  it.each(["staff", "admin"])("allows a non-owner %s after a fresh role lookup", async (role) => {
    const harness = createAdminHarness({
      ticket: queryResult(ticketRow({ applicant_id: OTHER_USER_ID })),
      staff: queryResult({ role }),
    });

    await expect(loadTicketThread(TICKET_ID)).resolves.toMatchObject({
      ticket: { applicant_id: OTHER_USER_ID },
      messages: [messageRow("message-1")],
    });

    expect(harness.calls.map((call) => call.table)).toEqual([
      "applicant_profiles",
      "support_ticket",
      "users",
      "support_message",
    ]);
    const staffCall = harness.calls.find((call) => call.table === "users");
    expect(staffCall?.eq).toContainEqual(["id", USER_ID]);
    expect(staffCall?.is).toEqual([["deleted_at", null]]);
  });
});

describe("loadTicketThread authorization failures", () => {
  it.each([
    ["ordinary applicant", queryResult({ role: "applicant" })],
    ["deleted staff account", queryResult(null)],
    ["role lookup error", queryResult(null, { message: "role lookup failed" })],
  ])("denies a non-owner with %s before loading messages", async (_label, staff) => {
    const harness = createAdminHarness({
      ticket: queryResult(ticketRow({ applicant_id: OTHER_USER_ID })),
      staff,
    });

    await expect(loadTicketThread(TICKET_ID)).resolves.toEqual({ error: "Unauthorized" });
    expect(harness.calls.map((call) => call.table)).toEqual([
      "applicant_profiles",
      "support_ticket",
      "users",
    ]);
    expect(harness.calls.some((call) => call.table === "support_message")).toBe(false);
  });

  it("keeps unauthenticated, missing-profile, and missing-ticket guards", async () => {
    authGetUser.mockResolvedValueOnce({ data: { user: null } });
    await expect(loadTicketThread(TICKET_ID)).resolves.toEqual({ error: "Not authenticated" });
    expect(createAdminClient).not.toHaveBeenCalled();

    const missingProfile = createAdminHarness({ profile: queryResult(null) });
    await expect(loadTicketThread(TICKET_ID)).resolves.toEqual({ error: "No applicant profile" });
    expect(missingProfile.calls.map((call) => call.table)).toEqual(["applicant_profiles"]);

    const missingTicket = createAdminHarness({ ticket: queryResult(null) });
    await expect(loadTicketThread(TICKET_ID)).resolves.toEqual({ error: "Not found" });
    expect(missingTicket.calls.map((call) => call.table)).toEqual([
      "applicant_profiles",
      "support_ticket",
    ]);
  });
});

describe("loadTicketThread Storage fallback", () => {
  it("lets an owner read a fallback ticket without a staff lookup", async () => {
    const harness = createAdminHarness({
      ticket: queryResult(null, { code: "PGRST205", message: "table missing" }),
    });
    const stored = storedTicket({ applicant_id: USER_ID });
    const messages = [messageRow("stored-message")];
    supportStorage.readStoredSupportTicket.mockResolvedValue(stored);
    supportStorage.listStoredTicketMessages.mockResolvedValue(messages);

    await expect(loadTicketThread(TICKET_ID)).resolves.toEqual({
      ticket: stored,
      messages,
    });

    expect(harness.calls.map((call) => call.table)).toEqual([
      "applicant_profiles",
      "support_ticket",
    ]);
    expect(supportStorage.listStoredTicketMessages).toHaveBeenCalledWith(TICKET_ID);
  });

  it("keeps non-owner fallback authorization and does not read messages when denied", async () => {
    const harness = createAdminHarness({
      ticket: queryResult(null, { code: "PGRST205", message: "table missing" }),
      staff: queryResult({ role: "applicant" }),
    });
    supportStorage.readStoredSupportTicket.mockResolvedValue(
      storedTicket({ applicant_id: OTHER_USER_ID }),
    );

    await expect(loadTicketThread(TICKET_ID)).resolves.toEqual({ error: "Unauthorized" });
    expect(harness.calls.map((call) => call.table)).toEqual([
      "applicant_profiles",
      "support_ticket",
      "users",
    ]);
    expect(supportStorage.listStoredTicketMessages).not.toHaveBeenCalled();
  });

  it("allows a non-owner staff user to read fallback messages", async () => {
    const harness = createAdminHarness({
      ticket: queryResult(null, { code: "PGRST205", message: "table missing" }),
      staff: queryResult({ role: "staff" }),
    });
    const stored = storedTicket({ applicant_id: OTHER_USER_ID });
    const messages = [messageRow("stored-staff-visible")];
    supportStorage.readStoredSupportTicket.mockResolvedValue(stored);
    supportStorage.listStoredTicketMessages.mockResolvedValue(messages);

    await expect(loadTicketThread(TICKET_ID)).resolves.toEqual({ ticket: stored, messages });
    expect(harness.calls.map((call) => call.table)).toEqual([
      "applicant_profiles",
      "support_ticket",
      "users",
    ]);
    expect(supportStorage.listStoredTicketMessages).toHaveBeenCalledWith(TICKET_ID);
  });

  it("uses the Storage message fallback after an authorized database ticket read", async () => {
    const harness = createAdminHarness({
      ticket: queryResult(ticketRow({ applicant_id: USER_ID })),
      messages: queryResult(null, { code: "PGRST205", message: "table missing" }),
    });
    const messages = [messageRow("storage-message")];
    supportStorage.listStoredTicketMessages.mockResolvedValue(messages);

    await expect(loadTicketThread(TICKET_ID)).resolves.toEqual({
      ticket: ticketRow({ applicant_id: USER_ID }),
      messages,
    });
    expect(harness.calls.map((call) => call.table)).toEqual([
      "applicant_profiles",
      "support_ticket",
      "support_message",
    ]);
    expect(harness.calls.some((call) => call.table === "users")).toBe(false);
  });
});
