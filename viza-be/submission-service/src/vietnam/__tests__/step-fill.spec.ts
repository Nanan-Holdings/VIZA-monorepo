import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildAntSelectMatchTexts,
  buildAntSelectSearchTerms,
  buildAntSelectOptionRegex,
  getVietnamSelectFieldTimeoutMs,
  isAcceptableAntSelectMatch,
  rankAntSelectCandidates,
  resolveStepPlan,
} from "../fillers.js";
import {
  getVnCountryAlpha3ForOptionText,
  getVnCountryOptionIndex,
  getVnCountrySearchTextForOptionText,
  getVnPortalOptionText,
  normalizeVnOccupationOption,
  normalizeVnCountryOptionText,
  VN_FIELD_MAPPINGS,
} from "../field-mappings.js";
import {
  fillVietnamApplication,
  toPortalDateForField,
  validateVietnamPortalValidityRange,
} from "../run.js";
import { VN_COUNTRY_NAME_BY_ALPHA3 } from "../country-options.js";

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

test("vn.step-fill: portal date formatting does not silently change applicant dates", () => {
  assert.equal(toPortalDateForField("visa_valid_from", "2026-06-20"), "20/06/2026");
  assert.equal(toPortalDateForField("visa_valid_from", "2026-06-30"), "30/06/2026");
});

test("vn.step-fill: portal validity range requires valid-to after the effective valid-from", () => {
  assert.equal(
    validateVietnamPortalValidityRange(
      { visa_valid_from: "2026-06-22", visa_valid_to: "2026-06-22" },
      new Date(2026, 5, 22),
    ).length,
    2,
  );
  assert.match(
    validateVietnamPortalValidityRange(
      { visa_valid_from: "2026-06-20", visa_valid_to: "2026-06-21" },
      new Date(2026, 5, 22),
    )[0]?.message ?? "",
    /cannot be earlier than today/i,
  );
  assert.deepEqual(
    validateVietnamPortalValidityRange(
      { visa_valid_from: "2026-06-22", visa_valid_to: "2026-06-30" },
      new Date(2026, 5, 22),
    ),
    [],
  );
});

