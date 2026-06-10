"use client";

import { useEffect, type CSSProperties, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CircleFlag } from "react-circle-flags";
import SiteNav from "@/components/SiteNav";
import { LAUNCHED_COUNTRIES, visaHref, type CountryMeta } from "@/lib/countries";
import { priceBreakdownSgd } from "@/lib/pricing";
import type { IconName, VisaContent } from "@/lib/visa-content/types";
import "./visa-rich.css";

/**
 * Reusable, data-driven visa destination page (MKT-004/005).
 *
 * Renders the full rich layout (hero, overview, process, documents, rejection
 * reasons, entry/exit, extension, reviews, nearby, FAQ, sources, sticky price
 * card, AI bar, footer) from a `VisaContent` object. This replaces the former
 * bespoke Indonesia page + thin `VisaCountryTemplate` split so every country
 * gets the same polished UI with its own information.
 *
 * Marketing non-negotiable: zero auth/payment SDK imports. The single CTA links
 * to the country-aware `/apply` wizard; payment happens later in the portal.
 */

/** Icon registry — `VisaContent` references these by `IconName`. */
const ICONS: Record<IconName, ReactNode> = {
  globe: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15 15 0 0 1 0 20" /><path d="M12 2a15 15 0 0 0 0 20" /></svg>
  ),
  clock: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
  ),
  currency: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M2 12h20" /></svg>
  ),
  pin: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
  ),
  refresh: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
  ),
  extend: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
  ),
  alert: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
  ),
  calendar: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
  ),
  ban: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></svg>
  ),
  doc: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
  ),
  photo: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M2 20a10 10 0 0 1 20 0" /></svg>
  ),
  plane: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" /></svg>
  ),
  hotel: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7h18M5 7v13a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7" /><path d="M9 4h6v3H9z" /></svg>
  ),
  bolt: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" /></svg>
  ),
  shield: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></svg>
  ),
};

function applyHref(locale: string, slug: string): string {
  const prefix = locale === "en" ? "" : `/${locale}`;
  return `${prefix}/apply?country=${encodeURIComponent(slug)}`;
}

