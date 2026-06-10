import { test } from "node:test";
import assert from "node:assert/strict";
import { proxyCoverageGaps, resolveEgressCountry } from "../country-overrides.js";

const LAUNCH = [
  "indonesia", "egypt", "australia", "saudi_arabia", "united_kingdom", "vietnam",
  "malaysia", "japan", "united_states", "canada", "turkey", "thailand",
  "united_arab_emirates", "france", "italy", "india",
];

/** RUN-CORE-006: proxy egress coverage for all launch countries. */
test("proxy: no coverage gaps across the 16 launch countries", () => {
  assert.deepEqual(proxyCoverageGaps(LAUNCH), []);
});

test("proxy: france/italy/saudi resolve (added in RUN-CORE-006)", () => {
  assert.equal(resolveEgressCountry("france").brightDataCountry, "fr");
  assert.equal(resolveEgressCountry("italy").brightDataCountry, "it");
  assert.equal(resolveEgressCountry("saudi_arabia").brightDataCountry, "sa");
});

test("proxy: unknown country is a gap", () => {
  assert.deepEqual(proxyCoverageGaps(["narnia"]), ["narnia"]);
});
