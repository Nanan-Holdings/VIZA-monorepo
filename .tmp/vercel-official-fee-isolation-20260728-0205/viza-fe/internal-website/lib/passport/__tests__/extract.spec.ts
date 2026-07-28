/**
 * Synthetic passport extraction tests. No real applicant data.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { extractPassport, toFormAnswers } from "../extract";

test("extractPassport keeps MRZ surname and given names when visual OCR swaps them", () => {
  const result = extractPassport({
    mrz: [
      "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<",
      "L898902C36UTO7408122F1204159ZE184226B<<<<<10",
    ].join("\n"),
    fields: {
      surname: { value: "ANNA MARIA", confidence: 0.99 },
      givenNames: { value: "ERIKSSON", confidence: 0.99 },
      passportNumber: { value: "WRONG1234", confidence: 0.99 },
    },
  });

  assert.equal(result.surname?.value, "ERIKSSON");
  assert.equal(result.surname?.source, "mrz");
  assert.equal(result.givenNames?.value, "ANNA MARIA");
  assert.equal(result.givenNames?.source, "mrz");
  assert.equal(result.passportNumber?.value, "L898902C3");

  const answers = toFormAnswers(result);
  assert.equal(answers.surname, "ERIKSSON");
  assert.equal(answers.given_names, "ANNA MARIA");
  assert.equal(answers.passport_number, "L898902C3");
});
