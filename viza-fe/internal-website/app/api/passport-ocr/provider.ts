import "server-only";

import type {
  PassportOcrFieldProposal,
  PassportOcrFile,
  PassportOcrProposedFields,
  PassportOcrProviderResult,
  SupportedPassportMimeType,
} from "./types";

type OpenAIContentPart =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string; detail: "high" }
  | { type: "input_file"; filename: string; file_data: string };

interface OpenAIMessageInput {
  role: "system" | "user";
  content: OpenAIContentPart[];
}

interface OpenAIExtractionOptions {
  unreadableRetry?: boolean;
}

interface RawProviderFields {
  full_name: string | null;
  native_full_name: string | null;
  given_names: string | null;
  surname: string | null;
  passport_number: string | null;
  date_of_birth: string | null;
  place_of_birth: string | null;
  nationality: string | null;
  issuing_country: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  gender: string | null;
}

type RawFieldConfidence = Record<keyof RawProviderFields, number | null>;

interface RawProviderMrz {
  line1: string | null;
  line2: string | null;
}

interface RawProviderOutput {
  is_readable: boolean;
  confidence: number;
  fields: RawProviderFields;
  field_confidence: RawFieldConfidence;
  mrz: RawProviderMrz;
}

interface OpenAIErrorBody {
  error?: {
    type?: string;
    code?: string | null;
    message?: string;
  };
}

export class PassportOcrProviderError extends Error {
  constructor(
    public readonly code: "provider_unavailable" | "unreadable" | "provider_failed",
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "PassportOcrProviderError";
  }
}

const DEFAULT_OPENAI_MODEL = "gpt-4o";
const DEFAULT_OPENAI_FALLBACK_MODELS = ["gpt-4o-mini"];

const PASSPORT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["is_readable", "confidence", "fields", "field_confidence", "mrz"],
  properties: {
    is_readable: { type: "boolean" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    fields: {
      type: "object",
      additionalProperties: false,
      required: [
        "full_name",
        "native_full_name",
        "given_names",
        "surname",
        "passport_number",
        "date_of_birth",
        "place_of_birth",
        "nationality",
        "issuing_country",
        "issue_date",
        "expiry_date",
        "gender",
      ],
      properties: {
        full_name: { type: ["string", "null"] },
        native_full_name: { type: ["string", "null"] },
        given_names: { type: ["string", "null"] },
        surname: { type: ["string", "null"] },
        passport_number: { type: ["string", "null"] },
        date_of_birth: { type: ["string", "null"] },
        place_of_birth: { type: ["string", "null"] },
        nationality: { type: ["string", "null"] },
        issuing_country: { type: ["string", "null"] },
        issue_date: { type: ["string", "null"] },
        expiry_date: { type: ["string", "null"] },
        gender: { type: ["string", "null"] },
      },
    },
    field_confidence: {
      type: "object",
      additionalProperties: false,
      required: [
        "full_name",
        "native_full_name",
        "given_names",
        "surname",
        "passport_number",
        "date_of_birth",
        "place_of_birth",
        "nationality",
        "issuing_country",
        "issue_date",
        "expiry_date",
        "gender",
      ],
      properties: {
        full_name: { type: ["number", "null"], minimum: 0, maximum: 1 },
        native_full_name: { type: ["number", "null"], minimum: 0, maximum: 1 },
        given_names: { type: ["number", "null"], minimum: 0, maximum: 1 },
        surname: { type: ["number", "null"], minimum: 0, maximum: 1 },
        passport_number: { type: ["number", "null"], minimum: 0, maximum: 1 },
        date_of_birth: { type: ["number", "null"], minimum: 0, maximum: 1 },
        place_of_birth: { type: ["number", "null"], minimum: 0, maximum: 1 },
        nationality: { type: ["number", "null"], minimum: 0, maximum: 1 },
        issuing_country: { type: ["number", "null"], minimum: 0, maximum: 1 },
        issue_date: { type: ["number", "null"], minimum: 0, maximum: 1 },
        expiry_date: { type: ["number", "null"], minimum: 0, maximum: 1 },
        gender: { type: ["number", "null"], minimum: 0, maximum: 1 },
      },
    },
    mrz: {
      type: "object",
      additionalProperties: false,
      required: ["line1", "line2"],
      properties: {
        line1: { type: ["string", "null"] },
        line2: { type: ["string", "null"] },
      },
    },
  },
} as const;

