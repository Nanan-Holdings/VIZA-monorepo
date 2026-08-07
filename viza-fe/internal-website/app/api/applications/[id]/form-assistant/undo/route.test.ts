import { beforeEach, describe, expect, it, vi } from "vitest";

const { consumeFormAssistantRateLimit, requireOwnedApplication } = vi.hoisted(() => ({
  consumeFormAssistantRateLimit: vi.fn(() => true),
  requireOwnedApplication: vi.fn(),
}));

vi.mock("@/lib/form-assistant/rate-limit", () => ({ consumeFormAssistantRateLimit }));
vi.mock("@/lib/form-assistant/server-context", () => ({ requireOwnedApplication }));

import { POST } from "./route";

function context() {
  return { params: Promise.resolve({ id: "application-id" }) };
}

function request(patches: unknown): Request {
  return new Request("http://localhost/undo", {
    method: "POST",
    body: JSON.stringify({ patches }),
    headers: { "Content-Type": "application/json" },
  });
}

function answerTable(row: Record<string, unknown> | null) {
  let operation: "read" | "update" | "delete" = "read";
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    update: vi.fn(() => { operation = "update"; return builder; }),
    delete: vi.fn(() => { operation = "delete"; return builder; }),
    maybeSingle: vi.fn(async () => operation === "read"
      ? { data: row, error: null }
      : { data: { field_name: row?.field_name }, error: null }),
  };
  return builder;
}

describe("POST /api/applications/[id]/form-assistant/undo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consumeFormAssistantRateLimit.mockReturnValue(true);
  });

  it("deletes a still-current assistant answer", async () => {
    const table = answerTable({
      field_name: "arrival_date",
      value_text: "2026-08-07",
      source: "form_assistant",
      source_metadata: { previousValue: null },
    });
    requireOwnedApplication.mockResolvedValue({
      admin: { from: vi.fn(() => table) },
      application: { visa_type: "SG_ARRIVAL_CARD" },
      user: { id: "user-id" },
    });

    const response = await POST(request([{ fieldName: "arrival_date", value: "2026-08-07" }]), context());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      restored: [{ fieldName: "arrival_date", restoredValue: null, restoredSource: null }],
      skippedConflicts: [],
    });
    expect(table.delete).toHaveBeenCalledOnce();
  });

  it("does not undo a value changed after the notice was shown", async () => {
    const table = answerTable({
      field_name: "arrival_date",
      value_text: "2026-08-08",
      source: "user_form",
      source_metadata: {},
    });
    requireOwnedApplication.mockResolvedValue({
      admin: { from: vi.fn(() => table) },
      application: { visa_type: "SG_ARRIVAL_CARD" },
      user: { id: "user-id" },
    });

    const response = await POST(request([{ fieldName: "arrival_date", value: "2026-08-07" }]), context());

    expect(await response.json()).toEqual({ restored: [], skippedConflicts: ["arrival_date"] });
    expect(table.delete).not.toHaveBeenCalled();
  });
});
