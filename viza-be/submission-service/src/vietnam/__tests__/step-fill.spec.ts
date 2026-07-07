import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildAntSelectOptionRegex,
  isAcceptableAntSelectMatch,
  rankAntSelectCandidates,
  resolveStepPlan,
} from "../fillers.js";
import {
  getVnPortalOptionText,
  normalizeVnCountryOptionText,
  VN_FIELD_MAPPINGS,
} from "../field-mappings.js";
import { toPortalDateForField } from "../run.js";

/**
 * RUN-VN-001: covers a full step fill at the (browser-free) plan level —
 * resolveStepPlan is exactly what fillFormStep executes against the page.
 */

const ANSWERS: Record<string, string> = {
  surname: "ZHANG",
  given_name: "Edward Zehua",
  date_of_birth: "1990-04-15",
};

test("vn.step-fill: resolveStepPlan maps text fields verbatim", () => {
  const plan = resolveStepPlan(ANSWERS, VN_FIELD_MAPPINGS);
  const given = plan.find((p) => p.fieldName === "given_name");
  assert.ok(given, "given_name is in the plan");
  assert.equal(given.domId, "basic_ttcnDemVaTen");
  assert.equal(given.value, "Edward Zehua");
  assert.equal(given.type, "text");
});

test("vn.step-fill: date fields are reformatted to DD/MM/YYYY", () => {
  const plan = resolveStepPlan(ANSWERS, VN_FIELD_MAPPINGS);
  const dob = plan.find((p) => p.fieldName === "date_of_birth");
  assert.ok(dob);
  assert.equal(dob.value, "15/04/1990");
  assert.equal(dob.type, "date");
});

test("vn.step-fill: visa valid-from date is not earlier than today", () => {
  assert.equal(
    toPortalDateForField("visa_valid_from", "2026-06-20", new Date(2026, 5, 22)),
    "22/06/2026",
  );
  assert.equal(
    toPortalDateForField("visa_valid_from", "2026-06-30", new Date(2026, 5, 22)),
    "30/06/2026",
  );
});

test("vn.step-fill: uploads and unanswered fields are excluded", () => {
  const plan = resolveStepPlan(ANSWERS, VN_FIELD_MAPPINGS);
  assert.ok(!plan.some((p) => p.type === "upload"), "no upload fields in plan");
  // only the 3 answered, non-upload fields are planned
  assert.equal(plan.length, 3);
});

test("vn.step-fill: select option matching escapes portal labels", () => {
  const pattern = buildAntSelectOptionRegex("Cat Bi Int Airport (Hai Phong)");
  assert.equal(pattern.test("Cat Bi Int Airport (Hai Phong)"), true);
  assert.equal(pattern.test("Cat Bi Int Airport Hai Phong"), false);
});

test("vn.step-fill: virtual select candidates match exact and token-equivalent labels", () => {
  assert.deepEqual(
    rankAntSelectCandidates(
      ["An Thoi Port Border Gate", "Noi Bai Int Airport (Ha Noi)"],
      "Noi Bai Int Airport (Ha Noi)",
    )[0],
    { index: 1, text: "Noi Bai Int Airport (Ha Noi)", score: 100 },
  );
  assert.equal(
    rankAntSelectCandidates(["Male", "Female"], "Male")[0]?.text,
    "Male",
  );
});

test("vn.step-fill: weak airport overlap is not accepted as a final select match", () => {
  const weakMatch = rankAntSelectCandidates(
    ["Cam Ranh Int Airport (Khanh Hoa)"],
    "Noi Bai Int Airport (Ha Noi)",
  )[0];
  assert.ok(weakMatch, "candidate is ranked");
  assert.equal(isAcceptableAntSelectMatch(weakMatch.score), false);
});

test("vn.step-fill: country dropdown values normalize to official option text", () => {
  assert.equal(normalizeVnCountryOptionText("HUN"), "Hungary");
  assert.equal(normalizeVnCountryOptionText("Hungary"), "Hungary");
  assert.equal(normalizeVnCountryOptionText("Hungarian"), "Hungary");
  assert.equal(normalizeVnCountryOptionText("PAN"), "Panama");
  assert.equal(normalizeVnCountryOptionText("Panama"), "Panama");
  assert.equal(normalizeVnCountryOptionText("Panamanian"), "Panama");
  assert.equal(getVnPortalOptionText("nationality", "HUN"), "Hungary");
  assert.equal(getVnPortalOptionText("other_vietnam_passport_nationality", "HUN"), "Hungary");
  assert.equal(getVnPortalOptionText("relative_nationality", "PAN"), "Panama");
});
