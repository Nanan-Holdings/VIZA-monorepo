import { getLocale } from "next-intl/server";
import { StaticArticle } from "@/components/client/static-article";
import { enDisclaimerArticle } from "@/lib/legal/en-legal-content";
import { zhDisclaimerArticle } from "@/lib/legal/zh-legal-content";

export const metadata = {
  title: "Disclaimer | VIZA",
};

export default async function DisclaimerPage() {
  const locale = await getLocale();
  return <StaticArticle {...(locale.startsWith("zh") ? zhDisclaimerArticle : enDisclaimerArticle)} />;
}
