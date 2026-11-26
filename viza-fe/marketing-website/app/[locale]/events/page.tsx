import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { staticPageMetadata } from "@/lib/seo/page-meta";
import SiteHeader from "@/design-system/sections/SiteHeader";
import SiteFooter from "@/design-system/sections/SiteFooter";
import PageIntro from "@/design-system/sections/PageIntro";
import Button from "@/design-system/ui/Button";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return staticPageMetadata(params, "events", "/events", { noindex: true });
}

export default async function EventsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "pageCopy.events" });
  return (
    <>
      <SiteHeader />
      <main className="ds-main">
        <PageIntro
          title={t("title")}
          lede={t("lede")}
          actions={<Button href="/contact">{t("contact")}</Button>}
        />
        <div className="ds-intro-body" />
      </main>
      <SiteFooter />
    </>
  );
}
