import { applyOverlay } from "@/lib/i18n-overlay";
import { seoOverlay, usesOverlay } from "@/lib/i18n-content";
import { SEO_SOURCE, type SeoCopy } from "@/lib/seo/titles";

/** Translated destination title and description wording for `locale`, or null for en and zh (they have code paths). */
export async function loadSeoCopy(locale: string): Promise<SeoCopy | null> {
  if (!usesOverlay(locale)) return null;
  return applyOverlay(SEO_SOURCE, await seoOverlay(locale));
}