const EMPTY_FIELDS: PassportOcrProposedFields = {
  fullName: { value: null, confidence: null },
  nativeFullName: { value: null, confidence: null },
  givenNames: { value: null, confidence: null },
  surname: { value: null, confidence: null },
  passportNumber: { value: null, confidence: null },
  dateOfBirth: { value: null, confidence: null },
  placeOfBirth: { value: null, confidence: null },
  nationality: { value: null, confidence: null },
  issuingCountry: { value: null, confidence: null },
  issueDate: { value: null, confidence: null },
  expiryDate: { value: null, confidence: null },
  gender: { value: null, confidence: null },
};

function clampConfidence(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function proposal(value: string | null, confidence: number | null): PassportOcrFieldProposal {
  return {
    value,
    confidence: confidence === null ? null : clampConfidence(confidence),
  };
}

function cleanText(value: string | null): string | null {
  const trimmed = value?.replace(/\s+/g, " ").trim();
  return trimmed ? trimmed : null;
}

function cleanPassportNumber(value: string | null): string | null {
  const trimmed = value?.replace(/\s+/g, "").trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function normalizeDate(value: string | null, warnings: string[], fieldName: string): string | null {
  const trimmed = cleanText(value);
  if (!trimmed) return null;

  if (isValidIsoDate(trimmed)) return trimmed;

  const numeric = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (numeric) {
    const [, rawDay, rawMonth, rawYear] = numeric;
    const day = rawDay.padStart(2, "0");
    const month = rawMonth.padStart(2, "0");
    const normalized = `${rawYear}-${month}-${day}`;
    if (isValidIsoDate(normalized)) return normalized;
  }

  const parsed = Date.parse(trimmed);
  if (!Number.isNaN(parsed) && /[A-Za-z]/.test(trimmed)) {
    const date = new Date(parsed);
    const normalized = [
      date.getUTCFullYear(),
      String(date.getUTCMonth() + 1).padStart(2, "0"),
      String(date.getUTCDate()).padStart(2, "0"),
    ].join("-");
    if (isValidIsoDate(normalized)) return normalized;
  }

  warnings.push(`${fieldName}_date_not_normalized`);
  return null;
}

function normalizeGender(value: string | null): string | null {
  const normalized = cleanText(value)?.toLowerCase();
  if (!normalized) return null;
  if (["m", "male"].includes(normalized)) return "M";
  if (["f", "female"].includes(normalized)) return "F";
  if (["x", "other", "unspecified"].includes(normalized)) return "X";
  return null;
}

function normalizeMrzLine(value: string | null): string | null {
  const normalized = cleanText(value)
    ?.toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z<]/g, "");
  return normalized || null;
}

function normalizeMrzDataLine(value: string | null): string | null {
  const normalized = cleanText(value)
    ?.toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9<]/g, "");
  return normalized || null;
}

function parseMrzName(line1: string | null): Pick<RawProviderFields, "full_name" | "given_names" | "surname"> | null {
  const normalized = normalizeMrzLine(line1);
  if (!normalized || !normalized.includes("<<")) return null;

  const namePart = normalized.length >= 5 ? normalized.slice(5) : normalized;
  const separatorIndex = namePart.indexOf("<<");
  if (separatorIndex <= 0) return null;

  const surname = cleanText(namePart.slice(0, separatorIndex).replace(/</g, " "));
  const givenNames = cleanText(namePart.slice(separatorIndex + 2).replace(/</g, " "));
  if (!surname && !givenNames) return null;

  return {
    full_name: cleanText([givenNames, surname].filter(Boolean).join(" ")),
    given_names: givenNames,
    surname,
  };
}

