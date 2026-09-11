import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertDs160ReadyForCeac,
  Ds160CompletenessError,
  findMissingDs160RuntimeAnswers,
} from "../ds160-completeness-verify";
import { orchestrateFill } from "../ceac/orchestrator";

const BASE_ANSWERS: Record<string, string> = {
  state_of_birth: "does_not_apply",
  passport_book_number: "does_not_apply",
  home_address_line1: "1 TEST STREET",
  home_address_city: "BEIJING",
  home_address_state: "does_not_apply",
  home_address_postal: "does_not_apply",
  home_address_country: "China",
  mailing_same_as_home: "yes",
  primary_phone: "+86 10000000000",
  secondary_phone: "does_not_apply",
  work_phone: "does_not_apply",
  has_other_phones: "no",
  email_address: "test@example.com",
  has_other_emails: "no",
  has_companions: "no",
  primary_occupation: "retired",
};

describe("DS-160 runtime completeness preflight", () => {
  it("accepts explicit NA values and derives the checkbox keys", () => {
    const answers = assertDs160ReadyForCeac(BASE_ANSWERS);

    assert.equal(answers.state_of_birth_na, "Y");
    assert.equal(answers.passport_book_number_na, "Y");
    assert.equal(answers.state_of_birth, undefined);
    assert.equal(answers.passport_book_number, undefined);
  });

  it("accepts every complete individual companion and rejects incomplete rows", () => {
    const complete = {
      ...BASE_ANSWERS,
      has_companions: "yes",
      companion_group_travel: "no",
      "companions[]": JSON.stringify([
        { firstName: "JANE", lastName: "DOE", relationship: "friend" },
        { firstName: "JOHN", lastName: "SMITH", relationship: "other" },
      ]),
    };
    assert.deepEqual(findMissingDs160RuntimeAnswers(complete), []);

    const incomplete = {
      ...complete,
      "companions[]": JSON.stringify([
        { firstName: "JANE", lastName: "", relationship: "" },
      ]),
    };
    assert.deepEqual(findMissingDs160RuntimeAnswers(incomplete), [
      "companions[0].lastName",
      "companions[0].relationship",
    ]);
  });

  it("requires employer details only for an employed occupation", () => {
    const missing = findMissingDs160RuntimeAnswers({
      ...BASE_ANSWERS,
      primary_occupation: "business",
    });

    assert.ok(missing.includes("employer_name"));
    assert.ok(missing.includes("employment_start_date_day"));
    assert.ok(missing.includes("monthly_income|monthly_income_na"));
    assert.equal(findMissingDs160RuntimeAnswers(BASE_ANSWERS).includes("employer_name"), false);
  });

  it("rejects incomplete phone, email, and social repeat rows", () => {
    const incomplete = findMissingDs160RuntimeAnswers({
      ...BASE_ANSWERS,
      has_other_phones: "yes",
      "additional_phones[]": JSON.stringify([""]),
      has_other_emails: "yes",
      "additional_emails[]": JSON.stringify([""]),
      "social_media[]": JSON.stringify([{ platform: "INSTAGRAM", handle: "" }]),
    });

    assert.ok(incomplete.includes("additional_phones[]"));
    assert.ok(incomplete.includes("additional_emails[]"));
    assert.ok(incomplete.includes("social_media[0].handle"));
    assert.deepEqual(findMissingDs160RuntimeAnswers(BASE_ANSWERS), []);
  });

  it("accepts one and many complete contact rows but rejects any partial canonical row", () => {
    const complete = {
      ...BASE_ANSWERS,
      has_other_phones: "yes",
      "additional_phones[]": JSON.stringify(["+86 111", "+65 222"]),
      has_other_emails: "yes",
      "additional_emails[]": JSON.stringify(["one@example.com"]),
      "social_media[]": JSON.stringify([
        { platform: "INSTAGRAM", handle: "first" },
        { platform: "REDDIT", handle: "second" },
      ]),
    };
    assert.deepEqual(findMissingDs160RuntimeAnswers(complete), []);

    const partial = findMissingDs160RuntimeAnswers({
      ...complete,
      "additional_phones[]": JSON.stringify(["+86 111", ""]),
      "social_media[]": JSON.stringify([
        { platform: "INSTAGRAM", handle: "first" },
        { platform: "REDDIT", handle: "" },
      ]),
    });
    assert.ok(partial.includes("additional_phones[]"));
    assert.ok(partial.includes("social_media[1].handle"));
  });

  it("requires the alternate mailing branch and rejects malformed canonical arrays", () => {
    const missingMailing = findMissingDs160RuntimeAnswers({
      ...BASE_ANSWERS,
      mailing_same_as_home: "no",
    });
    assert.ok(missingMailing.includes("mailing_address_line1"));
    assert.ok(missingMailing.includes("mailing_address_city"));
    assert.ok(missingMailing.includes("mailing_address_country"));

    const malformed = findMissingDs160RuntimeAnswers({
      ...BASE_ANSWERS,
      has_other_phones: "yes",
      "additional_phones[]": "not-json",
      "social_media[]": JSON.stringify([{ platform: "INSTAGRAM", handle: "ok" }, "bad-row"]),
    });
    assert.ok(malformed.includes("additional_phones[]"));
    assert.ok(malformed.includes("social_media[]"));
  });

  it("rejects a NONE row mixed with actual social-media rows", () => {
    const missing = findMissingDs160RuntimeAnswers({
      ...BASE_ANSWERS,
      "social_media[]": JSON.stringify([
        { platform: "NONE", handle: "" },
        { platform: "INSTAGRAM", handle: "first" },
      ]),
    });

    assert.ok(missing.includes("social_media[]"));
  });

  it("stops at the orchestrator boundary before touching a CEAC page", async () => {
    let pageWasRead = false;
    const session = Object.defineProperty({}, "page", {
      get() {
        pageWasRead = true;
        throw new Error("page must not be read before preflight");
      },
    });

    await assert.rejects(
      orchestrateFill(session as never, {
        answers: {},
        profile: {},
        tracker: {} as never,
      }),
      (error: unknown) => error instanceof Ds160CompletenessError,
    );
    assert.equal(pageWasRead, false);
  });
});
