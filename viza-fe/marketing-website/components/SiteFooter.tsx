"use client";

import { useTranslations } from "next-intl";

/**
 * Shared marketing-site footer (ported 1:1 from the design `explore.html` footer).
 * All user-facing copy comes from the `footer` message namespace; office addresses
 * are intentionally left untranslated (proper nouns). Brand/route adaptations match
 * the existing site (real internal routes, image app-store badges).
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

          <div className="ask-ai">{t("askAi")}</div>
          <div className="ai-chips">
            <button className="ai-chip c1" title={t("askAi")} aria-label={t("askAi")}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
            </button>
            <button className="ai-chip c2" title={t("askAi")} aria-label={t("askAi")}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /><path d="M11 8v6" /><path d="M8 11h6" /></svg>
            </button>
            <button className="ai-chip c3" title={t("askAi")} aria-label={t("askAi")}>
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 13.8 8.4 20 10.5 13.8 12.6 12 19 10.2 12.6 4 10.5 10.2 8.4 12 2Z" /></svg>
            </button>
            <button className="ai-chip c4" title={t("askAi")} aria-label={t("askAi")}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4" /><path d="M12 18v4" /><path d="M4.93 4.93l2.83 2.83" /><path d="M16.24 16.24l2.83 2.83" /><path d="M2 12h4" /><path d="M18 12h4" /><path d="M4.93 19.07l2.83-2.83" /><path d="M16.24 7.76l2.83-2.83" /></svg>
            </button>
          </div>
        </div>

        {/* Company */}
        <div className="col-company">
          <h4 className="col-head">{t("company")}</h4>
          <ul className="col-list">
            <li><a href="/careers">{t("careers")}</a></li>
            <li><a href="/contact">{t("contact")}</a></li>
            <li><a href="/security">{t("security")}</a></li>
            <li><a href="/refunds">{t("refundsPolicy")}</a></li>
            <li><a href="/status">{t("status")}</a></li>
            <li><a href="/legal/privacy">{t("privacy")}</a></li>
            <li><a href="/legal/terms">{t("terms")}</a></li>
          </ul>
        </div>

        {/* Products */}
        <div className="col-products">
          <h4 className="col-head">{t("product")}</h4>
          <ul className="col-list">
            <li><a href="/apply">{t("prodMockInterview")}</a></li>
            <li><a href="/">{t("prodVisaReq")}</a></li>
            <li><a href="/visa/france">{t("prodSchengen")}</a></li>
            <li><a href="/apply">{t("prodPhoto")}</a></li>
            <li><a href="/contact">{t("prodHelpline")}</a></li>
            <li><a href="/apply">{t("prodStudent")}</a></li>
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

        {/* App buttons span the brand column area */}
        <div className="foot-apps">
          {/* Native apps pre-launch (MKT-013 intentional): badges link to the web app for now. */}
          <a className="app-badge" href="/apply" aria-label="Download VIZA on the App Store">
            <img src="/assets/app-store-badge.png" alt="Download on the App Store" />
          </a>
          <a className="app-badge" href="/apply" aria-label="Get VIZA on Google Play">
            <img src="/assets/google-play-badge.png" alt="Get it on Google Play" />
          </a>
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
