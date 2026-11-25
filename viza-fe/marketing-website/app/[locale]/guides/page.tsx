import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import { Link } from "@/navigation";
import { locales } from "@/i18n";
import { GUIDES } from "@/lib/guides";
import { LOCALE_HTML_LANG, buildLocalePath, isLocale } from "@/lib/locales";
import { staticPageMetadata } from "@/lib/seo/page-meta";
import { SITE_URL } from "@/lib/seo/site";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return staticPageMetadata(params, "guides", "/guides", { ogKey: "guides" });
}

export default async function GuidesHub({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "guides" });
  const zh = locale === "zh-CN";
  const inLanguage = isLocale(locale) ? LOCALE_HTML_LANG[locale] : "en";
  const hubUrl = `${SITE_URL}${buildLocalePath(locale, "/guides")}`;
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
          url: `${SITE_URL}${buildLocalePath(locale, `/guides/${g.slug}`)}`,
          name: zh ? g.name.zh : g.name.en,
        })),
      },
    },
  ];

  return (
    <>
      <SiteNav activeTab="guides" />
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

          <h2 id="all">{t("hubGuidesTitle")}</h2>
          <p>{t("hubGuidesSub")}</p>
          <div className="ac-hub-grid">
            {GUIDES.map((g) => (
              <Link className="ac-hub-card" key={g.slug} href={`/guides/${g.slug}`}>
                <span className="tag">{zh ? g.tag.zh : g.tag.en}</span>
                <h3>{zh ? g.name.zh : g.name.en}</h3>
                <p>{zh ? g.summary.zh : g.summary.en}</p>
                <span className="go">{t("readGuide")}</span>
              </Link>
            ))}
          </div>

          <aside className="ac-box">
            <h2>{t("hubMoreTitle")}</h2>
            <p>{t("hubMoreBody")}</p>
            <div className="ac-actions">
              <Link className="ac-btn ghost" href="/">{t("hubDestinations")}</Link>
              <Link className="ac-btn ghost" href="/arrival-cards">{t("hubArrival")}</Link>
              <Link className="ac-btn ghost" href="/blog">{t("hubNews")}</Link>
            </div>
          </aside>
          <p className="ac-note" style={{ marginTop: 20 }}>{t("independent")}</p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