function normalizeMrzDate(value: string, kind: "birth" | "expiry"): string | null {
  if (!/^\d{6}$/.test(value)) return null;
  const yy = Number(value.slice(0, 2));
  const month = Number(value.slice(2, 4));
  const day = Number(value.slice(4, 6));
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentYY = currentYear % 100;
  let year = kind === "birth" && yy <= currentYY ? 2000 + yy : 1900 + yy;
  if (kind === "expiry") {
    year = yy < currentYY - 10 ? 2100 + yy : 2000 + yy;
  }

  const normalized = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return isValidIsoDate(normalized) ? normalized : null;
}

function parseMrzLine2(line2: string | null): Partial<RawProviderFields> | null {
  const normalized = normalizeMrzDataLine(line2);
  if (!normalized || normalized.length < 27) return null;

  const passportNumber = cleanPassportNumber(normalized.slice(0, 9).replace(/</g, ""));
  const nationality = cleanText(normalized.slice(10, 13).replace(/</g, ""));
  const dateOfBirth = normalizeMrzDate(normalized.slice(13, 19), "birth");
  const gender = normalizeGender(normalized.slice(20, 21));
  const expiryDate = normalizeMrzDate(normalized.slice(21, 27), "expiry");

  return {
    passport_number: passportNumber,
    nationality,
    date_of_birth: dateOfBirth,
    gender,
    expiry_date: expiryDate,
  };
}

function containsCjk(value: string | null): boolean {
  return /[\u3400-\u9fff]/.test(value ?? "");
}

function preferMrzLatinName(raw: RawProviderOutput, warnings: string[]) {
  const mrzName = parseMrzName(raw.mrz.line1);
  if (!mrzName) return raw.fields;

  if (
    containsCjk(raw.fields.full_name) ||
    containsCjk(raw.fields.given_names) ||
    containsCjk(raw.fields.surname)
  ) {
    warnings.push("name_latinized_from_mrz");
  }

  return {
    ...raw.fields,
    full_name: mrzName.full_name ?? raw.fields.full_name,
    given_names: mrzName.given_names ?? raw.fields.given_names,
    surname: mrzName.surname ?? raw.fields.surname,
  };
}

function repairLatinNameParts(fields: RawProviderFields, warnings: string[]): RawProviderFields {
  const fullName = cleanText(fields.full_name);
  const givenNames = cleanText(fields.given_names);
  const surname = cleanText(fields.surname);
  if (!fullName || !givenNames || !surname) return fields;
  if (containsCjk(fullName) || containsCjk(givenNames) || containsCjk(surname)) return fields;

  const expectedFullName = cleanText([givenNames, surname].join(" "));
  const fullNameHasMrzNoise =
    /\d/.test(fullName) ||
    fullName.includes("<<") ||
    fullName.includes("CHN") ||
    Boolean(fields.passport_number && fullName.includes(fields.passport_number.slice(0, 2)));

  if (expectedFullName && fullNameHasMrzNoise) {
    warnings.push("full_name_repaired_from_name_parts");
    return {
      ...fields,
      full_name: expectedFullName,
    };
  }

  if (surname !== fullName) return fields;
  const prefix = `${givenNames} `;
  const suffix = ` ${givenNames}`;
  let repairedSurname: string | null = null;

  if (fullName.startsWith(prefix)) {
    repairedSurname = cleanText(fullName.slice(prefix.length));
  } else if (fullName.endsWith(suffix)) {
    repairedSurname = cleanText(fullName.slice(0, -suffix.length));
  }

  if (!repairedSurname) return fields;

  warnings.push("surname_repaired_from_full_name");
  return {
    ...fields,
    surname: repairedSurname,
  };
}

function preferMrzLine2Fields(raw: RawProviderOutput, fields: RawProviderFields, warnings: string[]): RawProviderFields {
  const mrzFields = parseMrzLine2(raw.mrz.line2);
  if (!mrzFields) return fields;

  const merged = {
    ...fields,
    passport_number: mrzFields.passport_number ?? fields.passport_number,
    nationality: mrzFields.nationality ?? fields.nationality,
    date_of_birth: mrzFields.date_of_birth ?? fields.date_of_birth,
    gender: mrzFields.gender ?? fields.gender,
    expiry_date: mrzFields.expiry_date ?? fields.expiry_date,
  };

  warnings.push("fields_verified_from_mrz");
  return merged;
}

