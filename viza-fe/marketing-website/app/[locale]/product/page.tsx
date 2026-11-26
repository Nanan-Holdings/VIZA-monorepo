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
  const t = await getTranslations({ locale, namespace: "homePage" });
  const tp = await getTranslations({ locale, namespace: "pageCopy.product" });
  return (
    <>
      <SiteHeader />
      <main className="ds-main">
        <PageIntro
          title={tp("introTitle")}
          lede={tp("introLede")}
          actions={<Button href="/visa">{tp("browse")}</Button>}
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
