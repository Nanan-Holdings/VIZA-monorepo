"use client";

import { useLocale, useTranslations } from "next-intl";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { LAUNCHED_COUNTRIES, visaHref, type CountryMeta } from "@/lib/countries";
import { displayFeeSGD, totalSgd } from "@/lib/pricing";
import "./visa-template.css";

const FLAG_CDN = "https://hatscripts.github.io/circle-flags/flags";

/**
 * Reusable, data-driven visa country page (MKT-004). Fed by lib/countries.ts +
 * lib/pricing.ts. Used by app/[locale]/visa/[country]/page.tsx for the 15
 * launch countries without a bespoke page (Indonesia keeps its rich static
 * page). All section labels are localized via the `visa` message namespace
 * (MKT-008); country-specific copy comes from data, not hardcoded.
 */
export default function VisaCountryTemplate({ country }: { country: CountryMeta }) {
  const t = useTranslations("visa");
  const tc = useTranslations("countries");
  const tt = useTranslations("visaTypes");
  const locale = useLocale();
  const applyHref = `${locale === "en" ? "" : `/${locale}`}/apply?country=${encodeURIComponent(country.slug)}`;
  const fee = totalSgd(country.visaType) === 0 ? t("priceFree") : displayFeeSGD(country.visaType) ?? t("seePricing");
  const nearby = LAUNCHED_COUNTRIES.filter((c) => c.slug !== country.slug).slice(0, 4);
  // Localized name/type with English data as the fallback.
  const localName = tc.has(country.slug) ? tc(country.slug) : country.name;
  const localType = tt.has(country.type) ? tt(country.type) : country.type;

  return (
    <>
      <SiteNav />
      <main className="vt-wrap">
        <header className="vt-hero">
          <div className="vt-photo" style={{ backgroundImage: `url('${country.image}')` }} />
          <div className="vt-scrim" />
          <div className="vt-hero-inner">
            <h1>{t("heroTitle", { country: localName })}</h1>
            <div className="vt-sub">{country.city}</div>
            <div className="vt-badges">
              <span className="vt-badge">{localType}</span>
              <span className="vt-badge">{t("validity")}: {country.validity}</span>
              <span className="vt-badge">{t("fromFee", { fee })}</span>
            </div>
          </div>
        </header>

        <div className="vt-grid">
          <div>
            <section className="vt-section">
              <h2>{t("howItWorks")}</h2>
              <div className="vt-steps">
                {[t("step1"), t("step2"), t("step3"), t("step4")].map((s, i) => (
                  <div className="vt-step" key={i}>
                    <span className="vt-num">{i + 1}</span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="vt-section">
              <h2>{t("documents")}</h2>
              <ul className="vt-list">
                <li>{t("doc1")}</li>
                <li>{t("doc2")}</li>
                <li>{t("doc3")}</li>
                <li>{t("doc4")}</li>
              </ul>
            </section>

            <section className="vt-section">
              <h2>{t("nearby")}</h2>
              <div className="vt-nearby">
                {nearby.map((c) => (
                  <a key={c.slug} href={visaHref(c.slug)}>
                    <img src={`${FLAG_CDN}/${c.flagCode}.svg`} alt={c.name} />
                    <span>{tc.has(c.slug) ? tc(c.slug) : c.name}</span>
                  </a>
                ))}
              </div>
            </section>
          </div>

          <aside className="vt-side">
            <div className="vt-price-card">
              <div className="vt-price">
                {fee}
                <small>{t("allInclusive")}</small>
              </div>
              <div className="vt-cta">
                <a className="vt-btn" href={applyHref}>
                  {t("startApplication")}
                </a>
              </div>
            </div>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
