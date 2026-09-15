import assert from "node:assert/strict";
import { test } from "node:test";
import { ds160ConditionMatches } from "../../ds160-conditions";
import { DS160_FIELD_CONTRACTS } from "../../ds160-field-contract";
import {
  assertDs160RequiredAnswers,
  createDs160BranchPolicy,
  Ds160RequiredAnswersError,
  Ds160PlaceholderAnswersError,
  findDs160PlaceholderFields,
  ds160MappingRepeatGroup,
  ds160MappingSources,
  ds160RepeatAnswers,
} from "../field-contract";

function completeRequiredFixture(): Record<string, string> {
  const answers: Record<string, string> = {};
  for (const [fieldName, field] of Object.entries(DS160_FIELD_CONTRACTS)) {
    if (field.required) answers[fieldName] = "fixture";
  }
  return answers;
}

test("maps derived dates and aliases back to their seed branch and repeat group", () => {
  assert.deepEqual(ds160MappingSources("intended_arrival_date_day"), ["intended_arrival_date"]);
  assert.equal(ds160MappingRepeatGroup("social_media_provider__2"), "social_media");
  assert.equal(ds160MappingRepeatGroup("purpose_of_trip"), "trip_purpose");
});

test("inactive specific travel dates and dependent old nationality answers stay inactive", () => {
  const policy = createDs160BranchPolicy({
    has_specific_plans: "no", arrival_date: "2030-01-01", intended_arrival_date: "2030-03-01",
    other_nationality: "no", other_nationality_has_passport: "yes", other_nationality_passport_number: "stale",
  });
  assert.equal(policy.isMappingActive("arrival_date_day"), false);
  assert.equal(policy.isMappingActive("intended_arrival_date_day"), true);
  assert.equal(policy.isMappingActive("other_nationality_passport_number"), false);
  assert.equal(policy.values.other_nationality_has_passport, undefined);
});

test("selected specific travel dates activate their actual date controls", () => {
  const policy = createDs160BranchPolicy({ has_specific_plans: "yes" });
  assert.equal(policy.isMappingActive("arrival_date_day"), true);
  assert.equal(policy.isMappingActive("intended_arrival_date_day"), false);
});

test("legacy provider NONE and second-row aliases reach repeat fields without replacing canonical answers", () => {
  const rows = ds160RepeatAnswers({ social_media_platform: "EXISTING" }, {
    social_media_provider: "NONE", social_media_provider__2: "SECOND", social_media_identifier__2: "handle",
  });
  assert.equal(rows.social_media_platform, "EXISTING");
  assert.equal(rows.social_media_platform__2, "SECOND");
  assert.equal(rows.social_media_handle__2, "handle");
  assert.equal(ds160RepeatAnswers({}, { social_media_provider: "NONE" }).social_media_platform, "NONE");
  assert.equal(ds160RepeatAnswers({}, {}).social_media_platform, undefined);
});

test("null-like social-media controllers keep the handle branch inactive", () => {
  const expression = "social_media_platform !== NONE && social_media_platform !== null";
  for (const values of [
    {},
    { social_media_platform: "" },
    { social_media_platform: null },
    { social_media_platform: "null" },
    { social_media_platform: "NONE" },
  ]) {
    assert.equal(ds160ConditionMatches(expression, values), false);
  }
  assert.equal(ds160ConditionMatches(expression, { social_media_platform: "FACEBOOK" }), true);
});

test("required assertion reports missing field names without answer values", () => {
  const answers = completeRequiredFixture();
  delete answers.surname;
  answers.email_address = "sensitive@example.invalid";

  assert.throws(
    () => assertDs160RequiredAnswers(answers),
    (error: unknown) => {
      assert.ok(error instanceof Ds160RequiredAnswersError);
      assert.deepEqual(error.missingFields, ["surname"]);
      assert.match(error.message, /surname/);
      assert.doesNotMatch(error.message, /sensitive@example\.invalid/);
      return true;
    },
  );
});

test("required assertion honors inactive branches, explicit NA, and legacy aliases", () => {
  const answers = completeRequiredFixture();
  answers.other_names_used = "no";
  delete answers.other_surname;
  delete answers.other_given_names;
  answers.passport_expiration_date = "DOES_NOT_APPLY";
  delete answers.trip_payer_type;
  answers.who_is_paying = "self";

  assert.doesNotThrow(() => assertDs160RequiredAnswers(answers));
});

