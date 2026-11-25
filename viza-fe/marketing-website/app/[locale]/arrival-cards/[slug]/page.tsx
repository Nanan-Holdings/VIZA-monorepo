import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import ArrivalJsonLd from "@/components/ArrivalJsonLd";
import { Link } from "@/navigation";
import { locales } from "@/i18n";
import { GUIDES, guideBySlug, loadGuide } from "@/lib/arrival-cards";
import { pageMetadata } from "@/lib/seo/metadata";
import { portalUrl } from "@/lib/utils";

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
  const zh = locale === "zh-CN";
  const name = zh ? meta.name.zh : meta.name.en;
  const country = zh ? meta.country.zh : meta.country.en;
  const portalHref = meta.portal
    ? portalUrl(`/client/application?country=${encodeURIComponent(meta.portal.country)}&visaType=${encodeURIComponent(meta.portal.visaType)}`)
    : null;
  const others = GUIDES.filter((g) => g.slug !== slug);

  return (
    <>
      <SiteNav activeTab="arrivalCards" />
      <ArrivalJsonLd guide={guide} meta={meta} locale={locale} crumbs={{ home: t("breadcrumbHome"), hub: t("breadcrumbHub"), name }} />
      <main className="ac">
        <div className="ac-wrap">
          <nav className="ac-crumbs" aria-label="Breadcrumb">
            <ol>
              <li><Link href="/">{t("breadcrumbHome")}</Link></li>
              <li><Link href="/arrival-cards">{t("breadcrumbHub")}</Link></li>
              <li aria-current="page">{name}</li>
            </ol>
          </nav>
          <h1>{guide.h1}</h1>
          <p className="ac-lead">{guide.lead}</p>
          <p className="ac-note">{t("independent")}</p>

          <dl className="ac-glance" aria-label={t("glanceTitle")}>
            {guide.glance.map((g) => (
              <div key={g.k}>
                <dt>{g.k}</dt>
                <dd>{g.v}</dd>
              </div>
            ))}
          </dl>

          <aside className="ac-box" data-cta-block={portalHref ? "viza" : "official"}>
            {portalHref ? (
              <>
                <h2>{t("vizaTitle")}</h2>
                <p>{t("vizaBody", { name })}</p>
                <p className="ac-fee">{t("vizaFee")}: <strong>{t("vizaFeeFree")}</strong></p>
                <div className="ac-actions">
                  <a className="ac-btn" href={portalHref} data-cta="arrival-card" data-country={meta.portal?.country}>{t("vizaCta")}</a>
                  <a className="ac-btn ghost" href={meta.officialUrl} target="_blank" rel="noreferrer">{t("officialCta")}</a>
                </div>
              </>
            ) : (
              <>
                <h2>{t("noVizaTitle")}</h2>
                <p>{t("noVizaBody")}</p>
                <div className="ac-actions">
                  <a className="ac-btn" href={meta.officialUrl} target="_blank" rel="noreferrer">{t("officialCta")}</a>
                </div>
              </>
            )}
          </aside>

          {guide.sections.map((s) => (
            <section key={s.id} id={s.id}>
              <h2>{s.heading}</h2>
              {s.body.map((p) => <p key={p}>{p}</p>)}
              {s.list ? <ul className="ac-list">{s.list.map((li) => <li key={li}>{li}</li>)}</ul> : null}
            </section>
          ))}

          <section id="steps">
            <h2>{t("stepsTitle")}</h2>
            <ol className="ac-steps">
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
            <div className="ac-cards">
              {guide.mistakes.map((m) => (
                <div className="ac-card" key={m.title}>
                  <h3>{m.title}</h3>
                  <p>{m.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="fees">
            <h2>{t("feesTitle")}</h2>
            {guide.fees.map((p) => <p key={p}>{p}</p>)}
            <p>
              <a className="ac-link" href={meta.officialUrl} target="_blank" rel="noreferrer">{t("officialLabel")}: {meta.officialHost}</a>
            </p>
          </section>

          {meta.visaSlug ? (
            <aside className="ac-box">
              <h2>{t("visaTitle", { country })}</h2>
              <p>{t("visaBody", { country })}</p>
              <div className="ac-actions">
                <Link className="ac-btn ghost" href={`/visa/${meta.visaSlug}`}>{t("visaCta", { country })}</Link>
              </div>
            </aside>
          ) : null}

          <section id="faq" className="ac-faq">
            <h2>{t("faqTitle")}</h2>
            {guide.faq.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
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
            <h2>{t("relatedTitle")}</h2>
            <div className="ac-related">
              {others.map((g) => (
                <Link className="ac-btn ghost" key={g.slug} href={`/arrival-cards/${g.slug}`}>{zh ? g.name.zh : g.name.en}</Link>
              ))}
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
