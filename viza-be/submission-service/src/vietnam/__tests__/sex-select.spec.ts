import { test } from "node:test";
import assert from "node:assert/strict";
import { pickVietnamSelectOption, rankAntSelectCandidates, isAcceptableAntSelectMatch } from "../fillers.js";
import { getVnPortalOptionText } from "../field-mappings.js";

// Regression: 2026-11-22 a Male applicant was submitted as Female because the
// one-letter target "M" matched nothing confidently and the keyboard fallback
// picked the next row.
test("vn.sex-select: Male never resolves to Female", () => {
  const options = ["Male", "Female"];
  const target = getVnPortalOptionText("sex", "男");
  assert.equal(pickVietnamSelectOption(options, [target]), "Male");
  assert.equal(pickVietnamSelectOption(["Female", "Male"], [target]), "Male");
  assert.equal(pickVietnamSelectOption(options, [getVnPortalOptionText("sex", "F")]), "Female");
});

test("vn.sex-select: substring 'male' inside 'Female' is not a confident match", () => {
  const ranked = rankAntSelectCandidates(["Female"], "Male");
  assert.equal(isAcceptableAntSelectMatch(ranked[0]!.score), false);
  assert.equal(pickVietnamSelectOption(["Female"], ["Male"]), null);
});
