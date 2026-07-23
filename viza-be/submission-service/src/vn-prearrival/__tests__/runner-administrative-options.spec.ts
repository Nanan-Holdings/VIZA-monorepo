import assert from "node:assert/strict";
import test from "node:test";
import { officialAdministrativeLabel } from "../administrative-label";

test("resolves persisted Vietnam administrative codes to portal labels", () => {
  assert.equal(officialAdministrativeLabel("province", "48"), "Da Nang City");
  assert.equal(officialAdministrativeLabel("ward", "20285", "48"), "Ngu Hanh Son Ward");
});
