/**
 * ICAO 9303 TD3 (passport) MRZ parser (DOC-002).
 *
 * Deterministic — no OCR. Caller supplies the two 44-character MRZ
 * lines extracted from the image (the OCR provider produces them as
 * structured output). When the check digits validate, every field
 * lands at high confidence; failures fall back to visual-zone OCR.
 *
 * Spec ref: ICAO 9303-3 Annex A (Machine Readable Passports).
 */

export interface MrzFields {
  documentType: string;
  issuingCountry: string;
  surname: string;
  givenNames: string;
  passportNumber: string;
  passportNumberValid: boolean;
  nationality: string;
  dateOfBirth: string; // ISO YYYY-MM-DD
  dateOfBirthValid: boolean;
  sex: "M" | "F" | "X";
  expiryDate: string; // ISO YYYY-MM-DD
  expiryDateValid: boolean;
  personalNumber: string | null;
  personalNumberValid: boolean;
  /** Composite check digit (positions 1-10 + 14-20 + 22-43 of line 2). */
  compositeValid: boolean;
}

const ALPHA = "<0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function charValue(c: string): number {
  if (c >= "0" && c <= "9") return c.charCodeAt(0) - "0".charCodeAt(0);
  if (c === "<") return 0;
  if (c >= "A" && c <= "Z") return c.charCodeAt(0) - "A".charCodeAt(0) + 10;
  return 0;
}

const WEIGHTS = [7, 3, 1];

export function mrzCheckDigit(input: string): number {
  let sum = 0;
  for (let i = 0; i < input.length; i++) {
    sum += charValue(input[i]) * WEIGHTS[i % 3];
  }
  return sum % 10;
}

function parseMrzDate(yymmdd: string, future: boolean): string {
  const yy = Number.parseInt(yymmdd.slice(0, 2), 10);
  const mm = Number.parseInt(yymmdd.slice(2, 4), 10);
  const dd = Number.parseInt(yymmdd.slice(4, 6), 10);
  // ICAO has no century pivot. Pick the century that produces a year
  // inside a window around now: [-80, +5] for births (1944-style DOB
  // still parses; not-yet-born is impossible), [-30, +20] for
  // expiries (lets an already-expired passport read as the past, not
  // a 2120 future).
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const baseCentury = currentYear - (currentYear % 100);
  const candidates = [baseCentury + yy, baseCentury - 100 + yy, baseCentury + 100 + yy];
  const window = future ? { back: 30, ahead: 20 } : { back: 80, ahead: 5 };
  const valid = candidates
    .filter((y) => y >= currentYear - window.back && y <= currentYear + window.ahead)
    .sort((a, b) => Math.abs(a - currentYear) - Math.abs(b - currentYear));
  const yyyy = valid[0] ?? candidates[0];
  return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

export class MrzParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MrzParseError";
  }
}

export function parseTd3(line1: string, line2: string): MrzFields {
  if (line1.length !== 44 || line2.length !== 44) {
    throw new MrzParseError(
      `TD3 expects two 44-char lines; got ${line1.length} and ${line2.length}`,
    );
  }
  const documentType = line1[0];
  const issuingCountry = line1.slice(2, 5);
  // Names: surname<<given1<given2 — split on '<<'.
  const namePart = line1.slice(5, 44);
  const [surnameRaw, givenRaw = ""] = namePart.split("<<");
  const surname = surnameRaw.replace(/</g, " ").trim();
  const givenNames = givenRaw.replace(/</g, " ").trim();

  const passportNumber = line2.slice(0, 9).replace(/</g, "").trim();
  const passportCheck = line2[9];
  const passportNumberValid = mrzCheckDigit(line2.slice(0, 9)) === Number(passportCheck);

  const nationality = line2.slice(10, 13);

  const dobRaw = line2.slice(13, 19);
  const dobCheck = line2[19];
  const dateOfBirth = parseMrzDate(dobRaw, false);
  const dateOfBirthValid = mrzCheckDigit(dobRaw) === Number(dobCheck);

  const sexChar = line2[20];
  const sex: "M" | "F" | "X" = sexChar === "F" ? "F" : sexChar === "M" ? "M" : "X";

  const expiryRaw = line2.slice(21, 27);
  const expiryCheck = line2[27];
  const expiryDate = parseMrzDate(expiryRaw, true);
  const expiryDateValid = mrzCheckDigit(expiryRaw) === Number(expiryCheck);

  const personalNumberRaw = line2.slice(28, 42);
  const personalCheckChar = line2[42];
  const personalNumber = personalNumberRaw.replace(/</g, "").trim() || null;
  const personalNumberValid =
    personalCheckChar === "<" ||
    mrzCheckDigit(personalNumberRaw) === Number(personalCheckChar);

  const compositeInput =
    line2.slice(0, 10) + line2.slice(13, 20) + line2.slice(21, 43);
  const compositeCheck = line2[43];
  const compositeValid = mrzCheckDigit(compositeInput) === Number(compositeCheck);

  // Lightweight sanity: alpha used for issuing/nationality must be in alphabet.
  for (const c of issuingCountry + nationality) {
    if (!ALPHA.includes(c)) {
      throw new MrzParseError(
        `MRZ contains illegal character ${JSON.stringify(c)} in country/nationality`,
      );
    }
  }

  return {
    documentType,
    issuingCountry,
    surname,
    givenNames,
    passportNumber,
    passportNumberValid,
    nationality,
    dateOfBirth,
    dateOfBirthValid,
    sex,
    expiryDate,
    expiryDateValid,
    personalNumber,
    personalNumberValid,
    compositeValid,
  };
}

/** Convenience for callers holding the raw MRZ text "line1\nline2". */
export function parseTd3Block(block: string): MrzFields {
  const lines = block
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) {
    throw new MrzParseError("MRZ block needs two non-empty lines");
  }
  return parseTd3(lines[0], lines[1]);
}
