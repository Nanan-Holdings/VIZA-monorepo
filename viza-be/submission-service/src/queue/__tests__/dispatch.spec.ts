import { test } from "node:test";
import assert from "node:assert/strict";

process.env.SUPABASE_URL ??= "http://localhost";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-key";

let getRunOne: typeof import("../dispatch.js").getRunOne;
let normalizeCountry: typeof import("../dispatch.js").normalizeCountry;
let DISPATCH_META: typeof import("../dispatch.js").DISPATCH_META;
let UnsupportedCountryError: typeof import("../dispatch.js").UnsupportedCountryError;
let stableConsensusAnswers: typeof import("../answers.js").stableConsensusAnswers;
let matchesSubmissionPreflightApplication: typeof import("../answers.js").matchesSubmissionPreflightApplication;

test.before(async () => {
  const dispatch = await import("../dispatch.js");
  getRunOne = dispatch.getRunOne;
  normalizeCountry = dispatch.normalizeCountry;
  DISPATCH_META = dispatch.DISPATCH_META;
  UnsupportedCountryError = dispatch.UnsupportedCountryError;
  ({
    stableConsensusAnswers,
    matchesSubmissionPreflightApplication,
  } = await import("../answers.js"));
});

test("submission preflight binds a runner to the application's exact country and visa type", () => {
  const tr = { applicationCountry: "turkey", applicationVisaType: "TR_E_VISA" };
  const india = { applicationCountry: "india", applicationVisaType: "IN_E_VISA" };
  assert.equal(matchesSubmissionPreflightApplication(tr, "turkey", "TR_E_VISA"), true);
  assert.equal(matchesSubmissionPreflightApplication(tr, "india", "IN_E_VISA"), false);
  assert.equal(matchesSubmissionPreflightApplication(india, "india", "IN_E_VISA"), true);
  assert.equal(matchesSubmissionPreflightApplication(india, "india", "TR_E_VISA"), false);
});

test("stable cross-application answers require exact consensus and exclude travel facts", () => {
  const answers = stableConsensusAnswers([
    { field_name: "father_full_name", value_text: "CONSISTENT PARENT" },
    { field_name: "father_full_name", value_text: "CONSISTENT PARENT" },
    { field_name: "mother_full_name", value_text: "FIRST VALUE" },
    { field_name: "mother_full_name", value_text: "CONFLICTING VALUE" },
    { field_name: "intended_arrival_date", value_text: "2026-10-01" },
    { field_name: "has_changed_name", value_text: "no" },
    { field_name: "has_other_names_used", value_text: "no" },
  ]);
  assert.equal(answers.father_full_name, "CONSISTENT PARENT");
  assert.equal(answers.mother_full_name, undefined);
  assert.equal(answers.intended_arrival_date, undefined);
  assert.equal(answers.has_changed_name, undefined);
  assert.equal(answers.has_other_names_used, undefined);
});

test("dispatch: schema-aware tourist runners resolve behind their own live gates", () => {
  const gated = ["canada", "turkey", "india", "saudi_arabia", "united_arab_emirates"];
  for (const country of gated) {
    assert.equal(DISPATCH_META[country].implemented, true, `${country} is wired`);
    assert.equal(typeof getRunOne(country), "function");
  }
});

test("dispatch: ISO alias 'in' normalizes to the gated India route", () => {
  assert.equal(normalizeCountry("in"), "india");
  assert.equal(getRunOne("in"), getRunOne("india"));
});

test("dispatch: country code normalization handles gb/uk/us", () => {
  assert.equal(normalizeCountry("gb"), "united_kingdom");
  assert.equal(normalizeCountry("UK"), "united_kingdom");
  assert.equal(normalizeCountry("United States"), "united_states");
});

test("dispatch: unwired country throws UnsupportedCountryError", () => {
  assert.throws(() => getRunOne("atlantis"), UnsupportedCountryError);
});

test("dispatch: all launch countries resolve to a runOne", () => {
  const launch = [
    "indonesia", "egypt", "australia", "saudi_arabia", "united_kingdom", "vietnam",
    "malaysia", "japan", "united_states", "canada", "turkey", "thailand",
    "singapore", "united_arab_emirates", "france", "italy", "india", "taiwan", "south_korea",
  ];
  for (const c of launch) {
    if (c === "indonesia") continue;
    assert.equal(typeof getRunOne(c), "function", `${c} resolves`);
  }
});

test("dispatch: Taiwan aliases route to canonical tw runner", () => {
  assert.equal(normalizeCountry("TW"), "taiwan");
  assert.equal(getRunOne("tw"), getRunOne("taiwan"));
  assert.equal(DISPATCH_META.taiwan.runner, "tw/runner.runOne");
  assert.equal(DISPATCH_META.taiwan.implemented, true);
});

test("dispatch: Philippines arrival aliases route to the canonical fail-closed runner_job handler", () => {
  assert.equal(normalizeCountry("PH"), "philippines");
  assert.equal(getRunOne("ph"), getRunOne("philippines"));
  assert.equal(DISPATCH_META.philippines.runner, "ph-etravel/runner-job.runOne (arrival review/recovery only)");
  assert.equal(DISPATCH_META.philippines.implemented, true);
});

test("dispatch: Singapore aliases normalize and resolve", () => {
  assert.equal(normalizeCountry("SG"), "singapore");
  assert.equal(getRunOne("sg"), getRunOne("singapore"));
});

test("dispatch: Korea aliases normalize and resolve", () => {
  assert.equal(normalizeCountry("KR"), "south_korea");
  assert.equal(normalizeCountry("Korea"), "south_korea");
  assert.equal(getRunOne("kr"), getRunOne("south_korea"));
});

test("dispatch: shared-pool flow keys resolve only for their country", () => {
  const flows = [
    ["vietnam", "vn_evisa"],
    ["vietnam", "vn_prearrival"],
    ["singapore", "sgac"],
    ["malaysia", "mdac"],
    ["thailand", "tdac"],
    ["south_korea", "kr_eform"],
  ] as const;
  for (const [country, flow] of flows) {
    assert.equal(typeof getRunOne(country, flow), "function", `${country}/${flow}`);
  }
  assert.throws(
    () => getRunOne("malaysia", "tdac"),
    UnsupportedCountryError,
  );
});

test("dispatch: Indonesia cannot run through the simplified runner_job transport", () => {
  assert.throws(
    () => getRunOne("indonesia"),
    UnsupportedCountryError,
  );
});
