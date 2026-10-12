import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getExpectedNextPages } from "../orchestrator";

describe("DS-160 conditional page navigation", () => {
  it("jumps from spouse to Security when Work/Education is omitted for a minor", () => {
    assert.deepEqual(
      getExpectedNextPages("family_spouse", { skipWorkEducation: true }),
      ["security_background_1", "security_background_2", "security_background_3"],
    );
  });

  it("jumps from Address and Phone to Passport when U.S. Contact is omitted for an H stay", () => {
    assert.deepEqual(
      getExpectedNextPages("address_and_phone", { skipUsContact: true }),
      ["passport", "family_relatives", "family_spouse"],
    );
  });
});

