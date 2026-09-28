import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getState } from "../route";
import { POST } from "./route";
import type { VisaFormFieldRow, WizardStep } from "@/types/visa-form-fields";

type StoredMessage = {
  id: string;
  session_id: string;
  idempotency_key: string;
  role: "user" | "assistant";
  content: string;
  input_mode: string;
  response_json: Record<string, unknown>;
  created_at: string;
};

type FakeStore = {
  answers: Record<string, { value: string; source: string | null }>;
  messages: StoredMessage[];
  session: {
    id: string;
    schema_fingerprint: string;
    knowledge_release_key: string | null;
    state_json: Record<string, unknown>;
  };
};

const {
  requireOwnedApplication,
  loadAssistantSchema,
  loadAssistantAnswers,
  loadAssistantDocumentReadiness,
  repairAssistantOfficialOptionAnswers,
  loadApplicationKnowledge,
} = vi.hoisted(() => ({
  requireOwnedApplication: vi.fn(),
  loadAssistantSchema: vi.fn(),
  loadAssistantAnswers: vi.fn(),
  loadAssistantDocumentReadiness: vi.fn(),
  repairAssistantOfficialOptionAnswers: vi.fn(),
  loadApplicationKnowledge: vi.fn(),
}));

vi.mock("@/lib/form-assistant/server-context", () => ({
  requireOwnedApplication,
  loadAssistantSchema,
  loadAssistantAnswers,
  loadAssistantDocumentReadiness,
  repairAssistantOfficialOptionAnswers,
}));

vi.mock("@/lib/form-assistant/knowledge", () => ({
  loadApplicationKnowledge,
}));

function field(
  fieldName: string,
  label: string,
  fieldType: VisaFormFieldRow["fieldType"],
  required: boolean,
  options: VisaFormFieldRow["options"] = null,
): VisaFormFieldRow {
  return {
    id: fieldName,
    visaType: "DS160",
    fieldName,
    label,
    fieldType,
    required,
    stepNumber: 1,
    stepName: "Personal Information",
    displayOrder: fieldName === "has_ssn" ? 1 : 2,
    placeholder: null,
    validationRules: fieldName === "has_ssn" ? { label_zh: "是否有美国社会安全号码" } : null,
    options,
    conditionalLogic: null,
  };
}

const steps: WizardStep[] = [{
  stepNumber: 1,
  stepName: "Personal Information",
  fields: [
    field("has_ssn", "Do you have a U.S. Social Security Number?", "radio", true, ["yes", "no"]),
    field("passport_number", "Passport number", "text", true),
  ],
}];

const ssnSteps: WizardStep[] = [{
  stepNumber: 1,
  stepName: "Personal Information",
  fields: [
    {
      ...field("us_social_security_number", "U.S. Social Security Number", "text", true),
      validationRules: {
        has_does_not_apply: true,
        pattern: "^[0-9]{3}-[0-9]{2}-[0-9]{4}$",
      },
    },
    {
      ...field("national_id_number", "National Identification Number", "text", true),
      validationRules: { has_does_not_apply: true },
    },
  ],
}];

function createFakeAdmin(store: FakeStore) {
  const execute = (table: string, operation: string, payload: unknown, filters: Array<[string, unknown]>) => {
    if (table === "form_assistant_sessions") {
      if (operation === "select") return { data: store.session, error: null };
      if (operation === "update") {
        Object.assign(store.session.state_json, (payload as Record<string, unknown>).state_json ?? {});
        return { data: null, error: null };
      }
    }

    if (table === "form_assistant_messages") {
      if (operation === "select") {
        const role = filters.find(([key]) => key === "role")?.[1];
        const idempotencyKey = filters.find(([key]) => key === "idempotency_key")?.[1];
        if (role === "assistant" && typeof idempotencyKey === "string") {
          const row = store.messages.find((item) => item.role === "assistant" && item.idempotency_key === idempotencyKey);
          return { data: row ? { response_json: row.response_json } : null, error: null };
        }
        return { data: store.messages, error: null };
      }
      if (operation === "upsert") {
        const item = payload as Omit<StoredMessage, "id" | "created_at">;
        const duplicate = store.messages.find((row) =>
          row.session_id === item.session_id &&
          row.idempotency_key === item.idempotency_key &&
          row.role === item.role,
        );
        if (duplicate) return { data: null, error: null };
        const row: StoredMessage = {
          ...item,
          id: `${item.role}-${store.messages.length + 1}`,
          created_at: new Date().toISOString(),
        };
        store.messages.push(row);
        return { data: { id: row.id }, error: null };
      }
      if (operation === "delete") {
        const id = filters.find(([key]) => key === "id")?.[1];
        store.messages = store.messages.filter((row) => row.id !== id);
        return { data: null, error: null };
      }
    }

    if (table === "visa_application_answers") {
      if (operation === "insert") {
        const item = payload as { field_name?: unknown; value_text?: unknown; source?: unknown };
        if (typeof item.field_name === "string" && typeof item.value_text === "string") {
          store.answers[item.field_name] = {
            value: item.value_text,
            source: typeof item.source === "string" ? item.source : null,
          };
        }
        return { data: null, error: null };
      }
      if (operation === "update" || operation === "delete") return { data: null, error: null };
    }

    return { data: null, error: null };
  };

  return {
    from(table: string) {
      let operation = "select";
      let payload: unknown = null;
      const filters: Array<[string, unknown]> = [];
      const query: Record<string, unknown> = {
        select(..._args: unknown[]) {
          return query;
        },
        eq(key: string, value: unknown) {
          filters.push([key, value]);
          return query;
        },
        in(key: string, value: unknown) {
          filters.push([key, value]);
          return query;
        },
        order() {
          return query;
        },
        limit() {
          return query;
        },
        maybeSingle() {
          return Promise.resolve(execute(table, operation, payload, filters));
        },
        single() {
          return Promise.resolve(execute(table, operation, payload, filters));
        },
        insert(value: unknown) {
          operation = "insert";
          payload = value;
          return query;
        },
        upsert(value: unknown) {
          operation = "upsert";
          payload = value;
          return query;
        },
        update(value: unknown) {
          operation = "update";
          payload = value;
          return query;
        },
        delete() {
          operation = "delete";
          return query;
        },
        then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
          return Promise.resolve(execute(table, operation, payload, filters)).then(resolve, reject);
        },
      };
      return query;
    },
  };
}

