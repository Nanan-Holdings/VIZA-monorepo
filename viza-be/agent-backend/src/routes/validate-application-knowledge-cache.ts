import { createHash } from "node:crypto";
import {
  BoundedSingleFlightCache,
  type SingleFlightResult,
} from "./field-guidance-cache.js";

export interface ValidationKnowledgeCacheKeyInput {
  releaseId: string;
  releaseKey: string;
  query: string;
  embeddingModel: string;
  matchCount: number;
  filterVisaType: string;
}

/**
 * The key intentionally contains only public knowledge retrieval metadata.
 * Applicant identifiers, answers, documents, and validation findings must
 * never be added to this process-shared cache.
 */
export function createValidationKnowledgeCacheKey(
  input: ValidationKnowledgeCacheKeyInput,
): string {
  return createHash("sha256")
    .update(JSON.stringify({
      cacheVersion: 1,
      releaseId: input.releaseId,
      releaseKey: input.releaseKey,
      query: input.query,
      embeddingModel: input.embeddingModel,
      matchCount: input.matchCount,
      filterVisaType: input.filterVisaType,
    }))
    .digest("hex");
}

export class ValidationKnowledgeContextCache {
  private readonly cache: BoundedSingleFlightCache<string>;

  constructor(maxEntries = 32, ttlMs = 5 * 60_000) {
    this.cache = new BoundedSingleFlightCache<string>(maxEntries, ttlMs);
  }

  getOrCreate(
    input: ValidationKnowledgeCacheKeyInput,
    factory: () => Promise<string>,
  ): Promise<SingleFlightResult<string>> {
    return this.cache.getOrCreate(createValidationKnowledgeCacheKey(input), factory);
  }
}
