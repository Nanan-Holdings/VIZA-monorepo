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
  has_other_social_media: "no",
  has_companions: "no",
  primary_occupation: "retired",
  has_clan_tribe: "no",
  language_name: "ENGLISH",
  has_traveled_last_five_years: "no",
  has_belonged_to_organization: "no",
  has_specialized_skills: "no",
  has_served_military: "no",
  has_served_paramilitary: "no",
  has_communicable_disease: "no",
  has_physical_mental_disorder: "no",
  is_drug_abuser: "no",
  has_arrest_conviction: "no",
  has_violated_controlled_substance: "no",
  has_prostitution: "no",
  has_money_laundering: "no",
  has_human_trafficking: "no",
  has_aided_human_trafficking: "no",
  has_trafficking_beneficiary: "no",
  intend_illegal_activity: "no",
  intend_terrorist_activity: "no",
  has_provided_terrorist_support: "no",
  is_terrorist_member: "no",
  is_terrorist_family: "no",
  has_genocide: "no",
  has_torture: "no",
  has_extrajudicial_killings: "no",
  has_child_soldier: "no",
  has_religious_freedom_violation: "no",
  has_population_control: "no",
  has_coercive_transplant: "no",
  has_immigration_fraud: "no",
  has_removal_deportation_hearing: "no",
  has_failed_removal_hearing: "no",
  has_overstayed: "no",
  has_removal_order: "no",
  has_withheld_child_custody: "no",
  has_voted_illegally: "no",
  has_renounced_citizenship: "no",
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
    const complete: Record<string, string> = {
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

  it("requires the official other-social question and complete rows when answered yes", () => {
    const missingGate: Record<string, string> = { ...BASE_ANSWERS };
    delete missingGate.has_other_social_media;
    assert.ok(findMissingDs160RuntimeAnswers(missingGate).includes("has_other_social_media"));

    const missingRows = findMissingDs160RuntimeAnswers({
      ...BASE_ANSWERS,
      has_other_social_media: "yes",
      "other_social_media[]": "[]",
    });
    assert.ok(missingRows.includes("other_social_media[]"));

    const partialRows = findMissingDs160RuntimeAnswers({
      ...BASE_ANSWERS,
      has_other_social_media: "yes",
      "other_social_media[]": JSON.stringify([
        { platform: "Example portfolio", handle: "" },
      ]),
    });
    assert.ok(partialRows.includes("other_social_media[0].handle"));

    assert.deepEqual(findMissingDs160RuntimeAnswers({
      ...BASE_ANSWERS,
      has_other_social_media: "yes",
      "other_social_media[]": JSON.stringify([
        { platform: "Example portfolio", handle: "profile-name" },
      ]),
    }), []);
  });

  it("requires every Additional and Security gate before CEAC is touched", () => {
    const missingAdditional = { ...BASE_ANSWERS };
    delete missingAdditional.has_clan_tribe;
    delete missingAdditional.language_name;
    delete missingAdditional.has_served_paramilitary;
    const missingAdditionalKeys = findMissingDs160RuntimeAnswers(missingAdditional);
    assert.ok(missingAdditionalKeys.includes("has_clan_tribe"));
    assert.ok(missingAdditionalKeys.includes("language_name"));
    assert.ok(missingAdditionalKeys.includes("has_served_paramilitary"));

    const missingSecurity = { ...BASE_ANSWERS };
    delete missingSecurity.has_communicable_disease;
    delete missingSecurity.has_renounced_citizenship;
    const missingSecurityKeys = findMissingDs160RuntimeAnswers(missingSecurity);
    assert.ok(missingSecurityKeys.includes("has_communicable_disease"));
    assert.ok(missingSecurityKeys.includes("has_renounced_citizenship"));
  });

  it("requires complete Additional Yes branches and every military row", () => {
    const complete = {
      ...BASE_ANSWERS,
      has_clan_tribe: "yes",
      clan_tribe_name: "EXAMPLE CLAN",
      language_name__2: "MANDARIN",
      has_traveled_last_five_years: "yes",
      traveled_country: "JPN",
      traveled_country__2: "SING",
      has_belonged_to_organization: "yes",
      organization_name: "EXAMPLE ORGANIZATION",
      has_specialized_skills: "yes",
      specialized_skills_explain: "EXAMPLE TRAINING",
      has_served_military: "yes",
      military_country: "CHIN",
      military_branch: "EXAMPLE BRANCH",
      military_rank: "EXAMPLE RANK",
      military_specialty: "EXAMPLE SPECIALTY",
      military_date_from: "2010-01-02",
      military_date_to: "2011-03-04",
      military_country__2: "CHIN",
      military_branch__2: "EXAMPLE BRANCH 2",
      military_rank__2: "EXAMPLE RANK 2",
      military_specialty__2: "EXAMPLE SPECIALTY 2",
      military_date_from__2: "2012-05-06",
      military_date_to__2: "2013-07-08",
      has_served_paramilitary: "yes",
      paramilitary_explain: "EXAMPLE EXPLANATION",
    };
    assert.deepEqual(findMissingDs160RuntimeAnswers(complete), []);

    const partial: Record<string, string> = { ...complete };
    delete partial.organization_name;
    delete partial.military_rank__2;
    partial.military_date_to = "not-a-date";
    const missing = findMissingDs160RuntimeAnswers(partial);
    assert.ok(missing.includes("organization_name"));
    assert.ok(missing.includes("military_rank__2"));
    assert.ok(missing.includes("military_date_to"));
  });

  it("requires an explanation for every Security answer of Yes", () => {
    const oneYes: Record<string, string> = {
      ...BASE_ANSWERS,
      has_communicable_disease: "yes",
      has_arrest_conviction: "yes",
      intend_illegal_activity: "yes",
      has_immigration_fraud: "yes",
      has_removal_order: "yes",
      has_voted_illegally: "yes",
    };
    const missing = findMissingDs160RuntimeAnswers(oneYes);
    assert.deepEqual(missing.filter((key) => key.endsWith("_explain")), [
      "has_communicable_disease_explain",
      "has_arrest_conviction_explain",
      "intend_illegal_activity_explain",
      "has_immigration_fraud_explain",
      "has_removal_order_explain",
      "has_voted_illegally_explain",
    ]);

    for (const key of missing) oneYes[key] = "EXAMPLE EXPLANATION";
    assert.deepEqual(findMissingDs160RuntimeAnswers(oneYes), []);
  });

  it("ignores legacy Security answers that are absent from current CEAC", () => {
    const legacy = { ...BASE_ANSWERS };
    legacy.subject_to_removal_order = "no";
    legacy.failed_removal_hearing = "no";
    legacy.has_unlawful_presence = "no";

    assert.deepEqual(findMissingDs160RuntimeAnswers(legacy), []);
  });

  it("does not require obsolete Security fields that current CEAC does not expose", () => {
    const obsolete = { ...BASE_ANSWERS };
    delete obsolete.has_removal_deportation_hearing;
    delete obsolete.has_failed_removal_hearing;
    delete obsolete.has_overstayed;
    obsolete.has_been_detained = "no";
    obsolete.practicing_polygamy = "no";

    const missing = findMissingDs160RuntimeAnswers(obsolete);
    assert.equal(missing.includes("has_removal_deportation_hearing"), false);
    assert.equal(missing.includes("has_failed_removal_hearing"), false);
    assert.equal(missing.includes("has_overstayed"), false);
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
