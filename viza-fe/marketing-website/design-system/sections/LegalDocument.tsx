import { getTranslations } from "next-intl/server";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import PageHead from "./PageHead";
import ArticleShell from "./ArticleShell";
import GuideText from "@/components/GuideText";
import { COMPANY, LEGAL_UPDATED, getLegal, type LegalSlug } from "@/lib/legal";
import { LOCALE_HTML_LANG, buildLocalePath, isLocale } from "@/lib/locales";
import { SITE_URL } from "@/lib/seo/site";

const PATHS: Record<LegalSlug, string> = {
  terms: "/legal/terms",
  privacy: "/legal/privacy",
  refunds: "/refunds",
  "business-information": "/business-information",
};

function formatDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(iso));
}

/**
 * A legal page on the Kelin Studio template ("1. Who we are", then numbered sections), set as a Framer legal page:
 * a large plain title, a "last updated" line, a contents column and a readable text column. Server rendered.
 */
export default async function LegalDocument({ slug, locale }: { slug: LegalSlug; locale: string }) {
  const doc = getLegal(slug, locale);
  const t = await getTranslations({ locale, namespace: "ds.legal" });
  const th = await getTranslations({ locale, namespace: "guides" });
  const inLanguage = isLocale(locale) ? LOCALE_HTML_LANG[locale] : "en";
  const url = `${SITE_URL}${buildLocalePath(locale, PATHS[slug])}`;
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: th("breadcrumbHome"), item: `${SITE_URL}${buildLocalePath(locale, "/")}` },
        { "@type": "ListItem", position: 2, name: doc.title, item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: doc.title,
      url,
      inLanguage,
      dateModified: LEGAL_UPDATED,
      publisher: { "@type": "Organization", name: COMPANY.legalName, url: COMPANY.url },
    },
  ];

  return (
    <>
      <SiteHeader />
      {jsonLd.map((d) => (
        <script key={d["@type"]} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(d) }} />
      ))}
      <main className="ds-main ds-legal">
        <PageHead title={doc.title} lede={doc.lede} meta={[{ label: t("updated"), value: formatDate(LEGAL_UPDATED, locale) }]} />
        <div className="ds-container">
          <hr className="ds-rule" />
        </div>
        <ArticleShell toc={doc.sections.length > 2 ? doc.sections.map((s) => ({ id: s.id, label: s.heading })) : []} tocTitle={t("contents")} id="legal-text">
          <div className="ds-prose">
            {doc.sections.map((s) => (
              <section key={s.id} id={s.id} className="ds-legal-section">
                <h2>{s.heading}</h2>
                {s.blocks.map((b, i) => {
                  if (b.t === "p") return <p key={i}><GuideText text={b.text} /></p>;
                  if (b.t === "ul") return <ul key={i}>{b.items.map((li) => <li key={li}><GuideText text={li} /></li>)}</ul>;
                  if (b.t === "note") return <div key={i} className="ds-callout"><p><GuideText text={b.text} /></p></div>;
                  return (
                    <dl key={i} className="ds-legal-facts">
                      {b.rows.map(([k, v]) => (
                        <div key={k} style={{ display: "contents" }}>
                          <dt>{k}</dt>
                          <dd><GuideText text={v} /></dd>
                        </div>
                      ))}
                    </dl>
                  );
                })}
              </section>
            ))}
          </div>
        </ArticleShell>
      </main>
      <SiteFooter />
    </>
  );
}
