/**
 * Face-match (DOCUP-004) — provider-agnostic facade.
 *
 * MVP supports three providers, picked via FACE_MATCH_PROVIDER:
 *   - 'aws-rekognition' — AWS Rekognition CompareFaces
 *   - 'face-api'        — face-api.js running locally (heavy native dep,
 *                         lazy-loaded only when selected)
 *   - 'mock'            — deterministic 0.92 score (CI / staging default)
 *
 * Returns a normalized score in [0..1]. Callers decide the threshold.
 */

export type FaceMatchProvider = "aws-rekognition" | "face-api" | "mock";

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

let cachedRek: RekognitionShape | null = null;
let cachedFaceApi: FaceApiShape | null = null;

// Hide the specifier from tsc's module resolver — these are optional
// runtime deps installed only when their provider is selected.
const dynamicRequire: (specifier: string) => Promise<unknown> = (specifier) =>
  // eslint-disable-next-line no-new-func
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
  const raw = (process.env.FACE_MATCH_PROVIDER || "mock").toLowerCase();
  if (raw === "aws-rekognition" || raw === "face-api" || raw === "mock") return raw;
  return "mock";
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
  return { score: 0, provider: "mock" };
}

export const DEFAULT_FACE_MATCH_THRESHOLD = 0.85;

export type FaceMatchDecision = "auto_approve" | "staff_review" | "reject";

export function decideFromScore(score: number, threshold: number = DEFAULT_FACE_MATCH_THRESHOLD): FaceMatchDecision {
  if (score >= threshold) return "auto_approve";
  if (score >= threshold * 0.7) return "staff_review";
  return "reject";
}
