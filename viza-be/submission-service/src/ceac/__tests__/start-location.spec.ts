import assert from "node:assert/strict";
import test from "node:test";
import { resolveCeacStartLocationCode } from "../start-location";

test("uses the CEAC code saved by the VIZA consular-post question", () => {
  assert.equal(resolveCeacStartLocationCode({ consular_post: "SHG" }), "SHG");
});

test("normalizes legacy China post labels", () => {
  assert.equal(
    resolveCeacStartLocationCode({ embassy_or_consulate: "CHINA, SHENYANG" }),
    "SNY",
  );
});

test("rejects a missing post instead of silently defaulting to Nassau", () => {
  assert.throws(() => resolveCeacStartLocationCode({}), /consular post is missing/i);
});

test("rejects unsupported free text instead of sending it to CEAC", () => {
  assert.throws(
    () => resolveCeacStartLocationCode({ consular_post: "Singapore" }),
    /unsupported DS-160 consular post/i,
  );
});
