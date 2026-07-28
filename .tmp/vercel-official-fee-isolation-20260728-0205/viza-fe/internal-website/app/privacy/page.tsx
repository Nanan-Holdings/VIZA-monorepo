import { getLocale } from "next-intl/server";
import { StaticArticle } from "@/components/client/static-article";
import { enPrivacyArticle } from "@/lib/legal/en-legal-content";
import { zhPrivacyArticle } from "@/lib/legal/zh-legal-content";

export const metadata = {
  title: "Privacy Policy | VIZA",
};

export default async function PrivacyPage() {
  const locale = await getLocale();
  return <StaticArticle {...(locale.startsWith("zh") ? zhPrivacyArticle : enPrivacyArticle)} />;
}
