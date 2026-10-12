import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_VISA_KNOWLEDGE_MATCH_COUNT,
  DEFAULT_VISA_KNOWLEDGE_MIN_SIMILARITY,
  resolveVisaKnowledgeRetrievalPolicy,
} from "./visa-knowledge-retrieval-policy.js";

describe("visa knowledge retrieval policy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the bounded defaults when no overrides are configured", () => {
    expect(resolveVisaKnowledgeRetrievalPolicy()).toEqual({
      matchCount: DEFAULT_VISA_KNOWLEDGE_MATCH_COUNT,
      minSimilarity: DEFAULT_VISA_KNOWLEDGE_MIN_SIMILARITY,
    });
  });

  it("accepts valid bounded environment values", () => {
    vi.stubEnv("VISA_RAG_MATCH_COUNT", "12");
    vi.stubEnv("VISA_RAG_MIN_SIMILARITY", "1");

    expect(resolveVisaKnowledgeRetrievalPolicy()).toEqual({
      matchCount: 12,
      minSimilarity: 1,
    });
  });

  it("gives explicit valid request overrides priority over environment values", () => {
    vi.stubEnv("VISA_RAG_MATCH_COUNT", "9");
    vi.stubEnv("VISA_RAG_MIN_SIMILARITY", "0.7");

    expect(
      resolveVisaKnowledgeRetrievalPolicy({ matchCount: 2, minSimilarity: 0.15 }),
    ).toEqual({ matchCount: 2, minSimilarity: 0.15 });
  });

  it("falls back to a valid environment value when an explicit override is invalid", () => {
    vi.stubEnv("VISA_RAG_MATCH_COUNT", "8");
    vi.stubEnv("VISA_RAG_MIN_SIMILARITY", "0.6");

    expect(
      resolveVisaKnowledgeRetrievalPolicy({ matchCount: 13, minSimilarity: Number.NaN }),
    ).toEqual({ matchCount: 8, minSimilarity: 0.6 });
  });

  it("falls back to defaults when environment values are invalid", () => {
    vi.stubEnv("VISA_RAG_MATCH_COUNT", "0");
    vi.stubEnv("VISA_RAG_MIN_SIMILARITY", "1.1");

    expect(resolveVisaKnowledgeRetrievalPolicy()).toEqual({
      matchCount: DEFAULT_VISA_KNOWLEDGE_MATCH_COUNT,
      minSimilarity: DEFAULT_VISA_KNOWLEDGE_MIN_SIMILARITY,
    });
  });

  it("accepts numeric string similarity values and rejects non-integer match counts", () => {
    vi.stubEnv("VISA_RAG_MATCH_COUNT", "4.5");

    expect(
      resolveVisaKnowledgeRetrievalPolicy({ matchCount: "3", minSimilarity: "0.25" }),
    ).toEqual({ matchCount: 3, minSimilarity: 0.25 });
    expect(resolveVisaKnowledgeRetrievalPolicy({ matchCount: 4.5 })).toEqual({
      matchCount: DEFAULT_VISA_KNOWLEDGE_MATCH_COUNT,
      minSimilarity: DEFAULT_VISA_KNOWLEDGE_MIN_SIMILARITY,
    });
  });
});
