import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureDs160SecurityAnswer, generateDs160SecurityAnswer } from "../security-answer";

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
