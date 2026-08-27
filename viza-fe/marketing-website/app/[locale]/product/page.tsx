import { getTranslations, setRequestLocale } from "next-intl/server";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import { portalUrl } from "@/lib/utils";
import "../story.css";

/**
 * "What we are doing" — the product surface, stated in terms of what the platform
 * actually ships today (portal wizard, OCR, reusable profile, assisted form fill,
 * automated government-portal submission, status tracking).
 *
 * Every claim here must be traceable to a shipped capability. If a capability is
 * removed from the portal, remove it from `pages.product.features` too.
 */

const FEATURE_IDS = [
  "browse",
  "profile",
  "ocr",
  "assist",
  "bilingual",
  "submit",
  "track",
  "interview",
] as const;

const STEP_IDS = ["choose", "prepare", "review", "submit"] as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages.product" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function ProductPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "pages.product" });

  return (
    <>
      <SiteNav activeTab="product" />
      <main className="story">
        <header className="story-head">
          <span className="story-eyebrow">{t("eyebrow")}</span>
          <h1>{t("title")}</h1>
          <p>{t("lede")}</p>
        </header>

        <section className="story-section">
          <h2>{t("flowTitle")}</h2>
          <p>{t("flowLede")}</p>
          <div className="story-cards">
            {STEP_IDS.map((id, i) => (
              <div className="story-card" key={id}>
                <h3>{`${i + 1}. ${t(`steps.${id}.title`)}`}</h3>
                <p>{t(`steps.${id}.body`)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="story-section">
          <h2>{t("featuresTitle")}</h2>
          <p>{t("featuresLede")}</p>
          <div className="story-cards">
            {FEATURE_IDS.map((id) => (
              <div className="story-card" key={id}>
                <h3>{t(`features.${id}.title`)}</h3>
                <p>{t(`features.${id}.body`)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="story-section">
          <h2>{t("limitsTitle")}</h2>
          <p>{t("limitsLede")}</p>
          <div className="story-note">{t("limitsNote")}</div>
        </section>

        <div className="story-cta">
          <a className="story-btn" href="/">{t("ctaBrowse")}</a>
          <a className="story-btn secondary" href={portalUrl("/client/login")}>{t("ctaPortal")}</a>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
