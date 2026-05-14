"use client";

import { useEffect } from "react";
import { CircleFlag } from "react-circle-flags";
import "./site-nav.css";

const FLAG_CDN = "https://hatscripts.github.io/circle-flags/flags";

type Passport = { code: string; name: string };
const PASSPORTS: Passport[] = [
  { code: "SG", name: "Singapore" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" },
  { code: "AU", name: "Australia" },
  { code: "CA", name: "Canada" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "CN", name: "China" },
  { code: "IN", name: "India" },
  { code: "BR", name: "Brazil" },
  { code: "PH", name: "Philippines" },
  { code: "ID", name: "Indonesia" },
  { code: "MY", name: "Malaysia" },
  { code: "TH", name: "Thailand" },
];

type Props = {
  /** "explore" or "events" — adds .active to that tab. Omit for none. */
  activeTab?: "explore" | "events";
};

export default function SiteNav({ activeTab }: Props) {
  useEffect(() => {
    const tabsEl = document.getElementById("siteNavTabs");
    const pill = document.getElementById("siteNavPill");
    function movePill(target: Element) {
      if (!tabsEl || !pill) return;
      const r = target.getBoundingClientRect();
      const pr = tabsEl.getBoundingClientRect();
      (pill as HTMLElement).style.left = r.left - pr.left + "px";
      (pill as HTMLElement).style.width = r.width + "px";
    }
    tabsEl?.querySelectorAll(".nav-tab").forEach((b) => {
      b.addEventListener("click", () => {
        tabsEl.querySelectorAll(".nav-tab").forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        movePill(b);
      });
    });
    requestAnimationFrame(() => {
      const active = tabsEl?.querySelector(".nav-tab.active");
      if (active) movePill(active);
    });
    const onResize = () => {
      const active = tabsEl?.querySelector(".nav-tab.active");
      if (active) movePill(active);
    };
    window.addEventListener("resize", onResize);

    let currentPassport: Passport = PASSPORTS[0];
    let passportPop: HTMLElement | null = null;
    const passportPill = document.getElementById("siteNavPassportPill");

    function setPassport(p: Passport) {
      currentPassport = p;
      const code = p.code.toLowerCase();
      const ball = document.getElementById("siteNavPassportBall");
      if (ball) ball.innerHTML = `<img src="${FLAG_CDN}/${code}.svg" alt="${p.name}"/>`;
      const nameEl = document.getElementById("siteNavPassportName");
      if (nameEl) nameEl.textContent = p.name;
    }

    function closePassportPop() {
      if (passportPop) {
        passportPop.remove();
        passportPop = null;
      }
      passportPill?.classList.remove("open");
    }

    function renderPassportList(query: string) {
      const q = (query || "").trim().toLowerCase();
      const filtered = PASSPORTS.filter(
        (p) => !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)
      );
      return (
        filtered
          .map(
            (p) => `
        <button class="pp-row ${p.code === currentPassport.code ? "sel" : ""}" data-code="${p.code}">
          <span class="pp-flag"><img src="${FLAG_CDN}/${p.code.toLowerCase()}.svg" alt="${p.name}"/></span>
          <span class="pp-name">${p.name}</span>
          <svg class="pp-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </button>`
          )
          .join("") ||
        `<div style="padding:24px 12px;text-align:center;color:var(--fg-2);font-size:13px;">No passports match "${query}"</div>`
      );
    }

    function bindPpRows() {
      if (!passportPop) return;
      passportPop.querySelectorAll(".pp-row").forEach((r) => {
        r.addEventListener("click", () => {
          const p = PASSPORTS.find((x) => x.code === (r as HTMLElement).dataset.code);
          if (p) setPassport(p);
          closePassportPop();
        });
      });
    }

    passportPill?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (passportPop) {
        closePassportPop();
        return;
      }
      passportPill.classList.add("open");
      const pop = document.createElement("div");
      pop.className = "passport-pop";
      pop.innerHTML = `
        <h4>Choose your passport</h4>
        <label class="pp-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input id="ppSearch" placeholder="Search passport country…" autocomplete="off"/>
        </label>
        <div class="pp-list" id="ppList">${renderPassportList("")}</div>
        <div class="pp-foot">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
          Updated for May 2026 · Sourced from IATA Timatic
        </div>`;
      passportPill.appendChild(pop);
      passportPop = pop;
      pop.addEventListener("click", (e2) => e2.stopPropagation());
      const inp = pop.querySelector("#ppSearch") as HTMLInputElement | null;
      setTimeout(() => inp?.focus(), 0);
      inp?.addEventListener("input", (e2) => {
        const list = pop.querySelector("#ppList");
        if (list) list.innerHTML = renderPassportList((e2.target as HTMLInputElement).value);
        bindPpRows();
      });
      bindPpRows();
    });

    document.addEventListener("click", closePassportPop);

    return () => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("click", closePassportPop);
    };
  }, []);

  return (
    <nav className="site-nav">
      <div className="nav-inner">
        <div className="nav-left">
          <a className="nav-logo" href="/" aria-label="VIZA home">
            <img src="/assets/viza-logo-black.svg" alt="VIZA" />
          </a>
          <button className="passport-pill" id="siteNavPassportPill" type="button">
            <span className="ball" id="siteNavPassportBall">
              <CircleFlag countryCode="sg" height={32} />
            </span>
            <span>
              <span className="lab-key">Your passport</span>
              <span className="lab-val">
                <span id="siteNavPassportName">Singapore</span>
                <svg className="chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
            </span>
          </button>
        </div>

        <div className="nav-tabs" id="siteNavTabs">
          <span className="pill-indicator" id="siteNavPill" />
          <a className={`nav-tab${activeTab === "explore" ? " active" : ""}`} data-tab="explore" href="/">Explore</a>
          <a className={`nav-tab${activeTab === "events" ? " active" : ""}`} data-tab="events" href="/events">Events</a>
        </div>

        <div className="nav-right">
          <label className="search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input id="siteNavSearchInput" placeholder="Search a country or visa…" />
          </label>
          <button className="icon-btn" title="Help" type="button">
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
