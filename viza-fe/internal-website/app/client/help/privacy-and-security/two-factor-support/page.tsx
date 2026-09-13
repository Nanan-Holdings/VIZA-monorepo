import { getLocale } from "next-intl/server";
import { HelpArticle } from "@/components/client/help-article";
import { getStaticHelpArticleCopy } from "@/app/client/help/static-article-copy";

export async function generateMetadata() {
  const locale = await getLocale();
  const copy = getStaticHelpArticleCopy("twoFactorSupport", locale);
  return {
    title: `${copy.title} | ${locale.toLowerCase().startsWith("zh") ? "帮助中心" : "Help Center"}`,
  };
}

export default async function TwoFactorSupportPage() {
  const locale = await getLocale();
  return <HelpArticle {...getStaticHelpArticleCopy("twoFactorSupport", locale)} />;
}
