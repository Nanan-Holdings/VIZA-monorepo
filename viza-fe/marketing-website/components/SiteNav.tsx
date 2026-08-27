"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CircleFlag } from "react-circle-flags";
import { useTranslations } from "next-intl";
import LanguageToggle from "./LanguageToggle";
import { NAV_TABS, type NavTab } from "@/lib/nav-tabs";
import { PASSPORTS, usePassportSelection } from "@/lib/passports";
import { portalUrl } from "@/lib/utils";
import "./site-nav.css";

type Tab = NavTab["id"];

type Props = {
  /** Tab id to mark active. Omit for none. */
  activeTab?: Tab;
};

export default function SiteNav({ activeTab: initialTab }: Props) {
  const t = useTranslations();

  // --- Nav tab pill indicator ---
  const activeTab = initialTab;
  const tabsRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [pill, setPill] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  useLayoutEffect(() => {
    const measure = () => {
      const el = activeTab ? tabRefs.current[activeTab] : null;
      const wrap = tabsRef.current;
      if (!el || !wrap) {
        setPill({ left: 0, width: 0 });
        return;
      }
      const r = el.getBoundingClientRect();
      const pr = wrap.getBoundingClientRect();
      setPill({ left: r.left - pr.left, width: r.width });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [activeTab, t]);

  // --- Passport selector ---
  const [passportCode, setPassportCode] = usePassportSelection();
  const [ppOpen, setPpOpen] = useState(false);
  const [ppQuery, setPpQuery] = useState("");
  const ppInputRef = useRef<HTMLInputElement>(null);
  const passportName = t(`passports.${passportCode}`);

  useEffect(() => {
    if (ppOpen) {
      const id = window.setTimeout(() => ppInputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
    setPpQuery("");
  }, [ppOpen]);

  useEffect(() => {
    if (!ppOpen) return;
    const close = () => setPpOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [ppOpen]);

  const filteredPassports = useMemo(() => {
    const q = ppQuery.trim().toLowerCase();
    const codes = PASSPORTS.map((p) => p.code);
    if (!q) return codes;
    return codes.filter(
      (code) => t(`passports.${code}`).toLowerCase().includes(q) || code.toLowerCase().includes(q),
    );
  }, [ppQuery, t]);

  return (
    <nav className="site-nav">
      <div className="nav-inner">
        <div className="nav-left">
          <a className="nav-logo" href="/" aria-label="VIZA home">
            <img src="/assets/viza-logo-black.svg" alt="VIZA" />
          </a>
          <button
            className={`passport-pill${ppOpen ? " open" : ""}`}
            id="siteNavPassportPill"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPpOpen((v) => !v);
            }}
          >
            <span className="ball" id="siteNavPassportBall">
              <CircleFlag countryCode={passportCode.toLowerCase()} height={32} />
            </span>
            <span>
              <span className="lab-key">{t("nav.yourPassport")}</span>
              <span className="lab-val">
                <span id="siteNavPassportName">{passportName}</span>
                <svg className="chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
            </span>

            {ppOpen && (
              <div className="passport-pop" onClick={(e) => e.stopPropagation()}>
                <h4>{t("explore.choosePassport")}</h4>
                <label className="pp-search">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.35-4.35" />
                  </svg>
                  <input
                    id="ppSearch"
                    ref={ppInputRef}
                    value={ppQuery}
                    onChange={(e) => setPpQuery(e.target.value)}
                    placeholder={t("explore.searchPassport")}
                    autoComplete="off"
                  />
                </label>
                <div className="pp-list" id="ppList">
                  {filteredPassports.length === 0 ? (
                    <div style={{ padding: "24px 12px", textAlign: "center", color: "var(--fg-2)", fontSize: "13px" }}>
                      {t("explore.noMatch", { q: ppQuery })}
                    </div>
                  ) : (
                    filteredPassports.map((code) => (
                      <button
                        key={code}
                        type="button"
                        className={`pp-row${code === passportCode ? " sel" : ""}`}
                        data-code={code}
                        onClick={() => {
                          setPassportCode(code);
                          setPpOpen(false);
                        }}
                      >
                        <span className="pp-flag">
                          <CircleFlag countryCode={code.toLowerCase()} height={28} />
                        </span>
                        <span className="pp-name">{t(`passports.${code}`)}</span>
                        <svg className="pp-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </button>
                    ))
                  )}
                </div>
                <div className="pp-foot">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4" />
                    <path d="M12 8h.01" />
                  </svg>
                  {t("explore.ppFoot")}
                </div>
              </div>
            )}
          </button>
        </div>

        <div className="nav-tabs" id="siteNavTabs" ref={tabsRef}>
          <span className="pill-indicator" id="siteNavPill" style={{ left: pill.left, width: pill.width }} />
          {NAV_TABS.map((tab) => (
            <a
              key={tab.id}
              ref={(el) => { tabRefs.current[tab.id] = el; }}
              className={`nav-tab${activeTab === tab.id ? " active" : ""}`}
              data-tab={tab.id}
              href={tab.href}
            >
              {t(tab.labelKey)}
            </a>
          ))}
        </div>

        <div className="nav-right">
          {/* Submitting hands the term to the explore grid, which reads ?q= on load. */}
          <form className="search" action="/" method="get" role="search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              id="siteNavSearchInput"
              name="q"
              type="search"
              aria-label={t("nav.searchPlaceholder")}
              placeholder={t("nav.searchPlaceholder")}
            />
          </form>
          <LanguageToggle />
          <a className="icon-btn" href="/contact" title={t("explore.help")} aria-label={t("explore.help")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <path d="M12 17h.01" />
            </svg>
          </a>
          <a className="avatar" href={portalUrl("/client/login")} title={t("nav.signIn")} aria-label={t("nav.signIn")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </a>
        </div>
      </div>
    </nav>
  );
}
