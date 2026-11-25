import { Fragment } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/navigation";
import { SAME_AS } from "@/lib/seo/site";
import Logo from "../ui/Logo";

/** Footer links. Destinations points at the gallery on the home page (there is no /visa index). */
const LINKS = [
  { key: "destinations", href: { pathname: "/", hash: "destinations" } },
  { key: "arrivalCards", href: "/arrival-cards" },
  { key: "guides", href: "/guides" },
  { key: "news", href: "/blog" },
  { key: "about", href: "/about" },
  { key: "contact", href: "/contact" },
  { key: "careers", href: "/careers" },
  { key: "security", href: "/security" },
  { key: "status", href: "/status" },
] as const;

/** Social profiles, in the order of SAME_AS (lib/seo/site.ts), which the Organization schema also uses. */
const SOCIAL_NAMES = ["Facebook", "Pinterest", "Instagram", "LinkedIn", "X", "Reddit"] as const;

/**
 * Footer from the Framer template: three equal columns (logo, links, social), a hairline, then copyright,
 * registered office and legal links. Works in server and client trees (no client hooks).
 */
export default function SiteFooter() {
  const t = useTranslations("ds.footer");
  return (
    <footer className="ds-footer">
      <div className="ds-container">
        <div className="ds-footer-grid">
          <div className="ds-footer-brand">
            <Link href="/" aria-label={t("home")} className="ds-footer-logo">
              <Logo height={56} alt="VIZA" />
            </Link>
            <p className="ds-small">{t("tagline")}</p>
          </div>
          <div className="ds-footer-col">
            <p className="ds-footer-head">{t("explore")}</p>
            <ul className="ds-footer-links">
              {LINKS.map((l) => (
                <li key={l.key}>
                  <Link href={l.href}>{t(`links.${l.key}`)}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="ds-footer-col">
            <p className="ds-footer-head">{t("follow")}</p>
            <ul className="ds-footer-social">
              {SAME_AS.map((href, i) => (
                <Fragment key={href}>
                  {i > 0 && (
                    <li aria-hidden="true" className="ds-footer-slash">
                      /
                    </li>
                  )}
                  <li>
                    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={t("followOn", { platform: SOCIAL_NAMES[i] })}>
                      {SOCIAL_NAMES[i]}
                    </a>
                  </li>
                </Fragment>
              ))}
            </ul>
          </div>
        </div>
        <div className="ds-footer-bottom">
          <p className="ds-footer-copy">
            {t("copyright", { year: new Date().getFullYear() })}{" "}
            <a href="https://kelin.studio" target="_blank" rel="noopener" className="ds-footer-venture">
              {t("kelin")}
            </a>
          </p>
          <p className="ds-footer-copy">{t("office")}</p>
          <ul className="ds-footer-legal">
            <li>
              <Link href="/legal/privacy">{t("privacy")}</Link>
            </li>
            <li>
              <Link href="/legal/terms">{t("terms")}</Link>
            </li>
            <li>
              <Link href="/refunds">{t("refunds")}</Link>
            </li>
            <li>
              <Link href="/business-information">{t("business")}</Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
