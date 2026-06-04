import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getRunOne,
  normalizeCountry,
  DISPATCH_META,
  UnsupportedCountryError,
} from "../dispatch.js";

test("dispatch: India job routes to runInPrefill", () => {
  // Routing metadata asserts the binding without executing the runner
  // (which would hit the DB + launch a browser).
  assert.equal(DISPATCH_META.india.runner, "runInPrefill");
  assert.equal(DISPATCH_META.india.implemented, true);
  const runOne = getRunOne("india");
  assert.equal(typeof runOne, "function");
});

test("dispatch: ISO alias 'in' normalizes to india and resolves", () => {
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

test("dispatch: saudi_arabia runOne rejects with UnsupportedCountryError", async () => {
  const runOne = getRunOne("saudi_arabia");
  await assert.rejects(() => runOne("00000000-0000-0000-0000-000000000000"), UnsupportedCountryError);
});
