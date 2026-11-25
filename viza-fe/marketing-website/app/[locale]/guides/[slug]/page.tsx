import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import SiteHeader from "@/design-system/sections/SiteHeader";
import SiteFooter from "@/design-system/sections/SiteFooter";
import ArticleHero from "@/design-system/sections/ArticleHero";
import ArticleShell from "@/design-system/sections/ArticleShell";
import ArticleCards from "@/design-system/sections/ArticleCards";
import Button from "@/design-system/ui/Button";
import { guideImage } from "@/lib/site-content";
import GuideText from "@/components/GuideText";
import { locales } from "@/i18n";
import { GUIDES, guideBySlug, loadGuide } from "@/lib/guides";
import { stripLinks } from "@/lib/guides/text";
import { GUIDES as ARRIVAL_GUIDES } from "@/lib/arrival-cards";
import { COUNTRIES } from "@/lib/countries";
import { LOCALE_HTML_LANG, buildLocalePath, isLocale } from "@/lib/locales";
import { ogImagePath, pageMetadata } from "@/lib/seo/metadata";
import { SITE_URL } from "@/lib/seo/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.flatMap((locale) => GUIDES.map((g) => ({ locale, slug: g.slug })));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const guide = await loadGuide(slug, locale);
  const meta = guideBySlug(slug);
  if (!guide || !meta) return { robots: { index: false, follow: false } };
  return pageMetadata({
    title: guide.title,
    description: guide.description,
    path: `/guides/${slug}`,
    locale,
    ogKey: `guide-${slug}`,
    ogType: "article",
    article: { publishedTime: meta.published, modifiedTime: meta.modified, authors: ["VIZA"] },
  });
}

function formatDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(iso));
}

