"use client";

import { useTranslations } from "next-intl";
import "./site-footer.css";

/**
 * Shared marketing-site footer.
 * All user-facing copy comes from the `footer` message namespace; office addresses
 * are intentionally left untranslated (proper nouns).
 */
export default function SiteFooter() {
  const t = useTranslations("footer");

  const offices: Array<[string, string]> = [
    ["中国（上海）自由贸易试验区罗山路1502弄", "No. 67, Kangcheng Road, Lane 958, Xinsong Road, Minhang District, Shanghai, China"],
    ["225 Pasir Panjang Rd,", "Singapore"],
  ];

  const socialLinks = [
    { platform: "Facebook", href: "https://www.facebook.com/profile.php?id=61592698634582", icon: "/assets/social/facebook.svg" },
    { platform: "Pinterest", href: "https://www.pinterest.com/viza_com/", icon: "/assets/social/pinterest.svg" },
    { platform: "Instagram", href: "https://www.instagram.com/viza_com/?hl=en", icon: "/assets/social/instagram.svg" },
    { platform: "LinkedIn", href: "https://www.linkedin.com/company/viza-com/home/?viewAsMember=true", icon: "/assets/social/linkedin.svg" },
    { platform: "X", href: "https://x.com/viza_it_com", icon: "/assets/social/x.svg" },
    { platform: "Reddit", href: "https://www.reddit.com/user/viza_com/", icon: "/assets/social/reddit.svg" },
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

          <div className="foot-social">
            <p className="social-label">{t("followUs")}</p>
            <div className="social-links">
              {socialLinks.map(({ platform, href, icon }) => (
                <a
                  className="social-link"
                  href={href}
                  key={platform}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t("followOn", { platform })}
                >
                  <img src={icon} alt="" width="20" height="20" />
                </a>
              ))}
            </div>
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
