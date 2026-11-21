import assert from "node:assert/strict";
import test from "node:test";
import type { FvApplicationAnswers } from "../field-mappings";
import {
  FranceAccountRequiredError,
  FranceAnswersInvalidError,
  containsNonLatinText,
  findFranceAnswerIssues,
} from "../fallbacks";
import { NormalizationError } from "../normalize";

function validAnswers(): FvApplicationAnswers {
  return {
    step1: { depositTown: "", depositTownCity: "Changsha" },
    step2: {
      placeOfBirth: "CHANGSHA",
      street: "No. 18 Dongsanhuan North Road",
      place: "Beijing",
      phoneNumber: "+86 138 0013 8000",
      email: "applicant@viza.test",
      occupation: "11001",
    },
    step3: {},
    step4: {},
    step5: {
      cbxHasHostPerson: true,
      cbxHasHostOrganization: false,
      cbxHasPlaceOfApplication: false,
      cbxHasAutoFunding: true,
      cbxHasGuarantor: false,
      hostPersonSurname: "Dupont",
      hostPersonFirstnames: "Élise",
      hostPersonAddress: "12 rue de l'Église",
      hostPersonZipcode: "75004",
      hostPersonPlace: "Paris",
      hostPersonCountry: "FRA",
      hostPersonPhone: "+33 1 23 45 67 89",
      hostPersonEmail: "elise@viza.test",
    },
  } as unknown as FvApplicationAnswers;
}

test("valid Latin answers (including accents) pass unchanged", () => {
  const answers = validAnswers();
  const before = JSON.stringify(answers);
  assert.deepEqual(findFranceAnswerIssues(answers), []);
  assert.equal(JSON.stringify(answers), before, "answers are never modified");
});

test("Chinese text in an official field is reported against its VIZA field, not replaced", () => {
  const answers = validAnswers();
  answers.step2.place = "确定";
  const issues = findFranceAnswerIssues(answers);
  assert.deepEqual(issues.map((issue) => [issue.field, issue.reason, issue.answerFields[0]]), [
    ["place", "contains_non_latin", "home_address_city"],
  ]);
  assert.equal(answers.step2.place, "确定");
});

test("other non-Latin scripts and full-width punctuation are rejected", () => {
  assert.equal(containsNonLatinText("Москва"), true);
  assert.equal(containsNonLatinText("Beijing，Chaoyang"), true);
  assert.equal(containsNonLatinText("Saint-Étienne (42)"), false);
});

test("malformed phone and missing host postcode are reported", () => {
  const answers = validAnswers();
  answers.step2.phoneNumber = "call me";
  answers.step5.hostPersonZipcode = undefined;
  const issues = findFranceAnswerIssues(answers);
  assert.deepEqual(issues.map((issue) => [issue.field, issue.reason]), [
    ["phoneNumber", "invalid_format"],
    ["hostPersonZipcode", "missing"],
  ]);
});

test("hotel stays skip host-person checks", () => {
  const answers = validAnswers();
  answers.step5 = { ...answers.step5, cbxHasHostPerson: false, cbxHasHostOrganization: true, hostPersonZipcode: undefined };
  assert.deepEqual(findFranceAnswerIssues(answers), []);
});

test("an 'Other' occupation needs every employer detail, phone and email included", () => {
  const answers = validAnswers();
  answers.step2 = {
    ...answers.step2,
    occupation: "65005",
    occupationOtherSpecify: "Freelancer",
    businessSegment: "OTH",
    employerName: "Self",
    employerStreet: "1 Main St",
    employerPlace: "Beijing",
    employerCountry: "CHN",
  };
  const issues = findFranceAnswerIssues(answers);
  assert.deepEqual(issues.map((issue) => [issue.field, issue.answerFields]), [
    ["employerPhone", ["employer_phone"]],
    ["employerEmail", ["employer_email"]],
  ]);
});

test("the invalid-answers error is a non-retryable data error carrying every issue", () => {
  const answers = validAnswers();
  answers.step2.place = "确定";
  const error = new FranceAnswersInvalidError(findFranceAnswerIssues(answers));
  assert.ok(error instanceof NormalizationError);
  assert.equal(error.errorCode, "france_answers_invalid");
  assert.equal(error.issues.length, 1);
  assert.doesNotMatch(error.message, /确定/, "answer values are not logged");
});

test("a missing submission centre is reported before France-Visas is opened", () => {
  const answers = validAnswers();
  answers.step1 = { ...answers.step1, depositTown: "", depositTownCity: undefined };
  assert.deepEqual(findFranceAnswerIssues(answers).map((issue) => [issue.field, issue.reason, issue.answerFields[0]]), [
    ["depositTown", "missing", "submission_centre"],
  ]);
});

test("a missing France-Visas login is a non-retried data error with a Chinese fix-it", () => {
  const error = new FranceAccountRequiredError();
  assert.ok(error instanceof NormalizationError);
  assert.equal(error.errorCode, "france_account_required");
  assert.match(error.messageZh, /关联您的 France-Visas 账号/);
});

test("a student's educational establishment is checked against the school answers", () => {
  const answers = validAnswers();
  answers.step2 = {
    ...answers.step2,
    occupation: "69005",
    employerName: "National University of Singapore",
    employerStreet: "21 Lower Kent Ridge Road",
    employerCountry: "SGP",
    employerPhone: "+65 6516 6666",
  };
  const issues = findFranceAnswerIssues(answers);
  assert.deepEqual(issues.map((issue) => [issue.field, issue.answerFields[0], issue.labelZh]), [
    ["employerPlace", "school_city", "学校所在城市"],
    ["employerEmail", "school_email", "学校电子邮箱"],
  ]);
});
