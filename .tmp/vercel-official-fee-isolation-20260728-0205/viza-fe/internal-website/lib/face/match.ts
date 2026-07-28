/**
 * Face-match (DOCUP-004) — provider-agnostic facade.
 *
 * MVP supports providers picked via FACE_MATCH_PROVIDER:
 *   - 'aws-rekognition' — AWS Rekognition CompareFaces
 *   - 'face-api'        — face-api.js running locally (heavy native dep,
 *                         lazy-loaded only when selected)
 *   - 'openai_vision'   — OpenAI vision comparison with structured JSON
 *   - 'mock'            — deterministic 0.92 score (CI / staging default)
 *
 * Returns a normalized score in [0..1]. Callers decide the threshold.
 */

export type FaceMatchProvider = "aws-rekognition" | "face-api" | "openai_vision" | "mock";

export interface FaceMatchResult {
  /** Similarity 0..1 (1 = identical face). */
  score: number;
  provider: FaceMatchProvider;
  /** Provider-side raw payload for forensic logging. */
  raw?: unknown;
}

interface RekognitionShape {
  RekognitionClient: new (cfg: Record<string, unknown>) => {
    send(cmd: unknown): Promise<{ FaceMatches?: Array<{ Similarity?: number }> }>;
  };
  CompareFacesCommand: new (input: Record<string, unknown>) => unknown;
}

interface FaceApiShape {
  computeSimilarity(a: Buffer, b: Buffer): Promise<number>;
}

type OpenAIContentPart =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string; detail: "high" };

interface OpenAIMessageInput {
  role: "system" | "user";
  content: OpenAIContentPart[];
}

interface OpenAIFaceMatchRaw {
  face_detected_in_passport: boolean;
  face_detected_in_portrait: boolean;
  same_person_probability: number;
  reason: string;
}

const OPENAI_FACE_MATCH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "face_detected_in_passport",
    "face_detected_in_portrait",
    "same_person_probability",
    "reason",
  ],
  properties: {
    face_detected_in_passport: { type: "boolean" },
    face_detected_in_portrait: { type: "boolean" },
    same_person_probability: { type: "number", minimum: 0, maximum: 1 },
    reason: { type: "string" },
  },
} as const;

let cachedRek: RekognitionShape | null = null;
let cachedFaceApi: FaceApiShape | null = null;

// Hide the specifier from tsc's module resolver — these are optional
// runtime deps installed only when their provider is selected.
const dynamicRequire: (specifier: string) => Promise<unknown> = (specifier) =>
  new Function("specifier", "return import(specifier)")(specifier) as Promise<unknown>;

async function loadRekognition(): Promise<RekognitionShape> {
  if (cachedRek) return cachedRek;
  cachedRek = (await dynamicRequire("@aws-sdk/client-rekognition")) as RekognitionShape;
  return cachedRek;
}

async function loadFaceApi(): Promise<FaceApiShape> {
  if (cachedFaceApi) return cachedFaceApi;
  cachedFaceApi = (await dynamicRequire("./face-api-runtime")) as FaceApiShape;
  return cachedFaceApi;
}

function readProvider(): FaceMatchProvider {
  const raw = (process.env.FACE_MATCH_PROVIDER || "mock").toLowerCase().replace(/-/g, "_");
  if (raw === "aws_rekognition") return "aws-rekognition";
  if (raw === "face_api") return "face-api";
  if (raw === "openai" || raw === "openai_vision") return "openai_vision";
  if (raw === "mock") return raw;
  return "mock";
}

function detectImageMime(bytes: Buffer): string {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }
  return "image/jpeg";
}

function buildImagePart(bytes: Buffer): OpenAIContentPart {
  return {
    type: "input_image",
    image_url: `data:${detectImageMime(bytes)};base64,${bytes.toString("base64")}`,
    detail: "high",
  };
}

function extractOutputText(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as { output_text?: unknown; output?: unknown };
  if (typeof record.output_text === "string") return record.output_text;
  if (!Array.isArray(record.output)) return null;
  for (const item of record.output) {
    if (typeof item !== "object" || item === null) continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (typeof part === "object" && part !== null && typeof (part as { text?: unknown }).text === "string") {
        return (part as { text: string }).text;
      }
    }
  }
  return null;
}

