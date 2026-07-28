import { getLocale } from "next-intl/server";
import { StaticArticle } from "@/components/client/static-article";
import { enTermsArticle } from "@/lib/legal/en-legal-content";
import { zhTermsArticle } from "@/lib/legal/zh-legal-content";

export const metadata = {
  title: "Terms of Service | VIZA",
};

export default async function TermsPage() {
  const locale = await getLocale();
  return <StaticArticle {...(locale.startsWith("zh") ? zhTermsArticle : enTermsArticle)} />;
}
