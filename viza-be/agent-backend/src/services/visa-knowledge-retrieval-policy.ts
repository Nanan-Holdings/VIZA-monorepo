// Retained baseline, not a claimed optimum. All three dated experiment winners
// failed independent recall gates; see evals/README.md before changing defaults.
export const DEFAULT_VISA_KNOWLEDGE_MATCH_COUNT = 5;
export const DEFAULT_VISA_KNOWLEDGE_MIN_SIMILARITY = 0.03;

const MIN_MATCH_COUNT = 1;
const MAX_MATCH_COUNT = 12;
const MIN_SIMILARITY = 0;
const MAX_SIMILARITY = 1;

export interface VisaKnowledgeRetrievalPolicy {
  matchCount: number;
  minSimilarity: number;
}

export interface VisaKnowledgeRetrievalOverrides {
  matchCount?: unknown;
  minSimilarity?: unknown;
}

function parseMatchCount(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isInteger(value) && value >= MIN_MATCH_COUNT && value <= MAX_MATCH_COUNT
      ? value
      : null;
  }

  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= MIN_MATCH_COUNT && parsed <= MAX_MATCH_COUNT
    ? parsed
    : null;
}

function parseMinSimilarity(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= MIN_SIMILARITY && value <= MAX_SIMILARITY
      ? value
      : null;
  }

  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= MIN_SIMILARITY && parsed <= MAX_SIMILARITY
    ? parsed
    : null;
}

function envValue(name: string): string | undefined {
  const value = process.env[name];
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

export function resolveVisaKnowledgeRetrievalPolicy(
  overrides: VisaKnowledgeRetrievalOverrides = {},
): VisaKnowledgeRetrievalPolicy {
  const envMatchCount = parseMatchCount(envValue("VISA_RAG_MATCH_COUNT"));
  const envMinSimilarity = parseMinSimilarity(envValue("VISA_RAG_MIN_SIMILARITY"));

  return {
    matchCount:
      parseMatchCount(overrides.matchCount) ??
      envMatchCount ??
      DEFAULT_VISA_KNOWLEDGE_MATCH_COUNT,
    minSimilarity:
      parseMinSimilarity(overrides.minSimilarity) ??
      envMinSimilarity ??
      DEFAULT_VISA_KNOWLEDGE_MIN_SIMILARITY,
  };
}
