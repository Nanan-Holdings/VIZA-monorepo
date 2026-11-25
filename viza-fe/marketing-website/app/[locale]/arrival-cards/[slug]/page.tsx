import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import SiteHeader from "@/design-system/sections/SiteHeader";
import SiteFooter from "@/design-system/sections/SiteFooter";
import ArticleHero from "@/design-system/sections/ArticleHero";
import ArticleShell from "@/design-system/sections/ArticleShell";
import ArticleCards from "@/design-system/sections/ArticleCards";
import Button from "@/design-system/ui/Button";
import { ChevronRight } from "@/design-system/ui/Icons";
import { guideImage } from "@/lib/site-content";
import ArrivalJsonLd from "@/components/ArrivalJsonLd";
import { locales } from "@/i18n";
import { GUIDES, guideBySlug, loadGuide, localizedGuides } from "@/lib/arrival-cards";
import { pageMetadata } from "@/lib/seo/metadata";
import { portalUrl } from "@/lib/utils";
import { Link } from "@/navigation";

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.flatMap((locale) => GUIDES.map((g) => ({ locale, slug: g.slug })));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const guide = await loadGuide(slug, locale);
  if (!guide) return { robots: { index: false, follow: false } };
  return pageMetadata({
    title: guide.title,
    description: guide.description,
    path: `/arrival-cards/${slug}`,
    locale,
    ogKey: `arrival-${slug}`,
  });
}

export default async function ArrivalGuidePage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const meta = guideBySlug(slug);
  const guide = await loadGuide(slug, locale);
  if (!meta || !guide) notFound();
  const t = await getTranslations({ locale, namespace: "arrival" });
  const allGuides = await localizedGuides(locale);
  const here = allGuides.find((g) => g.slug === slug)!;
  const name = here.name;
  const country = here.country;
  const portalHref = meta.portal
    ? portalUrl(`/client/application?country=${encodeURIComponent(meta.portal.country)}&visaType=${encodeURIComponent(meta.portal.visaType)}`)
    : null;
  const others = allGuides.filter((g) => g.slug !== slug);
  const ta = await getTranslations({ locale, namespace: "ds.article" });
  const photo = guideImage([meta.visaSlug ?? "singapore"]);
  const used = new Set<string>([photo]);
  const toc = [
    ...guide.sections.map((s) => ({ id: s.id, label: s.heading })),
    { id: "steps", label: t("stepsTitle") },
    { id: "mistakes", label: t("mistakesTitle") },
    { id: "fees", label: t("feesTitle") },
    { id: "faq", label: t("faqTitle") },
    { id: "sources", label: t("sourcesTitle") },
  ];

  return (
    <>
      <SiteHeader active="arrivalCards" />
      <ArrivalJsonLd guide={guide} meta={meta} locale={locale} crumbs={{ home: t("breadcrumbHome"), hub: t("breadcrumbHub"), name }} />
      <main className="ds-main">
        <ArticleHero
          title={guide.h1}
          image={photo}
          downLabel={ta("down")}
          crumbs={[{ label: t("breadcrumbHome"), href: "/" }, { label: t("breadcrumbHub"), href: "/arrival-cards" }, { label: name }]}
        />
        <div className="ds-container">
          <div className="ds-artmeta">
            <span>{t("cardsLabel")}<b>{country}</b></span>
            <p className="ds-artmeta-lead">{guide.lead}</p>
          </div>
        </div>
        <ArticleShell toc={toc} tocTitle={ta("toc")}>
          <div className="ds-prose">
            <section aria-label={t("glanceTitle")}>
              <dl className="ds-facts-box">
                {guide.glance.map((g) => (
                  <div key={g.k}>
                    <dt>{g.k}</dt>
                    <dd>{g.v}</dd>
                  </div>
                ))}
              </dl>
              <p className="ds-art-note" style={{ marginTop: 16 }}>{t("independent")}</p>
            </section>

            <aside className="ds-portal-cta" data-cta-block={portalHref ? "viza" : "official"}>
              {portalHref ? (
                <>
                  <h2>{t("vizaTitle")}</h2>
                  <p>{t("vizaBody", { name })}</p>
                  <p>{t("vizaFee")}: <strong>{t("vizaFeeFree")}</strong></p>
                  <div className="ds-portal-actions">
                    <a className="ds-btn ds-btn--light" href={portalHref} data-cta="arrival-card" data-country={meta.portal?.country}><span>{t("vizaCta")}</span><ChevronRight className="ds-btn-icon" size={16} /></a>
                    <Button href={meta.officialUrl} variant="glass" external>{t("officialCta")}</Button>
                  </div>
                </>
              ) : (
                <>
                  <h2>{t("noVizaTitle")}</h2>
                  <p>{t("noVizaBody")}</p>
                  <div className="ds-portal-actions">
                    <Button href={meta.officialUrl} variant="light" external>{t("officialCta")}</Button>
                  </div>
                </>
              )}
            </aside>

            {guide.sections.map((s) => (
              <section key={s.id} id={s.id}>
                <h2>{s.heading}</h2>
                {s.body.map((p) => <p key={p}>{p}</p>)}
                {s.list ? <ul>{s.list.map((li) => <li key={li}>{li}</li>)}</ul> : null}
              </section>
            ))}

            <section id="steps">
              <h2>{t("stepsTitle")}</h2>
              <ol className="ds-steps">
                {guide.steps.map((s, i) => (
                  <li key={s.name} id={`step-${i + 1}`}>
                    <div>
                      <h3>{s.name}</h3>
                      <p>{s.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <section id="mistakes">
              <h2>{t("mistakesTitle")}</h2>
              <div className="ds-mini-cards">
                {guide.mistakes.map((m) => (
                  <div key={m.title}>
                    <h3>{m.title}</h3>
                    <p>{m.body}</p>
                  </div>
                ))}
              </div>
            </section>

            <section id="fees">
              <h2>{t("feesTitle")}</h2>
              <div className="ds-callout ds-callout--warn">
                {guide.fees.map((p) => <p key={p}>{p}</p>)}
              </div>
              <p>
                <a href={meta.officialUrl} target="_blank" rel="noreferrer">{t("officialLabel")}: {meta.officialHost}</a>
              </p>
            </section>

            {meta.visaSlug ? (
              <aside className="ds-callout">
                <h2>{t("visaTitle", { country })}</h2>
                <p>{t("visaBody", { country })}</p>
                <p><Link href={`/visa/${meta.visaSlug}`}>{t("visaCta", { country })} <span aria-hidden="true">→</span></Link></p>
              </aside>
            ) : null}

            <section id="faq">
              <h2>{t("faqTitle")}</h2>
              <div className="ds-faq-list-simple">
                {guide.faq.map((f) => (
                  <details key={f.q}>
                    <summary>{f.q}</summary>
                    <p>{f.a}</p>
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
        <section className="ds-container ds-section ds-section--ruled" id="more">
          <h2 className="ds-h2" style={{ marginBottom: 48 }}>{t("relatedTitle")}</h2>
          <ArticleCards
            items={others.map((g) => ({
              href: `/arrival-cards/${g.slug}`,
              image: guideImage([g.visaSlug ?? "singapore"], used),
              meta: g.country,
              title: g.name,
              body: t(`cards.${g.slug}.summary`),
              more: t("readGuide"),
            }))}
          />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
