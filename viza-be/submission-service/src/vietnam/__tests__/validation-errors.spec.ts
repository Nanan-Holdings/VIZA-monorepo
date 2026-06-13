import { test } from "node:test";
import assert from "node:assert/strict";
import { dedupeVietnamValidationErrors } from "../validation-errors.js";

test("vn.validation-errors: dedupes identical portal validation messages", () => {
  const errors = dedupeVietnamValidationErrors([
    { label: "Religion", message: "Only Latin characters are allowed", domId: "basic_ttcnTonGiao" },
    { label: "Religion", message: "Only Latin characters are allowed", domId: "basic_ttcnTonGiao" },
    { label: "Occupation", message: "Required", domId: "occupation" },
  ]);

  assert.deepEqual(errors, [
    { label: "Religion", message: "Only Latin characters are allowed", domId: "basic_ttcnTonGiao" },
    { label: "Occupation", message: "Required", domId: "occupation" },
  ]);
});
