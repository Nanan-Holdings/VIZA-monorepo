import { describe, expect, it } from "vitest";
import {
  buildKnowledgeChunkContent,
  buildKnowledgeEmbeddingText,
  KNOWLEDGE_EMBEDDING_INPUT_MAX_CHARS,
  KNOWLEDGE_CHUNKING_CANDIDATES,
  resolveKnowledgeChunkingPolicy,
  splitKnowledgeChunk,
  type KnowledgeChunkInput,
  type KnowledgeDocumentMetadata,
} from "./visa-knowledge-chunking.js";

it("accepts only reproducible evaluated chunking profiles and returns defensive policies", () => {
  expect(KNOWLEDGE_CHUNKING_CANDIDATES).toHaveLength(7);
  expect(resolveKnowledgeChunkingPolicy("seed-semantic")).toBeNull();
  const policy = resolveKnowledgeChunkingPolicy("chars-400-overlap-80");
  expect(policy).toEqual({ maxChars: 400, overlapChars: 80 });
  if (policy) policy.maxChars = 1;
  expect(resolveKnowledgeChunkingPolicy("chars-400-overlap-80")?.maxChars).toBe(400);
  expect(() => resolveKnowledgeChunkingPolicy("unmeasured-512-tokens")).toThrow("Unknown chunking profile");
});

const document: KnowledgeDocumentMetadata = {
  country: "japan",
  visaType: "tourist",
  documentType: "requirements",
  title: "Japan tourist visa requirements",
  sourceUrl: "https://example.test/japan",
};

function chunk(content: string): KnowledgeChunkInput {
  return {
    id: "jp-requirements-1",
    title: "Required documents",
    tags: ["documents", "tourism"],
    content,
  };
}

function reconstructWithOverlap(
  pieces: KnowledgeChunkInput[],
  overlapChars: number,
): string {
  if (pieces.length === 0) return "";
  return pieces
    .map((piece, index) => {
      if (index === 0 || overlapChars === 0) return piece.content;
      return Array.from(piece.content).slice(overlapChars).join("");
    })
    .join("");
}

describe("visa knowledge chunking", () => {
  it("preserves the historical single chunk when no policy is selected", () => {
    const input = chunk("A complete seed chunk.");

    expect(splitKnowledgeChunk(input, null)).toEqual([input]);
    expect(splitKnowledgeChunk(input, null)[0]).toBe(input);
  });

  it("keeps short content and its original id when no split is needed", () => {
    const input = chunk("One paragraph.");

    expect(splitKnowledgeChunk(input, { maxChars: 100, overlapChars: 10 })).toEqual([
      input,
    ]);
  });

  it("prefers the latest paragraph boundary while covering all source text", () => {
    const input = chunk(
      "First paragraph has several useful facts.\n\nSecond paragraph also has facts.\n\nThird paragraph ends here.",
    );
    const pieces = splitKnowledgeChunk(input, { maxChars: 65, overlapChars: 0 });

    expect(pieces.length).toBeGreaterThan(1);
    expect(pieces[0].content.endsWith("\n\n")).toBe(true);
    expect(pieces[1].content.startsWith("Second paragraph")).toBe(true);
    expect(reconstructWithOverlap(pieces, 0)).toBe(input.content);
    expect(pieces.map((piece) => piece.id)).toEqual(
      pieces.map((_, index) => `${input.id}__part_${index + 1}`),
    );
    expect(pieces.every((piece) => piece.title === input.title)).toBe(true);
    expect(pieces.every((piece) => piece.tags === input.tags)).toBe(true);
  });

  it("uses sentence boundaries before falling back to a hard code-point split", () => {
    const input = chunk("First sentence is complete. Second sentence follows. Final words.");
    const pieces = splitKnowledgeChunk(input, { maxChars: 42, overlapChars: 0 });

    expect(pieces[0].content).toBe("First sentence is complete. ");
    expect(reconstructWithOverlap(pieces, 0)).toBe(input.content);
    expect(pieces.every((piece) => Array.from(piece.content).length <= 42)).toBe(true);
  });

  it("measures limits and overlap in Unicode code points", () => {
    const input = chunk("😀一二三四五六七八九十😀一二三四五六七八九十");
    const pieces = splitKnowledgeChunk(input, { maxChars: 7, overlapChars: 2 });

    expect(pieces.length).toBeGreaterThan(1);
    expect(pieces.every((piece) => Array.from(piece.content).length <= 7)).toBe(true);
    expect(reconstructWithOverlap(pieces, 2)).toBe(input.content);
    expect(pieces.every((piece) => !piece.content.includes("\uFFFD"))).toBe(true);
  });

  it("rejects invalid policy bounds", () => {
    const input = chunk("content");
    const invalidPolicies = [
      { maxChars: 0, overlapChars: 0 },
      { maxChars: -1, overlapChars: 0 },
      { maxChars: 2.5, overlapChars: 0 },
      { maxChars: Number.NaN, overlapChars: 0 },
      { maxChars: Number.POSITIVE_INFINITY, overlapChars: 0 },
      { maxChars: 4, overlapChars: -1 },
      { maxChars: 4, overlapChars: 4 },
      { maxChars: 4, overlapChars: 1.5 },
    ];

    for (const policy of invalidPolicies) {
      expect(() => splitKnowledgeChunk(input, policy)).toThrow(RangeError);
    }
  });

  it("matches the current ingestor's metadata envelope exactly", () => {
    const input = chunk("Submit the completed form.");
    const content = buildKnowledgeChunkContent(document, input);

    expect(content).toBe(
      [
        "# Required documents",
        "",
        "Country: japan",
        "Visa type: tourist",
        "Document type: requirements",
        "Source: Japan tourist visa requirements",
        "Source URL: https://example.test/japan",
        "Tags: documents, tourism",
        "",
        "Submit the completed form.",
      ].join("\n"),
    );
    expect(buildKnowledgeEmbeddingText(document, input)).toBe(
      `Required documents\n\n${content}`,
    );
  });

  it("keeps the ingestor's UTF-16 8,000-unit embedding slice", () => {
    const input = chunk("😀".repeat(5_000));
    const fullText = `Required documents\n\n${buildKnowledgeChunkContent(document, input)}`;
    const embeddingText = buildKnowledgeEmbeddingText(document, input);

    expect(embeddingText).toBe(fullText.slice(0, KNOWLEDGE_EMBEDDING_INPUT_MAX_CHARS));
    expect(embeddingText.length).toBe(KNOWLEDGE_EMBEDDING_INPUT_MAX_CHARS);
    // The legacy UTF-16 slice can end on a high surrogate; this is deliberate
    // compatibility coverage rather than a new Unicode normalization rule.
    expect(embeddingText.charCodeAt(embeddingText.length - 1)).toBe(0xd83d);
  });
});
