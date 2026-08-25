import { getTranslations } from "next-intl/server";
import { HelpArticleFromMessages } from "@/components/client/help-article-from-messages";

const ARTICLE_KEY = "accountSecurityTips";

export async function generateMetadata() {
  const t = await getTranslations(`help.articles.${ARTICLE_KEY}`);
  return { title: t("metaTitle") };
}

export default function AccountSecurityTipsPage() {
  return <HelpArticleFromMessages articleKey={ARTICLE_KEY} />;
}
