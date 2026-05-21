import { parseTd3, parseTd3Block, type MrzFields } from "./mrz";

/**
 * Passport-scan extraction (DOC-002).
 *
 * Strategy:
 *   1. Run the OCR provider (Claude vision via the agent-backend
 *      `/api/passport-scan/extract` route, already wired). It returns
 *      the two MRZ lines + visual-zone fields with per-field
 *      confidence.
 *   2. If the MRZ check digits all validate → high-confidence fields
 *      from the deterministic parser; we trust them above the
 *      OCR-only visual-zone fields.
 *   3. Otherwise, fall back to the visual-zone fields and tag
 *      anything below `LOW_CONFIDENCE_THRESHOLD` for manual confirm.
 *
 * Provider choice: **Anthropic Claude vision** via the agent-backend
 * service. The repo already authenticates to Anthropic for the
 * Companion (DOC notes); reusing it avoids a fourth subprocessor.
 * Textract / Doc AI / Azure remain options if Claude vision misses
 * cropped or skewed MRZs in the wild — this module's contract
 * doesn't change.
 */

export const LOW_CONFIDENCE_THRESHOLD = 0.85;

export interface ExtractedField {
  value: string;
  confidence: number;
  source: "mrz" | "ocr";
  needsConfirm: boolean;
}

export interface ExtractedPassport {
  passportNumber: ExtractedField | null;
  surname: ExtractedField | null;
  givenNames: ExtractedField | null;
  nationality: ExtractedField | null;
  issuingCountry: ExtractedField | null;
  dateOfBirth: ExtractedField | null;
  expiryDate: ExtractedField | null;
  sex: ExtractedField | null;
  /** Raw block from the OCR — preserved for forensics. */
  rawMrz: string | null;
  /** Aggregate flag: any field at or below the threshold. */
  manualConfirmRequired: boolean;
}

export interface OcrPayload {
  /** Two-line raw MRZ string ("\n"-joined) when the provider read it. */
  mrz?: string | null;
  /** Visual-zone fields with per-field confidence. */
  fields?: {
    passportNumber?: { value: string; confidence: number };
    surname?: { value: string; confidence: number };
    givenNames?: { value: string; confidence: number };
    nationality?: { value: string; confidence: number };
    issuingCountry?: { value: string; confidence: number };
    dateOfBirth?: { value: string; confidence: number };
    expiryDate?: { value: string; confidence: number };
    sex?: { value: string; confidence: number };
  };
}

function fromMrz(mrz: MrzFields): ExtractedPassport {
  const f = (
    value: string,
    valid: boolean,
    source: "mrz" | "ocr" = "mrz",
  ): ExtractedField => ({
    value,
    confidence: valid ? 0.99 : 0.6,
    source,
    needsConfirm: !valid,
  });
  return {
    passportNumber: f(mrz.passportNumber, mrz.passportNumberValid),
    surname: { value: mrz.surname, confidence: 0.95, source: "mrz", needsConfirm: false },
    givenNames: { value: mrz.givenNames, confidence: 0.95, source: "mrz", needsConfirm: false },
    nationality: { value: mrz.nationality, confidence: 0.99, source: "mrz", needsConfirm: false },
    issuingCountry: { value: mrz.issuingCountry, confidence: 0.99, source: "mrz", needsConfirm: false },
    dateOfBirth: f(mrz.dateOfBirth, mrz.dateOfBirthValid),
    expiryDate: f(mrz.expiryDate, mrz.expiryDateValid),
    sex: { value: mrz.sex, confidence: 0.99, source: "mrz", needsConfirm: false },
    rawMrz: null,
    manualConfirmRequired:
      !mrz.passportNumberValid ||
      !mrz.dateOfBirthValid ||
      !mrz.expiryDateValid ||
      !mrz.compositeValid,
  };
}

function fromOcr(p: OcrPayload): ExtractedPassport {
  const wrap = (
    f?: { value: string; confidence: number },
  ): ExtractedField | null => {
    if (!f) return null;
    return {
      value: f.value,
      confidence: f.confidence,
      source: "ocr",
      needsConfirm: f.confidence < LOW_CONFIDENCE_THRESHOLD,
    };
  };
  const fields: Array<ExtractedField | null> = [];
  const out: ExtractedPassport = {
    passportNumber: wrap(p.fields?.passportNumber),
    surname: wrap(p.fields?.surname),
    givenNames: wrap(p.fields?.givenNames),
    nationality: wrap(p.fields?.nationality),
    issuingCountry: wrap(p.fields?.issuingCountry),
    dateOfBirth: wrap(p.fields?.dateOfBirth),
    expiryDate: wrap(p.fields?.expiryDate),
    sex: wrap(p.fields?.sex),
    rawMrz: p.mrz ?? null,
    manualConfirmRequired: false,
  };
  fields.push(
    out.passportNumber,
    out.surname,
    out.givenNames,
    out.nationality,
    out.issuingCountry,
    out.dateOfBirth,
    out.expiryDate,
    out.sex,
  );
  out.manualConfirmRequired = fields.some((f) => f && f.needsConfirm);
  return out;
}

/**
 * Synthesise extracted fields from an OCR payload.
 *
 * @param payload — what the OCR provider returned (Claude vision via
 *                  agent-backend in the live path).
 */
export function extractPassport(payload: OcrPayload): ExtractedPassport {
  if (payload.mrz) {
    try {
      const lines = payload.mrz.split(/\r?\n/).filter((l) => l.trim().length > 0);
      const mrz =
        lines.length >= 2 ? parseTd3(lines[0], lines[1]) : parseTd3Block(payload.mrz);
      const out = fromMrz(mrz);
      out.rawMrz = payload.mrz;
      // Layer in any visual-zone fields the MRZ doesn't carry (e.g. high-fidelity
      // surname diacritics from the visible side) without overwriting MRZ trust.
      const ocr = fromOcr(payload);
      if (ocr.surname && ocr.surname.confidence > 0.9 && out.surname) {
        out.surname = { ...ocr.surname, value: ocr.surname.value };
      }
      if (ocr.givenNames && ocr.givenNames.confidence > 0.9 && out.givenNames) {
        out.givenNames = { ...ocr.givenNames, value: ocr.givenNames.value };
      }
      return out;
    } catch (err) {
      // Fall through to OCR-only — MRZ parse failure shouldn't kill extraction.
      console.warn("[passport] MRZ parse failed, falling back to OCR:", err);
    }
  }
  return fromOcr(payload);
}

/** Mapping from extracted shape into the form-answer key set the runner consumes. */
export function toFormAnswers(p: ExtractedPassport): Record<string, string> {
  const out: Record<string, string> = {};
  if (p.passportNumber) out.passport_number = p.passportNumber.value;
  if (p.surname) out.surname = p.surname.value;
  if (p.givenNames) out.given_names = p.givenNames.value;
  if (p.nationality) out.nationality = p.nationality.value;
  if (p.issuingCountry) out.passport_issuing_country = p.issuingCountry.value;
  if (p.dateOfBirth) out.date_of_birth = p.dateOfBirth.value;
  if (p.expiryDate) out.passport_expiry_date = p.expiryDate.value;
  if (p.sex) out.sex = p.sex.value;
  return out;
}
