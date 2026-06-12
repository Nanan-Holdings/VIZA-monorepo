import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveDS160Answers } from "../ds160-derive-answers";

describe("deriveDS160Answers", () => {
  it("maps a no-social-media answer to the CEAC NONE provider option", () => {
    const answers = deriveDS160Answers({ has_social_media: "N" });

    assert.equal(answers.social_media_provider, "NONE");
    assert.equal(answers.has_social_media, "N");
    assert.equal(answers.social_media_identifier, undefined);
  });

  it("transliterates known Chinese city names for CEAC city text fields", () => {
    const answers = deriveDS160Answers({ home_address_city: "长沙" });

    assert.equal(answers.home_address_city, "CHANGSHA");
  });

  it("removes non-fillable NA tokens from optional CEAC text fields", () => {
    const answers = deriveDS160Answers({
      passport_issuance_state: "DOES_NOT_APPLY",
      home_address_state: "DOES_NOT_APPLY",
      home_address_postal: "DOES_NOT_APPLY",
    });

    assert.equal(answers.passport_issuance_state, undefined);
    assert.equal(answers.home_address_state_na, "Y");
    assert.equal(answers.home_address_postal_na, "Y");
    assert.equal(answers.home_address_state, undefined);
    assert.equal(answers.home_address_postal, undefined);
  });

  it("maps unknown U.S. contact name and email tokens to CEAC NA checkboxes", () => {
    const answers = deriveDS160Answers({
      us_contact_surname: "DO_NOT_KNOW",
      us_contact_given_names: "DO_NOT_KNOW",
      us_contact_organization: "DO_NOT_KNOW",
      us_contact_email: "DOES_NOT_APPLY",
    });

    assert.equal(answers.us_contact_name_na, "Y");
    assert.equal(answers.us_contact_email_na, "Y");
    assert.equal(answers.us_contact_organization, "UNKNOWN");
    assert.equal(answers.us_contact_organization_na, undefined);
    assert.equal(answers.us_contact_surname, undefined);
    assert.equal(answers.us_contact_given_names, undefined);
    assert.equal(answers.us_contact_email, undefined);
  });

  it("defaults blank U.S. tax identifiers to CEAC NA checkboxes", () => {
    const answers = deriveDS160Answers({ us_taxpayer_id: "" });

    assert.equal(answers.us_taxpayer_id_na, "Y");
    assert.equal(answers.us_taxpayer_id, undefined);
  });
});