function parseOpenAIFaceMatchRaw(text: string): OpenAIFaceMatchRaw {
  const parsed: unknown = JSON.parse(text);
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("OpenAI face match returned a non-object response");
  }
  const record = parsed as Partial<OpenAIFaceMatchRaw>;
  return {
    face_detected_in_passport: record.face_detected_in_passport === true,
    face_detected_in_portrait: record.face_detected_in_portrait === true,
    same_person_probability:
      typeof record.same_person_probability === "number" && Number.isFinite(record.same_person_probability)
        ? Math.max(0, Math.min(1, record.same_person_probability))
        : 0,
    reason: typeof record.reason === "string" ? record.reason : "No reason returned",
  };
}

function buildOpenAIFaceMatchInput(passportImg: Buffer, applicantImg: Buffer): OpenAIMessageInput[] {
  return [
    {
      role: "system",
      content: [
        {
          type: "input_text",
          text:
            "You compare a face visible on a passport data page with a portrait photo for a Vietnam e-Visa upload gate. " +
            "Return JSON only. If either image does not contain a visible human face, mark that face_detected flag false and use probability 0. " +
            "Do not identify the person; only estimate whether the two visible faces appear to be the same applicant.",
        },
      ],
    },
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text:
            "Image 1 is the passport data page. Image 2 is the portrait photo. " +
            "Return same_person_probability from 0 to 1 plus both face detection flags.",
        },
        buildImagePart(passportImg),
        buildImagePart(applicantImg),
      ],
    },
  ];
}

async function compareFacesWithOpenAI(passportImg: Buffer, applicantImg: Buffer): Promise<FaceMatchResult> {
  const apiKey = process.env.FACE_MATCH_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === "your_openai_api_key_here") {
    throw new Error("OpenAI face match is not configured");
  }

  const model = process.env.FACE_MATCH_OPENAI_MODEL?.trim() || "gpt-4.1-mini";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: buildOpenAIFaceMatchInput(passportImg, applicantImg),
      max_output_tokens: 500,
      text: {
        format: {
          type: "json_schema",
          name: "face_match_result",
          strict: true,
          schema: OPENAI_FACE_MATCH_SCHEMA,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI face match failed with HTTP ${response.status}`);
  }

  const responseBody: unknown = await response.json();
  const outputText = extractOutputText(responseBody);
  if (!outputText) throw new Error("OpenAI face match returned no output text");

  const raw = parseOpenAIFaceMatchRaw(outputText);
  const score =
    raw.face_detected_in_passport && raw.face_detected_in_portrait
      ? raw.same_person_probability
      : 0;

  return { score, provider: "openai_vision", raw };
}

export async function compareFaces(
  passportImg: Buffer,
  applicantImg: Buffer,
): Promise<FaceMatchResult> {
  const provider = readProvider();
  if (provider === "mock") {
    return { score: 0.92, provider, raw: { reason: "mock provider — deterministic" } };
  }
  if (provider === "aws-rekognition") {
    const rek = await loadRekognition();
    const client = new rek.RekognitionClient({
      region: process.env.AWS_REGION || "us-east-1",
    });
    const cmd = new rek.CompareFacesCommand({
      SimilarityThreshold: 0,
      SourceImage: { Bytes: passportImg },
      TargetImage: { Bytes: applicantImg },
    });
    const out = await client.send(cmd);
    const top = out.FaceMatches?.[0]?.Similarity ?? 0;
    return { score: Math.max(0, Math.min(1, top / 100)), provider, raw: out };
  }
  if (provider === "face-api") {
    const faceApi = await loadFaceApi();
    const sim = await faceApi.computeSimilarity(passportImg, applicantImg);
    return { score: Math.max(0, Math.min(1, sim)), provider };
  }
  if (provider === "openai_vision") {
    return compareFacesWithOpenAI(passportImg, applicantImg);
  }
  return { score: 0, provider: "mock" };
}

export const DEFAULT_FACE_MATCH_THRESHOLD = 0.85;

export type FaceMatchDecision = "auto_approve" | "staff_review" | "reject";

export function decideFromScore(score: number, threshold: number = DEFAULT_FACE_MATCH_THRESHOLD): FaceMatchDecision {
  if (score >= threshold) return "auto_approve";
  if (score >= threshold * 0.7) return "staff_review";
  return "reject";
}
