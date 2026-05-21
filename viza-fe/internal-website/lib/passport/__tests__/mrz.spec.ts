/**
 * MRZ TD3 parser tests (DOC-002). Run with:
 *   npx tsx --test lib/passport/__tests__/mrz.spec.ts
 *
 * Synthetic MRZ values — no real applicant data.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTd3, mrzCheckDigit } from "../mrz";

test("mrzCheckDigit known case", () => {
  // ICAO 9303-3 example.
  assert.equal(mrzCheckDigit("D23145890"), 7);
});

test("parseTd3 happy path with valid check digits", () => {
  // Synthetic but check-digit-correct.
  const line1 = "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<";
  const line2 = "L898902C36UTO7408122F1204159ZE184226B<<<<<10";
  const fields = parseTd3(line1, line2);
  assert.equal(fields.documentType, "P");
  assert.equal(fields.issuingCountry, "UTO");
  assert.equal(fields.surname, "ERIKSSON");
  assert.equal(fields.givenNames, "ANNA MARIA");
  assert.equal(fields.passportNumber, "L898902C3");
  assert.equal(fields.nationality, "UTO");
  assert.equal(fields.dateOfBirth, "1974-08-12");
  assert.equal(fields.sex, "F");
  assert.equal(fields.expiryDate, "2012-04-15");
  assert.equal(fields.passportNumberValid, true);
  assert.equal(fields.dateOfBirthValid, true);
  assert.equal(fields.expiryDateValid, true);
});

test("parseTd3 detects mutated check digit", () => {
  const line1 = "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<";
  // Flip the passport-number check digit from 6 → 5.
  const line2 = "L898902C35UTO7408122F1204159ZE184226B<<<<<10";
  const fields = parseTd3(line1, line2);
  assert.equal(fields.passportNumberValid, false);
});

test("parseTd3 rejects wrong line lengths", () => {
  assert.throws(() => parseTd3("short", "short"));
});
