import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import SiteHeader from "@/design-system/sections/SiteHeader";
import SiteFooter from "@/design-system/sections/SiteFooter";
import PageHead from "@/design-system/sections/PageHead";
import ArticleCards from "@/design-system/sections/ArticleCards";
import Button from "@/design-system/ui/Button";
import { guideImage } from "@/lib/site-content";
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

  const used = new Set<string>();
  const items = GUIDES.map((g) => ({
    href: `/guides/${g.slug}`,
    image: guideImage(g.visa, used),
    meta: zh ? g.tag.zh : g.tag.en,
    title: zh ? g.name.zh : g.name.en,
    body: zh ? g.summary.zh : g.summary.en,
    more: t("readGuide"),
  }));

  return (
    <>
      <SiteHeader active="guides" />
      {jsonLd.map((d) => (
        <script key={d["@type"]} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(d) }} />
      ))}
      <main className="ds-main">
        <PageHead title={t("hubH1")} lede={t("hubLead")} />
        <section className="ds-container ds-section" style={{ paddingTop: 0 }} id="all">
          <h2 className="ds-sr">{t("hubGuidesTitle")}</h2>
          <ArticleCards items={items} />
        </section>
        <section className="ds-container ds-section ds-section--ruled">
          <div className="ds-head" data-reveal="">
            <h2 className="ds-statement">{t("hubMoreTitle")}</h2>
            <div className="ds-head-aside"><p className="ds-body">{t("hubMoreBody")}</p></div>
          </div>
          <ul className="ds-linkrow" style={{ marginTop: 32 }}>
            <li><Button href="/#destinations" variant="muted">{t("hubDestinations")}</Button></li>
            <li><Button href="/arrival-cards" variant="muted">{t("hubArrival")}</Button></li>
            <li><Button href="/blog" variant="muted">{t("hubNews")}</Button></li>
          </ul>
          <p className="ds-small" style={{ marginTop: 32, color: "var(--ds-ink-muted)" }}>{t("independent")}</p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
