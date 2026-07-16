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

test("dispatch: all launch countries resolve to a runOne", () => {
  const launch = [
    "indonesia", "egypt", "australia", "saudi_arabia", "united_kingdom", "vietnam",
    "malaysia", "japan", "united_states", "canada", "turkey", "thailand",
    "singapore", "united_arab_emirates", "france", "italy", "india", "south_korea",
  ];
  for (const c of launch) {
    assert.equal(typeof getRunOne(c), "function", `${c} resolves`);
  }
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
