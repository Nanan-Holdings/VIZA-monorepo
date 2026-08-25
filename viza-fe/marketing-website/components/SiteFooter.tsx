"use client";

import { useTranslations } from "next-intl";
import "./site-footer.css";

/**
 * Shared marketing-site footer.
 *
 * All user-facing copy comes from the `footer` message namespace; office addresses
 * are intentionally left untranslated (proper nouns).
 *
 * Every link here must resolve to a page that exists and match its own label. The
 * decorative "ask AI" chips and the App Store / Google Play badges were removed —
 * the chips did nothing when clicked and there are no native apps to download.
 */
export default function SiteFooter() {
  const t = useTranslations("footer");

  const offices: Array<[string, string]> = [
    ["中国（上海）自由贸易试验区罗山路1502弄", "No. 67, Kangcheng Road, Lane 958, Xinsong Road, Minhang District, Shanghai, China"],
    ["225 Pasir Panjang Rd,", "Singapore"],
  ];

  return (
    <footer className="site-foot" data-screen-label="Footer">
      <div className="foot-rule"></div>

      <div className="foot-main">
        {/* Brand column */}
        <div className="foot-brand">
          <a className="foot-logo" href="/">
            <img src="/assets/viza-logo-black.svg" alt="VIZA" />
          </a>
          <p className="foot-tag">{t("tagline")}</p>
        </div>

        {/* Company — every entry must resolve to a page that exists. */}
        <div className="col-company">
          <h4 className="col-head">{t("company")}</h4>
          <ul className="col-list">
            <li><a href="/about">{t("about")}</a></li>
            <li><a href="/careers">{t("careers")}</a></li>
            <li><a href="/contact">{t("contact")}</a></li>
            <li><a href="/status">{t("status")}</a></li>
          </ul>
        </div>

        {/* Product — each label now links to the page it names. */}
        <div className="col-products">
          <h4 className="col-head">{t("product")}</h4>
          <ul className="col-list">
            <li><a href="/product">{t("prodOverview")}</a></li>
            <li><a href="/">{t("prodVisaReq")}</a></li>
            <li><a href="/apply">{t("prodApply")}</a></li>
            <li><a href="/visa/france">{t("prodSchengen")}</a></li>
            <li><a href="/visa/united-states">{t("prodUsVisa")}</a></li>
          </ul>
        </div>

        {/* Legal & policies — split out of "Company" so the grouping matches the label. */}
        <div className="col-legal">
          <h4 className="col-head">{t("legal")}</h4>
          <ul className="col-list">
            <li><a href="/refunds">{t("refundsPolicy")}</a></li>
            <li><a href="/legal/privacy">{t("privacy")}</a></li>
            <li><a href="/legal/terms">{t("terms")}</a></li>
            <li><a href="/security">{t("security")}</a></li>
          </ul>
        </div>

        {/* Offices */}
        <div className="col-offices">
          <h4 className="col-head">{t("offices")}</h4>
          <ul className="col-list">
            {offices.map(([line1, line2]) => (
              <li className="office-row" key={line2}>
                <svg className="office-pin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                <span>{line1}<br />{line2}</span>
              </li>
            ))}
          </ul>
        </div>

      </div>

      <div className="foot-rule"></div>

      <div className="foot-bottom">
        <div className="legal">
          <span>{t("copyright")}</span>
          <span className="sep"></span>
          <a href="/legal/privacy">{t("privacy")}</a>
          <span className="sep"></span>
          <a href="/legal/terms">{t("terms")}</a>
        </div>
        <div className="foot-mark">
          <img src="/assets/viza-logo-black.svg" alt="VIZA" />
        </div>
      </div>
    </footer>
  );
}
