"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/navigation";
import { portalUrl } from "@/lib/utils";
import Logo from "../ui/Logo";
import { Close, Menu, User } from "../ui/Icons";
import LanguageSwitcher from "./LanguageSwitcher";

export type HeaderTab = "destinations" | "arrivalCards" | "guides" | "news" | "about" | "contact";

type NavItem = { id: HeaderTab; href: string | { pathname: string; hash: string } };

const NAV: NavItem[] = [
  { id: "destinations", href: { pathname: "/", hash: "destinations" } },
  { id: "arrivalCards", href: "/arrival-cards" },
  { id: "guides", href: "/guides" },
  { id: "news", href: "/blog" },
  { id: "about", href: "/about" },
  { id: "contact", href: "/contact" },
];

/** Link label that rolls up to a second copy on hover, like the Framer NavLink (line01 / line02). */
function RollText({ children }: { children: string }) {
  return (
    <span className="ds-roll">
      <span className="ds-roll-a">{children}</span>
      <span className="ds-roll-b" aria-hidden="true">
        {children}
      </span>
    </span>
  );
}

/**
 * Site header from the Framer Navbar: logo, text links 88px after it, language and sign in on the right.
 * Sticky; slides away on scroll down and back on scroll up, turning white once the page has moved.
 * Below 1200px the links fold into a full-screen menu (Framer's phone menu), since six links, the
 * language menu and sign in do not fit the tablet width.
 */
export default function SiteHeader({ active }: { active?: HeaderTab }) {
  const t = useTranslations("ds.header");
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 8);
      // Hide only after the header has scrolled past, and never while the menu is open.
      if (y > 160 && y > lastY.current + 4) setHidden(true);
      else if (y < lastY.current - 4 || y <= 160) setHidden(false);
      lastY.current = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    document.documentElement.classList.toggle("ds-menu-open", open);
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const cls = ["ds-header", scrolled && "is-scrolled", hidden && !open && "is-hidden", open && "is-open"].filter(Boolean).join(" ");

  return (
    <header className={cls}>
      <div className="ds-container ds-header-row">
        <div className="ds-header-left">
          <Link className="ds-header-logo" href="/" aria-label={t("home")}>
            <Logo height={30} alt="VIZA" />
          </Link>
          <nav className="ds-header-nav" aria-label={t("primary")}>
            <ul>
              {NAV.map((item) => (
                <li key={item.id}>
                  <Link className="ds-navlink" href={item.href} aria-current={active === item.id ? "page" : undefined}>
                    <RollText>{t(`nav.${item.id}`)}</RollText>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="ds-header-right">
          <LanguageSwitcher />
          <a className="ds-btn ds-header-signin" href={portalUrl("/client/login")}>
            <User size={16} />
            <span>{t("signIn")}</span>
          </a>
          <button
            type="button"
            className="ds-header-toggle"
            aria-expanded={open}
            aria-controls="ds-menu"
            aria-label={open ? t("closeMenu") : t("openMenu")}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <Close size={26} strokeWidth={1.8} /> : <Menu size={28} strokeWidth={1.8} />}
          </button>
        </div>
      </div>

      <div id="ds-menu" className="ds-menu" hidden={!open}>
        <nav className="ds-container ds-menu-inner" aria-label={t("primary")}>
          <ul className="ds-menu-links">
            <li>
              <Link className="ds-menu-link" href="/">
                {t("nav.home")}
              </Link>
            </li>
            {NAV.map((item) => (
              <li key={item.id}>
                <Link className="ds-menu-link" href={item.href} aria-current={active === item.id ? "page" : undefined} onClick={() => setOpen(false)}>
                  {t(`nav.${item.id}`)}
                </Link>
              </li>
            ))}
          </ul>
          <div className="ds-menu-foot">
            <a className="ds-btn ds-btn--block" href={portalUrl("/client/login")}>
              {t("signIn")}
            </a>
            <LanguageSwitcher inline />
          </div>
        </nav>
      </div>
    </header>
  );
}
