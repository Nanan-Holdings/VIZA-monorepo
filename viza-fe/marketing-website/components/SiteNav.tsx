"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CircleFlag } from "react-circle-flags";
import { useTranslations } from "next-intl";
import LanguageToggle from "./LanguageToggle";
import "./site-nav.css";

/** Passport ISO codes (display names resolve from the `passports` namespace). */
const PASSPORT_CODES = [
  "SG", "JP", "KR", "DE", "FR", "GB", "US", "AU", "CA",
  "AE", "CN", "IN", "BR", "PH", "ID", "MY", "TH",
] as const;
type PassportCode = (typeof PASSPORT_CODES)[number];

type Tab = "explore" | "events";

type Props = {
  /** "explore" or "events" — adds .active to that tab. Omit for none. */
  activeTab?: Tab;
};

export default function SiteNav({ activeTab: initialTab }: Props) {
  const t = useTranslations();

  // --- Nav tab pill indicator ---
  const [activeTab, setActiveTab] = useState<Tab | undefined>(initialTab);
  const tabsRef = useRef<HTMLDivElement>(null);
  const exploreRef = useRef<HTMLAnchorElement>(null);
  const eventsRef = useRef<HTMLAnchorElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  useLayoutEffect(() => {
    if (!activeTab) return;
    const el = activeTab === "explore" ? exploreRef.current : eventsRef.current;
    const wrap = tabsRef.current;
    if (!el || !wrap) return;
    const r = el.getBoundingClientRect();
    const pr = wrap.getBoundingClientRect();
    setPill({ left: r.left - pr.left, width: r.width });
  }, [activeTab, t]);

  useEffect(() => {
    const onResize = () => {
      if (!activeTab) return;
      const el = activeTab === "explore" ? exploreRef.current : eventsRef.current;
      const wrap = tabsRef.current;
      if (!el || !wrap) return;
      const r = el.getBoundingClientRect();
      const pr = wrap.getBoundingClientRect();
      setPill({ left: r.left - pr.left, width: r.width });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [activeTab]);

  // --- Passport selector ---
  const [passportCode, setPassportCode] = useState<PassportCode>("SG");
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
    if (!q) return PASSPORT_CODES;
    return PASSPORT_CODES.filter(
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
          <a
            ref={exploreRef}
            className={`nav-tab${activeTab === "explore" ? " active" : ""}`}
            data-tab="explore"
            href="/"
            onClick={() => setActiveTab("explore")}
          >
            {t("nav.explore")}
          </a>
          <a
            ref={eventsRef}
            className={`nav-tab${activeTab === "events" ? " active" : ""}`}
            data-tab="events"
            href="/events"
            onClick={() => setActiveTab("events")}
          >
            {t("nav.events")}
          </a>
        </div>

        <div className="nav-right">
          <label className="search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input id="siteNavSearchInput" placeholder={t("nav.searchPlaceholder")} />
          </label>
          <LanguageToggle />
          <button className="icon-btn" title={t("explore.help")} type="button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <path d="M12 17h.01" />
            </svg>
          </button>
          <div className="avatar">CL</div>
        </div>
      </div>
    </nav>
  );
}
