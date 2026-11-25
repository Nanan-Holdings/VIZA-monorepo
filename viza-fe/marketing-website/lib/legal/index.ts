import type { LegalDoc, LegalSlug } from "./types";
import { en } from "./en";
import { zhCN } from "./zh-CN";

export { LEGAL_UPDATED } from "./types";
export type { LegalDoc, LegalSlug } from "./types";
export { COMPANY } from "./company";

export function getLegal(slug: LegalSlug, locale: string): LegalDoc {
  return (locale === "zh-CN" ? zhCN : en)[slug];
}
