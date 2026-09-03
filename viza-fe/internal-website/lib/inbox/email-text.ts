/**
 * Plain-text helpers for inbound mail: list snippets, translation paragraphs,
 * and the text handed to the AI reading pass. Pure functions, safe on both
 * server and client.
 */

const BLOCK_TAG_BREAK =
  /<\/(p|div|tr|li|h[1-6]|blockquote|table)>|<br\s*\/?>/gi;

const TAG = /<[^>]+>/g;

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

function decodeBasicEntities(value: string): string {
  return value
    .replace(/&(nbsp|amp|lt|gt|quot|#39|apos);/g, (match) => ENTITIES[match] ?? match)
    .replace(/&#(\d+);/g, (_m, code: string) => {
      const point = Number(code);
      return Number.isFinite(point) && point > 0 && point < 0x10ffff
        ? String.fromCodePoint(point)
        : "";
    });
}

/** Strip HTML down to readable text, preserving block boundaries as newlines. */
export function htmlToPlainText(html: string): string {
  const withBreaks = (html ?? "")
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(BLOCK_TAG_BREAK, "\n")
    .replace(TAG, " ");
  return decodeBasicEntities(withBreaks)
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Best readable text for a message: prefer `text`, fall back to stripped html. */
export function bestPlainText(
  text: string | null | undefined,
  html: string | null | undefined,
): string {
  const fromText = (text ?? "").trim();
  if (fromText) return fromText;
  const fromHtml = (html ?? "").trim();
  return fromHtml ? htmlToPlainText(fromHtml) : "";
}

/** One-line list preview. */
export function emailSnippet(
  text: string | null | undefined,
  html: string | null | undefined,
  maxLength = 160,
): string {
  const plain = bestPlainText(text, html).replace(/\s+/g, " ").trim();
  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, maxLength - 1).trimEnd()}…`;
}

/** Paragraph split used by the reading pane and the translation pass. */
export function emailParagraphs(
  text: string | null | undefined,
  html: string | null | undefined,
  maxParagraphs = 60,
): string[] {
  const plain = bestPlainText(text, html);
  if (!plain) return [];
  return plain
    .split(/\n{2,}|\r\n{2,}/)
    .flatMap((block) => {
      const trimmed = block.replace(/\s+\n/g, "\n").trim();
      if (!trimmed) return [];
      // A "paragraph" that is really many single-newline lines (plain-text
      // mail) stays together so the reading pane mirrors the original shape.
      return [trimmed.replace(/\n/g, " ").replace(/\s{2,}/g, " ")];
    })
    .slice(0, maxParagraphs);
}

/**
 * Chunk paragraphs into batches whose combined length stays under the Google
 * Translate per-request cap (sum of texts, see lib/translation).
 */
export function chunkParagraphs(
  paragraphs: string[],
  maxCharsPerBatch = 4200,
): string[][] {
  const batches: string[][] = [];
  let current: string[] = [];
  let currentLength = 0;
  for (const paragraph of paragraphs) {
    const clipped =
      paragraph.length > maxCharsPerBatch
        ? `${paragraph.slice(0, maxCharsPerBatch - 1)}…`
        : paragraph;
    if (current.length > 0 && currentLength + clipped.length > maxCharsPerBatch) {
      batches.push(current);
      current = [];
      currentLength = 0;
    }
    current.push(clipped);
    currentLength += clipped.length;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}
