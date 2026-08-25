"use client";

import { useTranslations } from "next-intl";
import { HelpArticle, type HelpArticleSection } from "@/components/client/help-article";

/**
 * Renders a help article whose content lives in `help.articles.<key>` rather than
 * hardcoded in the page.
 *
 * The Help Center used to be English-only regardless of the interface language,
 * which is what applicants hit when they opened help from the checkout page.
 */
export function HelpArticleFromMessages({ articleKey }: { articleKey: string }) {
  const t = useTranslations(`help.articles.${articleKey}`);
  const sections = t.raw("sections") as HelpArticleSection[];

  return <HelpArticle title={t("title")} subtitle={t("subtitle")} sections={sections} />;
}
