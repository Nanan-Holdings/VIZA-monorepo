import { test } from "node:test";
import assert from "node:assert/strict";
import { uncheckedVietnamDeclarationIndexes } from "../declaration.js";

test("vn.declaration: checks each unchecked declaration input exactly once", () => {
  assert.deepEqual(uncheckedVietnamDeclarationIndexes([false, false]), [0, 1]);
  assert.deepEqual(uncheckedVietnamDeclarationIndexes([true, false]), [1]);
  assert.deepEqual(uncheckedVietnamDeclarationIndexes([true, true]), []);
});
