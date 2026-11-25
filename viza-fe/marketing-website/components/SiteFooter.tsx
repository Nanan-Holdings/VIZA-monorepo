"use client";

import { Link } from "@/navigation";

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
    ["中国（上海）自由贸易试验区罗山路1502弄", "Lane 1502, Luoshan Road, China (Shanghai) Pilot Free Trade Zone"],
    ["60 Paya Lebar Road, #06-28 Paya Lebar Square,", "Singapore 409051"],
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
          <Link className="foot-logo" href="/">
            <img src="/assets/viza-logo-black.svg" alt="VIZA" />
          </Link>
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
            <li><Link href="/careers">{t("careers")}</Link></li>
            <li><Link href="/contact">{t("contact")}</Link></li>
            <li><Link href="/security">{t("security")}</Link></li>
            <li><Link href="/status">{t("status")}</Link></li>
            <li><Link href="/legal/privacy">{t("privacy")}</Link></li>
            <li><Link href="/legal/terms">{t("terms")}</Link></li>
          </ul>
        </div>

        {/* Products */}
        <div className="col-products">
          <h4 className="col-head">{t("product")}</h4>
          <ul className="col-list">
            <li><Link href="/apply">{t("prodMockInterview")}</Link></li>
            <li><Link href="/">{t("prodVisaReq")}</Link></li>
            <li><Link href="/arrival-cards">{t("arrivalCards")}</Link></li>
            <li><Link href="/visa/france">{t("prodSchengen")}</Link></li>
            <li><Link href="/apply">{t("prodPhoto")}</Link></li>
            <li><Link href="/contact">{t("prodHelpline")}</Link></li>
            <li><Link href="/apply">{t("prodStudent")}</Link></li>
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
          <Link className="app-badge" href="/apply" aria-label="Download VIZA on the App Store">
            <img src="/assets/app-store-badge.png" alt="Download on the App Store" />
          </Link>
          <Link className="app-badge" href="/apply" aria-label="Get VIZA on Google Play">
            <img src="/assets/google-play-badge.png" alt="Get it on Google Play" />
          </Link>
        </div>
      </div>

      <div className="foot-rule"></div>

      <div className="foot-bottom">
        <div className="legal">
          <span>{t("copyright")}</span>
          <span className="sep"></span>
          <Link href="/legal/privacy">{t("privacy")}</Link>
          <span className="sep"></span>
          <Link href="/legal/terms">{t("terms")}</Link>
        </div>
        <div className="foot-mark">
          <img src="/assets/viza-logo-black.svg" alt="VIZA" />
        </div>
      </div>
    </footer>
  );
}
