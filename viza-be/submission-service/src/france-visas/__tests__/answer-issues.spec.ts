import assert from "node:assert/strict";
import test from "node:test";
import type { FvApplicationAnswers } from "../field-mappings";
import {
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

test("an 'Other' occupation needs employer details and at least one employer contact", () => {
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
    ["employerPhone", ["employer_phone", "employer_email"]],
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
