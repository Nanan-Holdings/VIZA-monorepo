import { StaticArticle } from "@/components/client/static-article";
import { zhDisclaimerArticle } from "@/lib/legal/zh-legal-content";

export const metadata = {
  title: "免责声明 | VIZA",
};

export default function DisclaimerPage() {
  return <StaticArticle {...zhDisclaimerArticle} />;
}
