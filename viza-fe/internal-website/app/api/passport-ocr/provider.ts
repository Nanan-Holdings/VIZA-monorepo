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
  given_names: string | null;
  surname: string | null;
  passport_number: string | null;
  date_of_birth: string | null;
  nationality: string | null;
  issuing_country: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  gender: string | null;
}

type RawFieldConfidence = Record<keyof RawProviderFields, number | null>;

interface RawProviderOutput {
  is_readable: boolean;
  confidence: number;
  fields: RawProviderFields;
  field_confidence: RawFieldConfidence;
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

const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

const PASSPORT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["is_readable", "confidence", "fields", "field_confidence"],
  properties: {
    is_readable: { type: "boolean" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    fields: {
      type: "object",
      additionalProperties: false,
      required: [
        "full_name",
        "given_names",
        "surname",
        "passport_number",
        "date_of_birth",
        "nationality",
        "issuing_country",
        "issue_date",
        "expiry_date",
        "gender",
      ],
      properties: {
        full_name: { type: ["string", "null"] },
        given_names: { type: ["string", "null"] },
        surname: { type: ["string", "null"] },
        passport_number: { type: ["string", "null"] },
        date_of_birth: { type: ["string", "null"] },
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
        "given_names",
        "surname",
        "passport_number",
        "date_of_birth",
        "nationality",
        "issuing_country",
        "issue_date",
        "expiry_date",
        "gender",
      ],
      properties: {
        full_name: { type: ["number", "null"], minimum: 0, maximum: 1 },
        given_names: { type: ["number", "null"], minimum: 0, maximum: 1 },
        surname: { type: ["number", "null"], minimum: 0, maximum: 1 },
        passport_number: { type: ["number", "null"], minimum: 0, maximum: 1 },
        date_of_birth: { type: ["number", "null"], minimum: 0, maximum: 1 },
        nationality: { type: ["number", "null"], minimum: 0, maximum: 1 },
        issuing_country: { type: ["number", "null"], minimum: 0, maximum: 1 },
        issue_date: { type: ["number", "null"], minimum: 0, maximum: 1 },
        expiry_date: { type: ["number", "null"], minimum: 0, maximum: 1 },
        gender: { type: ["number", "null"], minimum: 0, maximum: 1 },
      },
    },
  },
} as const;

const EMPTY_FIELDS: PassportOcrProposedFields = {
  fullName: { value: null, confidence: null },
  givenNames: { value: null, confidence: null },
  surname: { value: null, confidence: null },
  passportNumber: { value: null, confidence: null },
  dateOfBirth: { value: null, confidence: null },
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

function normalizeFields(raw: RawProviderOutput): { fields: PassportOcrProposedFields; warnings: string[] } {
  const warnings: string[] = [];
  const fields = raw.fields;
  const confidence = raw.field_confidence;

  return {
    warnings,
    fields: {
      fullName: proposal(cleanText(fields.full_name), confidence.full_name),
      givenNames: proposal(cleanText(fields.given_names), confidence.given_names),
      surname: proposal(cleanText(fields.surname), confidence.surname),
      passportNumber: proposal(cleanPassportNumber(fields.passport_number), confidence.passport_number),
      dateOfBirth: proposal(normalizeDate(fields.date_of_birth, warnings, "date_of_birth"), confidence.date_of_birth),
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
      given_names: nullableString(value.fields.given_names),
      surname: nullableString(value.fields.surname),
      passport_number: nullableString(value.fields.passport_number),
      date_of_birth: nullableString(value.fields.date_of_birth),
      nationality: nullableString(value.fields.nationality),
      issuing_country: nullableString(value.fields.issuing_country),
      issue_date: nullableString(value.fields.issue_date),
      expiry_date: nullableString(value.fields.expiry_date),
      gender: nullableString(value.fields.gender),
    },
    field_confidence: {
      full_name: nullableConfidence(value.field_confidence.full_name),
      given_names: nullableConfidence(value.field_confidence.given_names),
      surname: nullableConfidence(value.field_confidence.surname),
      passport_number: nullableConfidence(value.field_confidence.passport_number),
      date_of_birth: nullableConfidence(value.field_confidence.date_of_birth),
      nationality: nullableConfidence(value.field_confidence.nationality),
      issuing_country: nullableConfidence(value.field_confidence.issuing_country),
      issue_date: nullableConfidence(value.field_confidence.issue_date),
      expiry_date: nullableConfidence(value.field_confidence.expiry_date),
      gender: nullableConfidence(value.field_confidence.gender),
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
            "surname, passport number, date of birth, nationality, issuing country, issue date, expiry date, " +
            "and gender if available. This data will not be written until the applicant confirms it. " +
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
  return Array.from(new Set([configuredModel || DEFAULT_OPENAI_MODEL, ...fallbackModels, DEFAULT_OPENAI_MODEL]));
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