function request(body: unknown, init: RequestInit = {}) {
  return new Request("http://localhost/api/applications/application-1/form-assistant/turn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    ...init,
  });
}

function context(store: FakeStore, overrides: Record<string, unknown> = {}) {
  return {
    admin: createFakeAdmin(store),
    user: { id: "user-1", email: "qa@example.test" },
    application: {
      id: "application-1",
      applicant_id: "applicant-1",
      country: "united_states",
      visa_type: "DS160",
      submitted_at: null,
      submission_result_status: null,
      submission_result: null,
    },
    formAssistantReadOnly: false,
    ...overrides,
  };
}

function createStore(): FakeStore {
  return {
    answers: {},
    messages: [],
    session: {
      id: "session-1",
      schema_fingerprint: "old-fingerprint",
      knowledge_release_key: null,
      state_json: {},
    },
  };
}

async function json(response: Response) {
  return await response.json() as Record<string, unknown>;
}

describe("form assistant turn route", () => {
  const originalOpenAiKey = process.env.OPENAI_API_KEY;
  const originalDeepSeekKey = process.env.DEEPSEEK_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.OPENAI_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    const store = createStore();
    const owned = context(store);
    requireOwnedApplication.mockResolvedValue(owned);
    loadAssistantSchema.mockResolvedValue(steps);
    loadAssistantAnswers.mockImplementation(async () => store.answers);
    loadAssistantDocumentReadiness.mockResolvedValue(null);
    repairAssistantOfficialOptionAnswers.mockImplementation(async (_admin: unknown, _id: string, _steps: WizardStep[], answers: FakeStore["answers"]) => answers);
    loadApplicationKnowledge.mockResolvedValue({ context: "", sources: [] });
    (globalThis as { __formAssistantTestStore?: FakeStore }).__formAssistantTestStore = store;
  });

  afterEach(() => {
    if (originalOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalOpenAiKey;
    if (originalDeepSeekKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = originalDeepSeekKey;
    delete (globalThis as { __formAssistantTestStore?: FakeStore }).__formAssistantTestStore;
  });

  it("runs the real deterministic parser, persists the answer, and asks the next field", async () => {
    const response = await POST(request({ message: "没有", locale: "zh-CN", idempotencyKey: "turn-1" }), {
      params: Promise.resolve({ id: "application-1" }),
    });
    const payload = await json(response);

    expect(response.status).toBe(200);
    expect(payload.appliedPatches).toEqual(expect.arrayContaining([
      expect.objectContaining({ fieldName: "has_ssn", value: "no", confidence: "high" }),
    ]));
    expect(payload.missingFields).toEqual(expect.arrayContaining([
      expect.objectContaining({ fieldName: "passport_number" }),
    ]));
    expect(payload.assistantMessage).toContain("Passport number");
    const store = (globalThis as { __formAssistantTestStore?: FakeStore }).__formAssistantTestStore!;
    expect(store.answers.has_ssn).toEqual({ value: "no", source: "form_assistant" });
    expect(store.messages.filter((item) => item.role === "user")).toHaveLength(1);
    expect(store.messages.filter((item) => item.role === "assistant")).toHaveLength(1);
  });

  it("runs the real SSN Does Not Apply branch through the route and advances once", async () => {
    const store = (globalThis as { __formAssistantTestStore?: FakeStore }).__formAssistantTestStore!;
    loadAssistantSchema.mockResolvedValueOnce(ssnSteps);

    const response = await POST(request({ message: "无", locale: "zh-CN", idempotencyKey: "ssn-na-turn" }), {
      params: Promise.resolve({ id: "application-1" }),
    });
    const payload = await json(response);

    expect(response.status).toBe(200);
    expect(payload.appliedPatches).toEqual(expect.arrayContaining([
      expect.objectContaining({
        fieldName: "us_social_security_number",
        value: "DOES_NOT_APPLY",
      }),
    ]));
    expect(payload.missingFields).toEqual(expect.arrayContaining([
      expect.objectContaining({ fieldName: "national_id_number" }),
    ]));
    expect(payload.missingFields).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ fieldName: "us_social_security_number" }),
    ]));
    expect(payload.assistantMessage).toContain("National Identification Number");
    expect(payload.assistantMessage).not.toContain("Social Security Number是什么");
    expect(store.answers.us_social_security_number).toEqual({
      value: "DOES_NOT_APPLY",
      source: "form_assistant",
    });
  });

  it("returns the stored response for a repeated idempotency key without a second write", async () => {
    const body = { message: "没有", locale: "zh-CN", idempotencyKey: "same-turn" };
    const first = await POST(request(body), { params: Promise.resolve({ id: "application-1" }) });
    const second = await POST(request(body), { params: Promise.resolve({ id: "application-1" }) });
    const firstPayload = await json(first);
    const secondPayload = await json(second);
    const store = (globalThis as { __formAssistantTestStore?: FakeStore }).__formAssistantTestStore!;

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(secondPayload).toEqual(firstPayload);
    expect(store.messages.filter((item) => item.role === "user")).toHaveLength(1);
    expect(store.messages.filter((item) => item.role === "assistant")).toHaveLength(1);
  });

  it("maps provider exhaustion to a retryable 503 and removes the unfinished user turn", async () => {
    const response = await POST(request({ message: "some answer", locale: "en", idempotencyKey: "failed-turn" }), {
      params: Promise.resolve({ id: "application-1" }),
    });
    const payload = await json(response);
    const store = (globalThis as { __formAssistantTestStore?: FakeStore }).__formAssistantTestStore!;

    expect(response.status).toBe(503);
    expect(payload.code).toBe("FORM_ASSISTANT_PROVIDERS_UNAVAILABLE");
    expect(store.messages.filter((item) => item.role === "user")).toHaveLength(0);
  });

  it("rejects an already submitted/read-only application before parsing or writing", async () => {
    const store = (globalThis as { __formAssistantTestStore?: FakeStore }).__formAssistantTestStore!;
    requireOwnedApplication.mockResolvedValueOnce({ error: "Application is read-only.", status: 409 });

    const response = await POST(request({ message: "没有", locale: "zh-CN", idempotencyKey: "readonly" }), {
      params: Promise.resolve({ id: "application-1" }),
    });

    expect(response.status).toBe(409);
    expect(await json(response)).toEqual({ error: "Application is read-only." });
    expect(store.messages).toHaveLength(0);
    expect(loadAssistantSchema).not.toHaveBeenCalled();
  });

  it.each([
    ["invalid JSON", new Request("http://localhost/turn", { method: "POST", body: "{" })],
    ["missing message", request({ locale: "en", idempotencyKey: "invalid" })],
  ])("rejects %s before touching persistence", async (_label, input) => {
    const store = (globalThis as { __formAssistantTestStore?: FakeStore }).__formAssistantTestStore!;
    const response = await POST(input, { params: Promise.resolve({ id: "application-1" }) });

    expect(response.status).toBe(400);
    expect(store.messages).toHaveLength(0);
  });

  it("allows state recovery for a submitted application without creating a new session", async () => {
    const store = (globalThis as { __formAssistantTestStore?: FakeStore }).__formAssistantTestStore!;
    requireOwnedApplication.mockResolvedValueOnce(context(store, { formAssistantReadOnly: true }));

    const response = await getState(new Request("http://localhost/api/applications/application-1/form-assistant?locale=zh-CN"), {
      params: Promise.resolve({ id: "application-1" }),
    });
    const payload = await json(response);

    expect(response.status).toBe(200);
    expect(payload.sessionId).toBe("session-1");
    expect(payload.missingFields).toEqual(expect.arrayContaining([
      expect.objectContaining({ fieldName: "has_ssn" }),
    ]));
    expect(payload.assistantMessage).toContain("是否有美国社会安全号码");
    expect(store.messages).toHaveLength(0);
  });

  it("returns the ownership error without loading the schema", async () => {
    requireOwnedApplication.mockResolvedValueOnce({ error: "Unauthorized", status: 401 });

    const response = await POST(request({ message: "没有", locale: "zh-CN" }), {
      params: Promise.resolve({ id: "other-application" }),
    });

    expect(response.status).toBe(401);
    expect(await json(response)).toEqual({ error: "Unauthorized" });
    expect(loadAssistantSchema).not.toHaveBeenCalled();
  });
});
