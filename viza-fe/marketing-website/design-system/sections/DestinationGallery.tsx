"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CircleFlag } from "react-circle-flags";
import { useTranslations } from "next-intl";
import { Link } from "@/navigation";
import { visaHref } from "@/lib/countries";
import { useCatalogue } from "@/components/CatalogueProvider";
import VisaWorldMap from "@/components/VisaWorldMap";
import Photo from "../ui/Photo";
import { Bolt, Calendar, Check, ChevronDown, Doc, Globe, Grid, Info, MapIcon, Search, Sort } from "../ui/Icons";
import { stagger } from "../motion/delay";
import "../destinations.css";

const FILTER_KEYS = ["delivery", "type", "documents", "dates"] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

const SORT_KEYS = ["featured", "open", "name"] as const;
type SortKey = (typeof SORT_KEYS)[number];

/** Passport ranking data from the earlier explore page (names resolve from the `passports` namespace). */
const PASSPORTS = [
  { code: "SG", free: 157, voa: 29, req: 9 },
  { code: "JP", free: 154, voa: 30, req: 11 },
  { code: "KR", free: 152, voa: 31, req: 12 },
  { code: "DE", free: 153, voa: 28, req: 14 },
  { code: "FR", free: 151, voa: 29, req: 15 },
  { code: "GB", free: 148, voa: 30, req: 17 },
  { code: "US", free: 145, voa: 31, req: 19 },
  { code: "AU", free: 144, voa: 32, req: 19 },
  { code: "CA", free: 144, voa: 31, req: 20 },
  { code: "AE", free: 132, voa: 38, req: 25 },
  { code: "CN", free: 85, voa: 32, req: 78 },
  { code: "IN", free: 58, voa: 28, req: 109 },
  { code: "BR", free: 134, voa: 26, req: 35 },
  { code: "PH", free: 67, voa: 30, req: 98 },
  { code: "ID", free: 76, voa: 30, req: 89 },
  { code: "MY", free: 124, voa: 35, req: 36 },
  { code: "TH", free: 81, voa: 32, req: 82 },
] as const;

const FILTER_ICON: Record<FilterKey, typeof Bolt> = { delivery: Bolt, type: Globe, documents: Doc, dates: Calendar };

/** Cards shown before "Show all" (phones show fewer, see sections.css). */
const FIRST = 9;

export type GalleryCountry = {
  slug: string;
  name: string;
  city: string;
  type: string;
  valid: string;
  image: string;
  flagCode: string;
  launched: boolean;
  tag: "fast" | "evisa";
};

/** One destination: photo with flag, name, and a single line of facts. */
export function DestinationCard({ c, soon, free, compact }: { c: GalleryCountry; soon: string; free: string; compact?: boolean }) {
  return (
    <Link href={visaHref(c.slug)} className={`ds-dest${compact ? " is-compact" : ""}`}>
      <div className="ds-dest-media">
        <Photo src={c.image} sizes="(max-width: 809px) 100vw, (max-width: 1199px) 50vw, 421px" />
        <span className="ds-dest-flag" aria-hidden="true">
          <CircleFlag countryCode={c.flagCode} height={32} />
        </span>
        {!c.launched && <span className="ds-dest-soon">{soon}</span>}
      </div>
      <div className="ds-dest-caption">
        <h3 className="ds-title">{c.name}</h3>
        <p className="ds-small">
          {[c.type, c.valid, c.launched ? free : null].filter(Boolean).join(" · ")}
        </p>
      </div>
    </Link>
  );
}

type Menu = { kind: "filter"; key: FilterKey; left: number; top: number } | { kind: "sort"; left: number; top: number };

/**
 * The home destination gallery: passport selector, search, filter pills, sort, grid or map view, then the
 * destination cards. Every card link is in the server HTML (cards past the first nine are only hidden).
 */
