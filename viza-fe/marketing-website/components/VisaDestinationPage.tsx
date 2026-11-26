"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CircleFlag } from "react-circle-flags";
import { Link } from "@/navigation";
import SiteHeader from "@/design-system/sections/SiteHeader";
import SiteFooter from "@/design-system/sections/SiteFooter";
import Photo from "@/design-system/ui/Photo";
import Button from "@/design-system/ui/Button";
import { ArrowDown, ArrowLeft, ArrowRight, Calendar, Check, Clock, Doc, Globe, Info, Pin, Shield, Tag } from "@/design-system/ui/Icons";
import { stagger } from "@/design-system/motion/delay";
import VisaStructuredData from "@/components/VisaStructuredData";
import { useCatalogue, type CatalogueCountry } from "@/components/CatalogueProvider";
import { isPublished, type CountryMeta } from "@/lib/countries";
import { displayGovernmentFeeSgd, governmentFeeSgd } from "@/lib/pricing";
import type { DestinationContent, IconName } from "@/lib/visa-content/types";
import "./visa-dest.css";

/**
 * Destination page on the Framer visa-type detail layout: back button, H1, a row of facts, a big rounded
 * photo, then a two column body. The left column is sticky (in-page section nav and the apply card); the
 * right column holds the 13 content sections from `DestinationContent`. Every section is server rendered.
 */

const SECTIONS = [
  ["glance", "tabGlance"],
  ["passports", "tabPassports"],
  ["types", "tabTypes"],
  ["residents", "tabResidents"],
  ["fees", "tabFees"],
  ["apply", "tabApply"],
  ["checklist", "tabChecklist"],
  ["rejection", "tabRejection"],
  ["travel", "tabTravel"],
  ["faq", "tabFaq"],
  ["related", "tabRelated"],
] as const;

const ICONS: Record<IconName, ReactNode> = {
  globe: <Globe size={22} />,
  clock: <Clock size={22} />,
  currency: <Tag size={22} />,
  pin: <Pin size={22} />,
  refresh: <Clock size={22} />,
  extend: <Clock size={22} />,
  alert: <Info size={22} />,
  calendar: <Calendar size={22} />,
  ban: <Info size={22} />,
  doc: <Doc size={22} />,
  photo: <Doc size={22} />,
  plane: <Globe size={22} />,
  hotel: <Pin size={22} />,
  bolt: <Clock size={22} />,
  shield: <Shield size={22} />,
};

