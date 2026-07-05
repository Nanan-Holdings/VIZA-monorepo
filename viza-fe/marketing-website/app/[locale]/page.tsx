"use client";
import "./explore.css";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CircleFlag } from "react-circle-flags";
import { useTranslations } from "next-intl";
import { COUNTRIES as COUNTRY_META, visaHref } from "@/lib/countries";
import { displayFeeSGD } from "@/lib/pricing";
import LanguageToggle from "@/components/LanguageToggle";
import SiteFooter from "@/components/SiteFooter";
import VisaWorldMap from "@/components/VisaWorldMap";

const FILTER_KEYS = ["delivery", "type", "documents", "dates"] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

const SORT_KEYS = ["guaranteed", "feeLow", "duration", "popular", "recent"] as const;
type SortKey = (typeof SORT_KEYS)[number];

/** Passport ranking data (no copy — names resolve from the `passports` namespace). */
const PASSPORTS = [
  { code: "SG", free: 157, voa: 29, req: 9, rank: "#1" },
  { code: "JP", free: 154, voa: 30, req: 11, rank: "#2" },
  { code: "KR", free: 152, voa: 31, req: 12, rank: "#3" },
  { code: "DE", free: 153, voa: 28, req: 14, rank: "#3" },
  { code: "FR", free: 151, voa: 29, req: 15, rank: "#4" },
  { code: "GB", free: 148, voa: 30, req: 17, rank: "#5" },
  { code: "US", free: 145, voa: 31, req: 19, rank: "#6" },
  { code: "AU", free: 144, voa: 32, req: 19, rank: "#6" },
  { code: "CA", free: 144, voa: 31, req: 20, rank: "#7" },
  { code: "AE", free: 132, voa: 38, req: 25, rank: "#11" },
  { code: "CN", free: 85, voa: 32, req: 78, rank: "#60" },
  { code: "IN", free: 58, voa: 28, req: 109, rank: "#80" },
  { code: "BR", free: 134, voa: 26, req: 35, rank: "#15" },
  { code: "PH", free: 67, voa: 30, req: 98, rank: "#73" },
  { code: "ID", free: 76, voa: 30, req: 89, rank: "#67" },
  { code: "MY", free: 124, voa: 35, req: 36, rank: "#13" },
  { code: "TH", free: 81, voa: 32, req: 82, rank: "#62" },
] as const;
type Passport = (typeof PASSPORTS)[number];

const Chevron = ({ size = 12 }: { size?: number }) => (
  <svg className="chev" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
);

const Check = ({ className }: { className?: string }) => (
  <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
);

function FilterIcon({ k }: { k: FilterKey }) {
  switch (k) {
    case "delivery":
      return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" /></svg>;
    case "type":
      return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h20" /><path d="M12 2a15 15 0 0 1 0 20" /><path d="M12 2a15 15 0 0 0 0 20" /><circle cx="12" cy="12" r="10" /></svg>;
    case "documents":
      return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>;
    case "dates":
      return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
  }
}

type OpenMenu = { kind: "filter"; key: FilterKey; left: number; top: number } | { kind: "sort"; left: number; top: number };

