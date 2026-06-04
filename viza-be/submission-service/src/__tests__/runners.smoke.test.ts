import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LAUNCH_COUNTRIES,
  DISPATCH,
  DISPATCH_META,
  getRunOne,
  normalizeCountry,
  UnsupportedCountryError,
} from "../queue/dispatch.js";

/**
 * RUN-CORE-005: per-country runner smoke harness. Iterates the dispatch table
 * and asserts every bound country resolves to a runOne (mapping wiring is
 * sound), the metadata is in sync, and unimplemented countries throw
 * UnsupportedCountryError. Keeps dispatch coverage green as countries land.
 */

test("smoke: every launch country resolves to a runOne", () => {
  for (const c of LAUNCH_COUNTRIES) {
    assert.equal(typeof getRunOne(c), "function", `${c} resolves`);
  }
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
  assert.equal(normalizeCountry("In"), "india");
});

test("smoke: unimplemented country throws UnsupportedCountryError", () => {
  assert.throws(() => getRunOne("narnia"), UnsupportedCountryError);
});
