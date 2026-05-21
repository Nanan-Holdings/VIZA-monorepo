"use client";

import { useEffect } from "react";
import SiteNav from "@/components/SiteNav";
import "./status.css";

export default function StatusPage() {
  useEffect(() => {
    // --- nav pill ---
    const tabsEl = document.getElementById("navTabs");
    const pill = document.getElementById("navPill") as HTMLElement | null;
    function movePill(target: HTMLElement | null) {
      if (!target || !pill || !tabsEl) return;
      const r = target.getBoundingClientRect();
      const pr = tabsEl.getBoundingClientRect();
      pill.style.left = r.left - pr.left + "px";
      pill.style.width = r.width + "px";
    }
    void movePill;
    // no active nav tab on status page; hide indicator
    if (pill) pill.style.display = "none";

    // ----- Data -----
    // Status: op | deg | part | maj
    type PortalStatus = "op" | "deg" | "part" | "maj";
    interface PortalBanner {
      type: "red" | "amber";
      text: string;
      link: string;
    }
    interface Portal {
      iso: string;
      name: string;
      sub: string;
      status: PortalStatus;
      uptime: number;
      note?: string;
      banner?: PortalBanner;
    }
    const PORTALS: Portal[] = [
      { iso: "AE", name: "United Arab Emirates", sub: "GDRFA · ICA portals", status: "op", uptime: 88.84 },
      { iso: "AM", name: "Armenia", sub: "e-Visa portal", status: "op", uptime: 100 },
      { iso: "AU", name: "Australia", sub: "ImmiAccount", status: "op", uptime: 48.95, note: "Repeated availability dips overnight (AET). 7-day pattern monitored." },
      { iso: "AZ", name: "Azerbaijan", sub: "ASAN Visa", status: "op", uptime: 92.64 },
      { iso: "DE", name: "Germany", sub: "VIDEX · consulate slots", status: "op", uptime: 98.28 },
      { iso: "DK", name: "Denmark", sub: "newtodenmark.dk", status: "op", uptime: 100 },
      { iso: "EG", name: "Egypt", sub: "e-Visa Portal", status: "op", uptime: 68.49 },
      { iso: "FI", name: "Finland", sub: "EnterFinland", status: "op", uptime: 97.78 },
      { iso: "FR", name: "France", sub: "France-Visas", status: "op", uptime: 79.11 },
      { iso: "GB", name: "United Kingdom", sub: "UKVCAS · UK Visas", status: "maj", uptime: 40.15, banner: { type: "red", text: "Some application types are facing an outage.", link: "View incident timeline" } },
      { iso: "GE", name: "Georgia", sub: "evisa.gov.ge", status: "op", uptime: 100 },
      { iso: "GR", name: "Greece", sub: "AEGEAN · consular", status: "op", uptime: 89.69 },
      { iso: "HK", name: "Hong Kong", sub: "Immigration eVisa", status: "op", uptime: 95.71 },
      { iso: "ID", name: "Indonesia", sub: "e-Visa Indonesia", status: "op", uptime: 93.47 },
      { iso: "IN", name: "India", sub: "Indian Visa Online", status: "op", uptime: 100 },
      { iso: "JO", name: "Jordan", sub: "gateway.jo", status: "op", uptime: 91.87 },
      { iso: "KE", name: "Kenya", sub: "eCitizen / eVisa", status: "op", uptime: 93.64 },
      { iso: "KH", name: "Cambodia", sub: "evisa.gov.kh", status: "op", uptime: 97.01 },
      { iso: "LK", name: "Sri Lanka", sub: "ETA portal", status: "op", uptime: 99.78 },
      { iso: "MA", name: "Morocco", sub: "evisa.gov.ma", status: "op", uptime: 76.54 },
      { iso: "TH", name: "Thailand", sub: "Thailand e-Visa", status: "op", uptime: 84.2 },
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

    // Render 90-day bar for a row given uptime and seed
    function bars(uptime: number, seed: string, statusFinal: PortalStatus) {
      const rng = mulberry(hashStr(seed));
      const out: string[] = [];
      const targetIssues = Math.round((90 * (100 - uptime)) / 100); // proportional
      // distribute issues somewhat clustered
      const issueDays = new Set<number>();
      while (issueDays.size < targetIssues) {
        // cluster near middle/end for realism
        const r = rng();
        const idx = Math.floor(Math.pow(r, 1.2) * 90); // bias slightly toward 0..89
        issueDays.add(idx);
      }
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
        out.push(`<div class="uptime-bar ${cls === "op" ? "" : cls}" title="Day ${d - 89}"></div>`);
      }
      return out.join("");
    }

    function statusLabel(s: PortalStatus) {
      return ({ op: "Operational", deg: "Degraded", part: "Partial outage", maj: "Major outage" } as const)[s];
    }
    function pctClass(uptime: number) {
      if (uptime < 60) return "maj";
      if (uptime < 80) return "part";
      if (uptime < 95) return "deg";
      return "";
    }

    function renderPortals(filter = "") {
      const list = document.getElementById("portalList");
      if (!list) return;
      const f = filter.trim().toLowerCase();
      const rows = PORTALS.filter((p) => !f || p.name.toLowerCase().includes(f) || p.iso.toLowerCase().includes(f));
      list.innerHTML = rows
        .map((p) => {
          const bannerHtml = p.banner
            ? `<div class="row-banner ${p.banner.type === "red" ? "" : "amber"}">
             <span>${p.banner.text}</span>
             <a href="#incidents">${p.banner.link} →</a>
           </div>`
            : "";
          return `
        <div class="row" data-name="${p.name.toLowerCase()}">
          <div class="row-title">
            <div class="iso">${p.iso}</div>
            <div class="ti">
              <h5>${p.name}</h5>
              <div class="sub">${p.sub}</div>
            </div>
          </div>
          <div class="uptime">
            <div class="uptime-bars">${bars(p.uptime, p.iso, p.status)}</div>
            <div class="uptime-foot">
              <span>90 days ago</span>
              <strong>${p.uptime.toFixed(2)}% uptime</strong>
              <span>Today</span>
            </div>
          </div>
          <div class="row-stat">
            <div class="pct ${pctClass(p.uptime)}">${statusLabel(p.status)}</div>
            <div class="lbl">${p.status === "op" ? "No active issues" : "Active incident"}</div>
          </div>
          ${bannerHtml}
        </div>
      `;
        })
        .join("");
      // Also build the Atlys featured row's bars
      const atlysBars = document.querySelector<HTMLElement>('.feat .uptime-bars[data-row="atlys"]');
      if (atlysBars && !atlysBars.dataset.rendered) {
        atlysBars.innerHTML = bars(99.5, "atlys-platform", "op");
        atlysBars.dataset.rendered = "1";
      }
    }
    renderPortals();

    const searchInput = document.getElementById("countrySearch") as HTMLInputElement | null;
    const onSearchInput = (e: Event) => renderPortals((e.target as HTMLInputElement).value);
    if (searchInput) searchInput.addEventListener("input", onSearchInput);

    // ----- Incidents -----
    // (timeline curated from the past two weeks)
    type IncidentTag = "identified" | "investigating" | "resolved";
    interface IncidentEvent {
      t: string;
      tag: IncidentTag;
      desc: string;
    }
    interface IncidentItem {
      iso: string;
      name: string;
      events: IncidentEvent[];
    }
    interface IncidentDay {
      date: string;
      count: number;
      items: IncidentItem[];
    }
    const INCIDENTS: IncidentDay[] = [
      {
        date: "May 10, 2026",
        count: 2,
        items: [
          { iso: "EG", name: "Egypt", events: [{ t: "May 10, 3:05 PM", tag: "resolved", desc: "This incident has been resolved. Service has returned to normal operations." }] },
          { iso: "ID", name: "Indonesia", events: [{ t: "May 10, 5:05 PM", tag: "resolved", desc: "This incident has been resolved. Service has returned to normal operations." }] },
        ],
      },
      {
        date: "May 9, 2026",
        count: 2,
        items: [
          {
            iso: "EG",
            name: "Egypt",
            events: [
              { t: "May 9, 10:50 PM", tag: "identified", desc: "We are investigating elevated failure rates." },
              { t: "May 10, 12:20 AM", tag: "investigating", desc: "Severity escalated from degraded to partial outage." },
              { t: "May 10, 2:50 AM", tag: "investigating", desc: "Severity escalated from partial outage to major outage." },
            ],
          },
          {
            iso: "ID",
            name: "Indonesia",
            events: [
              { t: "May 9, 3:05 PM", tag: "identified", desc: "We are investigating elevated failure rates." },
              { t: "May 9, 7:20 PM", tag: "investigating", desc: "Severity escalated from partial outage to major outage." },
            ],
          },
        ],
      },
      {
        date: "May 8, 2026",
        count: 1,
        items: [
          {
            iso: "AE",
            name: "United Arab Emirates",
            events: [
              { t: "May 8, 1:05 PM", tag: "identified", desc: "We are investigating elevated failure rates." },
              { t: "May 8, 2:05 PM", tag: "resolved", desc: "This incident has been resolved. Service has returned to normal operations." },
              { t: "May 8, 2:50 PM", tag: "identified", desc: "We are investigating elevated failure rates." },
              { t: "May 8, 7:35 PM", tag: "resolved", desc: "This incident has been resolved. Service has returned to normal operations." },
            ],
          },
        ],
      },
      {
        date: "May 5, 2026",
        count: 2,
        items: [
          {
            iso: "AE",
            name: "United Arab Emirates",
            events: [
              { t: "May 5, 1:36 PM", tag: "investigating", desc: "Severity escalated from degraded to partial outage." },
              { t: "May 5, 4:50 PM", tag: "resolved", desc: "This incident has been resolved." },
              { t: "May 5, 9:20 PM", tag: "identified", desc: "We are investigating elevated failure rates." },
              { t: "May 5, 10:20 PM", tag: "resolved", desc: "This incident has been resolved." },
            ],
          },
          {
            iso: "GB",
            name: "United Kingdom",
            events: [
              { t: "May 5, 2:43 PM", tag: "resolved", desc: "This incident has been resolved." },
              { t: "May 5, 3:35 PM", tag: "identified", desc: "We are investigating elevated failure rates." },
              { t: "May 5, 7:35 PM", tag: "investigating", desc: "Severity escalated from partial outage to major outage." },
            ],
          },
        ],
      },
      {
        date: "May 4, 2026",
        count: 2,
        items: [
          {
            iso: "AE",
            name: "United Arab Emirates",
            events: [
              { t: "May 4, 4:05 PM", tag: "identified", desc: "We are investigating elevated failure rates." },
              { t: "May 4, 5:05 PM", tag: "resolved", desc: "This incident has been resolved." },
              { t: "May 4, 7:36 PM", tag: "identified", desc: "We are investigating elevated failure rates." },
              { t: "May 4, 8:35 PM", tag: "resolved", desc: "This incident has been resolved." },
            ],
          },
          {
            iso: "GB",
            name: "United Kingdom",
            events: [
              { t: "May 4, 12:05 PM", tag: "resolved", desc: "This incident has been resolved." },
              { t: "May 4, 1:50 PM", tag: "identified", desc: "We are investigating elevated failure rates." },
            ],
          },
        ],
      },
      {
        date: "May 2, 2026",
        count: 3,
        items: [
          {
            iso: "AE",
            name: "United Arab Emirates",
            events: [
              { t: "May 2, 6:35 PM", tag: "identified", desc: "We are investigating elevated failure rates." },
              { t: "May 2, 7:50 PM", tag: "resolved", desc: "This incident has been resolved." },
            ],
          },
          {
            iso: "GB",
            name: "United Kingdom",
            events: [
              { t: "May 2, 9:20 AM", tag: "identified", desc: "We are investigating elevated failure rates." },
              { t: "May 2, 10:20 AM", tag: "resolved", desc: "This incident has been resolved." },
              { t: "May 2, 8:20 PM", tag: "identified", desc: "We are investigating elevated failure rates." },
            ],
          },
          {
            iso: "TH",
            name: "Thailand",
            events: [
              { t: "May 2, 8:20 PM", tag: "identified", desc: "We are investigating elevated failure rates." },
              { t: "May 3, 12:05 AM", tag: "resolved", desc: "This incident has been resolved." },
            ],
          },
        ],
      },
      {
        date: "May 1, 2026",
        count: 1,
        items: [
          {
            iso: "AE",
            name: "United Arab Emirates",
            events: [
              { t: "May 1, 2:05 PM", tag: "identified", desc: "We are investigating elevated failure rates." },
              { t: "May 1, 3:05 PM", tag: "resolved", desc: "This incident has been resolved." },
            ],
          },
        ],
      },
      {
        date: "April 30, 2026",
        count: 5,
        items: [
          {
            iso: "AE",
            name: "United Arab Emirates",
            events: [
              { t: "Apr 30, 8:20 AM", tag: "identified", desc: "We are investigating elevated failure rates." },
              { t: "Apr 30, 9:50 AM", tag: "resolved", desc: "This incident has been resolved." },
            ],
          },
          { iso: "AU", name: "Australia", events: [{ t: "Apr 30, 3:05 PM", tag: "resolved", desc: "This incident has been resolved." }] },
          { iso: "GB", name: "United Kingdom", events: [{ t: "Apr 30, 4:51 PM", tag: "resolved", desc: "This incident has been resolved." }] },
          {
            iso: "ID",
            name: "Indonesia",
            events: [
              { t: "Apr 30, 1:20 PM", tag: "identified", desc: "We are investigating elevated failure rates." },
              { t: "Apr 30, 2:37 PM", tag: "investigating", desc: "Severity escalated from degraded to partial outage." },
              { t: "Apr 30, 8:20 PM", tag: "resolved", desc: "This incident has been resolved." },
            ],
          },
          {
            iso: "TH",
            name: "Thailand",
            events: [
              { t: "Apr 30, 6:50 PM", tag: "resolved", desc: "This incident has been resolved." },
              { t: "Apr 30, 7:50 PM", tag: "identified", desc: "We are investigating elevated failure rates." },
              { t: "May 1, 12:20 AM", tag: "resolved", desc: "This incident has been resolved." },
            ],
          },
        ],
      },
    ];

    function renderIncidents() {
      const c = document.getElementById("incidentList");
      if (!c) return;
      c.innerHTML = INCIDENTS.map(
        (day) => `
      <div class="day-group">
        <div class="day-head">
          <span class="date">${day.date}</span>
          <span class="count"><strong>${day.count}</strong> ${day.count === 1 ? "country" : "countries"} faced performance issues</span>
        </div>
        ${day.items
          .map(
            (it) => `
          <div class="incident">
            <div class="incident-country">
              <div class="iso">${it.iso}</div>
              <div class="ni">
                <h5>${it.name}</h5>
                <div class="when">${it.events.length} event${it.events.length > 1 ? "s" : ""}</div>
              </div>
            </div>
            <div class="incident-events">
              ${it.events
                .map(
                  (e) => `
                <div class="ev">
                  <span class="time">${e.t}</span>
                  <span class="tag ${e.tag}"><span class="d"></span>${e.tag[0].toUpperCase() + e.tag.slice(1)}</span>
                  <span class="desc">${e.desc}</span>
                </div>
              `,
                )
                .join("")}
            </div>
          </div>
        `,
          )
          .join("")}
      </div>
    `,
      ).join("");
    }
    renderIncidents();

    // Sub-tab active state via scroll
    const subTabs = document.querySelectorAll<HTMLElement>(".sub-tab");
    const onSubTabClick = (t: HTMLElement) => () => {
      subTabs.forEach((x) => x.classList.remove("active"));
      t.classList.add("active");
    };
    const handlers: Array<{ el: HTMLElement; fn: () => void }> = [];
    subTabs.forEach((t) => {
      const fn = onSubTabClick(t);
      t.addEventListener("click", fn);
      handlers.push({ el: t, fn });
    });

    return () => {
      if (searchInput) searchInput.removeEventListener("input", onSearchInput);
      handlers.forEach(({ el, fn }) => el.removeEventListener("click", fn));
    };
  }, []);

  return (
    <>
      {/* Top nav */}
      <SiteNav />

      {/* HERO */}
      <section className="hero" data-screen-label="Hero">
        <div className="hero-inner">
          <div className="crumb">
            <a href="/">Transparency</a>
            <span className="arr">›</span>
            <span className="here">System Status</span>
          </div>

          <div className="hero-grid">
            <div>
              <h1>
                On time, <em>guaranteed.</em>
                <br />
                Or you{'’'}ll be the first to know.
              </h1>
              <p className="lead">
                A real-time dashboard for VIZA and every government visa portal we file against — whether it{'’'}s up, slow, or buckling under a 9pm Monday rush. We publish what we see, the moment we see it.
              </p>
            </div>

            <div className="console">
              <div className="console-head">
                <span>VIZA Reliability · Live</span>
                <span className="live">On time</span>
              </div>
              <div className="console-body">
                <div className="console-state">
                  <div className="ico">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <h2>
                    All systems operational
                    <small>Last refresh 12 seconds ago · monitored every 30s</small>
                  </h2>
                </div>
                <div className="console-numbers">
                  <div className="console-num">
                    <div className="v">
                      99.5
                      <small style={{ fontSize: "14px", color: "#5eead4" }}>%</small>
                    </div>
                    <div className="k">Atlys, 90&#8209;day</div>
                  </div>
                  <div className="console-num">
                    <div className="v">21</div>
                    <div className="k">Portals monitored</div>
                  </div>
                  <div className="console-num">
                    <div className="v">1</div>
                    <div className="k">Active incident</div>
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
            <a className="sub-tab active" href="#current">
              Current status <span className="cnt">21</span>
            </a>
            <a className="sub-tab" href="#incidents">
              Past incidents
            </a>
            <a className="sub-tab" href="#subscribe">
              Subscribe
            </a>
          </div>
          <div className="search-box">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input id="countrySearch" type="search" placeholder="Search for countries" />
          </div>
          <a className="btn-sub" href="#subscribe">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16v16H4z" />
              <path d="m22 7-10 6L2 7" />
            </svg>
            Subscribe to updates
          </a>
        </div>
      </div>

      {/* BODY */}
      <main className="page" id="current">
        {/* Atlys (VIZA) row */}
        <section className="panel">
          <div className="panel-head">
            <h3>VIZA platform</h3>
            <span className="meta">
              <span className="pulse"></span>Monitored 30s · 12 services
            </span>
          </div>
          <div className="feat">
            <div className="feat-title">
              <div className="mark">VZ</div>
              <div className="ti">
                <h4>Atlys application platform</h4>
                <div className="sub">Web · iOS · Android · Consultant console</div>
              </div>
            </div>
            <div className="uptime">
              <div className="uptime-bars" data-up="99.5" data-row="atlys"></div>
              <div className="uptime-foot">
                <span>90 days ago</span>
                <strong>99.5% uptime</strong>
                <span>Today</span>
              </div>
            </div>
            <div className="row-stat">
              <div className="pct">Operational</div>
              <div className="lbl">No active issues</div>
            </div>
          </div>
        </section>

        {/* Government portals */}
        <div className="panel-section-head">
          <div>
            <h2>Government portals</h2>
            <p>We poll each portal continuously and surface what we observe — so you don{'’'}t have to refresh a 2003-era webform yourself.</p>
          </div>
          <div className="legend">
            <span className="legend-item">
              <span className="legend-sw op"></span>Operational
            </span>
            <span className="legend-item">
              <span className="legend-sw de"></span>Degraded
            </span>
            <span className="legend-item">
              <span className="legend-sw pa"></span>Partial outage
            </span>
            <span className="legend-item">
              <span className="legend-sw mj"></span>Major outage
            </span>
          </div>
        </div>

        <section className="panel" id="portalList">
          {/* rendered by JS */}
        </section>

        {/* Past incidents */}
        <div className="panel-section-head" id="incidents">
          <div>
            <h2>Past incidents</h2>
            <p>Every event we logged, in plain words. We don{'’'}t hide them — we link to them.</p>
          </div>
          <div className="legend">
            <span className="legend-item">
              <span className="legend-sw de"></span>Identified
            </span>
            <span className="legend-item">
              <span className="legend-sw pa"></span>Investigating
            </span>
            <span className="legend-item">
              <span className="legend-sw op"></span>Resolved
            </span>
          </div>
        </div>

        <section className="panel" id="incidentList">
          {/* rendered by JS */}
        </section>

        {/* Subscribe strip */}
        <section className="strip" id="subscribe">
          <div className="left">
            <h3>
              Be the first
              <br />
              to hear when something breaks.
            </h3>
            <p>Pick the countries you care about and we{'’'}ll send you a single, plain-English update when their portals — or ours — go down or come back online.</p>
          </div>
          <div className="right">
            <label style={{ fontSize: "13px", color: "var(--fg-2)" }}>Get incident updates by email</label>
            <div className="form-row">
              <input type="email" placeholder="you@example.com" />
              <button className="btn-go">Subscribe</button>
            </div>
            <div style={{ fontSize: "12px", color: "var(--fg-2)", marginTop: "4px" }}>Or follow status via:</div>
            <div className="chan">
              <span className="chan-chip">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1 0 2 1 2 2v12c0 1-1 2-2 2H4c-1 0-2-1-2-2V6c0-1 1-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                Email digest
              </span>
              <span className="chan-chip">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
                SMS &amp; WhatsApp
              </span>
              <span className="chan-chip">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 11a16 16 0 0 1 16 16" />
                  <path d="M4 4a23 23 0 0 1 23 23" />
                  <circle cx="5" cy="26" r="2" />
                </svg>
                RSS feed
              </span>
              <span className="chan-chip">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 11.5C21 17 12 22 12 22S3 17 3 11.5a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="11" r="3" />
                </svg>
                Webhook for ops
              </span>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="site-foot" data-screen-label="Footer">
        <div className="foot-rule"></div>
        <div className="foot-main">
          <div className="foot-brand">
            <a className="foot-logo" href="/">
              <img src="/assets/viza-logo-black.svg" alt="VIZA" />
            </a>
            <p className="foot-tag">VIZA helps you plan, apply, and track visas seamlessly across the world.</p>
          </div>
          <div className="col-company">
            <h4 className="col-head">Company</h4>
            <ul className="col-list">
              <li>
                <a href="/careers">Careers</a>
              </li>
              <li>
                <a href="/contact">Contact</a>
              </li>
              <li>
                <a href="/security">Security</a>
              </li>
              <li>
                <a href="/status">System status</a>
              </li>
              <li>
                <a href="/refunds">Refunds Policy</a>
              </li>
              <li>
                <a href="/legal/privacy">Privacy</a>
              </li>
              <li>
                <a href="/legal/terms">Terms</a>
              </li>
            </ul>
          </div>
          <div className="col-products">
            <h4 className="col-head">Products</h4>
            <ul className="col-list">
              <li>
                <a href="/">Visa Requirements</a>
              </li>
              <li>
                <a href="#">Schengen Appointment Checker</a>
              </li>
              <li>
                <a href="#">Visa Photo Creator</a>
              </li>
              <li>
                <a href="#">VIZA Emergency Helpline</a>
              </li>
            </ul>
          </div>
        </div>
        <div className="foot-rule"></div>
        <div className="foot-bottom">
          <div className="legal">
            <span>© VIZA, All rights reserved</span>
            <span className="sep"></span>
            <a href="#">Privacy</a>
            <span className="sep"></span>
            <a href="#">Terms</a>
          </div>
          <div className="foot-mark">
            <img src="/assets/viza-logo-black.svg" alt="VIZA" />
          </div>
        </div>
      </footer>
    </>
  );
}
