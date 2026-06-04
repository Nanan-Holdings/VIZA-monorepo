import { test } from "node:test";
import assert from "node:assert/strict";
import { softTranslationGate } from "../standard-evisa.js";

/**
 * RUN-CORE-007: the non-fatal translation gate flags CJK fields without
 * throwing (the runner proceeds with the fallback). Covers invocation for
 * one country (Türkiye).
 */
test("translation-gate: flags CJK answer keys (non-fatal)", () => {
  const offenders = softTranslationGate("turkey", {
    surname: "ZHANG",
    given_names: "爱德华", // CJK
    email: "e@example.com",
  });
  assert.deepEqual(offenders, ["given_names"]);
});

test("translation-gate: clean Latin answers → no offenders", () => {
  const offenders = softTranslationGate("turkey", { surname: "ZHANG", given_names: "Edward" });
  assert.deepEqual(offenders, []);
});
