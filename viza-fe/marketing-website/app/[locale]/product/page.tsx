import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { staticPageMetadata } from "@/lib/seo/page-meta";
import SiteHeader from "@/design-system/sections/SiteHeader";
import SiteFooter from "@/design-system/sections/SiteFooter";
import PageIntro from "@/design-system/sections/PageIntro";
import FeatureCards from "@/design-system/sections/FeatureCards";
import Button from "@/design-system/ui/Button";
import { Check, Languages, Tag } from "@/design-system/ui/Icons";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return staticPageMetadata(params, "product", "/product");
}

export default async function ProductPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const zh = locale === "zh-CN";
  const t = await getTranslations({ locale, namespace: "homePage" });
  return (
    <>
      <SiteHeader />
      <main className="ds-main">
        <PageIntro
          title={zh ? "VIZA 如何协助您的签证申请" : "How VIZA supports your visa application"}
          lede={
            zh
              ? "了解可用的签证申请准备、材料核对和申请进度服务。VIZA 的服务免费，具体服务范围和可用性会在您选择目的地后明确显示。"
              : "Explore available visa preparation, document review, and application-status services. VIZA's service is free. Exact scope and availability are shown after you choose a destination."
          }
          actions={<Button href="/visa">{zh ? "浏览目的地" : "Browse destinations"}</Button>}
        />
        <div className="ds-container ds-intro-body">
          <FeatureCards
            items={[
              { title: t("why.items.free.title"), body: t("why.items.free.body"), icon: <Tag size={88} strokeWidth={1.1} /> },
              { title: t("why.items.checked.title"), body: t("why.items.checked.body"), icon: <Check size={88} strokeWidth={1.1} /> },
              { title: t("why.items.language.title"), body: t("why.items.language.body"), icon: <Languages size={88} strokeWidth={1.1} /> },
            ]}
          />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