function normalizeFields(raw: RawProviderOutput): { fields: PassportOcrProposedFields; warnings: string[] } {
  const warnings: string[] = [];
  const fields = repairLatinNameParts(
    preferMrzLine2Fields(raw, preferMrzLatinName(raw, warnings), warnings),
    warnings,
  );
  const confidence = raw.field_confidence;

  return {
    warnings,
    fields: {
      fullName: proposal(cleanText(fields.full_name), confidence.full_name),
      nativeFullName: proposal(cleanText(fields.native_full_name), confidence.native_full_name),
      givenNames: proposal(cleanText(fields.given_names), confidence.given_names),
      surname: proposal(cleanText(fields.surname), confidence.surname),
      passportNumber: proposal(cleanPassportNumber(fields.passport_number), confidence.passport_number),
      dateOfBirth: proposal(normalizeDate(fields.date_of_birth, warnings, "date_of_birth"), confidence.date_of_birth),
      placeOfBirth: proposal(cleanText(fields.place_of_birth), confidence.place_of_birth),
      nationality: proposal(cleanText(fields.nationality), confidence.nationality),
      issuingCountry: proposal(cleanText(fields.issuing_country), confidence.issuing_country),
      issueDate: proposal(normalizeDate(fields.issue_date, warnings, "issue_date"), confidence.issue_date),
      expiryDate: proposal(normalizeDate(fields.expiry_date, warnings, "expiry_date"), confidence.expiry_date),
      gender: proposal(normalizeGender(fields.gender), confidence.gender),
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function nullableConfidence(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? clampConfidence(value) : null;
}

function parseRawProviderOutput(value: unknown): RawProviderOutput | null {
  if (!isRecord(value) || !isRecord(value.fields) || !isRecord(value.field_confidence)) return null;
  if (typeof value.is_readable !== "boolean") return null;

  return {
    is_readable: value.is_readable,
    confidence: clampConfidence(value.confidence),
    fields: {
      full_name: nullableString(value.fields.full_name),
      native_full_name: nullableString(value.fields.native_full_name),
      given_names: nullableString(value.fields.given_names),
      surname: nullableString(value.fields.surname),
      passport_number: nullableString(value.fields.passport_number),
      date_of_birth: nullableString(value.fields.date_of_birth),
      place_of_birth: nullableString(value.fields.place_of_birth),
      nationality: nullableString(value.fields.nationality),
      issuing_country: nullableString(value.fields.issuing_country),
      issue_date: nullableString(value.fields.issue_date),
      expiry_date: nullableString(value.fields.expiry_date),
      gender: nullableString(value.fields.gender),
    },
    field_confidence: {
      full_name: nullableConfidence(value.field_confidence.full_name),
      native_full_name: nullableConfidence(value.field_confidence.native_full_name),
      given_names: nullableConfidence(value.field_confidence.given_names),
      surname: nullableConfidence(value.field_confidence.surname),
      passport_number: nullableConfidence(value.field_confidence.passport_number),
      date_of_birth: nullableConfidence(value.field_confidence.date_of_birth),
      place_of_birth: nullableConfidence(value.field_confidence.place_of_birth),
      nationality: nullableConfidence(value.field_confidence.nationality),
      issuing_country: nullableConfidence(value.field_confidence.issuing_country),
      issue_date: nullableConfidence(value.field_confidence.issue_date),
      expiry_date: nullableConfidence(value.field_confidence.expiry_date),
      gender: nullableConfidence(value.field_confidence.gender),
    },
    mrz: {
      line1: isRecord(value.mrz) ? nullableString(value.mrz.line1) : null,
      line2: isRecord(value.mrz) ? nullableString(value.mrz.line2) : null,
    },
  };
}

function extractOutputText(value: unknown): string | null {
  if (!isRecord(value)) return null;
  if (typeof value.output_text === "string") return value.output_text;

  const output = Array.isArray(value.output) ? value.output : [];
  for (const item of output) {
    if (!isRecord(item)) continue;
    const content = Array.isArray(item.content) ? item.content : [];
    for (const part of content) {
      if (!isRecord(part)) continue;
      if (typeof part.text === "string") return part.text;
    }
  }

  return null;
}

function buildFilePart(file: PassportOcrFile): OpenAIContentPart {
  const base64 = file.bytes.toString("base64");
  if (file.mimeType === "application/pdf") {
    return {
      type: "input_file",
      filename: file.filename,
      file_data: `data:${file.mimeType};base64,${base64}`,
    };
  }

  return {
    type: "input_image",
    image_url: `data:${file.mimeType};base64,${base64}`,
    detail: "high",
  };
}

function buildOpenAIInput(file: PassportOcrFile, options: OpenAIExtractionOptions = {}): OpenAIMessageInput[] {
  const retryText = options.unreadableRetry
    ? "The passport page may be sideways, upside down, photographed at an angle, or embedded inside a PDF page. Rotate it mentally as needed. If the passport bio page, visual inspection zone, or MRZ is visible enough to read any requested fields, set is_readable to true and return null only for fields that remain uncertain. Set is_readable to false only when no passport bio page is visible or all requested fields are genuinely illegible."
    : "";

  return [
    {
      role: "system",
      content: [
        {
          type: "input_text",
          text:
            "Extract only visible passport bio page fields. Return null for missing or uncertain fields. " +
            "Do not infer values that are not visible. Dates must be YYYY-MM-DD when possible. " +
            "For full_name, given_names, and surname, return the Latin alphabet/romanized passport name from the visual inspection zone or MRZ; never return local-script names such as Chinese characters in those Latin fields. " +
            "For native_full_name, return the visible local-script/native name exactly as printed, such as Chinese characters, when present; otherwise return null. " +
            "For passports with MRZ, copy both MRZ lines exactly into mrz.line1 and mrz.line2 before normalizing any fields. " +
            "Sideways or rotated passport photos should still be read when the printed fields or MRZ are visible.",
        },
      ],
    },
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text:
            "Read this passport document for a confirmation workflow. Extract proposed full name, given names, " +
            "native full name/local-script name, surname, passport number, date of birth, place of birth, nationality, issuing country, issue date, expiry date, " +
            "gender, and MRZ lines if available. Latin name fields must use the Latin/MRZ spelling, and native_full_name must preserve the local-script name if visible. " +
            "This data will not be written until the applicant confirms it. " +
            retryText,
        },
        buildFilePart(file),
      ],
    },
  ];
}

