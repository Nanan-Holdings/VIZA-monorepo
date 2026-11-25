/**
 * Translation overlays for the long-form content (destinations, guides, arrival cards, legal, SEO copy).
 *
 * The English object in code is the source of truth. A locale's translation is a flat map
 * "path/to/string" -> translated text, written by scripts/i18n/translate.mjs into
 * translations/<locale>/<unit>.json. Applying it walks the English object and replaces every string
 * the overlay has a value for, so a string that has no translation yet shows its English text.
 *
 * Pure and dependency free: scripts/og.mjs and scripts/check-copy.mjs load this file directly.
 */
export type Overlay = Record<string, string>;

/** Path separator inside an overlay key. Arrays use their index: "faq/3/q". */
export const OVERLAY_SEP = "/";

export function applyOverlay<T>(source: T, overlay: Overlay | null | undefined): T {
  if (!overlay) return source;
  const walk = (node: unknown, path: string): unknown => {
    if (typeof node === "string") return Object.prototype.hasOwnProperty.call(overlay, path) ? overlay[path] : node;
    if (Array.isArray(node)) return node.map((v, i) => walk(v, path === "" ? String(i) : `${path}${OVERLAY_SEP}${i}`));
    if (node && typeof node === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node)) out[k] = walk(v, path === "" ? k : `${path}${OVERLAY_SEP}${k}`);
      return out;
    }
    return node;
  };
  return walk(source, "") as T;
}

/** zh-CN has hand-written (native) twin files in code instead of an overlay. zh-TW is an ordinary overlay locale. */
export function isNativeZh(locale: string): boolean {
  return locale === "zh-CN";
}