test("vn.step-fill: invalid validity range is rejected before browser launch", async () => {
  const result = await fillVietnamApplication(
    {
      answers: {
        visa_valid_from: "2099-06-22",
        visa_valid_to: "2099-06-22",
      },
    },
    {
      officialBaseUrl: "https://example.invalid/",
    },
  );

  assert.equal(result.status, "scaffolded_pending_walk");
  assert.match(
    result.status === "scaffolded_pending_walk" ? result.reason : "",
    /valid from must be before.*valid to must be after/i,
  );
  assert.equal(result.diagnostics?.validationErrors?.length, 2);
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

test("vn.step-fill: current Vietnamese border-gate labels preserve the saved English choice", () => {
  assert.ok(buildAntSelectMatchTexts("Cat Bi Int Airport (Hai Phong)").includes("SBQT Cát Bi"));
  assert.ok(buildAntSelectMatchTexts("Bo Y Landport").includes("Cửa khẩu Bờ Y"));
});

test("vn.step-fill: free-text occupations map to official portal categories", () => {
  assert.equal(normalizeVnOccupationOption("Software engineer"), "Employee");
  assert.equal(normalizeVnOccupationOption("Self-employed consultant"), "Businessman");
  assert.equal(normalizeVnOccupationOption("Civil servant"), "Official");
  assert.equal(normalizeVnOccupationOption("University student"), "Student");
  assert.equal(normalizeVnOccupationOption("Homemaker"), "Others");
  assert.equal(getVnPortalOptionText("occupation", "software_engineer"), "Employee");
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
  assert.equal(normalizeVnCountryOptionText("VNM"), "Viet Nam");
  assert.equal(normalizeVnCountryOptionText("CZE"), "Czech Republic");
  assert.equal(normalizeVnCountryOptionText("HKG"), "China");
  assert.equal(normalizeVnCountryOptionText("Hong Kong"), "China");
  assert.equal(normalizeVnCountryOptionText("Macau SAR"), "China");
  assert.equal(
    normalizeVnCountryOptionText("GBR"),
    "United Kingdom of Great Britain and Northern Ireland",
  );
  assert.equal(getVnPortalOptionText("nationality", "Hong Kong"), "China");
  assert.equal(getVnCountryAlpha3ForOptionText("Hong Kong"), "CHN");
  assert.equal(getVnPortalOptionText("nationality", "HUN"), "Hungary");
  assert.equal(getVnPortalOptionText("other_vietnam_passport_nationality", "HUN"), "Hungary");
  assert.equal(getVnPortalOptionText("relative_nationality", "PAN"), "Panama");
  assert.equal(getVnPortalOptionText("nationality", "VNM"), "Viet Nam");
  assert.equal(getVnCountryAlpha3ForOptionText("Panama"), "PAN");
  assert.equal(getVnCountryOptionIndex("Panama"), 141);
  assert.equal(getVnCountrySearchTextForOptionText("China"), "Trung Quốc");
  assert.equal(getVnCountrySearchTextForOptionText("Hungary"), "Hung-ga-ri");
  assert.equal(getVnCountrySearchTextForOptionText("Panama"), "Pa-na-ma");
  assert.deepEqual(buildAntSelectSearchTerms("China"), [
    "China",
    "Chin",
    "Trung Quốc",
    "Trung",
    "Trun",
    "",
  ]);
  assert.deepEqual(buildAntSelectSearchTerms("Hungary"), [
    "Hungary",
    "Hung",
    "Hung-ga-ri",
    "",
  ]);
  assert.deepEqual(buildAntSelectSearchTerms("Panama"), [
    "Panama",
    "Pana",
    "Pa-na-ma",
    "Pa",
    "Pa-n",
    "",
  ]);
});

test("vn.step-fill: portal controls accept Vietnamese visible aliases", () => {
  assert.deepEqual(buildAntSelectMatchTexts("China"), ["China", "Trung Quốc"]);
  assert.ok(buildAntSelectMatchTexts("No").includes("Không"));
  assert.ok(buildAntSelectMatchTexts("Single-entry").includes("Một lần"));
  assert.ok(buildAntSelectMatchTexts("Ordinary passport").includes("Hộ chiếu phổ thông"));
  assert.ok(buildAntSelectMatchTexts("ordinary").includes("Phổ thông"));
  assert.equal(getVnPortalOptionText("passport_type", "official"), "Official passport");
});

test("vn.step-fill: select field timeout is bounded", () => {
  assert.equal(getVietnamSelectFieldTimeoutMs(undefined), 45_000);
  assert.equal(getVietnamSelectFieldTimeoutMs("100"), 1_000);
  assert.equal(getVietnamSelectFieldTimeoutMs("90000"), 60_000);
  assert.equal(getVietnamSelectFieldTimeoutMs("invalid"), 45_000);
});

test("vn.step-fill: every official country code maps both ways and matches the frontend source", () => {
  const officialEntries = Object.entries(VN_COUNTRY_NAME_BY_ALPHA3);
  assert.equal(officialEntries.length, 205);
  assert.equal("HKG" in VN_COUNTRY_NAME_BY_ALPHA3, false);
  assert.equal("MAC" in VN_COUNTRY_NAME_BY_ALPHA3, false);

  for (const [code, officialLabel] of officialEntries) {
    assert.equal(normalizeVnCountryOptionText(code), officialLabel, `${code} code -> label`);
    assert.equal(getVnPortalOptionText("nationality", code), officialLabel, `${code} portal label`);
    assert.equal(getVnCountryAlpha3ForOptionText(officialLabel), code, `${officialLabel} label -> code`);
  }

  const frontendSourcePath = resolve(
    process.cwd(),
    "../../viza-fe/internal-website/lib/vietnam-evisa-official-countries.ts",
  );
  const frontendSource = readFileSync(frontendSourcePath, "utf8");
  const sourceMatch = frontendSource.match(
    /VIETNAM_E_VISA_OFFICIAL_COUNTRY_ROWS_SOURCE = `([\s\S]*?)`;/,
  );
  assert.ok(sourceMatch?.[1], "frontend official-country source is present");
  const frontendEntries = sourceMatch[1].split(/\r?\n/).map((row) => {
    const separatorIndex = row.indexOf("|");
    return [row.slice(0, separatorIndex), row.slice(separatorIndex + 1)];
  });
  assert.deepEqual(frontendEntries, officialEntries);

  const migrationPath = resolve(
    process.cwd(),
    "../../viza-fe/internal-website/supabase/migrations/20260728083839_vn_evisa_official_country_options.sql",
  );
  const migrationSource = readFileSync(migrationPath, "utf8");
  const migrationMatch = migrationSource.match(/\$countries\$([\s\S]*?)\$countries\$/);
  assert.ok(migrationMatch?.[1], "database migration official-country source is present");
  const migrationEntries = migrationMatch[1].split(/\r?\n/).map((row) => {
    const separatorIndex = row.indexOf("|");
    return [row.slice(0, separatorIndex), row.slice(separatorIndex + 1)];
  });
  assert.deepEqual(migrationEntries, officialEntries);
});