export default function DestinationGallery({ asPage = false }: { asPage?: boolean }) {
  const t = useTranslations();
  const g = useTranslations("ds.gallery");
  const { countries: catalogue } = useCatalogue();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Passport
  const [passportCode, setPassportCode] = useState("SG");
  const [ppOpen, setPpOpen] = useState(false);
  const [ppQuery, setPpQuery] = useState("");
  const ppInput = useRef<HTMLInputElement>(null);
  const passport = PASSPORTS.find((p) => p.code === passportCode) ?? PASSPORTS[0];
  const passportName = t(`passports.${passport.code}`);

  useEffect(() => {
    if (ppOpen) {
      const id = window.setTimeout(() => ppInput.current?.focus(), 0);
      const close = () => setPpOpen(false);
      document.addEventListener("click", close);
      return () => {
        window.clearTimeout(id);
        document.removeEventListener("click", close);
      };
    }
    setPpQuery("");
  }, [ppOpen]);

  const passports = useMemo(() => {
    const q = ppQuery.trim().toLowerCase();
    return q ? PASSPORTS.filter((p) => t(`passports.${p.code}`).toLowerCase().includes(q) || p.code.toLowerCase().includes(q)) : PASSPORTS;
  }, [ppQuery, t]);

  // Filters and sort
  const [filterSel, setFilterSel] = useState<Record<FilterKey, number>>({ delivery: 0, type: 0, documents: 0, dates: 0 });
  const [sortKey, setSortKey] = useState<SortKey>("featured");
  const [menu, setMenu] = useState<Menu | null>(null);
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    document.addEventListener("click", close);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("click", close);
      window.removeEventListener("resize", close);
    };
  }, [menu]);
  const openMenu = (e: React.MouseEvent, next: Menu) => {
    e.stopPropagation();
    setPpOpen(false);
    setMenu((cur) => (cur && cur.kind === next.kind && (cur.kind === "sort" || (next.kind === "filter" && cur.key === next.key)) ? null : next));
  };
  const at = (e: React.MouseEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { left: Math.min(r.left + window.scrollX, window.innerWidth - 236), top: r.bottom + window.scrollY + 6 };
  };
  const filterOptions = (key: FilterKey) => t.raw(`explore.filterOpts.${key}`) as string[];

  const [view, setView] = useState<"grid" | "map">("grid");
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  const countries = useMemo<GalleryCountry[]>(() => {
    const list = catalogue.map((c) => ({
      slug: c.slug,
      name: t.has(`countries.${c.slug}`) ? t(`countries.${c.slug}`) : c.name,
      city: t.has(`cities.${c.slug}`) ? t(`cities.${c.slug}`) : c.city,
      type: t.has(`visaTypes.${c.type}`) ? t(`visaTypes.${c.type}`) : c.type,
      valid: t.has(`validity.${c.slug}`) ? t(`validity.${c.slug}`) : c.validity,
      image: c.image,
      flagCode: c.flagCode,
      launched: c.launched,
      tag: c.tag,
    }));
    if (sortKey === "name") return [...list].sort((a, b) => a.name.localeCompare(b.name));
    if (sortKey === "open") return [...list].sort((a, b) => Number(b.launched) - Number(a.launched));
    return list;
  }, [catalogue, t, sortKey]);

  const q = search.trim().toLowerCase();
  const matches = (c: GalleryCountry) => !q || c.name.toLowerCase().includes(q) || c.city.toLowerCase().includes(q);
  const visible = countries.filter(matches);
  const soon = t("common.comingSoon");
  const free = t("visa.priceFree");
  const collapsed = !asPage && !showAll && !q && countries.length > FIRST;

  return (
    <section className={`ds-section ds-gallery${asPage ? " ds-gallery--page" : ""}`} id="destinations" aria-labelledby="destinations-title">
      <div className="ds-container ds-stack">
        <div className={`ds-head${asPage ? " ds-head--page" : ""}`} data-reveal="">
          {asPage ? (
            <h1 id="destinations-title" className="ds-display ds-page-title">
              {t("pages.visaIndex.heroTitle")}
            </h1>
          ) : (
            <h2 id="destinations-title" className="ds-h2">
              {g("title")}
            </h2>
          )}
          <div className="ds-head-aside">
            <p className="ds-body">{g("lede")}</p>
            <div className="ds-seg" role="group" aria-label={g("view")}>
              <button type="button" aria-pressed={view === "grid"} onClick={() => setView("grid")}>
                <Grid size={14} />
                {t("explore.grid")}
              </button>
              <button type="button" aria-pressed={view === "map"} onClick={() => setView("map")}>
                <MapIcon size={14} />
                {t("explore.map")}
              </button>
            </div>
          </div>
        </div>

        <div className="ds-gallery-tools" data-reveal="">
          <div className="ds-gallery-row">
            <div className="ds-pp">
              <button
                type="button"
                className={`ds-pp-btn${ppOpen ? " is-open" : ""}`}
                aria-haspopup="listbox"
                aria-expanded={ppOpen}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenu(null);
                  setPpOpen((v) => !v);
                }}
              >
                <span className="ds-pp-flag">
                  <CircleFlag countryCode={passport.code.toLowerCase()} height={36} />
                </span>
                <span className="ds-pp-text">
                  <span className="ds-pp-key">{t("nav.yourPassport")}</span>
                  <span className="ds-pp-val">
                    {passportName}
                    <ChevronDown size={12} />
                  </span>
                </span>
              </button>
              {ppOpen && (
                <div className="ds-pop ds-pp-pop" onClick={(e) => e.stopPropagation()}>
                  <p className="ds-pop-title">{t("explore.choosePassport")}</p>
                  <label className="ds-search ds-search--muted">
                    <Search size={14} />
                    <input ref={ppInput} value={ppQuery} onChange={(e) => setPpQuery(e.target.value)} placeholder={t("explore.searchPassport")} autoComplete="off" />
                  </label>
                  <div className="ds-pp-list" role="listbox" aria-label={t("explore.choosePassport")}>
                    {passports.length === 0 ? (
                      <p className="ds-caption ds-pp-empty">{t("explore.noMatch", { q: ppQuery })}</p>
                    ) : (
                      passports.map((p) => (
                        <button
                          key={p.code}
                          type="button"
                          role="option"
                          aria-selected={p.code === passport.code}
                          className="ds-pp-row"
                          onClick={() => {
                            setPassportCode(p.code);
                            setPpOpen(false);
                          }}
                        >
                          <CircleFlag countryCode={p.code.toLowerCase()} height={26} />
                          <span className="ds-pp-name">{t(`passports.${p.code}`)}</span>
                          <span className="ds-caption">{t("explore.visaFree", { n: p.free })}</span>
                          <Check size={14} className="ds-pp-check" />
                        </button>
                      ))
                    )}
                  </div>
                  <p className="ds-caption ds-pop-foot">
                    <Info size={12} />
                    {t("explore.ppFoot")}
                  </p>
                </div>
              )}
            </div>
            <p className="ds-small ds-pp-summary">
              {g("passportSummary", { free: passport.free, voa: passport.voa, req: passport.req })}
            </p>
            <label className="ds-search">
              <Search size={16} />
              <span className="ds-sr">{t("nav.searchPlaceholder")}</span>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("nav.searchPlaceholder")} />
            </label>
          </div>
          <div className="ds-gallery-row ds-gallery-filters">
            <div className="ds-filter-scroll">
              {FILTER_KEYS.map((key) => {
                const Icon = FILTER_ICON[key];
                const isOpen = menu?.kind === "filter" && menu.key === key;
                return (
                  <button key={key} type="button" className={`ds-filter${isOpen ? " is-open" : ""}`} aria-expanded={isOpen} onClick={(e) => openMenu(e, { kind: "filter", key, ...at(e) })}>
                    <Icon size={14} />
                    <span className="ds-filter-key">{t(`explore.filters.${key}`)}</span>
                    <span className="ds-filter-val">{filterOptions(key)[filterSel[key]]}</span>
                    <ChevronDown size={12} />
                  </button>
                );
              })}
            </div>
            <button type="button" className={`ds-filter${menu?.kind === "sort" ? " is-open" : ""}`} aria-expanded={menu?.kind === "sort"} onClick={(e) => openMenu(e, { kind: "sort", ...at(e) })}>
              <Sort size={14} />
              <span className="ds-filter-val">{g(`sorts.${sortKey}`)}</span>
              <ChevronDown size={12} />
            </button>
          </div>
        </div>

        {countries.length === 0 ? (
          <p className="ds-body" role="status">
            {t("explore.catalogueUnavailable")}
          </p>
        ) : view === "map" ? (
          <VisaWorldMap
            countries={countries}
            renderCard={(slug) => {
              const c = countries.find((x) => x.slug === slug);
              return c ? <DestinationCard c={c} soon={soon} free={free} compact /> : null;
            }}
          />
        ) : (
          <>
            <ul className={`ds-dest-grid${collapsed ? " is-collapsed" : ""}`}>
              {countries.map((c, i) => (
                <li key={c.slug} hidden={!matches(c)} data-reveal="" style={stagger(i % 3)}>
                  <DestinationCard c={c} soon={soon} free={free} />
                </li>
              ))}
            </ul>
            {visible.length === 0 && (
              <p className="ds-body" role="status">
                {g("noResults")}
              </p>
            )}
            {collapsed && (
              <div className="ds-gallery-more">
                <button type="button" className="ds-btn ds-btn--muted" onClick={() => setShowAll(true)}>
                  {t("explore.seeAll", { n: countries.length })}
                  <ChevronDown size={16} />
                </button>
              </div>
            )}
          </>
        )}
        <p className="ds-caption ds-gallery-note">{t("explore.footnote")}</p>
      </div>

      {mounted &&
        menu &&
        createPortal(
          <div className="ds-pop ds-menu-pop" style={{ left: menu.left, top: menu.top }} onClick={(e) => e.stopPropagation()}>
            {menu.kind === "filter"
              ? filterOptions(menu.key).map((label, i) => (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={filterSel[menu.key] === i}
                    onClick={() => {
                      setFilterSel((prev) => ({ ...prev, [menu.key]: i }));
                      setMenu(null);
                    }}
                  >
                    <span>{label}</span>
                    <Check size={14} />
                  </button>
                ))
              : SORT_KEYS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={sortKey === k}
                    onClick={() => {
                      setSortKey(k);
                      setMenu(null);
                    }}
                  >
                    <span>{g(`sorts.${k}`)}</span>
                    <Check size={14} />
                  </button>
                ))}
          </div>,
          document.body,
        )}
    </section>
  );
}
