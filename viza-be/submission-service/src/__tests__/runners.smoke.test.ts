import { test } from "node:test";
import assert from "node:assert/strict";

process.env.SUPABASE_URL ??= "http://localhost";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-key";

let LAUNCH_COUNTRIES: typeof import("../queue/dispatch.js").LAUNCH_COUNTRIES;
let DISPATCH: typeof import("../queue/dispatch.js").DISPATCH;
let DISPATCH_META: typeof import("../queue/dispatch.js").DISPATCH_META;
let getRunOne: typeof import("../queue/dispatch.js").getRunOne;
let normalizeCountry: typeof import("../queue/dispatch.js").normalizeCountry;
let UnsupportedCountryError: typeof import("../queue/dispatch.js").UnsupportedCountryError;

test.before(async () => {
  const dispatch = await import("../queue/dispatch.js");
  LAUNCH_COUNTRIES = dispatch.LAUNCH_COUNTRIES;
  DISPATCH = dispatch.DISPATCH;
  DISPATCH_META = dispatch.DISPATCH_META;
  getRunOne = dispatch.getRunOne;
  normalizeCountry = dispatch.normalizeCountry;
  UnsupportedCountryError = dispatch.UnsupportedCountryError;
});

/**
 * RUN-CORE-005: per-country runner smoke harness. Iterates the dispatch table
 * and asserts every bound country resolves to a runOne (mapping wiring is
 * sound), the metadata is in sync, and unimplemented countries throw
 * UnsupportedCountryError. Keeps dispatch coverage green as countries land.
 */

test("smoke: every launch country resolves to a runOne", () => {
  for (const c of LAUNCH_COUNTRIES) {
    if (c === "indonesia") continue;
    assert.equal(typeof getRunOne(c), "function", `${c} resolves`);
  }
  assert.throws(() => getRunOne("indonesia"), UnsupportedCountryError);
});

test("smoke: every DISPATCH key has matching DISPATCH_META", () => {
  for (const key of Object.keys(DISPATCH)) {
    assert.ok(DISPATCH_META[key], `meta for ${key}`);
    assert.equal(DISPATCH_META[key].implemented, true, `${key} implemented`);
  }
});

test("smoke: ISO aliases resolve to the same runOne as canonical", () => {
  assert.equal(getRunOne("gb"), getRunOne("united_kingdom"));
  assert.equal(getRunOne("us"), getRunOne("united_states"));
  assert.equal(getRunOne("uae"), getRunOne("united_arab_emirates"));
  assert.equal(getRunOne("in"), getRunOne("india"));
  assert.equal(normalizeCountry("In"), "india");
});

test("smoke: unimplemented country throws UnsupportedCountryError", () => {
  assert.throws(() => getRunOne("narnia"), UnsupportedCountryError);
});
