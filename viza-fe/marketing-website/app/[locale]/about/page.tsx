import { getTranslations, setRequestLocale } from "next-intl/server";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import "../story.css";

/**
 * "Who we are".
 *
 * NOTE FOR OPS/FOUNDERS: the two office locations below are the real ones already
 * published in the site footer. The founding story and the named team roster are
 * intentionally NOT invented here — `pages.about.teamNote` says so out loud rather
 * than shipping placeholder bios that read as fact. Replace `pages.about.story*`
 * and add a `team` array once the real copy is signed off.
 */

const VALUE_IDS = ["plain", "scope", "handson"] as const;

const OFFICES: Array<{ id: "sg" | "cn"; lines: string[] }> = [
  { id: "sg", lines: ["225 Pasir Panjang Rd", "Singapore"] },
  {
    id: "cn",
    lines: [
      "No. 67, Kangcheng Road, Lane 958, Xinsong Road",
      "Minhang District, Shanghai, China",
    ],
  },
];

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages.about" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "pages.about" });

  return (
    <>
      <SiteNav activeTab="about" />
      <main className="story">
        <header className="story-head">
          <span className="story-eyebrow">{t("eyebrow")}</span>
          <h1>{t("title")}</h1>
          <p>{t("lede")}</p>
        </header>

        <section className="story-section">
          <h2>{t("storyTitle")}</h2>
          <p>{t("storyBody")}</p>
        </section>

        <section className="story-section">
          <h2>{t("valuesTitle")}</h2>
          <div className="story-cards">
            {VALUE_IDS.map((id) => (
              <div className="story-card" key={id}>
                <h3>{t(`values.${id}.title`)}</h3>
                <p>{t(`values.${id}.body`)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="story-section">
          <h2>{t("officesTitle")}</h2>
          <div className="story-facts">
            {OFFICES.map((office) => (
              <div className="story-fact" key={office.id}>
                <div className="k">{t(`offices.${office.id}`)}</div>
                <div className="v">
                  {office.lines.map((line) => (
                    <div key={line}>{line}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="story-section">
          <h2>{t("teamTitle")}</h2>
          <p>{t("teamBody")}</p>
          <div className="story-note">{t("teamNote")}</div>
        </section>

        <div className="story-cta">
          <a className="story-btn" href="/careers">{t("ctaCareers")}</a>
          <a className="story-btn secondary" href="/contact">{t("ctaContact")}</a>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