export default function VisaCountryRich({
  country,
  content,
}: {
  country: CountryMeta;
  content: VisaContent;
}) {
  const locale = useLocale();
  const t = useTranslations("visa");
  const tc = useTranslations("countries");

  // Section-tab pill + scroll-spy. Layout-driven (not country-specific) — kept
  // verbatim from the former bespoke Indonesia page.
  useEffect(() => {
    const sectionTabs = document.querySelectorAll<HTMLButtonElement>(".section-tab");
    const sectionTabHandlers: Array<{ el: Element; handler: () => void }> = [];
    sectionTabs.forEach((t) => {
      const handler = () => {
        const target = document.getElementById(t.dataset.target || "");
        if (!target) return;
        window.scrollTo({ top: target.offsetTop - 140, behavior: "smooth" });
      };
      t.addEventListener("click", handler);
      sectionTabHandlers.push({ el: t, handler });
    });

    const sections = [...sectionTabs]
      .map((t) => document.getElementById(t.dataset.target || ""))
      .filter((s): s is HTMLElement => Boolean(s));

    function onScroll() {
      const y = window.scrollY + 200;
      let activeIdx = 0;
      sections.forEach((s, i) => {
        if (s.offsetTop <= y) activeIdx = i;
      });
      sectionTabs.forEach((t, i) => t.classList.toggle("active", i === activeIdx));
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      sectionTabHandlers.forEach(({ el, handler }) => el.removeEventListener("click", handler));
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const nearby = LAUNCHED_COUNTRIES.filter((c) => c.slug !== country.slug).slice(0, 4);
  const price = priceBreakdownSgd(country.visaType);

  // Group FAQ by category, preserving authoring order.
  const faqGroups: { category: string; items: typeof content.faq }[] = [];
  for (const item of content.faq) {
    const last = faqGroups[faqGroups.length - 1];
    if (last && last.category === item.category) last.items.push(item);
    else faqGroups.push({ category: item.category, items: [item] });
  }
  let faqIndex = -1;

  return (
    <>
      <SiteNav />

      <div className="visa-grid">
        {/* Hero */}
        <header
          className="hero"
          style={{ ["--hero-img"]: `url('${content.heroImage}')` } as CSSProperties}
        >
          <div className="hero-left">
            <a href="/" className="hero-back">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
              {t("back")}
            </a>
            <h1>
              {content.heroTitle}
              <span className="title-flag"><CircleFlag countryCode={country.flagCode} height={34} /></span>
              {content.heroTitleSuffix ? <><br />{content.heroTitleSuffix}</> : null}
            </h1>
            <p className="lede">{content.lede}</p>

            <div className="hero-meta">
              {content.meta.map((m) => (
                <div className="m" key={m.k}>
                  <div className="k">{m.k}</div>
                  <div className="v">{m.v}</div>
                </div>
              ))}
            </div>

            <div className="hero-tags">
              {content.tags.map((tag) => (
                <span className="hero-tag" key={tag.label}>
                  {ICONS[tag.icon]}
                  {tag.label}
                </span>
              ))}
            </div>
          </div>
        </header>

        {/* Section tabs */}
        <div className="section-tabs-wrap">
          <div className="section-tabs" id="sectionTabs">
            <button className="section-tab active" data-target="overview">{t("tabOverview")}</button>
            <button className="section-tab" data-target="process">{t("tabProcess")}</button>
            <button className="section-tab" data-target="docs">{t("tabDocuments")}</button>
            <button className="section-tab" data-target="rejection">{t("tabRejection")}</button>
            <button className="section-tab" data-target="entry">{t("tabEntry")}</button>
            <button className="section-tab" data-target="extension">{t("tabExtension")}</button>
            <button className="section-tab" data-target="reviews">{t("tabReviews")}</button>
            <button className="section-tab" data-target="nearby">{t("tabNearby")}</button>
            <button className="section-tab" data-target="faq">{t("tabFaq")}</button>
          </div>
        </div>

        {/* Page */}
        <main className="col-main">
          {/* Overview */}
          <section className="block" id="overview">
            <h2>{content.overviewTitle}</h2>
            <p className="block-sub">{content.overviewSub}</p>
            <div className="glance">
              {content.glance.map((g) => (
                <div className="g" key={g.k}>
                  <div className="ico">{ICONS[g.icon]}</div>
                  <div className="k">{g.k}</div>
                  <div className="v">{g.v}</div>
                  {g.sub ? <div className="sub">{g.sub}</div> : null}
                </div>
              ))}
            </div>
          </section>

          {/* Process */}
          <section className="block" id="process">
            <h2>{content.processTitle}</h2>
            <p className="block-sub">{content.processSub}</p>
            <div className="steps">
              {content.steps.map((step, i) => (
                <div className={`step${step.delivered ? " delivered" : ""}`} key={i}>
                  <div className="num">{i + 1}</div>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                    {step.statusRows ? (
                      <div className="step-status">
                        {step.statusRows.map((row, ri) => (
                          <div className="row" key={ri}>
                            <span className="dot"></span>
                            {row.label}
                            <span className="ts">{row.ts}</span>
                            {row.onTime ? <span className="ontime">{t("onTime")}</span> : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Documents */}
          <section className="block" id="docs">
            <h2>{content.docsTitle}</h2>
            <p className="block-sub">{content.docsSub}</p>
            <div className="docs">
              {content.documents.map((d) => (
                <div className="doc" key={d.name}>
                  <div className="ico">{ICONS.doc}</div>
                  <div>
                    <div className="nm">{d.name}</div>
                    <div className="sub">{d.sub}</div>
                  </div>
                  <svg className="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                </div>
              ))}
            </div>
          </section>

          {/* Rejection reasons */}
          <section className="block" id="rejection">
            <h2>{content.rejectionTitle}</h2>
            <p className="block-sub">{content.rejectionSub}</p>
            <div className="reasons">
              {content.rejectionReasons.map((r) => (
                <div className="reason" key={r.title}>
                  <div className="ico">{ICONS.alert}</div>
                  <h4>{r.title}</h4>
                  <p>{r.body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Entry / exit */}
          <section className="block" id="entry">
            <h2>{content.entryTitle}</h2>
            <p className="block-sub">{content.entrySub}</p>
            <div className="glance">
              {content.entryExit.map((g) => (
                <div className="g" key={g.k}>
                  <div className="ico">{ICONS[g.icon]}</div>
                  <div className="k">{g.k}</div>
                  <div className="v">{g.v}</div>
                  {g.sub ? <div className="sub">{g.sub}</div> : null}
                </div>
              ))}
            </div>
          </section>

          {/* Extension */}
          <section className="block" id="extension">
            <h2>{content.extensionTitle}</h2>
            <p className="block-sub">{content.extensionSub}</p>
            <div className="glance">
              {content.extension.map((g) => (
                <div className="g" key={g.k}>
                  <div className="ico">{ICONS[g.icon]}</div>
                  <div className="k">{g.k}</div>
                  <div className="v">{g.v}</div>
                  {g.sub ? <div className="sub">{g.sub}</div> : null}
                </div>
              ))}
            </div>
          </section>

          {/* Reviews */}
          <section className="block" id="reviews">
            <h2>{t("reviewsTitle")}</h2>
            <div className="reviews-head">
              <div>
                <div className="score">{content.reviews.score} {content.reviews.outOf ? <small>{content.reviews.outOf}</small> : null}</div>
                <div className="stars">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26" /></svg>
                  ))}
                </div>
                <div className="score-sub">{content.reviews.sub}</div>
              </div>
              <div className="platforms">
                {content.reviews.platforms.map((p) => (
                  <span className="platform-pill" key={p.name}><span className="star">★</span> {p.rating} {p.name}</span>
                ))}
              </div>
            </div>

            <div className="reviews">
              {content.reviews.items.map((r) => (
                <div className="review" key={r.name}>
                  <div className="top">
                    <div className="av">{r.initials}</div>
                    <div className="meta">
                      <div className="nm">{r.name}</div>
                      <div className="src">{r.source}</div>
                    </div>
                  </div>
                  <h4>{r.title}</h4>
                  <p>{r.body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Nearby */}
          <section className="block" id="nearby">
            <h2>{t("nearbyTitle")}</h2>
            <p className="block-sub">{t("nearbySub")}</p>
            <div className="nearby">
              {nearby.map((c) => (
                <a className="near" href={visaHref(c.slug)} key={c.slug}>
                  <div className="img" style={{ backgroundImage: `url('${c.image}')` }}></div>
                  <div className="body">
                    <div>
                      <div className="nm">{tc.has(c.slug) ? tc(c.slug) : c.name}</div>
                      <div className="eta">{c.type}</div>
                    </div>
                    <span className="arrow"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg></span>
                  </div>
                </a>
              ))}
            </div>
          </section>

          {/* FAQ */}
          <section className="block" id="faq">
            <h2>{t("faqTitle")}</h2>
            <p className="block-sub">{content.faqSub}</p>
            <div className="faq">
              {faqGroups.map((group) => (
                <div key={group.category}>
                  <div className="faq-cat">{group.category}</div>
                  {group.items.map((item) => {
                    faqIndex += 1;
                    return (
                      <details className="q" key={item.q} open={faqIndex === 0}>
                        <summary>
                          {item.q}
                          <span className="plus"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg></span>
                        </summary>
                        <div className="a">{item.a}</div>
                      </details>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="editorial">
              <div className="ico">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></svg>
              </div>
              <p>{t("editorial")} <a href="#">{t("editorialLink")}</a>.</p>
            </div>
          </section>

          {/* Sources */}
          {content.sources.length > 0 ? (
            <section className="block" id="sources">
              <h2>{t("sourcesTitle")}</h2>
              <div className="sources">
                {content.sources.map((s) => (
                  <a className="source" href={s.url} target="_blank" rel="noreferrer" key={s.url}>
                    <span className="ico"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg></span>
                    <span className="lk">{s.label}</span>
                    <span className="url">{s.display}</span>
                  </a>
                ))}
              </div>
            </section>
          ) : null}
        </main>

        <aside className="col-side">
          <div className="price-card">
            <div className="price-eta">
              <div className="ico">{ICONS.bolt}</div>
              <div className="text">
                <span className="lab">{content.price.etaLabel}</span>
                <span className="val">{content.price.etaValue}</span>
              </div>
            </div>

            <div className="price-head">
              <h3>{content.price.title}</h3>
              {content.price.saving ? <span className="saving">{content.price.saving}</span> : null}
            </div>
            <p className="price-sub">{content.price.sub}</p>

            {price ? (
              <div className="price-rows">
                <div className="price-row">
                  <span className="lk">{t("priceGovt")} <span className="pill">{t("pillCheckout")}</span></span>
                  <span className="vk">SGD {price.govtSgd}</span>
                </div>
                <div className="price-row">
                  <span className="lk">{t("priceProcessing")} <span className="pill later">{t("pillAllInclusive")}</span></span>
                  <span className="vk">SGD {price.agencySgd}</span>
                </div>
                <div className="price-total">
                  <span className="lk">{t("priceTotal")}</span>
                  <span className="vk">SGD {price.totalSgd}</span>
                </div>
              </div>
            ) : null}

            <a href={applyHref(locale, country.slug)} className="price-cta" style={{ textDecoration: "none" }}>
              {t("priceCta")}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
            </a>
            <div className="price-foot">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></svg>
              {content.price.foot}
            </div>
          </div>
        </aside>
      </div>

      {/* AI bar */}
      <div className="ai-bar">
        <div className="spark">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 14.39 8.84 22 9.27 16.5 14.5 17.62 22 12 18.27 6.38 22 7.5 14.5 2 9.27 9.61 8.84z" /></svg>
        </div>
        <input placeholder={content.aiPlaceholder} />
        <button className="send" aria-label="Ask">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
        </button>
      </div>

      {/* Site footer */}
      <footer className="site-foot" data-screen-label="Footer">
        <div className="foot-rule"></div>

        <div className="foot-main">
          <div className="foot-brand">
            <a className="foot-logo" href="/"><img src="/assets/viza-logo-black.svg" alt="VIZA" /></a>
            <p className="foot-tag">VIZA helps you plan, apply, and track visas seamlessly across the world.</p>

            <div className="ask-ai">Ask AI about VIZA</div>
            <div className="ai-chips">
              <button className="ai-chip c1" title="Ask in your AI assistant">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
              </button>
              <button className="ai-chip c2" title="Ask in your AI assistant">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /><path d="M11 8v6" /><path d="M8 11h6" /></svg>
              </button>
              <button className="ai-chip c3" title="Ask in your AI assistant">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 13.8 8.4 20 10.5 13.8 12.6 12 19 10.2 12.6 4 10.5 10.2 8.4 12 2Z" /></svg>
              </button>
              <button className="ai-chip c4" title="Ask in your AI assistant">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4" /><path d="M12 18v4" /><path d="M4.93 4.93l2.83 2.83" /><path d="M16.24 16.24l2.83 2.83" /><path d="M2 12h4" /><path d="M18 12h4" /><path d="M4.93 19.07l2.83-2.83" /><path d="M16.24 7.76l2.83-2.83" /></svg>
              </button>
            </div>
          </div>

          <div className="col-company">
            <h4 className="col-head">Company</h4>
            <ul className="col-list">
              <li><a href="/careers">Careers</a></li>
              <li><a href="/contact">Contact</a></li>
              <li><a href="/security">Security</a></li>
              <li><a href="/refunds">Refunds Policy</a></li>
              <li><a href="/status">Status</a></li>
              <li><a href="/legal/privacy">Privacy</a></li>
              <li><a href="/legal/terms">Terms</a></li>
            </ul>
          </div>

          <div className="col-products">
            <h4 className="col-head">Products</h4>
            <ul className="col-list">
              <li><a href="#">U.S. Mock Interview</a></li>
              <li><a href="#">Visa Requirements</a></li>
              <li><a href="#">Schengen Appointment Checker</a></li>
              <li><a href="#">Visa Photo Creator</a></li>
              <li><a href="#">VIZA Emergency Helpline</a></li>
              <li><a href="#">Student Visa</a></li>
            </ul>
          </div>

          <div className="col-offices">
            <h4 className="col-head">Offices</h4>
            <ul className="col-list">
              <li className="office-row">
                <svg className="office-pin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                <span>1 Marina Boulevard, #20-01,<br />Singapore 018989</span>
              </li>
              <li className="office-row">
                <svg className="office-pin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                <span>301 Mission Street, San Francisco,<br />CA 94105, USA</span>
              </li>
              <li className="office-row">
                <svg className="office-pin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                <span>M16 — Al Makateb Building,<br />Al Quoz 3, Sheikh Zayed Rd, Dubai</span>
              </li>
              <li className="office-row">
                <svg className="office-pin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                <span>Suite 203, Davina House,<br />137-149 Goswell Road, London EC1V 7ET</span>
              </li>
            </ul>
          </div>

          <div className="foot-apps">
            <a className="app-badge" href="#" aria-label="Download VIZA on the App Store">
              <img src="/assets/app-store-badge.png" alt="Download on the App Store" />
            </a>
            <a className="app-badge" href="#" aria-label="Get VIZA on Google Play">
              <img src="/assets/google-play-badge.png" alt="Get it on Google Play" />
            </a>
          </div>
        </div>

        <div className="foot-rule"></div>

        <div className="foot-bottom">
          <div className="legal">
            <span>© VIZA, All rights reserved</span>
            <span className="sep"></span>
            <a href="#">Privacy</a>
            <span className="sep"></span>
            <a href="#">Terms</a>
          </div>
          <div className="foot-mark">
            <img src="/assets/viza-logo-black.svg" alt="VIZA" />
          </div>
        </div>
      </footer>
    </>
  );
}