export default async function GuidePage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const meta = guideBySlug(slug);
  const guide = await loadGuide(slug, locale);
  if (!meta || !guide) notFound();
  const t = await getTranslations({ locale, namespace: "guides" });
  const tc = await getTranslations({ locale, namespace: "countries" });
  const zh = locale === "zh-CN";
  const inLanguage = isLocale(locale) ? LOCALE_HTML_LANG[locale] : "en";
  const url = `${SITE_URL}${buildLocalePath(locale, `/guides/${slug}`)}`;
  const name = zh ? meta.name.zh : meta.name.en;
  const others = GUIDES.filter((g) => g.slug !== slug);
  const visaPages = meta.visa.map((s) => {
    const c = COUNTRIES.find((x) => x.slug === s);
    return { slug: s, name: tc.has(s) ? tc(s) : (c?.name ?? s) };
  });
  const arrival = ARRIVAL_GUIDES.filter((g) => meta.arrival.includes(g.slug));

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: t("breadcrumbHome"), item: `${SITE_URL}${buildLocalePath(locale, "/")}` },
        { "@type": "ListItem", position: 2, name: t("breadcrumbHub"), item: `${SITE_URL}${buildLocalePath(locale, "/guides")}` },
        { "@type": "ListItem", position: 3, name, item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: guide.h1,
      description: guide.description,
      inLanguage,
      datePublished: meta.published,
      dateModified: meta.modified,
      mainEntityOfPage: url,
      image: `${SITE_URL}${ogImagePath(`guide-${slug}`, locale)}`,
      author: { "@type": "Organization", name: "VIZA", url: SITE_URL },
      publisher: { "@type": "Organization", name: "VIZA", url: SITE_URL },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      inLanguage,
      mainEntity: guide.faq.map((f) => ({ "@type": "Question", name: stripLinks(f.q), acceptedAnswer: { "@type": "Answer", text: stripLinks(f.a) } })),
    },
  ];

  const ta = await getTranslations({ locale, namespace: "ds.article" });
  const used = new Set<string>([guideImage(meta.visa)]);
  const toc = [
    ...guide.sections.map((s) => ({ id: s.id, label: s.heading })),
    { id: "destinations", label: t("relatedVisaTitle") },
    ...(arrival.length > 0 ? [{ id: "arrival-cards", label: t("relatedArrivalTitle") }] : []),
    { id: "faq", label: t("faqTitle") },
    { id: "sources", label: t("sourcesTitle") },
  ];

  return (
    <>
      <SiteHeader active="guides" />
      {jsonLd.map((d) => (
        <script key={d["@type"]} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(d) }} />
      ))}
      <main className="ds-main">
        <ArticleHero
          title={guide.h1}
          image={guideImage(meta.visa)}
          downLabel={ta("down")}
          crumbs={[{ label: t("breadcrumbHome"), href: "/" }, { label: t("breadcrumbHub"), href: "/guides" }, { label: name }]}
        />
        <div className="ds-container">
          <div className="ds-artmeta">
            <span>{t("published")}<b><time dateTime={meta.published}>{formatDate(meta.published, locale)}</time></b></span>
            {meta.modified !== meta.published ? <span>{t("updated")}<b><time dateTime={meta.modified}>{formatDate(meta.modified, locale)}</time></b></span> : null}
            <span>{zh ? meta.tag.zh : meta.tag.en}</span>
            <p className="ds-artmeta-lead"><GuideText text={guide.lead} /></p>
          </div>
        </div>
        <ArticleShell toc={toc} tocTitle={ta("toc")}>
          <div className="ds-prose">
            <section aria-label={t("glanceTitle")}>
              <dl className="ds-facts-box">
                {guide.glance.map((g) => (
                  <div key={g.k}>
                    <dt>{g.k}</dt>
                    <dd><GuideText text={g.v} /></dd>
                  </div>
                ))}
              </dl>
              <p className="ds-art-note" style={{ marginTop: 16 }}>{t("independent")}</p>
            </section>

            {guide.sections.map((s) => (
              <section key={s.id} id={s.id}>
                <h2>{s.heading}</h2>
                {s.body.map((p) => <p key={p}><GuideText text={p} /></p>)}
                {s.list ? <ul>{s.list.map((li) => <li key={li}><GuideText text={li} /></li>)}</ul> : null}
                {s.table ? (
                  <div className="ds-table-wrap">
                    <table>
                      <thead>
                        <tr>{s.table.head.map((h) => <th key={h} scope="col">{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {s.table.rows.map((row) => (
                          <tr key={row.join("|")}>{row.map((cell, i) => <td key={`${i}-${cell}`}><GuideText text={cell} /></td>)}</tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </section>
            ))}

            <section id="destinations">
              <h2>{t("relatedVisaTitle")}</h2>
              <p>{t("relatedVisaSub")}</p>
              <ul className="ds-linkrow" style={{ padding: 0 }}>
                {visaPages.map((v) => (
                  <li key={v.slug}><Button href={`/visa/${v.slug}`} variant="muted">{v.name}</Button></li>
                ))}
              </ul>
            </section>

            {arrival.length > 0 ? (
              <section id="arrival-cards">
                <h2>{t("relatedArrivalTitle")}</h2>
                <ul className="ds-linkrow" style={{ padding: 0 }}>
                  {arrival.map((g) => (
                    <li key={g.slug}><Button href={`/arrival-cards/${g.slug}`} variant="muted">{zh ? g.name.zh : g.name.en}</Button></li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section id="faq">
              <h2>{t("faqTitle")}</h2>
              <div className="ds-faq-list-simple">
                {guide.faq.map((f) => (
                  <details key={f.q}>
                    <summary>{stripLinks(f.q)}</summary>
                    <p><GuideText text={f.a} /></p>
                  </details>
                ))}
              </div>
            </section>

            <section id="sources">
              <h2>{t("sourcesTitle")}</h2>
              <ul className="ds-sources">
                {guide.sources.map((s) => (
                  <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.label}</a></li>
                ))}
              </ul>
              <p className="ds-reviewed"><strong>{t("reviewedTitle")}.</strong> {guide.reviewed}</p>
            </section>
          </div>
        </ArticleShell>
        <section className="ds-container ds-section ds-section--ruled">
          <h2 className="ds-h2" style={{ marginBottom: 48 }}>{t("relatedGuidesTitle")}</h2>
          <ArticleCards
            items={others.map((g) => ({
              href: `/guides/${g.slug}`,
              image: guideImage(g.visa, used),
              meta: zh ? g.tag.zh : g.tag.en,
              title: zh ? g.name.zh : g.name.en,
              body: zh ? g.summary.zh : g.summary.en,
              more: t("readGuide"),
            }))}
          />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
