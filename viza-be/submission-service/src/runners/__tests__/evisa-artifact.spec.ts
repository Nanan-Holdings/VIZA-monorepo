import { test } from "node:test";
import assert from "node:assert/strict";
import { evisaArtifactKey } from "../evisa-artifact.js";

/** RUN-CORE-003: country-tagged artifact key construction. */
test("evisa-artifact: country-tagged key", () => {
  assert.equal(evisaArtifactKey("indonesia", "job-123"), "indonesia-evisa-job-123.pdf");
  assert.equal(evisaArtifactKey("VN", "j", "pdf"), "vn-evisa-j.pdf");
});

test("evisa-artifact: sanitizes country + honors ext", () => {
  assert.equal(evisaArtifactKey("united-arab-emirates", "j", "png"), "united_arab_emirates-evisa-j.png");
});
