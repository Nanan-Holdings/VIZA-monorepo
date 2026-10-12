import assert from "node:assert/strict";
import test from "node:test";
import {
  CEAC_DS160_LOCATION_OPTIONS,
  CEAC_DS160_LOCATION_OPTION_COUNT,
  Ds160ProofConsularPostRequiredError,
  resolveCeacStartLocationCode,
  resolveDs160ProofStartLocationCode,
} from "../start-location";

test("uses the CEAC code saved by the VIZA consular-post question", () => {
  assert.equal(resolveCeacStartLocationCode({ consular_post: "SHG" }), "SHG");
});

test("normalizes legacy China post labels", () => {
  assert.equal(
    resolveCeacStartLocationCode({ embassy_or_consulate: "CHINA, SHENYANG" }),
    "SNY",
  );
});

test("accepts all current official options and unique city aliases", () => {
  assert.equal(CEAC_DS160_LOCATION_OPTIONS.length, CEAC_DS160_LOCATION_OPTION_COUNT);
  assert.equal(CEAC_DS160_LOCATION_OPTION_COUNT, 217);
  for (const [code, label] of CEAC_DS160_LOCATION_OPTIONS) {
    assert.equal(resolveCeacStartLocationCode({ consular_post: code }), code);
    assert.equal(resolveCeacStartLocationCode({ consular_post: label }), code);
  }
  assert.equal(resolveCeacStartLocationCode({ consular_post: "SGP" }), "SGP");
  assert.equal(
    resolveCeacStartLocationCode({ embassy_or_consulate: "SINGAPORE, SINGAPORE" }),
    "SGP",
  );
  assert.equal(resolveCeacStartLocationCode({ consular_post: "Singapore" }), "SGP");
  assert.equal(resolveCeacStartLocationCode({ consular_post: "LND" }), "LND");
  assert.equal(resolveCeacStartLocationCode({ consular_post: "London" }), "LND");
});

test("rejects a missing post instead of silently defaulting to Nassau", () => {
  assert.throws(() => resolveCeacStartLocationCode({}), /consular post is missing/i);
});

test("rejects unknown free text instead of sending it to CEAC", () => {
  assert.throws(
    () => resolveCeacStartLocationCode({ consular_post: "Singapore, Unknown" }),
    /unsupported DS-160 consular post/i,
  );
});

test("proof recovery uses the saved post and fails terminally when it is unusable", () => {
  assert.equal(resolveDs160ProofStartLocationCode({ consular_post: "SHG" }), "SHG");
  assert.throws(
    () => resolveDs160ProofStartLocationCode({}),
    (error: unknown) =>
      error instanceof Ds160ProofConsularPostRequiredError
      && error.code === "ds160_proof_consular_post_required",
  );
  assert.throws(
    () => resolveDs160ProofStartLocationCode({ consular_post: "Singapore, Unknown" }),
    (error: unknown) => error instanceof Ds160ProofConsularPostRequiredError,
  );
});