test("required assertion checks every active persisted repeat row", () => {
  const answers = completeRequiredFixture();
  answers.has_companions = "yes";
  answers.companion_group_travel = "no";
  answers.companion_surname = "FIRST";
  answers.companion_given_names = "ROW";
  answers.companion_relationship = "friend";
  answers.companion_surname__2 = "SECOND";
  answers.companion_relationship__2 = "friend";

  assert.throws(
    () => assertDs160RequiredAnswers(answers),
    (error: unknown) => {
      assert.ok(error instanceof Ds160RequiredAnswersError);
      assert.deepEqual(error.missingFields, ["companion_given_names__2"]);
      return true;
    },
  );
});

test("branch policy defers row-local conditions to preserve later repeat rows", () => {
  const policy = createDs160BranchPolicy({
    social_media_platform: "NONE",
    social_media_platform__2: "FACEBOOK",
    social_media_handle__2: "second-handle",
  });
  assert.equal(policy.isMappingActive("social_media_handle__2"), true);
});

test("placeholder preflight rejects prompts in required and optional active fields without leaking values", () => {
  const answers = completeRequiredFixture();
  answers.surname = "For example, PRIVATE SURNAME";
  answers.full_name_native_alphabet = "请填写母语字母全名（如适用）";
  assert.throws(() => assertDs160RequiredAnswers(answers), (error: unknown) => {
    assert.ok(error instanceof Ds160PlaceholderAnswersError);
    assert.deepEqual(error.placeholderFields, ["surname", "full_name_native_alphabet"]);
    assert.doesNotMatch(error.message, /PRIVATE|母语/);
    return true;
  });
});

test("placeholder preflight recognizes the saved Chinese and translated travel prompts", () => {
  assert.deepEqual(findDs160PlaceholderFields({
    has_specific_plans: "no", intended_length_of_stay_unit: "DAY(S)",
    intended_length_of_stay_value: "请填写预计在美停留时间（数值）",
    us_address_street1: "Please fill in the street address (line 1)",
    us_address_street2: "Please fill in the street address (line 2, if applicable).",
    us_address_city: "Please fill in the city.", us_address_zip: "请填写邮编",
    home_address_city: "Please fill in the city.",
  }), ["intended_length_of_stay_value", "us_address_street1", "us_address_street2", "us_address_city", "us_address_zip", "home_address_city"]);
});

test("placeholder preflight follows official English alias precedence and preserves native script", () => {
  assert.deepEqual(findDs160PlaceholderFields({
    surname: "请输入姓氏", surname_en: "LEE",
    home_address_city: "城市", home_address_city_en: "Please enter your city",
    full_name_native_alphabet: "李明", full_name_native_alphabet_en: "Please enter your name",
  }), ["home_address_city"]);
  assert.deepEqual(findDs160PlaceholderFields({
    surname: "For example, Zhang", surname_en: "LEE",
    home_address_city: "City", home_address_city_en: "Please enter your city",
  }), ["surname"]);
});

test("placeholder preflight ignores inactive branches and their translated aliases", () => {
  assert.deepEqual(findDs160PlaceholderFields({
    other_names_used: "no", other_surname: "请填写曾用姓氏", other_surname_en: "Please enter your surname",
    has_specific_plans: "yes", intended_length_of_stay_value: "请填写停留时间",
  }), []);
});

test("placeholder preflight checks later repeat rows and honors row-local NONE", () => {
  assert.deepEqual(findDs160PlaceholderFields({
    social_media_platform: "NONE", social_media_handle: "Please enter your handle",
    social_media_platform__2: "FACEBOOK", social_media_handle__2: "请填写账号",
    social_media_handle__2_en: "Please enter your handle",
  }), ["social_media_handle__2"]);
});

test("placeholder preflight accepts explicit NA and prose that merely mentions instructions", () => {
  assert.deepEqual(findDs160PlaceholderFields({
    passport_book_number: "DOES_NOT_APPLY", father_surname: "DO_NOT_KNOW",
    surname: "SAMPLE", home_address_city: "Example City",
    primary_occupation: "engineering",
    job_duties: "I provide technical support and review please-enter prompts.",
  }), []);
});
