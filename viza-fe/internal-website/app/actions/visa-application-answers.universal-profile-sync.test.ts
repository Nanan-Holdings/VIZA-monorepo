import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import { syncApplicationAnswersToUniversalProfile } from "./visa-application-answers";

type QueryResult = {
  data: unknown;
  error: { code?: string; message: string } | null;
};

function query(result: QueryResult) {
  const builder: Record<string, unknown> & { then?: unknown } = {};
  for (const method of ["eq", "in", "select", "update", "upsert"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn().mockResolvedValue(result);
  builder.then = (
    resolve: (value: QueryResult) => unknown,
    reject?: (reason: unknown) => unknown
  ) => Promise.resolve(result).then(resolve, reject);
  return builder as Record<string, ReturnType<typeof vi.fn>> &
    PromiseLike<QueryResult>;
}

function formField(fieldName: string) {
  return {
    id: fieldName,
    visa_type: "AE_TOURIST_VISA",
    field_name: fieldName,
    label: fieldName,
    field_type: "text",
    required: false,
    step_number: 1,
    step_name: "Personal",
    display_order: 1,
    placeholder: null,
    validation_rules: null,
    options: null,
    conditional_logic: null,
    created_at: null,
    updated_at: null,
  };
}

describe("syncApplicationAnswersToUniversalProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
    });
  });

  it("sends each canonical key once when alias fields share a value", async () => {
    // Real AE form shape: the same surname is stored under three aliases.
    const fieldNames = ["last_name", "surname", "family_name", "given_name", "given_names"];
    const universalUpsert = query({ data: null, error: null });
    const tables: Record<string, ReturnType<typeof query>> = {
      applications: query({
        data: { id: "app-1", applicant_id: "profile-1", visa_type: "AE_TOURIST_VISA", purpose: null },
        error: null,
      }),
      applicant_profiles: query({
        data: { id: "profile-1", auth_user_id: "user-1", dependant_of_user_id: null },
        error: null,
      }),
      visa_form_fields: query({ data: fieldNames.map(formField), error: null }),
      visa_application_answers: query({
        data: fieldNames.map((field_name) => ({
          field_name,
          value_text: field_name.includes("given") ? "SAN" : "ZHANG",
        })),
        error: null,
      }),
      universal_profile_answers: universalUpsert,
    };
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn((table: string) => tables[table]),
    });

    const result = await syncApplicationAnswersToUniversalProfile("app-1");

    expect(result.error).toBeUndefined();
    const rows = universalUpsert.upsert.mock.calls[0][0] as Array<{
      canonical_key: string;
      source_field_name: string;
    }>;
    const keys = rows.map((row) => row.canonical_key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.sort()).toEqual(["given_names", "surname"]);
    // The field named with the canonical key wins over its aliases.
    expect(rows.find((row) => row.canonical_key === "surname")?.source_field_name).toBe("surname");
  });
});
