import assert from "node:assert/strict";
import test from "node:test";
import { deriveUkBiometricsCountryIso3 } from "./country-iso3.js";

test("UK biometrics country prefers explicit answer over residence", () => {
  assert.equal(
    deriveUkBiometricsCountryIso3({
      biometrics_country: "USA",
      country_of_residence: "Singapore",
      country_of_nationality: "China",
    }),
    "USA",
  );
});

test("UK biometrics country uses residence but never nationality as a guess", () => {
  assert.equal(
    deriveUkBiometricsCountryIso3({
      country_of_residence: "Singapore",
      country_of_nationality: "China",
    }),
    "SGP",
  );
  assert.equal(
    deriveUkBiometricsCountryIso3({ country_of_nationality: "China" }),
    undefined,
  );
});
