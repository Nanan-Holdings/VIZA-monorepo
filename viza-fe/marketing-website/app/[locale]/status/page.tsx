"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import SiteNav from "@/components/SiteNav";
import "./status.css";
import SiteFooter from "@/components/SiteFooter";

// ----- Data -----
// Status: op | deg | part | maj
type PortalStatus = "op" | "deg" | "part" | "maj";
interface PortalBanner {
  type: "red" | "amber";
}
interface Portal {
  iso: string;
  status: PortalStatus;
  uptime: number;
  banner?: PortalBanner;
}
// Copy (names, subtitles, banner text) lives in the `status.portals` messages, keyed by ISO code.
const PORTALS: Portal[] = [
  { iso: "AE", status: "op", uptime: 88.84 },
  { iso: "AM", status: "op", uptime: 100 },
  { iso: "AU", status: "op", uptime: 48.95 },
  { iso: "AZ", status: "op", uptime: 92.64 },
  { iso: "DE", status: "op", uptime: 98.28 },
  { iso: "DK", status: "op", uptime: 100 },
  { iso: "EG", status: "op", uptime: 68.49 },
  { iso: "FI", status: "op", uptime: 97.78 },
  { iso: "FR", status: "op", uptime: 79.11 },
  { iso: "GB", status: "maj", uptime: 40.15, banner: { type: "red" } },
  { iso: "GE", status: "op", uptime: 100 },
  { iso: "GR", status: "op", uptime: 89.69 },
  { iso: "HK", status: "op", uptime: 95.71 },
  { iso: "ID", status: "op", uptime: 93.47 },
  { iso: "IN", status: "op", uptime: 100 },
  { iso: "JO", status: "op", uptime: 91.87 },
  { iso: "KE", status: "op", uptime: 93.64 },
  { iso: "KH", status: "op", uptime: 97.01 },
  { iso: "LK", status: "op", uptime: 99.78 },
  { iso: "MA", status: "op", uptime: 76.54 },
  { iso: "TH", status: "op", uptime: 84.2 },
];

