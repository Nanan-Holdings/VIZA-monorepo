import { useTranslations } from "next-intl";
import { Link } from "@/navigation";
import { visaHref } from "@/lib/countries";
import { SAME_AS } from "@/lib/seo/site";
import Logo from "../ui/Logo";
import { SOCIAL_ICONS } from "../ui/SocialIcons";

/** Destination pages linked from the footer, by search demand from Singapore. */
const DESTINATIONS = ["japan", "south-korea", "china", "vietnam", "united-states", "united-kingdom", "schengen", "australia"] as const;

/** Arrival cards, labelled by their official product names (the same in every language). */
const ARRIVAL_CARDS = [
  { slug: "singapore-sg-arrival-card", name: "SG Arrival Card" },
  { slug: "malaysia-mdac", name: "MDAC" },
  { slug: "thailand-tdac", name: "TDAC" },
  { slug: "japan-visit-japan-web", name: "Visit Japan Web" },
  { slug: "korea-e-arrival-card", name: "Korea e-Arrival Card" },
  { slug: "indonesia-all-indonesia", name: "All Indonesia" },
] as const;

const COMPANY = [
  { key: "about", href: "/about" },
  { key: "news", href: "/blog" },
  { key: "guides", href: "/guides" },
  { key: "careers", href: "/careers" },
  { key: "contact", href: "/contact" },
  { key: "security", href: "/security" },
  { key: "status", href: "/status" },
] as const;

/** Social profiles, in the order of SAME_AS (lib/seo/site.ts), which the Organization schema also uses. */
const SOCIALS = [
  { name: "Facebook", icon: SOCIAL_ICONS.facebook },
  { name: "Pinterest", icon: SOCIAL_ICONS.pinterest },
  { name: "Instagram", icon: SOCIAL_ICONS.instagram },
  { name: "LinkedIn", icon: SOCIAL_ICONS.linkedin },
  { name: "X", icon: SOCIAL_ICONS.x },
  { name: "Reddit", icon: SOCIAL_ICONS.reddit },
] as const;

/**
 * Site footer, laid out like Volumet's: a brand column (logo, line, registered office, social icons), then
 * titled link columns, then a legal bar. Works in server and client trees (no client hooks, no async data).
 */
export default function SiteFooter() {
  const t = useTranslations("ds.footer");
  const tFooter = useTranslations("footer");
  const tCountries = useTranslations("countries");
  return (
    <footer className="ds-footer">
      <div className="ds-container">
        <div className="ds-footer-grid">
          <div className="ds-footer-brand">
            <Link href="/" aria-label={t("home")} className="ds-footer-logo">
              <Logo height={40} alt="VIZA" />
            </Link>
            <p className="ds-footer-text">{t("tagline")}</p>
            <p className="ds-footer-text">{t("office")}</p>
            <ul className="ds-footer-social">
              {SAME_AS.map((href, i) => (
                <li key={href}>
                  <a href={href} target="_blank" rel="noopener noreferrer" aria-label={t("followOn", { platform: SOCIALS[i].name })} title={SOCIALS[i].name}>
                    <svg viewBox={SOCIALS[i].icon.viewBox} aria-hidden="true" focusable="false">
                      <path d={SOCIALS[i].icon.path} />
                    </svg>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <nav className="ds-footer-col" aria-label={t("links.destinations")}>
            <p className="ds-footer-head">
              <Link href={{ pathname: "/", hash: "destinations" }}>{t("links.destinations")}</Link>
            </p>
            <ul className="ds-footer-links">
              {DESTINATIONS.map((slug) => (
                <li key={slug}>
                  <Link href={visaHref(slug)}>{tCountries(slug)}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav className="ds-footer-col" aria-label={t("links.arrivalCards")}>
            <p className="ds-footer-head">
              <Link href="/arrival-cards">{t("links.arrivalCards")}</Link>
            </p>
            <ul className="ds-footer-links">
              {ARRIVAL_CARDS.map((c) => (
                <li key={c.slug}>
                  <Link href={`/arrival-cards/${c.slug}`}>{c.name}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav className="ds-footer-col" aria-label={tFooter("company")}>
            <p className="ds-footer-head">{tFooter("company")}</p>
            <ul className="ds-footer-links">
              {COMPANY.map((l) => (
                <li key={l.key}>
                  <Link href={l.href}>{t(`links.${l.key}`)}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="ds-footer-bottom">
          <p className="ds-footer-copy">
            {t("copyright", { year: new Date().getFullYear() })}{" "}
            <a href="https://kelin.studio" target="_blank" rel="noopener" className="ds-footer-venture">
              {t("kelin")}
            </a>
          </p>
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
