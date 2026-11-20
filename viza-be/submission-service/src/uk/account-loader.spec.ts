import assert from "node:assert/strict";
import test from "node:test";
import { encryptSecret } from "../secret-cipher.js";

type AccountLoaderModule = typeof import("../account-loader.js");
type UkAccountLoaderClient = NonNullable<Parameters<AccountLoaderModule["loadUkAccount"]>[2]>;
let accountLoaderModule: AccountLoaderModule | null = null;

async function getAccountLoaderModule(): Promise<AccountLoaderModule> {
  if (!accountLoaderModule) {
    process.env.SUPABASE_URL = process.env.SUPABASE_URL ?? "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY =
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? "test-service-role-key-1234567890";
    accountLoaderModule = await import("../account-loader.js");
  }
  return accountLoaderModule;
}

interface QueryResult {
  data: unknown;
  error: null;
}

class FakeQuery {
  public readonly filters: Record<string, unknown> = {};

  public constructor(
    private readonly exactRow: unknown | null,
    private readonly legacyRows: unknown[],
  ) {}

  public select(_columns: string): this {
    return this;
  }

  public eq(column: string, value: unknown): this {
    this.filters[column] = value;
    return this;
  }

  public is(column: string, value: unknown): this {
    this.filters[column] = value;
    return this;
  }

  public maybeSingle(): Promise<QueryResult> {
    const isExactQuery = "application_id" in this.filters;
    if (isExactQuery) {
      const matches =
        this.exactRow !== null &&
        (this.exactRow as { application_id?: unknown }).application_id === this.filters.application_id &&
        (this.exactRow as { applicant_id?: unknown }).applicant_id === this.filters.applicant_id;
      return Promise.resolve({ data: matches ? this.exactRow : null, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  }

  public limit(_count: number): Promise<QueryResult> {
    return Promise.resolve({ data: this.legacyRows, error: null });
  }
}

class FakeClient {
  public readonly queries: FakeQuery[] = [];

  public constructor(
    private readonly exactRow: unknown | null,
    private readonly legacyRows: unknown[],
  ) {}

  public from(table: string): FakeQuery {
    assert.equal(table, "uk_accounts");
    const query = new FakeQuery(this.exactRow, this.legacyRows);
    this.queries.push(query);
    return query;
  }
}

async function withTestSecret<T>(fn: () => Promise<T>): Promise<T> {
  const previous = process.env.SUBMISSION_RESULT_SECRET_KEY;
  process.env.SUBMISSION_RESULT_SECRET_KEY = "uk-account-loader-test-secret";
  try {
    return await fn();
  } finally {
    if (previous === undefined) delete process.env.SUBMISSION_RESULT_SECRET_KEY;
    else process.env.SUBMISSION_RESULT_SECRET_KEY = previous;
  }
}

test("UK account lookup fences both application and applicant", async () => {
  await withTestSecret(async () => {
    const client = new FakeClient(
      {
        id: "uk-account-1",
        application_id: "application-1",
        applicant_id: "applicant-1",
        email: "application-1@example.test",
        password_encrypted: encryptSecret("password-1"),
        resume_url: "https://example.test/resume/1",
      },
      [],
    );

    const { loadUkAccount } = await getAccountLoaderModule();
    const loaded = await loadUkAccount(
      "application-1",
      "applicant-1",
      client as unknown as UkAccountLoaderClient,
    );
    assert.equal(loaded?.row.application_id, "application-1");
    assert.equal(loaded?.row.applicant_id, "applicant-1");
    assert.equal(loaded?.password, "password-1");
    assert.deepEqual(client.queries[0]?.filters, {
      application_id: "application-1",
      applicant_id: "applicant-1",
    });
    assert.equal(client.queries.length, 1);
  });
});

test("unbound legacy UK account fails closed instead of creating a duplicate", async () => {
  const client = new FakeClient(
    null,
    [{ id: "legacy-1", application_id: null, applicant_id: "applicant-1" }],
  );
  const { loadUkAccount, UkAccountBindingAmbiguousError } = await getAccountLoaderModule();

  await assert.rejects(
    loadUkAccount("application-2", "applicant-1", client as unknown as UkAccountLoaderClient),
    (error: unknown) => {
      assert.ok(error instanceof UkAccountBindingAmbiguousError);
      assert.match((error as Error).message, /manual binding is required/);
      return true;
    },
  );
  assert.deepEqual(client.queries[0]?.filters, {
    application_id: "application-2",
    applicant_id: "applicant-1",
  });
  assert.deepEqual(client.queries[1]?.filters, {
    applicant_id: "applicant-1",
    application_id: null,
  });
});