function splitModelList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
}

function getOpenAIModelCandidates(): string[] {
  const configuredModel = process.env.PASSPORT_OCR_OPENAI_MODEL?.trim();
  const fallbackModels = splitModelList(process.env.PASSPORT_OCR_OPENAI_FALLBACK_MODELS);
  return Array.from(
    new Set([
      configuredModel || DEFAULT_OPENAI_MODEL,
      configuredModel ? DEFAULT_OPENAI_MODEL : null,
      ...fallbackModels,
      ...DEFAULT_OPENAI_FALLBACK_MODELS,
    ].filter((model): model is string => Boolean(model))),
  );
}

async function parseOpenAIErrorBody(response: Response): Promise<OpenAIErrorBody | null> {
  try {
    const body: unknown = await response.json();
    return isRecord(body) ? (body as OpenAIErrorBody) : null;
  } catch {
    return null;
  }
}

function isOpenAIModelAccessError(response: Response, body: OpenAIErrorBody | null): boolean {
  const code = body?.error?.code ?? "";
  const message = body?.error?.message?.toLowerCase() ?? "";
  return (
    code === "model_not_found" ||
    ((response.status === 400 || response.status === 403 || response.status === 404) &&
      message.includes("model"))
  );
}

function isOpenAIConfigurationError(response: Response, body: OpenAIErrorBody | null): boolean {
  const code = body?.error?.code ?? "";
  const message = body?.error?.message?.toLowerCase() ?? "";
  return (
    response.status === 401 ||
    response.status === 402 ||
    code === "invalid_api_key" ||
    code === "insufficient_quota" ||
    message.includes("api key") ||
    message.includes("credit") ||
    message.includes("quota") ||
    message.includes("billing")
  );
}