export default function ExplorePage() {
  const t = useTranslations();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // --- Nav tab pill indicator ---
  const [activeTab, setActiveTab] = useState<"explore" | "events">("explore");
  const tabsRef = useRef<HTMLDivElement>(null);
  const exploreRef = useRef<HTMLAnchorElement>(null);
  const eventsRef = useRef<HTMLAnchorElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  useLayoutEffect(() => {
    const el = activeTab === "explore" ? exploreRef.current : eventsRef.current;
    const wrap = tabsRef.current;
    if (!el || !wrap) return;
    const r = el.getBoundingClientRect();
    const pr = wrap.getBoundingClientRect();
    setPill({ left: r.left - pr.left, width: r.width });
  }, [activeTab, t]);

  useEffect(() => {
    const onResize = () => {
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
  const [passportCode, setPassportCode] = useState<string>("SG");
  const [ppOpen, setPpOpen] = useState(false);
  const [ppQuery, setPpQuery] = useState("");
  const ppInputRef = useRef<HTMLInputElement>(null);
  const passport: Passport = PASSPORTS.find((p) => p.code === passportCode) ?? PASSPORTS[0];
  const passportName = t(`passports.${passport.code}`);

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
    if (!q) return PASSPORTS;
    return PASSPORTS.filter((p) => t(`passports.${p.code}`).toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
  }, [ppQuery, t]);

  // --- Filter / sort dropdowns ---
  const [filterSel, setFilterSel] = useState<Record<FilterKey, number>>({ delivery: 0, type: 0, documents: 0, dates: 0 });
  const [sortKey, setSortKey] = useState<SortKey>("guaranteed");
  const [openMenu, setOpenMenu] = useState<OpenMenu | null>(null);

  useEffect(() => {
    if (!openMenu) return;
    const close = () => setOpenMenu(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [openMenu]);

  const openFilterMenu = (e: React.MouseEvent, key: FilterKey) => {
    e.stopPropagation();
    if (openMenu && openMenu.kind === "filter" && openMenu.key === key) {
      setOpenMenu(null);
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    setOpenMenu({ kind: "filter", key, left: r.left + window.scrollX, top: r.bottom + window.scrollY });
  };

  const openSortMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (openMenu && openMenu.kind === "sort") {
      setOpenMenu(null);
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    setOpenMenu({ kind: "sort", left: r.left + window.scrollX, top: r.bottom + window.scrollY });
  };

  const filterOptions = (key: FilterKey) => t.raw(`explore.filterOpts.${key}`) as string[];

  // --- View toggle ---
  const [view, setView] = useState<"grid" | "map">("grid");

  // --- Favorites + search ---
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const toggleFav = (slug: string) =>
    setFavs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  const [search, setSearch] = useState("");

  // --- Country cards (localized, derived from shared metadata) ---
  const countries = useMemo(
    () =>
      COUNTRY_META.map((c) => ({
        slug: c.slug,
        name: t(`countries.${c.slug}`),
        city: t(`cities.${c.slug}`),
        type: t(`visaTypes.${c.type}`),
        valid: t(`validity.${c.slug}`),
        fee: displayFeeSGD(c.visaType) ?? t("explore.seePricing"),
        tag: c.tag,
        img: c.image,
        flagCode: c.flagCode,
        featured: c.featured,
      })),
    [t],
  );

  const matches = (name: string, city: string) => {
    const q = search.trim().toLowerCase();
    return !q || name.toLowerCase().includes(q) || city.toLowerCase().includes(q);
  };

  const first = countries.slice(0, 9);
  const rest = countries.slice(9);

  type CardData = (typeof countries)[number];
  const Card = ({ c, featured }: { c: CardData; featured?: boolean }) => {
    const fav = favs.has(c.slug);
    const isFast = c.tag === "fast";
    const hidden = !matches(c.name, c.city);
    return (
      <a className={`card-c ${featured ? "featured" : ""}`} href={visaHref(c.slug)} style={{ textDecoration: "none", color: "inherit", display: hidden ? "none" : undefined }}>
        <div className="card-img">
          <div className="photo" style={{ backgroundImage: `url('${c.img}')` }}></div>
          {isFast && <span className="card-tag tag-fast">{t("explore.fastTrack")}</span>}
          <button
            className={`card-fav ${fav ? "on" : ""}`}
            aria-label={t("explore.save")}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleFav(c.slug);
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill={fav ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
          </button>
          <div className="card-name">
            <div>
              <div className="nm">{c.name}</div>
              <div className="ct">{c.city}</div>
            </div>
            <div className="flag"><CircleFlag countryCode={c.flagCode} height={28} /></div>
          </div>
        </div>
        <div className="card-body">
          <div className="card-stats">
            <div className="stat"><div className="k">{t("explore.cardType")}</div><div className="v">{c.type}</div></div>
            <div className="stat"><div className="k">{t("explore.cardValid")}</div><div className="v">{c.valid}</div></div>
            <div className="stat"><div className="k">{t("explore.cardFee")}</div><div className="v">{c.fee}</div></div>
          </div>
          <div className="card-foot">
            <div className="foot-eta">
              <span className="lk">{t("explore.guaranteedBy")}</span>
              <span className="lv">{t("explore.guarantor")}</span>
            </div>
            <button className="foot-cta" aria-label={t("explore.startApplication")} onClick={(e) => e.preventDefault()}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </div>
        </div>
      </a>
    );
  };

  return (
    <>
      {/* Top nav */}
      <nav className="nav">
        <div className="nav-inner">
          <div className="nav-left">
            <a className="nav-logo" href="/"><img src="/assets/viza-logo-black.svg" alt="VIZA" /></a>
            <div
              className={`passport-pill ${ppOpen ? "open" : ""}`}
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                setOpenMenu(null);
                setPpOpen((v) => !v);
              }}
            >
              <span className="ball"><CircleFlag countryCode={passport.code.toLowerCase()} height={32} /></span>
              <span>
                <span className="lab-key">{t("nav.yourPassport")}</span>
                <span className="lab-val">
                  <span>{passportName}</span>
                  <Chevron />
                </span>
              </span>

              {ppOpen && (
                <div className="passport-pop" onClick={(e) => e.stopPropagation()}>
                  <h4>{t("explore.choosePassport")}</h4>
                  <label className="pp-search">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                    <input ref={ppInputRef} value={ppQuery} onChange={(e) => setPpQuery(e.target.value)} placeholder={t("explore.searchPassport")} autoComplete="off" />
                  </label>
                  <div className="pp-list">
                    {filteredPassports.length === 0 ? (
                      <div style={{ padding: "24px 12px", textAlign: "center", color: "var(--fg-2)", fontSize: "13px" }}>{t("explore.noMatch", { q: ppQuery })}</div>
                    ) : (
                      filteredPassports.map((p) => (
                        <button
                          key={p.code}
                          className={`pp-row ${p.code === passport.code ? "sel" : ""}`}
                          onClick={() => {
                            setPassportCode(p.code);
                            setPpOpen(false);
                          }}
                        >
                          <span className="pp-flag"><CircleFlag countryCode={p.code.toLowerCase()} height={28} /></span>
                          <span className="pp-name">{t(`passports.${p.code}`)}</span>
                          <span className="pp-meta">{t("explore.visaFree", { n: p.free })}</span>
                          <Check className="pp-check" />
                        </button>
                      ))
                    )}
                  </div>
                  <div className="pp-foot">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
                    {t("explore.ppFoot")}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="center-tabs nav-tabs" ref={tabsRef}>
            <span className="pill-indicator" style={{ left: pill.left, width: pill.width }}></span>
            <a ref={exploreRef} className={`nav-tab ${activeTab === "explore" ? "active" : ""}`} href="/" onClick={() => setActiveTab("explore")}>{t("nav.explore")}</a>
            <a ref={eventsRef} className={`nav-tab ${activeTab === "events" ? "active" : ""}`} href="/events" onClick={() => setActiveTab("events")}>{t("nav.events")}</a>
          </div>

          <div className="nav-right">
            <label className="search">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("nav.searchPlaceholder")} />
            </label>
            <LanguageToggle />
            <button className="icon-btn" title={t("explore.help")}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
            </button>
            <div className="avatar">CL</div>
          </div>
        </div>
      </nav>

      {/* Passport status strip */}
      <section className="passport-strip">
        <div className="passport-strip-inner">
          <div className="ps-head">
            <div className="ps-flag"><CircleFlag countryCode={passport.code.toLowerCase()} height={36} /></div>
            <div>
              <div className="ps-name">{t("explore.passportLabel", { name: passportName })}</div>
              <div className="ps-sub">{t("explore.passportSub", { n: passport.free + passport.voa + passport.req, rank: passport.rank })}</div>
            </div>
          </div>
          <div className="ps-stats">
            <div className="ps-stat free">
              <div className="ps-num"><span className="ps-dot"></span><span>{passport.free}</span></div>
              <div className="ps-lab"><b>{t("explore.freeLabel")}</b> · {t("explore.freeNote")}</div>
            </div>
            <div className="ps-stat voa">
              <div className="ps-num"><span className="ps-dot"></span><span>{passport.voa}</span></div>
              <div className="ps-lab"><b>{t("explore.voaLabel")}</b> · {t("explore.voaNote")}</div>
            </div>
            <div className="ps-stat req">
              <div className="ps-num"><span className="ps-dot"></span><span>{passport.req}</span></div>
              <div className="ps-lab"><b>{t("explore.reqLabel")}</b> · {t("explore.reqNote")}</div>
            </div>
          </div>
          <button className="ps-cta">
            {t("explore.fullMap")}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>
      </section>

      {/* Page */}
      <main className="page">
        <header className="pagehead">
          <h1>{t("pages.home.heroTitle")}</h1>
          <p>{t("pages.home.heroLede")}</p>
        </header>

        {/* Filter pill bar */}
        <div className="filter-bar">
          {FILTER_KEYS.map((key) => (
            <button key={key} className={`filter ${openMenu?.kind === "filter" && openMenu.key === key ? "active" : ""}`} onClick={(e) => openFilterMenu(e, key)}>
              <span className="icon"><FilterIcon k={key} /></span>
              <span className="text">
                <span className="label-key">{t(`explore.filters.${key}`)}</span>
                <span className="label-val">
                  <span>{filterOptions(key)[filterSel[key]]}</span>
                  <Chevron />
                </span>
              </span>
            </button>
          ))}
        </div>

        {/* Sort / count / view toggle row */}
        <div className="actions-row">
          <div className="results-count">
            {t.rich("explore.resultsCount", {
              count: countries.length,
              sort: t(`explore.sorts.${sortKey}`),
              b: (chunks) => <strong>{chunks}</strong>,
              dot: () => <span style={{ color: "#cdcdcd" }}>·</span>,
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button className="sort-select" onClick={openSortMenu}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M6 12h12M10 18h4" /></svg>
              <span>{t(`explore.sorts.${sortKey}`)}</span>
              <Chevron />
            </button>
            <div className="view-toggle">
              <button className={view === "grid" ? "active" : ""} onClick={() => setView("grid")}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>
                {t("explore.grid")}
              </button>
              <button className={view === "map" ? "active" : ""} onClick={() => setView("map")}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" /><line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" /></svg>
                {t("explore.map")}
              </button>
            </div>
          </div>
        </div>

        {view === "map" ? (
          /* Dotted world map: colorized dots for supported destinations, hover for the card */
          <VisaWorldMap
            countries={countries}
            renderCard={(slug) => {
              const c = countries.find((x) => x.slug === slug);
              return c ? <Card c={c} /> : null;
            }}
          />
        ) : (
          <>
            {/* Primary grid: 1 featured + regular */}
            <div className="grid">
              {first.map((c, i) => (
                <Card key={c.slug} c={c} featured={i === 0} />
              ))}
            </div>

            <div className="section-head">
              <h2>{t("explore.sectionTitle", { country: passportName })}</h2>
              <a href="#" className="seeall">{t("explore.seeAll", { n: COUNTRY_META.length })} <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg></a>
            </div>
            <div className="grid">
              {rest.map((c) => (
                <Card key={c.slug} c={c} />
              ))}
            </div>
          </>
        )}

        <p className="footnote">{t("explore.footnote")}</p>
      </main>

      <SiteFooter />

      {/* Filter / sort dropdown (portaled to escape the filter-bar overflow) */}
      {mounted &&
        openMenu &&
        createPortal(
          <div className="dropdown" style={{ position: "absolute", left: openMenu.left, top: openMenu.top }} onClick={(e) => e.stopPropagation()}>
            {openMenu.kind === "filter"
              ? filterOptions(openMenu.key).map((label, i) => (
                  <button
                    key={label}
                    className={filterSel[openMenu.key] === i ? "sel" : ""}
                    onClick={() => {
                      setFilterSel((prev) => ({ ...prev, [openMenu.key]: i }));
                      setOpenMenu(null);
                    }}
                  >
                    <span>{label}</span>
                    <Check className="check" />
                  </button>
                ))
              : SORT_KEYS.map((k) => (
                  <button
                    key={k}
                    className={sortKey === k ? "sel" : ""}
                    onClick={() => {
                      setSortKey(k);
                      setOpenMenu(null);
                    }}
                  >
                    <span>{t(`explore.sorts.${k}`)}</span>
                    <Check className="check" />
                  </button>
                ))}
          </div>,
          document.body,
        )}
    </>
  );
}
