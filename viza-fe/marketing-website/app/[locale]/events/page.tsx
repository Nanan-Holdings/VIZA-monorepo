import { getTranslations, setRequestLocale } from "next-intl/server";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import "../story.css";

/**
 * The "活动" nav tab used to point at a route that did not exist, so visitors
 * landed on an error page. Until there is a real events programme this renders an
 * honest, non-error placeholder.
 */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages.events" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function EventsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "pages.events" });

  return (
    <>
      <SiteNav activeTab="events" />
      <main className="story">
        <header className="story-head">
          <span className="story-eyebrow">{t("eyebrow")}</span>
          <h1>{t("title")}</h1>
          <p>{t("lede")}</p>
        </header>
        <div className="story-cta">
          <a className="story-btn" href="/">{t("ctaBrowse")}</a>
          <a className="story-btn secondary" href="/contact">{t("ctaContact")}</a>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
