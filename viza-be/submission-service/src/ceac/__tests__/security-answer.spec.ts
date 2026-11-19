import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { backfillDs160SecurityAnswers, ensureDs160SecurityAnswer, generateDs160SecurityAnswer, rememberDs160SecurityAnswer } from "../security-answer";

type Row = { application_id: string; field_name: string; value_text: string | null };

/** In-memory stand-in for the three visa_application_answers calls. */
function fakeClient(rows: Row[]): SupabaseClient {
  const from = () => {
    const filters: Record<string, string> = {};
    let blankOnly = false;
    let patch: Partial<Row> | null = null;
    const matching = () => rows.filter((row) =>
      Object.entries(filters).every(([key, value]) => row[key as keyof Row] === value) &&
      (!blankOnly || row.value_text === null || row.value_text === ""));
    const builder = {
      update(value: Partial<Row>) { patch = value; return builder; },
      select() { return builder; },
      eq(key: string, value: string) { filters[key] = value; return builder; },
      or() { blankOnly = true; return builder; },
      async upsert(row: Row) {
        if (!rows.some((existing) => existing.application_id === row.application_id && existing.field_name === row.field_name)) {
          rows.push({ ...row });
        }
        return { error: null };
      },
      async maybeSingle() { return { data: matching()[0] ?? null, error: null }; },
      then(resolve: (value: { error: null }) => unknown) {
        if (patch) for (const row of matching()) Object.assign(row, patch);
        return Promise.resolve({ error: null }).then(resolve);
      },
    };
    return builder;
  };
  return { from } as unknown as SupabaseClient;
}

test("generates a 12-character readable answer without look-alike characters", () => {
  for (let i = 0; i < 200; i += 1) {
    assert.match(generateDs160SecurityAnswer(), /^[A-HJKMNP-Z2-9]{12}$/);
  }
});

test("saves a generated answer when the application has none", async () => {
  const rows: Row[] = [];
  const answer = await ensureDs160SecurityAnswer(fakeClient(rows), "app-1", () => "NEWANSWER234");
  assert.equal(answer, "NEWANSWER234");
  assert.deepEqual(rows, [{ application_id: "app-1", field_name: "ds160_security_answer", value_text: "NEWANSWER234" }]);
});

test("fills a blank saved row instead of leaving the draft unrecoverable", async () => {
  const rows: Row[] = [{ application_id: "app-1", field_name: "ds160_security_answer", value_text: "" }];
  assert.equal(await ensureDs160SecurityAnswer(fakeClient(rows), "app-1", () => "FILLED234567"), "FILLED234567");
  assert.equal(rows[0].value_text, "FILLED234567");
});

test("keeps an answer that was already saved by someone else", async () => {
  const rows: Row[] = [{ application_id: "app-1", field_name: "ds160_security_answer", value_text: "SAVEDBYUSER" }];
  assert.equal(await ensureDs160SecurityAnswer(fakeClient(rows), "app-1", () => "IGNORED23456"), "SAVEDBYUSER");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].value_text, "SAVEDBYUSER");
});

test("refuses to continue when the answer cannot be read back", async () => {
  const client = {
    from: () => {
      const builder = {
        update: () => builder, eq: () => builder, or: () => builder, select: () => builder,
        upsert: async () => ({ error: null }),
        maybeSingle: async () => ({ data: null, error: null }),
        then: (resolve: (value: { error: null }) => unknown) => Promise.resolve({ error: null }).then(resolve),
      };
      return builder;
    },
  } as unknown as SupabaseClient;
  await assert.rejects(ensureDs160SecurityAnswer(client, "app-1"), /not persisted/);
});

test("remembers the answer actually used when none is saved", async () => {
  const rows: Row[] = [];
  await rememberDs160SecurityAnswer(fakeClient(rows), "app-1", "  USEDANSWER  ");
  assert.deepEqual(rows, [{ application_id: "app-1", field_name: "ds160_security_answer", value_text: "USEDANSWER" }]);
});

test("never overwrites a different saved answer when remembering", async () => {
  const rows: Row[] = [{ application_id: "app-1", field_name: "ds160_security_answer", value_text: "APPLICANTSOWN" }];
  await rememberDs160SecurityAnswer(fakeClient(rows), "app-1", "OTHERANSWER");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].value_text, "APPLICANTSOWN");
});

test("backfills readable answers only for results without one, counting failures", async () => {
  const writes: Array<{ op: string; applicationId?: string; value?: unknown }> = [];
  const client = {
    from(table: string) {
      let op = "select";
      let applicationId: string | undefined;
      let value: unknown;
      const builder = {
        select: () => builder, eq: (key: string, v: string) => { if (key === "application_id") applicationId = v; return builder; },
        not: () => builder, limit: () => builder, in: () => builder, or: () => builder,
        update(patch: { value_text: unknown }) { op = "update"; value = patch.value_text; return builder; },
        async upsert(row: { application_id: string; value_text: unknown }) {
          writes.push({ op: "upsert", applicationId: row.application_id, value: row.value_text });
          return { error: null };
        },
        then(resolve: (r: unknown) => unknown) {
          if (table === "applications") {
            return Promise.resolve({ error: null, data: [
              { id: "needs-answer", submission_result: { securityAnswerCipher: "cipher-ok" } },
              { id: "has-answer", submission_result: { securityAnswerCipher: "cipher-ok" } },
              { id: "bad-cipher", submission_result: { securityAnswerCipher: "cipher-bad" } },
            ] }).then(resolve);
          }
          if (op === "update") writes.push({ op, applicationId, value });
          return Promise.resolve({ error: null, data: [{ application_id: "has-answer", value_text: "KEEPME" }] }).then(resolve);
        },
      };
      return builder;
    },
  } as unknown as SupabaseClient;

  const summary = await backfillDs160SecurityAnswers(client, (cipher) => {
    if (cipher === "cipher-bad") throw new Error("bad key");
    return "DECRYPTED123";
  });

  assert.deepEqual(summary, { checked: 2, filled: 1, failed: 1 });
  assert.ok(writes.some((w) => w.op === "upsert" && w.applicationId === "needs-answer" && w.value === "DECRYPTED123"));
  assert.ok(!writes.some((w) => w.applicationId === "has-answer"));
});
