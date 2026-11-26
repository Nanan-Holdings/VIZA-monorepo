import type { LegalDoc, LegalSlug } from "./types";
import { en } from "./en";
import { zhCN } from "./zh-CN";
import { applyOverlay } from "@/lib/i18n-overlay";
import { legalOverlay, usesOverlay } from "@/lib/i18n-content";

export { LEGAL_UPDATED } from "./types";
export type { LegalDoc, LegalSlug } from "./types";
export { COMPANY } from "./company";

/** English, the hand-written zh-CN twin, or English with translations/<locale>/legal.json laid over it. */
export async function getLegal(slug: LegalSlug, locale: string): Promise<LegalDoc> {
  if (locale === "zh-CN") return zhCN[slug];
  if (!usesOverlay(locale)) return en[slug];
  return applyOverlay(en, await legalOverlay(locale))[slug];
}