/** Highlights the section being read in the in-page nav. The links are plain anchors, so it works without scripts. */
function SectionNav({ label, items }: { label: string; items: Array<{ id: string; text: string }> }) {
  const [active, setActive] = useState(items[0]?.id ?? "");
  useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter((e): e is HTMLElement => Boolean(e));
    if (!("IntersectionObserver" in window) || els.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-110px 0px -60% 0px", threshold: 0 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items]);
  return (
    <nav className="dp-nav" aria-label={label}>
      <ul>
        {items.map((i) => (
          <li key={i.id}>
            <a href={`#${i.id}`} aria-current={active === i.id ? "true" : undefined}>
              {i.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Section({ id, title, sub, children, index = 0 }: { id: string; title: string; sub?: string; children: ReactNode; index?: number }) {
  return (
    <section className="dp-sec" id={id} data-reveal="" style={stagger(index % 2)}>
      <h2 className="ds-statement dp-sec-title">{title}</h2>
      {sub ? <p className="ds-body dp-sec-sub">{sub}</p> : null}
      {children}
    </section>
  );
}

export default function VisaDestinationPage({
  country,
  content,
}: {
  country: CountryMeta & Pick<CatalogueCountry, "pricing">;
  content: DestinationContent;
}) {
  const locale = useLocale();
  const t = useTranslations("visa");
  const d = useTranslations("visa.dest");
  const dd = useTranslations("ds.dest");
  const tc = useTranslations("countries");
  const { countries } = useCatalogue();

  const { page } = content;
  const g = page.glance;
  const consultOnly = Boolean(country.consultOnly);
  const applyHref = `/apply?country=${encodeURIComponent(country.slug)}`;
  const ctaHref = consultOnly ? "/contact" : applyHref;
  const ctaLabel = consultOnly ? d("consultCta") : t("priceCta");
  const localName = tc.has(country.slug) ? tc(country.slug) : country.name;
  const nameOf = (slug: string, fallback: string) => (tc.has(slug) ? tc(slug) : fallback);
  const govFeeValue = governmentFeeSgd(country.pricing);
  const govFeeLabel = govFeeValue === 0 ? t("priceFree") : displayGovernmentFeeSgd(country.pricing) ?? t("govFeeSetByAuthorityShort");

  const related = page.related.destinations
    .map((slug) => countries.find((c) => c.slug === slug))
    .filter((c): c is NonNullable<typeof c> => Boolean(c && isPublished(c)));

  const faqGroups: { category: string; items: typeof content.faq }[] = [];
  for (const item of content.faq) {
    const last = faqGroups[faqGroups.length - 1];
    if (last && last.category === item.category) last.items.push(item);
    else faqGroups.push({ category: item.category, items: [item] });
  }
  let faqIndex = -1;

  const glanceItems: Array<{ icon: IconName; k: string; v: string }> = [
    { icon: "globe", k: d("glanceVisa"), v: g.needVisa },
    { icon: "currency", k: d("glanceGovFee"), v: g.govFee },
    { icon: "shield", k: d("glanceVizaFee"), v: t("priceFree") },
    { icon: "clock", k: d("glanceProcessing"), v: g.processing },
    { icon: "calendar", k: d("glanceMaxStay"), v: g.maxStay },
    { icon: "doc", k: d("glanceChecked"), v: g.checked },
  ];

  const navItems = SECTIONS.map(([id, key]) => ({ id, text: d(key) }));
  let n = 0;

  return (
    <>
      <VisaStructuredData country={country} locale={locale} localName={localName} localType={country.type} faq={content.faq} />
      <SiteHeader active="destinations" />
      <main className="ds-main dp">
        <section className="dp-hero">
          <div className="ds-container">
            <Link href="/visa" className="ds-icon-btn ds-icon-btn--dark dp-back" aria-label={dd("all")} title={dd("all")}>
              <ArrowLeft size={18} />
            </Link>
            <h1 className="ds-hero-title dp-title" data-reveal="hero">
              {content.heroTitle}
              <span className="dp-flag">
                <CircleFlag alt="" countryCode={country.flagCode} height={44} />
              </span>
              {content.heroTitleSuffix ? <span className="dp-title-suffix"> {content.heroTitleSuffix}</span> : null}
            </h1>
            <p className="ds-body dp-lede">{content.lede}</p>
            <dl className="dp-facts">
              {content.meta.map((m) => (
                <div key={m.k}>
                  <dt>{m.k}</dt>
                  <dd>{m.v}</dd>
                </div>
              ))}
            </dl>
            <div className="dp-photo">
              <Photo src={content.heroImage} alt="" sizes="(max-width: 1296px) 100vw, 1296px" priority />
              <ul className="dp-tags">
                {content.tags.map((tag) => (
                  <li key={tag.label}>{tag.label}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <div className="ds-container dp-body">
          <aside className="dp-side">
            <div className="dp-side-inner">
              <div className="ds-card dp-apply">
                <p className="dp-apply-eta">
                  <Clock size={16} />
                  <span>
                    {content.price.etaLabel} <strong>{content.price.etaValue}</strong>
                  </span>
                </p>
                <h2 className="ds-title dp-apply-title">{content.price.title}</h2>
                {content.price.saving ? <span className="dp-apply-pill">{content.price.saving}</span> : null}
                <p className="ds-small dp-apply-sub">{content.price.sub}</p>
                <dl className="dp-apply-rows">
                  <div>
                    <dt>{t("priceService")}</dt>
                    <dd>{t("priceFree")}</dd>
                  </div>
                  <div>
                    <dt>
                      {t("priceGovt")}
                      <small>{t("pillPaidToAuthority")}</small>
                    </dt>
                    <dd>{govFeeLabel}</dd>
                  </div>
                  <div className="is-total">
                    <dt>{t("priceTotalToViza")}</dt>
                    <dd>{t("priceFree")}</dd>
                  </div>
                </dl>
                <Button href={ctaHref} block>
                  {ctaLabel}
                </Button>
                <p className="ds-caption dp-apply-foot">
                  <Shield size={14} />
                  {content.price.foot}
                </p>
              </div>
              <SectionNav label={dd("onPage")} items={navItems} />
            </div>
          </aside>

          <div className="dp-content">
            <Section id="glance" title={d("glanceTitle")} index={n++}>
              <ul className="dp-glance">
                {glanceItems.map((item) => (
                  <li key={item.k} className="ds-card">
                    <span className="dp-ico" aria-hidden="true">
                      {ICONS[item.icon]}
                    </span>
                    <p className="ds-small">{item.k}</p>
                    <p className="dp-glance-v">{item.v}</p>
                  </li>
                ))}
              </ul>
            </Section>

            <Section id="passports" title={d("passportsTitle")} sub={page.passports.intro} index={n++}>
              <div className="ds-card dp-table-wrap">
                <table className="dp-table">
                  <thead>
                    <tr>
                      <th>{d("colPassport")}</th>
                      <th>{d("colEntry")}</th>
                      <th>{d("colNotes")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {page.passports.rows.map((row) => (
                      <tr key={row.passport}>
                        <th scope="row">{row.passport}</th>
                        <td className="is-strong">{row.status}</td>
                        <td>{row.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section id="types" title={d("typesTitle")} sub={page.visaTypes.intro} index={n++}>
              <div className="dp-cards">
                {page.visaTypes.items.map((item) => (
                  <article className="ds-card dp-card" key={item.title}>
                    <h3 className="ds-title">{item.title}</h3>
                    <p className="ds-body">{item.body}</p>
                  </article>
                ))}
              </div>
            </Section>

            <Section id="residents" title={d("residentsTitle")} sub={page.residents.intro} index={n++}>
              <dl className="ds-card dp-defs">
                {page.residents.rows.map((row) => (
                  <div key={row.pass}>
                    <dt>{row.pass}</dt>
                    <dd>{row.body}</dd>
                  </div>
                ))}
              </dl>
            </Section>

            <Section id="fees" title={d("feesTitle")} sub={page.fees.intro} index={n++}>
              <div className="ds-card dp-table-wrap">
                <table className="dp-table">
                  <thead>
                    <tr>
                      <th>{d("colItem")}</th>
                      <th>{d("colAmount")}</th>
                      <th>{d("colNotes")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">{d("glanceVizaFee")}</th>
                      <td className="is-strong">{t("priceFree")}</td>
                      <td>{d("vizaFeeNote")}</td>
                    </tr>
                    {page.fees.rows.map((row) => (
                      <tr key={row.item}>
                        <th scope="row">{row.item}</th>
                        <td className="is-strong">{row.amount}</td>
                        <td>{row.note ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="ds-body dp-note">{page.fees.processing}</p>
            </Section>

            <Section id="apply" title={d("applyTitle")} sub={page.apply.intro} index={n++}>
              <div className="dp-cards dp-cards--two">
                <article className="ds-card dp-card">
                  <h3 className="ds-title">{page.apply.guided.title}</h3>
                  <p className="ds-body">{page.apply.guided.body}</p>
                </article>
                <article className="ds-card dp-card dp-card--accent">
                  <h3 className="ds-title">{page.apply.fullService.title}</h3>
                  <p className="ds-body">{page.apply.fullService.body}</p>
                </article>
              </div>
              <ol className="dp-steps">
                {page.apply.steps.map((step, i) => (
                  <li key={step.title} className="ds-card">
                    <span className="dp-step-num">{i + 1}</span>
                    <div>
                      <h3 className="ds-subtitle">{step.title}</h3>
                      <p className="ds-body">{step.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Section>

            <Section id="checklist" title={d("checklistTitle")} sub={page.checklist.intro} index={n++}>
              <div className="dp-cards">
                {page.checklist.groups.map((group) => (
                  <article className="ds-card dp-card" key={group.applicant}>
                    <h3 className="ds-title">{group.applicant}</h3>
                    <ul className="dp-ticks">
                      {group.items.map((item) => (
                        <li key={item}>
                          <Check size={16} />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </Section>

            <Section id="rejection" title={content.rejectionTitle} sub={content.rejectionSub} index={n++}>
              <div className="dp-cards">
                {content.rejectionReasons.map((r) => (
                  <article className="ds-card dp-card" key={r.title}>
                    <span className="dp-ico dp-ico--warn" aria-hidden="true">
                      <Info size={22} />
                    </span>
                    <h3 className="ds-subtitle">{r.title}</h3>
                    <p className="ds-body">{r.body}</p>
                  </article>
                ))}
              </div>
            </Section>

            <Section id="travel" title={d("travelTitle")} sub={page.travel.intro} index={n++}>
              <div className="dp-cards">
                {page.travel.items.map((item) => (
                  <article className="ds-card dp-card" key={item.title}>
                    <h3 className="ds-title">{item.title}</h3>
                    <p className="ds-body">{item.body}</p>
                    {item.href && item.linkLabel ? (
                      <Link className="dp-link" href={item.href}>
                        {item.linkLabel}
                        <ArrowRight size={14} />
                      </Link>
                    ) : null}
                  </article>
                ))}
              </div>
            </Section>

            <section className="ds-card dp-reviewed" id="reviewed" data-reveal="">
              <span className="dp-ico" aria-hidden="true">
                <Shield size={22} />
              </span>
              <p className="ds-body">
                <strong>{d("reviewedBy", { date: page.reviewed.date })}</strong> {page.reviewed.note}
              </p>
            </section>

            <Section id="faq" title={t("faqTitle")} sub={content.faqSub} index={n++}>
              <div className="dp-faq">
                {faqGroups.map((group) => (
                  <div key={group.category}>
                    <p className="ds-small dp-faq-cat">{group.category}</p>
                    {group.items.map((item) => {
                      faqIndex += 1;
                      return (
                        <details className="ds-card ds-faq-item" key={item.q} open={faqIndex === 0}>
                          <summary>
                            <span className="ds-subtitle">{item.q}</span>
                            <span className="ds-icon-btn ds-icon-btn--dark ds-faq-toggle" aria-hidden="true">
                              <ArrowDown size={14} />
                            </span>
                          </summary>
                          <p className="ds-body">{item.a}</p>
                        </details>
                      );
                    })}
                  </div>
                ))}
              </div>
            </Section>

            <Section id="related" title={d("relatedTitle")} sub={d("relatedSub")} index={n++}>
              {related.length > 0 && (
                <ul className="dp-related">
                  {related.map((c) => (
                    <li key={c.slug}>
                      <Link href={`/visa/${c.slug}`} className="ds-dest">
                        <div className="ds-dest-media">
                          <Photo src={c.image} sizes="(max-width: 809px) 100vw, 320px" />
                          <span className="ds-dest-flag" aria-hidden="true">
                            <CircleFlag alt="" countryCode={c.flagCode} height={32} />
                          </span>
                        </div>
                        <div className="ds-dest-caption">
                          <h3 className="ds-title">{nameOf(c.slug, c.name)}</h3>
                          <p className="ds-small">{c.type}</p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {page.related.guides.length > 0 ? (
                <ul className="dp-guides">
                  {page.related.guides.map((guide) => (
                    <li key={guide.href}>
                      {guide.href.startsWith("http") ? (
                        <a href={guide.href} target="_blank" rel="noreferrer">
                          {guide.label}
                          <ArrowRight size={14} />
                        </a>
                      ) : (
                        <Link href={guide.href}>
                          {guide.label}
                          <ArrowRight size={14} />
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
            </Section>

            <section className="dp-start" id="start" data-reveal="">
              <h2 className="ds-hero-title">{d("startTitle")}</h2>
              <p className="ds-body">{consultOnly ? d("startConsultBody") : d("startBody")}</p>
              <Button href={ctaHref} variant="light">
                {ctaLabel}
              </Button>
            </section>

            {content.sources.length > 0 ? (
              <section className="dp-sec" id="sources">
                <h2 className="ds-statement dp-sec-title">{t("sourcesTitle")}</h2>
                <ul className="dp-sources">
                  {content.sources.map((s) => (
                    <li key={s.url}>
                      <a className="ds-card" href={s.url} target="_blank" rel="noreferrer">
                        <span className="ds-small dp-source-label">{s.label}</span>
                        <span className="ds-caption">{s.display}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
