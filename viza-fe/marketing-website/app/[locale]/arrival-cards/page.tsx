import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import { Link } from "@/navigation";
import { locales } from "@/i18n";
import { GUIDES } from "@/lib/arrival-cards";
import { LOCALE_HTML_LANG, buildLocalePath, isLocale } from "@/lib/locales";
import { staticPageMetadata } from "@/lib/seo/page-meta";
import { SITE_URL } from "@/lib/seo/site";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return staticPageMetadata(params, "arrivalCards", "/arrival-cards", { ogKey: "arrival-cards" });
}

export default async function ArrivalCardsHub({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "arrival" });
  const zh = locale === "zh-CN";
  const inLanguage = isLocale(locale) ? LOCALE_HTML_LANG[locale] : "en";
  const hubUrl = `${SITE_URL}${buildLocalePath(locale, "/arrival-cards")}`;
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: t("breadcrumbHome"), item: `${SITE_URL}${buildLocalePath(locale, "/")}` },
        { "@type": "ListItem", position: 2, name: t("breadcrumbHub"), item: hubUrl },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      inLanguage,
      name: t("hubH1"),
      url: hubUrl,
      mainEntity: {
        "@type": "ItemList",
        itemListElement: GUIDES.map((g, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: `${SITE_URL}${buildLocalePath(locale, `/arrival-cards/${g.slug}`)}`,
          name: zh ? g.name.zh : g.name.en,
        })),
      },
    },
  ];

  return (
    <>
      <SiteNav activeTab="arrivalCards" />
      {jsonLd.map((d) => (
        <script key={d["@type"]} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(d) }} />
      ))}
      <main className="ac">
        <div className="ac-wrap wide">
          <nav className="ac-crumbs" aria-label="Breadcrumb">
            <ol>
              <li><Link href="/">{t("breadcrumbHome")}</Link></li>
              <li aria-current="page">{t("breadcrumbHub")}</li>
            </ol>
          </nav>
          <h1>{t("hubH1")}</h1>
          <p className="ac-lead" style={{ maxWidth: 760 }}>{t("hubLead")}</p>

          <h2 id="guides">{t("hubGuidesTitle")}</h2>
          <p>{t("hubGuidesSub")}</p>
          <div className="ac-hub-grid">
            {GUIDES.map((g) => (
              <Link className="ac-hub-card" key={g.slug} href={`/arrival-cards/${g.slug}`}>
                <span className="tag">{zh ? g.country.zh : g.country.en}</span>
                <h3>{zh ? g.name.zh : g.name.en}</h3>
                <p>{t(`cards.${g.slug}.summary`)}</p>
                <span className="when">{t("cardWhen")}: {t(`cards.${g.slug}.when`)}</span>
                <span className="go">{t("readGuide")}</span>
              </Link>
            ))}
          </div>

          <div style={{ maxWidth: 760 }}>
            <h2 id="what">{t("hubWhatTitle")}</h2>
            {(t.raw("hubWhat") as string[]).map((p) => <p key={p}>{p}</p>)}
            <h2 id="free">{t("hubFreeTitle")}</h2>
            {(t.raw("hubFree") as string[]).map((p) => <p key={p}>{p}</p>)}
            <h2 id="when">{t("hubWhenTitle")}</h2>
            {(t.raw("hubWhen") as string[]).map((p) => <p key={p}>{p}</p>)}
            <aside className="ac-box">
              <h2>{t("hubVisaTitle")}</h2>
              <p>{t("hubVisaBody")}</p>
              <div className="ac-actions">
                <Link className="ac-btn ghost" href="/">{t("hubVisaCta")}</Link>
              </div>
            </aside>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
