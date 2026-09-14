/**
 * Utilities shared by visa knowledge ingestion and offline chunking evals.
 *
 * Chunk boundaries are measured in Unicode code points so a policy cannot
 * split an emoji or another astral-plane character in half. The embedding
 * formatter intentionally keeps the ingestor's existing UTF-16 `slice`
 * behavior; changing that would make new evaluations incomparable with the
 * stored embeddings.
 */

export interface KnowledgeChunkInput {
  id: string;
  title: string;
  tags: string[];
  content: string;
}

export interface ChunkingPolicy {
  maxChars: number;
  overlapChars: number;
}

export const KNOWLEDGE_CHUNKING_CANDIDATES: ReadonlyArray<{
  name: string;
  policy: ChunkingPolicy | null;
}> = [
  { name: "seed-semantic", policy: null },
  ...[400, 800, 1600].flatMap(maxChars => [0, 0.2].map(overlap => ({
    name: `chars-${maxChars}-overlap-${Math.round(maxChars * overlap)}`,
    policy: { maxChars, overlapChars: Math.round(maxChars * overlap) },
  }))),
];

export function resolveKnowledgeChunkingPolicy(name: string): ChunkingPolicy | null {
  const candidate = KNOWLEDGE_CHUNKING_CANDIDATES.find(item => item.name === name);
  if (!candidate) throw new Error(`Unknown chunking profile: ${name}`);
  return candidate.policy ? { ...candidate.policy } : null;
}

export interface KnowledgeDocumentMetadata {
  country: string;
  visaType: string;
  documentType: string;
  title: string;
  sourceUrl: string;
}

/** The current ingestor sends at most 8,000 UTF-16 code units to OpenAI. */
export const KNOWLEDGE_EMBEDDING_INPUT_MAX_CHARS = 8_000;

const SENTENCE_TERMINATORS = new Set([".", "!", "?", "。", "！", "？"]);
const CLOSING_CHARACTERS = new Set([
  '"',
  "'",
  "’",
  "”",
  "»",
  ")",
  "]",
  "}",
]);

function isLineBreak(value: string | undefined): boolean {
  return value === "\n" || value === "\r";
}

function isWhitespace(value: string | undefined): boolean {
  return value !== undefined && /\s/u.test(value);
}

function validatePolicy(policy: ChunkingPolicy): void {
  if (!Number.isSafeInteger(policy.maxChars) || policy.maxChars < 1) {
    throw new RangeError("Chunking maxChars must be a positive safe integer.");
  }
  if (
    !Number.isSafeInteger(policy.overlapChars) ||
    policy.overlapChars < 0 ||
    policy.overlapChars >= policy.maxChars
  ) {
    throw new RangeError(
      "Chunking overlapChars must be a non-negative safe integer smaller than maxChars.",
    );
  }
}

function consumeBoundarySuffix(
  codePoints: string[],
  boundary: number,
  maxEnd: number,
): number {
  let end = boundary;
  while (end < maxEnd && CLOSING_CHARACTERS.has(codePoints[end])) {
    end += 1;
  }
  while (end < maxEnd && isWhitespace(codePoints[end])) {
    end += 1;
  }
  return end;
}

function isSentenceBoundary(codePoints: string[], index: number): boolean {
  const character = codePoints[index];
  if (!SENTENCE_TERMINATORS.has(character)) return false;

  // Treat ASCII punctuation as a sentence boundary only when it terminates a
  // sentence. This avoids breaking common values such as URLs and decimals.
  if (character === "." || character === "!" || character === "?") {
    let lookahead = index + 1;
    while (CLOSING_CHARACTERS.has(codePoints[lookahead])) {
      lookahead += 1;
    }
    const next = codePoints[lookahead];
    if (next !== undefined && !isWhitespace(next)) return false;
  }
  return true;
}

