import { getSupabaseClient } from "../db/supabase-client.js";
import { Logger } from "../utils/logger.js";

const logger = new Logger({ serviceName: "VisaKnowledgeService" });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const EMBEDDING_MODEL = "text-embedding-3-small";
const DEFAULT_MATCH_COUNT = 5;
const DEFAULT_MIN_SIMILARITY = 0.03;

export type VisaKnowledgeIntent =
  | "route_recommendation"
  | "requirements"
  | "form_intake"
  | "fees_timing"
  | "eligibility"
  | "source_check";

export interface VisaKnowledgeQuery {
  query: string;
  country?: string | null;
  visaType?: string | null;
  intent?: VisaKnowledgeIntent;
  documentTypes?: string[];
  matchCount?: number;
  minSimilarity?: number;
}

export interface VisaKnowledgeChunk {
  id: string;
  content: string;
  country: string | null;
  visaType: string | null;
  documentType: string | null;
  title: string | null;
  sourceUrl: string | null;
  similarity: number | null;
}

export interface VisaKnowledgeResult {
  chunks: VisaKnowledgeChunk[];
  usedEmbedding: boolean;
  fallbackReason: string | null;
}

interface MatchVisaChunkRow {
  id?: unknown;
  content?: unknown;
  country?: unknown;
  visa_type?: unknown;
  document_type?: unknown;
  title?: unknown;
  source_url?: unknown;
  similarity?: unknown;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clampMatchCount(value: number | undefined): number {
  if (!value || !Number.isFinite(value)) return DEFAULT_MATCH_COUNT;
  return Math.min(Math.max(Math.trunc(value), 1), 12);
}

export function documentTypesForIntent(
  intent?: VisaKnowledgeIntent
): string[] | undefined {
  if (!intent) return undefined;
  const mapping: Record<VisaKnowledgeIntent, string[]> = {
    route_recommendation: ["requirements", "process"],
    requirements: ["requirements", "form_requirements"],
    form_intake: ["form_requirements", "requirements", "process"],
    fees_timing: ["requirements", "process"],
    eligibility: ["requirements"],
    source_check: ["requirements", "process", "form_requirements"],
  };
  return mapping[intent];
}

function withIntentDocumentTypes(query: VisaKnowledgeQuery): VisaKnowledgeQuery {
  if (query.documentTypes && query.documentTypes.length > 0) return query;
  const documentTypes = documentTypesForIntent(query.intent);
  return documentTypes ? { ...query, documentTypes } : query;
}

async function getEmbedding(text: string): Promise<number[] | null> {
  if (!OPENAI_API_KEY || OPENAI_API_KEY === "your_openai_api_key_here") {
    return null;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text.slice(0, 8000),
      }),
    });

    if (!response.ok) {
      logger.warn("Embedding request failed", undefined, {
        status: response.status,
      });
      return null;
    }

    const body = (await response.json()) as {
      data?: Array<{ embedding?: number[] }>;
    };

    return body.data?.[0]?.embedding ?? null;
  } catch (error) {
    logger.warn("Embedding request errored", error as Error);
    return null;
  }
}

function mapChunkRow(row: unknown): VisaKnowledgeChunk | null {
  const record = asRecord(row);
  if (!record) return null;

  const document = asRecord(record.visa_documents);
  const documentArray = Array.isArray(record.visa_documents)
    ? record.visa_documents.map(asRecord).find(Boolean) ?? null
    : null;
  const source = document ?? documentArray;
  const content = asString(record.content);

  if (!content) return null;

  return {
    id: asString(record.id) ?? "unknown",
    content,
    country: asString(record.country),
    visaType: asString(record.visa_type),
    documentType: asString(record.document_type),
    title: asString(record.title) ?? asString(source?.title),
    sourceUrl: asString(record.source_url) ?? asString(source?.source_url),
    similarity: asNumber(record.similarity),
  };
}

function mapRpcChunkRow(row: MatchVisaChunkRow): VisaKnowledgeChunk | null {
  return mapChunkRow(row);
}

async function retrieveWithVectorSearch(
  query: VisaKnowledgeQuery,
  embedding: number[],
  matchCount: number,
  minSimilarity: number
): Promise<VisaKnowledgeChunk[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("match_visa_chunks", {
    query_embedding: embedding,
    match_count: matchCount,
    filter_country: query.country ?? null,
    filter_visa_type: query.visaType ?? null,
    filter_document_types:
      query.documentTypes && query.documentTypes.length > 0
        ? query.documentTypes
        : null,
    min_similarity: minSimilarity,
  });

  if (error) {
    throw new Error(error.message);
  }

  const rows: unknown[] = Array.isArray(data) ? data : [];
  return rows
    .map((row) => mapRpcChunkRow(row as MatchVisaChunkRow))
    .filter((chunk): chunk is VisaKnowledgeChunk => chunk !== null);
}