// PRNG so the 90-day bars are deterministic per row
function mulberry(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Compute the 90-day bar classes for a row given uptime and seed (pure + deterministic)
function barsFor(uptime: number, seed: string, statusFinal: PortalStatus): PortalStatus[] {
  const rng = mulberry(hashStr(seed));
  const targetIssues = Math.round((90 * (100 - uptime)) / 100); // proportional
  // distribute issues somewhat clustered
  const issueDays = new Set<number>();
  while (issueDays.size < targetIssues) {
    // cluster near middle/end for realism
    const r = rng();
    const idx = Math.floor(Math.pow(r, 1.2) * 90); // bias slightly toward 0..89
    issueDays.add(idx);
  }
  const out: PortalStatus[] = [];
  for (let d = 0; d < 90; d++) {
    let cls: PortalStatus = "op";
    if (issueDays.has(d)) {
      const sev = rng();
      if (sev < 0.5) cls = "deg";
      else if (sev < 0.85) cls = "part";
      else cls = "maj";
    }
    // today (d=89) reflects current status
    if (d === 89 && statusFinal !== "op") cls = statusFinal;
    out.push(cls);
  }
  return out;
}

function pctClass(uptime: number) {
  if (uptime < 60) return "maj";
  if (uptime < 80) return "part";
  if (uptime < 95) return "deg";
  return "";
}

// ----- Incidents -----
// (timeline curated from the past two weeks; dates/times/descriptions live in
// the `status.incidents.days` messages, zipped with this structure by index)
type IncidentTag = "identified" | "investigating" | "resolved";
interface IncidentItem {
  iso: string;
  tags: IncidentTag[]; // one per event, in order
}
interface IncidentDay {
  count: number;
  items: IncidentItem[];
}
const INCIDENTS: IncidentDay[] = [
  {
    count: 2,
    items: [
      { iso: "EG", tags: ["resolved"] },
      { iso: "ID", tags: ["resolved"] },
    ],
  },
  {
    count: 2,
    items: [
      { iso: "EG", tags: ["identified", "investigating", "investigating"] },
      { iso: "ID", tags: ["identified", "investigating"] },
    ],
  },
  {
    count: 1,
    items: [{ iso: "AE", tags: ["identified", "resolved", "identified", "resolved"] }],
  },
  {
    count: 2,
    items: [
      { iso: "AE", tags: ["investigating", "resolved", "identified", "resolved"] },
      { iso: "GB", tags: ["resolved", "identified", "investigating"] },
    ],
  },
  {
    count: 2,
    items: [
      { iso: "AE", tags: ["identified", "resolved", "identified", "resolved"] },
      { iso: "GB", tags: ["resolved", "identified"] },
    ],
  },
  {
    count: 3,
    items: [
      { iso: "AE", tags: ["identified", "resolved"] },
      { iso: "GB", tags: ["identified", "resolved", "identified"] },
      { iso: "TH", tags: ["identified", "resolved"] },
    ],
  },
  {
    count: 1,
    items: [{ iso: "AE", tags: ["identified", "resolved"] }],
  },
  {
    count: 5,
    items: [
      { iso: "AE", tags: ["identified", "resolved"] },
      { iso: "AU", tags: ["resolved"] },
      { iso: "GB", tags: ["resolved"] },
      { iso: "ID", tags: ["identified", "investigating", "resolved"] },
      { iso: "TH", tags: ["resolved", "identified", "resolved"] },
    ],
  },
];

/** Localized incident copy, mirrored (by index) from `INCIDENTS`. */
interface LocalizedIncidentDay {
  date: string;
  items: { events: { time: string; desc: string }[] }[];
}

type SubTab = "current" | "incidents" | "subscribe";

export default function StatusPage() {
  const t = useTranslations("status");

  const [search, setSearch] = useState("");
  const [activeSub, setActiveSub] = useState<SubTab>("current");

  // 90-day bars are static per row — compute once
  const portalBars = useMemo(() => new Map(PORTALS.map((p) => [p.iso, barsFor(p.uptime, p.iso, p.status)])), []);
  const atlysBars = useMemo(() => barsFor(99.5, "atlys-platform", "op"), []);

  const incidentDays = t.raw("incidents.days") as LocalizedIncidentDay[];

  const f = search.trim().toLowerCase();
  const visiblePortals = PORTALS.filter(
    (p) => !f || t(`portals.${p.iso}.name`).toLowerCase().includes(f) || p.iso.toLowerCase().includes(f),
  );

  const renderBars = (bars: PortalStatus[]) =>
    bars.map((cls, d) => <div key={d} className={`uptime-bar ${cls === "op" ? "" : cls}`} title={t("dayTitle", { n: d - 89 })}></div>);

  return (
    <>
      {/* Top nav */}
      <SiteNav />

      {/* HERO */}
      <section className="hero" data-screen-label="Hero">
        <div className="hero-inner">
          <div className="crumb">
            <a href="/">{t("crumbHome")}</a>
            <span className="arr">›</span>
            <span className="here">{t("crumbHere")}</span>
          </div>

          <div className="hero-grid">
            <div>
              <h1>
                {t.rich("hero.title", {
                  em: (chunks) => <em>{chunks}</em>,
                  br: () => <br />,
                })}
              </h1>
              <p className="lead">{t("hero.lead")}</p>
            </div>

            <div className="console">
              <div className="console-head">
                <span>{t("console.title")}</span>
                <span className="live">{t("console.live")}</span>
              </div>
              <div className="console-body">
                <div className="console-state">
                  <div className="ico">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <h2>
                    {t("console.allOperational")}
                    <small>{t("console.lastRefresh")}</small>
                  </h2>
                </div>
                <div className="console-numbers">
                  <div className="console-num">
                    <div className="v">
                      99.5
                      <small style={{ fontSize: "14px", color: "#5eead4" }}>%</small>
                    </div>
                    <div className="k">{t("console.kAtlys")}</div>
                  </div>
                  <div className="console-num">
                    <div className="v">21</div>
                    <div className="k">{t("console.kPortals")}</div>
                  </div>
                  <div className="console-num">
                    <div className="v">1</div>
                    <div className="k">{t("console.kIncidents")}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SUBNAV */}
      <div className="subnav">
        <div className="subnav-inner">
          <div className="sub-tabs">
            <a className={`sub-tab ${activeSub === "current" ? "active" : ""}`} href="#current" onClick={() => setActiveSub("current")}>
              {t("subnav.current")} <span className="cnt">21</span>
            </a>
            <a className={`sub-tab ${activeSub === "incidents" ? "active" : ""}`} href="#incidents" onClick={() => setActiveSub("incidents")}>
              {t("subnav.incidents")}
            </a>
            <a className={`sub-tab ${activeSub === "subscribe" ? "active" : ""}`} href="#subscribe" onClick={() => setActiveSub("subscribe")}>
              {t("subnav.subscribe")}
            </a>
          </div>
          <div className="search-box">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input id="countrySearch" type="search" placeholder={t("subnav.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <a className="btn-sub" href="#subscribe">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16v16H4z" />
              <path d="m22 7-10 6L2 7" />
            </svg>
            {t("subnav.subscribeBtn")}
          </a>
        </div>
      </div>

      {/* BODY */}
      <main className="page" id="current">
        {/* Atlys (VIZA) row */}
        <section className="panel">
          <div className="panel-head">
            <h3>{t("platform.title")}</h3>
            <span className="meta">
              <span className="pulse"></span>
              {t("platform.meta")}
            </span>
          </div>
          <div className="feat">
            <div className="feat-title">
              <div className="mark">VZ</div>
              <div className="ti">
                <h4>{t("platform.name")}</h4>
                <div className="sub">{t("platform.sub")}</div>
              </div>
            </div>
            <div className="uptime">
              <div className="uptime-bars" data-up="99.5" data-row="atlys">
                {renderBars(atlysBars)}
              </div>
              <div className="uptime-foot">
                <span>{t("uptime.ago")}</span>
                <strong>{t("uptime.pct", { pct: "99.5" })}</strong>
                <span>{t("uptime.today")}</span>
              </div>
            </div>
            <div className="row-stat">
              <div className="pct">{t("statusLabels.op")}</div>
              <div className="lbl">{t("noIssues")}</div>
            </div>
          </div>
        </section>

        {/* Government portals */}
        <div className="panel-section-head">
          <div>
            <h2>{t("portalsHead.title")}</h2>
            <p>{t("portalsHead.lead")}</p>
          </div>
          <div className="legend">
            <span className="legend-item">
              <span className="legend-sw op"></span>
              {t("statusLabels.op")}
            </span>
            <span className="legend-item">
              <span className="legend-sw de"></span>
              {t("statusLabels.deg")}
            </span>
            <span className="legend-item">
              <span className="legend-sw pa"></span>
              {t("statusLabels.part")}
            </span>
            <span className="legend-item">
              <span className="legend-sw mj"></span>
              {t("statusLabels.maj")}
            </span>
          </div>
        </div>

        <section className="panel" id="portalList">
          {visiblePortals.map((p) => (
            <div className="row" data-name={t(`portals.${p.iso}.name`).toLowerCase()} key={p.iso}>
              <div className="row-title">
                <div className="iso">{p.iso}</div>
                <div className="ti">
                  <h5>{t(`portals.${p.iso}.name`)}</h5>
                  <div className="sub">{t(`portals.${p.iso}.sub`)}</div>
                </div>
              </div>
              <div className="uptime">
                <div className="uptime-bars">{renderBars(portalBars.get(p.iso) ?? [])}</div>
                <div className="uptime-foot">
                  <span>{t("uptime.ago")}</span>
                  <strong>{t("uptime.pct", { pct: p.uptime.toFixed(2) })}</strong>
                  <span>{t("uptime.today")}</span>
                </div>
              </div>
              <div className="row-stat">
                <div className={`pct ${pctClass(p.uptime)}`}>{t(`statusLabels.${p.status}`)}</div>
                <div className="lbl">{p.status === "op" ? t("noIssues") : t("activeIncident")}</div>
              </div>
              {p.banner && (
                <div className={`row-banner ${p.banner.type === "red" ? "" : "amber"}`}>
                  <span>{t(`portals.${p.iso}.bannerText`)}</span>
                  <a href="#incidents">{t(`portals.${p.iso}.bannerLink`)} →</a>
                </div>
              )}
            </div>
          ))}
        </section>

        {/* Past incidents */}
        <div className="panel-section-head" id="incidents">
          <div>
            <h2>{t("incidentsHead.title")}</h2>
            <p>{t("incidentsHead.lead")}</p>
          </div>
          <div className="legend">
            <span className="legend-item">
              <span className="legend-sw de"></span>
              {t("tags.identified")}
            </span>
            <span className="legend-item">
              <span className="legend-sw pa"></span>
              {t("tags.investigating")}
            </span>
            <span className="legend-item">
              <span className="legend-sw op"></span>
              {t("tags.resolved")}
            </span>
          </div>
        </div>

        <section className="panel" id="incidentList">
          {INCIDENTS.map((day, di) => {
            const loc = incidentDays[di];
            return (
              <div className="day-group" key={loc.date}>
                <div className="day-head">
                  <span className="date">{loc.date}</span>
                  <span className="count">
                    {t.rich("incidents.count", {
                      count: day.count,
                      strong: (chunks) => <strong>{chunks}</strong>,
                    })}
                  </span>
                </div>
                {day.items.map((it, ii) => (
                  <div className="incident" key={it.iso}>
                    <div className="incident-country">
                      <div className="iso">{it.iso}</div>
                      <div className="ni">
                        <h5>{t(`portals.${it.iso}.name`)}</h5>
                        <div className="when">{t("incidents.events", { count: it.tags.length })}</div>
                      </div>
                    </div>
                    <div className="incident-events">
                      {it.tags.map((tag, ei) => (
                        <div className="ev" key={ei}>
                          <span className="time">{loc.items[ii].events[ei].time}</span>
                          <span className={`tag ${tag}`}>
                            <span className="d"></span>
                            {t(`tags.${tag}`)}
                          </span>
                          <span className="desc">{loc.items[ii].events[ei].desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </section>

        {/* Subscribe strip */}
        <section className="strip" id="subscribe">
          <div className="left">
            <h3>
              {t.rich("subscribe.title", {
                br: () => <br />,
              })}
            </h3>
            <p>{t("subscribe.lead")}</p>
          </div>
          <div className="right">
            <label style={{ fontSize: "13px", color: "var(--fg-2)" }}>{t("subscribe.emailLabel")}</label>
            <div className="form-row">
              <input type="email" placeholder={t("subscribe.emailPlaceholder")} />
              <button className="btn-go">{t("subscribe.button")}</button>
            </div>
            <div style={{ fontSize: "12px", color: "var(--fg-2)", marginTop: "4px" }}>{t("subscribe.follow")}</div>
            <div className="chan">
              <span className="chan-chip">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1 0 2 1 2 2v12c0 1-1 2-2 2H4c-1 0-2-1-2-2V6c0-1 1-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                {t("subscribe.chipEmail")}
              </span>
              <span className="chan-chip">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
                {t("subscribe.chipSms")}
              </span>
              <span className="chan-chip">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 11a16 16 0 0 1 16 16" />
                  <path d="M4 4a23 23 0 0 1 23 23" />
                  <circle cx="5" cy="26" r="2" />
                </svg>
                {t("subscribe.chipRss")}
              </span>
              <span className="chan-chip">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 11.5C21 17 12 22 12 22S3 17 3 11.5a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="11" r="3" />
                </svg>
                {t("subscribe.chipWebhook")}
              </span>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