function findPreferredEnd(
  codePoints: string[],
  start: number,
  maxEnd: number,
  overlapChars: number,
): number {
  const minimumEnd = start + overlapChars + 1;
  let paragraphEnd = -1;
  let sentenceEnd = -1;
  let lineEnd = -1;

  let index = start;
  while (index < maxEnd) {
    const character = codePoints[index];

    if (isLineBreak(character)) {
      // Process CRLF as one line break. A pair of logical line breaks is a
      // paragraph boundary; a single one remains a useful lower-priority
      // line boundary for lists and compact source documents.
      if (character === "\n" && codePoints[index - 1] === "\r") {
        index += 1;
        continue;
      }

      const breakEnd =
        character === "\r" && codePoints[index + 1] === "\n"
          ? index + 2
          : index + 1;
      if (breakEnd >= minimumEnd && breakEnd <= maxEnd) {
        const candidate = consumeBoundarySuffix(codePoints, breakEnd, maxEnd);
        lineEnd = candidate;

        const hasPreviousBreak =
          index > start && isLineBreak(codePoints[index - 1]);
        const hasNextBreak = isLineBreak(codePoints[breakEnd]);
        if (hasPreviousBreak || hasNextBreak) {
          paragraphEnd = candidate;
        }
      }
      index = breakEnd;
      continue;
    }

    if (isSentenceBoundary(codePoints, index)) {
      const candidate = consumeBoundarySuffix(codePoints, index + 1, maxEnd);
      if (candidate >= minimumEnd && candidate <= maxEnd) {
        sentenceEnd = candidate;
      }
    }
    index += 1;
  }

  return paragraphEnd > 0
    ? paragraphEnd
    : sentenceEnd > 0
      ? sentenceEnd
      : lineEnd > 0
        ? lineEnd
        : maxEnd;
}

/**
 * Split one seed chunk without merging it with neighboring semantic chunks.
 * `null` preserves the historical behavior and returns the original chunk as
 * one element. Overlap is measured in Unicode code points and is applied only
 * between pieces of an actual split.
 */
export function splitKnowledgeChunk(
  chunk: KnowledgeChunkInput,
  policy: ChunkingPolicy | null,
): KnowledgeChunkInput[] {
  if (policy === null) return [chunk];
  validatePolicy(policy);

  const codePoints = Array.from(chunk.content);
  if (codePoints.length <= policy.maxChars) return [chunk];

  const contents: string[] = [];
  let start = 0;
  while (start < codePoints.length) {
    const hardEnd = Math.min(start + policy.maxChars, codePoints.length);
    const end =
      hardEnd === codePoints.length
        ? hardEnd
        : findPreferredEnd(codePoints, start, hardEnd, policy.overlapChars);

    // The boundary selector always makes progress because it ignores
    // candidates that cannot leave the required overlap behind. Keep this
    // guard as a final defense against future boundary changes.
    if (end <= start) {
      throw new Error("Chunking boundary did not make progress.");
    }

    contents.push(codePoints.slice(start, end).join(""));
    if (end === codePoints.length) break;

    const nextStart = end - policy.overlapChars;
    if (nextStart <= start) {
      throw new Error("Chunking overlap prevented progress.");
    }
    start = nextStart;
  }

  return contents.map((content, index) => ({
    ...chunk,
    id: `${chunk.id}__part_${index + 1}`,
    content,
  }));
}

/** Reproduce the exact content envelope used by the current ingestor. */
export function buildKnowledgeChunkContent(
  document: KnowledgeDocumentMetadata,
  chunk: KnowledgeChunkInput,
): string {
  return [
    `# ${chunk.title}`,
    "",
    `Country: ${document.country}`,
    `Visa type: ${document.visaType}`,
    `Document type: ${document.documentType}`,
    `Source: ${document.title}`,
    `Source URL: ${document.sourceUrl}`,
    `Tags: ${chunk.tags.join(", ")}`,
    "",
    chunk.content,
  ].join("\n");
}

/**
 * Reproduce the current ingestor's embedding input exactly. The final slice
 * intentionally counts UTF-16 code units, matching `String.prototype.slice`
 * in `ingest-country-visa-rag.ts`, even when that cuts an astral character.
 */
export function buildKnowledgeEmbeddingText(
  document: KnowledgeDocumentMetadata,
  chunk: KnowledgeChunkInput,
): string {
  return `${chunk.title}\n\n${buildKnowledgeChunkContent(document, chunk)}`.slice(
    0,
    KNOWLEDGE_EMBEDDING_INPUT_MAX_CHARS,
  );
}