async function extractWithOpenAI(file: PassportOcrFile): Promise<PassportOcrProviderResult> {
  const apiKey = process.env.PASSPORT_OCR_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === "your_openai_api_key_here") {
    throw new PassportOcrProviderError(
      "provider_unavailable",
      "Passport OCR is not configured yet.",
      false,
    );
  }

  const modelCandidates = getOpenAIModelCandidates();
  let unreadableResult: PassportOcrProviderResult | null = null;
  for (let index = 0; index < modelCandidates.length; index += 1) {
    const model = modelCandidates[index];
    for (const unreadableRetry of [false, true]) {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          input: buildOpenAIInput(file, { unreadableRetry }),
          max_output_tokens: 900,
          text: {
            format: {
              type: "json_schema",
              name: "passport_ocr_fields",
              strict: true,
              schema: PASSPORT_SCHEMA,
            },
          },
        }),
      });

      if (!response.ok) {
        const errorBody = await parseOpenAIErrorBody(response);
        const isModelError = isOpenAIModelAccessError(response, errorBody);
        if (isModelError && index < modelCandidates.length - 1) break;

        if (isOpenAIConfigurationError(response, errorBody)) {
          throw new PassportOcrProviderError(
            "provider_unavailable",
            "Passport OCR provider credentials or billing are not available.",
            false,
          );
        }

        const retryable = response.status === 429 || response.status >= 500;
        throw new PassportOcrProviderError(
          retryable || isModelError ? "provider_unavailable" : "provider_failed",
          isModelError
            ? "Passport OCR model is not available in this environment."
            : retryable
              ? "Passport OCR provider is temporarily unavailable."
              : "Passport OCR provider rejected the request.",
          retryable,
        );
      }

      const responseBody: unknown = await response.json();
      const outputText = extractOutputText(responseBody);
      if (!outputText) {
        throw new PassportOcrProviderError("unreadable", "The passport could not be read.", false);
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(outputText);
      } catch {
        throw new PassportOcrProviderError("unreadable", "The passport could not be read.", false);
      }

      const raw = parseRawProviderOutput(parsedJson);
      if (!raw || !raw.is_readable) {
        unreadableResult = {
          provider: "openai_vision",
          confidence: raw?.confidence ?? 0,
          isReadable: false,
          fields: EMPTY_FIELDS,
          warnings: ["document_unreadable"],
        };
        continue;
      }

      const normalized = normalizeFields(raw);
      return {
        provider: "openai_vision",
        confidence: raw.confidence,
        isReadable: true,
        fields: normalized.fields,
        warnings: normalized.warnings,
      };
    }
  }

  if (unreadableResult) return unreadableResult;

  throw new PassportOcrProviderError(
    "provider_unavailable",
    "Passport OCR model is not available in this environment.",
    false,
  );
}

export function getPassportOcrProviderName(): string {
  return process.env.PASSPORT_OCR_PROVIDER ?? "openai_vision";
}

export async function extractPassportOcr(file: PassportOcrFile): Promise<PassportOcrProviderResult> {
  const provider = getPassportOcrProviderName();

  if (provider === "openai_vision") {
    return extractWithOpenAI(file);
  }

  if (provider === "disabled") {
    throw new PassportOcrProviderError(
      "provider_unavailable",
      "Passport OCR is disabled for this environment.",
      false,
    );
  }

  throw new PassportOcrProviderError(
    "provider_unavailable",
    "Configured passport OCR provider is not supported by this deployment.",
    false,
  );
}

export function isSupportedPassportMimeType(value: string): value is SupportedPassportMimeType {
  return (
    value === "application/pdf" ||
    value === "image/jpeg" ||
    value === "image/png" ||
    value === "image/webp"
  );
}
