import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import SiteHeader from "@/design-system/sections/SiteHeader";
import SiteFooter from "@/design-system/sections/SiteFooter";
import PageHead from "@/design-system/sections/PageHead";
import ArticleCards from "@/design-system/sections/ArticleCards";
import Button from "@/design-system/ui/Button";
import { guideImage } from "@/lib/site-content";
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

  const used = new Set<string>();
  const items = GUIDES.map((g) => ({
    href: `/arrival-cards/${g.slug}`,
    image: guideImage([g.visaSlug ?? "singapore"], used),
    meta: `${zh ? g.country.zh : g.country.en} · ${t("cardWhen")}: ${t(`cards.${g.slug}.when`)}`,
    title: zh ? g.name.zh : g.name.en,
    body: t(`cards.${g.slug}.summary`),
    more: t("readGuide"),
  }));

  return (
    <>
      <SiteHeader active="arrivalCards" />
      {jsonLd.map((d) => (
        <script key={d["@type"]} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(d) }} />
      ))}
      <main className="ds-main">
        <PageHead title={t("hubH1")} lede={t("hubLead")} />
        <section className="ds-container ds-section" style={{ paddingTop: 0 }} id="guides">
          <h2 className="ds-sr">{t("hubGuidesTitle")}</h2>
          <ArticleCards items={items} />
        </section>
        <section className="ds-container ds-section ds-section--ruled">
          <div className="ds-prose ds-hub-prose">
            <div>
              <h2 id="what">{t("hubWhatTitle")}</h2>
              {(t.raw("hubWhat") as string[]).map((p) => <p key={p}>{p}</p>)}
            </div>
            <div>
              <h2 id="free">{t("hubFreeTitle")}</h2>
              {(t.raw("hubFree") as string[]).map((p) => <p key={p}>{p}</p>)}
            </div>
            <div>
              <h2 id="when">{t("hubWhenTitle")}</h2>
              {(t.raw("hubWhen") as string[]).map((p) => <p key={p}>{p}</p>)}
            </div>
          </div>
        </section>
        <section className="ds-container ds-section ds-section--ruled">
          <div className="ds-head" data-reveal="">
            <h2 className="ds-statement">{t("hubVisaTitle")}</h2>
            <div className="ds-head-aside">
              <p className="ds-body">{t("hubVisaBody")}</p>
              <Button href="/#destinations">{t("hubVisaCta")}</Button>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
