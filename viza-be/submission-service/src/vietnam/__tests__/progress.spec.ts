import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeVietnamProgressStage,
  shouldPersistVietnamProgressStage,
} from "../progress.js";

test("vn.progress: normalizes stage names for queue persistence", () => {
  assert.equal(normalizeVietnamProgressStage("official checkpoint: form ready"), "official_checkpoint:_form_ready");
  assert.equal(normalizeVietnamProgressStage(""), "processing");
});

test("vn.progress: avoids rewriting unchanged stages", () => {
  assert.equal(shouldPersistVietnamProgressStage("starting", "starting"), false);
  assert.equal(shouldPersistVietnamProgressStage("starting", "browser_ready"), true);
});
