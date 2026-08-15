import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const SCRIPT = resolve(process.cwd(), "scripts/queue/requeue-jobs.ts");

test("requeue tool only selects failed/dead-letter non-running rows", async () => {
  const source = await readFile(SCRIPT, "utf8");
  assert.match(source, /\.in\("status",\s*\["failed",\s*"dead_letter"\]\)/);
  assert.doesNotMatch(source, /r\.status\s*===\s*"running"/);
  assert.match(source, /\.eq\("status",\s*r\.status\)/);
  assert.match(source, /\.is\("leased_by",\s*null\)/);
  assert.match(source, /\.is\("leased_until",\s*null\)/);
});

test("requeue tool uses returned rows for counting and reports concurrent skips", async () => {
  const source = await readFile(SCRIPT, "utf8");
  assert.match(source, /\.select\("id"\)\s*\.maybeSingle\(\)/);
  assert.match(source, /if\s*\(!updated\?\.id\)/);
  assert.match(source, /concurrent|no longer eligible/i);
  assert.match(source, /requeued\s*\+=\s*1/);
});