async function retrieveWithFilteredFallback(
  query: VisaKnowledgeQuery,
  matchCount: number
): Promise<VisaKnowledgeChunk[]> {
  const supabase = getSupabaseClient();
  let request = supabase
    .from("visa_chunks")
    .select(
      "id, content, country, visa_type, document_type, visa_documents(title, source_url)"
    )
    .limit(matchCount);

  if (query.country) {
    request = request.eq("country", query.country);
  }
  if (query.visaType) {
    request = request.eq("visa_type", query.visaType);
  }
  if (query.documentTypes && query.documentTypes.length > 0) {
    request = request.in("document_type", query.documentTypes);
  }

  const { data, error } = await request;

  if (error) {
    logger.warn("Filtered knowledge fallback failed", error);
    return [];
  }

  const rows: unknown[] = Array.isArray(data) ? data : [];
  return rows
    .map(mapChunkRow)
    .filter((chunk): chunk is VisaKnowledgeChunk => chunk !== null);
}

export async function retrieveVisaKnowledge(
  query: VisaKnowledgeQuery
): Promise<VisaKnowledgeResult> {
  const cleanQuery = query.query.trim();
  if (!cleanQuery) {
    return {
      chunks: [],
      usedEmbedding: false,
      fallbackReason: "empty_query",
    };
  }

  const matchCount = clampMatchCount(query.matchCount);
  const minSimilarity = query.minSimilarity ?? DEFAULT_MIN_SIMILARITY;
  const embedding = await getEmbedding(cleanQuery);
  const intentQuery = withIntentDocumentTypes(query);
  const shouldRetryWithoutIntentDocumentTypes =
    !query.documentTypes?.length && Boolean(intentQuery.documentTypes?.length);

  if (embedding) {
    try {
      const chunks = await retrieveWithVectorSearch(
        intentQuery,
        embedding,
        matchCount,
        minSimilarity
      );
      if (chunks.length > 0) {
        return {
          chunks,
          usedEmbedding: true,
          fallbackReason: null,
        };
      }

      if (shouldRetryWithoutIntentDocumentTypes) {
        const broadChunks = await retrieveWithVectorSearch(
          query,
          embedding,
          matchCount,
          minSimilarity
        );
        if (broadChunks.length > 0) {
          return {
            chunks: broadChunks,
            usedEmbedding: true,
            fallbackReason: "intent_document_type_no_match",
          };
        }
      }
    } catch (error) {
      logger.warn("Vector knowledge retrieval failed", error as Error, {
        country: query.country,
        visaType: query.visaType,
      });
    }
  }

  const fallbackChunks = await retrieveWithFilteredFallback(intentQuery, matchCount);
  if (fallbackChunks.length > 0) {
    return {
      chunks: fallbackChunks,
      usedEmbedding: false,
      fallbackReason: embedding ? "vector_search_failed" : "embedding_unavailable",
    };
  }

  const broadFallbackChunks = shouldRetryWithoutIntentDocumentTypes
    ? await retrieveWithFilteredFallback(query, matchCount)
    : [];
  return {
    chunks: broadFallbackChunks,
    usedEmbedding: false,
    fallbackReason:
      broadFallbackChunks.length > 0
        ? "intent_document_type_no_match"
        : embedding
          ? "vector_search_failed"
          : "embedding_unavailable",
  };
}

export function formatKnowledgeContext(chunks: VisaKnowledgeChunk[]): string {
  if (chunks.length === 0) return "";

  return chunks
    .map((chunk, index) => {
      const sourceParts = [
        chunk.title,
        chunk.country,
        chunk.visaType,
        chunk.documentType,
      ].filter((part): part is string => Boolean(part));
      const sourceLabel = sourceParts.join(" | ") || "Visa knowledge";
      const sourceUrl = chunk.sourceUrl ? `\nSource URL: ${chunk.sourceUrl}` : "";

      return `Source ${index + 1}: ${sourceLabel}${sourceUrl}\n${chunk.content}`;
    })
    .join("\n\n---\n\n");
}
