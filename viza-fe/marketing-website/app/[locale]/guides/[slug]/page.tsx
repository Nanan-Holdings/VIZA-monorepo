import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import GuideText from "@/components/GuideText";
import { Link } from "@/navigation";
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

  return (
    <>
      <SiteNav activeTab="guides" />
      {jsonLd.map((d) => (
        <script key={d["@type"]} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(d) }} />
      ))}
      <main className="ac">
        <div className="ac-wrap">
          <nav className="ac-crumbs" aria-label="Breadcrumb">
            <ol>
              <li><Link href="/">{t("breadcrumbHome")}</Link></li>
              <li><Link href="/guides">{t("breadcrumbHub")}</Link></li>
              <li aria-current="page">{name}</li>
            </ol>
          </nav>
          <h1>{guide.h1}</h1>
          <p className="ac-lead"><GuideText text={guide.lead} /></p>
          <p className="gd-dates">
            {t("published")} <time dateTime={meta.published}>{formatDate(meta.published, locale)}</time>
            {meta.modified !== meta.published ? <> · {t("updated")} <time dateTime={meta.modified}>{formatDate(meta.modified, locale)}</time></> : null}
          </p>
          <p className="ac-note">{t("independent")}</p>

          <dl className="ac-glance" aria-label={t("glanceTitle")}>
            {guide.glance.map((g) => (
              <div key={g.k}>
                <dt>{g.k}</dt>
                <dd><GuideText text={g.v} /></dd>
              </div>
            ))}
          </dl>

          {guide.sections.map((s) => (
            <section key={s.id} id={s.id}>
              <h2>{s.heading}</h2>
              {s.body.map((p) => <p key={p}><GuideText text={p} /></p>)}
              {s.list ? <ul className="ac-list">{s.list.map((li) => <li key={li}><GuideText text={li} /></li>)}</ul> : null}
              {s.table ? (
                <div className="gd-table-wrap">
                  <table className="gd-table">
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
            <div className="ac-related">
              {visaPages.map((v) => (
                <Link className="ac-btn ghost" key={v.slug} href={`/visa/${v.slug}`}>{v.name}</Link>
              ))}
            </div>
          </section>

          {arrival.length > 0 ? (
            <section id="arrival-cards">
              <h2>{t("relatedArrivalTitle")}</h2>
              <div className="ac-related">
                {arrival.map((g) => (
                  <Link className="ac-btn ghost" key={g.slug} href={`/arrival-cards/${g.slug}`}>{zh ? g.name.zh : g.name.en}</Link>
                ))}
              </div>
            </section>
          ) : null}

          <section id="faq" className="ac-faq">
            <h2>{t("faqTitle")}</h2>
            {guide.faq.map((f) => (
              <details key={f.q}>
                <summary>{stripLinks(f.q)}</summary>
                <p><GuideText text={f.a} /></p>
              </details>
            ))}
          </section>

          <section id="sources">
            <h2>{t("sourcesTitle")}</h2>
            <ul className="ac-sources">
              {guide.sources.map((s) => (
                <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.label}</a></li>
              ))}
            </ul>
            <p className="ac-reviewed"><strong>{t("reviewedTitle")}.</strong> {guide.reviewed}</p>
          </section>

          <section id="more">
            <h2>{t("relatedGuidesTitle")}</h2>
            <div className="ac-related">
              {others.map((g) => (
                <Link className="ac-btn ghost" key={g.slug} href={`/guides/${g.slug}`}>{zh ? g.name.zh : g.name.en}</Link>
              ))}
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
