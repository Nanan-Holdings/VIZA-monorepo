"use client";

import { useEffect } from "react";
import { CircleFlag } from "react-circle-flags";
import SiteNav from "@/components/SiteNav";
import "./contact.css";

export default function ContactPage() {
  useEffect(() => {
    // Tab pill indicator
    const tabsEl = document.getElementById("navTabs");
    const pill = document.getElementById("navPill") as HTMLElement | null;
    function movePill(target: Element | null) {
      if (!target || !tabsEl || !pill) return;
      const r = (target as HTMLElement).getBoundingClientRect();
      const pr = tabsEl.getBoundingClientRect();
      pill.style.left = r.left - pr.left + "px";
      pill.style.width = r.width + "px";
    }
    const activeTab = tabsEl?.querySelector(".nav-tab.active") ?? null;
    requestAnimationFrame(() => movePill(activeTab));
    const onResize = () => movePill(tabsEl?.querySelector(".nav-tab.active") ?? null);
    window.addEventListener("resize", onResize);

    // QR generator — pseudo-random but deterministic per seed, with finder patterns.
    // Renders a 33x33 module SVG that LOOKS like a real QR code.
    function makeQR(svgId: string, seed: string) {
      const svg = document.getElementById(svgId);
      if (!svg) return;
      const SIZE = 33;
      // deterministic PRNG
      let s = 0;
      for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
      function rand() {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 0xffffffff;
      }

      // grid: 0 = white, 1 = black
      const grid: number[][] = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));

      // place finder pattern (7x7) at top-left of a 7x7 area starting at (r,c)
      function placeFinder(r: number, c: number) {
        for (let i = 0; i < 7; i++) {
          for (let j = 0; j < 7; j++) {
            const isBorder = i === 0 || i === 6 || j === 0 || j === 6;
            const isCenter = i >= 2 && i <= 4 && j >= 2 && j <= 4;
            grid[r + i][c + j] = isBorder || isCenter ? 1 : 0;
          }
        }
      }
      placeFinder(0, 0);
      placeFinder(0, SIZE - 7);
      placeFinder(SIZE - 7, 0);

      // small alignment pattern bottom-right
      function placeAlign(r: number, c: number) {
        for (let i = 0; i < 5; i++) {
          for (let j = 0; j < 5; j++) {
            const isBorder = i === 0 || i === 4 || j === 0 || j === 4;
            const isCenter = i === 2 && j === 2;
            grid[r + i][c + j] = isBorder || isCenter ? 1 : 0;
          }
        }
      }
      placeAlign(SIZE - 9, SIZE - 9);

      // timing patterns
      for (let i = 8; i < SIZE - 8; i++) {
        grid[6][i] = i % 2 === 0 ? 1 : 0;
        grid[i][6] = i % 2 === 0 ? 1 : 0;
      }

      // mark "reserved" zones we won't overwrite
      function isReserved(r: number, c: number) {
        if (r < 9 && c < 9) return true;
        if (r < 9 && c > SIZE - 9) return true;
        if (r > SIZE - 9 && c < 9) return true;
        if (r >= SIZE - 9 && c >= SIZE - 9) return true;
        if (r === 6 || c === 6) return true;
        return false;
      }

      // fill data modules with deterministic noise
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          if (isReserved(r, c)) continue;
          grid[r][c] = rand() < 0.48 ? 1 : 0;
        }
      }

      // clear a 5x5 in the very center (for the logo)
      const cx = Math.floor(SIZE / 2);
      for (let i = cx - 2; i <= cx + 2; i++) {
        for (let j = cx - 2; j <= cx + 2; j++) {
          grid[i][j] = 0;
        }
      }

      // emit svg
      let path = "";
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          if (grid[r][c]) path += `M${c} ${r}h1v1h-1z`;
        }
      }
      svg.innerHTML = `<rect width="${SIZE}" height="${SIZE}" fill="#fff"/><path d="${path}" fill="#0a0a0a" shape-rendering="crispEdges"/>`;
    }
    makeQR("qr-wechat", "viza-wechat-help-desk");
    makeQR("qr-whatsapp", "viza-whatsapp-help-desk");

    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <>
      {/* ============================== NAV ============================== */}
      <SiteNav />

      {/* ============================== HERO ============================== */}
      <section className="hero" data-screen-label="Hero">
        <div className="hero-inner">
          <div className="hero-top">
            <div className="hero-crumb">
              <a href="/">VIZA</a>
              <span className="sep">/</span>
              <span>Get in touch</span>
            </div>
            <div className="hero-status">
              <span className="dot"></span>
              All four desks online
              <span className="meta">· 24 consultants live now</span>
            </div>
          </div>

          <h1 className="hero-headline">
            We pick up<br />
            the phone. <em>And</em><br />
            <span className="underline">we mean it.</span>
          </h1>

          <div className="hero-band">
            <p className="hero-lead">
              Tricky Schengen rejection. Visa expiring on Monday. Just a pricing question. <strong>Pick a channel below</strong> — phone, WhatsApp, WeChat, or email — and a consultant who handles that exact corridor will be with you in minutes, not days.
            </p>
            <div className="hero-actions">
              <a className="btn-hero-primary" href="#form">
                Send a brief
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
              </a>
              <a className="btn-hero-ghost" href="#channels">See all channels</a>
            </div>
          </div>

          <div className="hero-channels-head" id="channels">
            <span className="lbl">Choose your channel</span>
            <span className="hint">Each one staffed by humans on our consultant floor — not a chatbot, not a forwarding inbox.</span>
          </div>
          <div className="channel-grid">

            {/* WhatsApp */}
            <div className="ch-card tone-whatsapp">
              <div className="ch-head">
                <div className="ch-glyph">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
                </div>
                <span className="ch-tag">QR · live chat</span>
              </div>
              <h3>WhatsApp<small>Fastest channel · median 2 min reply</small></h3>
              <div className="ch-body">
                <div className="qr-block">
                  <div className="qr-frame">
                    <svg viewBox="0 0 33 33" id="qr-whatsapp" preserveAspectRatio="xMidYMid meet"></svg>
                    <div className="qr-logo">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
                    </div>
                  </div>
                  <div className="qr-meta">
                    <strong>Scan to chat</strong>
                    <span className="qr-handle">+65 9013 4421</span>
                  </div>
                </div>
              </div>
              <div className="ch-foot">
                <span className="hours"><span className="dot"></span>24/7 · all hours covered</span>
                <span className="ch-action">Start a chat ↗</span>
              </div>
            </div>

            {/* WeChat */}
            <div className="ch-card tone-wechat">
              <div className="ch-head">
                <div className="ch-glyph">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 4C5.4 4 2 6.7 2 10c0 1.7.9 3.3 2.4 4.4L3.5 17l3-1.5c.6.1 1.3.2 2 .2" /><path d="M22 14.5c0-2.8-2.7-5.1-6-5.1s-6 2.3-6 5.1 2.7 5.1 6 5.1c.5 0 1 0 1.5-.1L20 21l-.4-1.9c1.5-1 2.4-2.4 2.4-3.9z" /><circle cx="7" cy="9" r="0.5" fill="currentColor" /><circle cx="12" cy="9" r="0.5" fill="currentColor" /><circle cx="14" cy="14" r="0.5" fill="currentColor" /><circle cx="18" cy="14" r="0.5" fill="currentColor" /></svg>
                </div>
                <span className="ch-tag">QR · 微信</span>
              </div>
              <h3>WeChat<small>For our clients in mainland China &amp; SEA</small></h3>
              <div className="ch-body">
                <div className="qr-block">
                  <div className="qr-frame">
                    <svg viewBox="0 0 33 33" id="qr-wechat" preserveAspectRatio="xMidYMid meet"></svg>
                    <div className="qr-logo">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 4C5.4 4 2 6.7 2 10c0 1.7.9 3.3 2.4 4.4L3.5 17l3-1.5c.6.1 1.3.2 2 .2" /><path d="M22 14.5c0-2.8-2.7-5.1-6-5.1s-6 2.3-6 5.1 2.7 5.1 6 5.1c.5 0 1 0 1.5-.1L20 21l-.4-1.9c1.5-1 2.4-2.4 2.4-3.9z" /></svg>
                    </div>
                  </div>
                  <div className="qr-meta">
                    <strong>Scan to add</strong>
                    <span className="qr-handle">@viza_help</span>
                  </div>
                </div>
              </div>
              <div className="ch-foot">
                <span className="hours"><span className="dot"></span>Mon–Sun · 9am–11pm SGT</span>
                <span className="ch-action">Open in WeChat ↗</span>
              </div>
            </div>

            {/* Phone */}
            <div className="ch-card tone-phone">
              <div className="ch-head">
                <div className="ch-glyph">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5a2 2 0 0 1 2-2h3l2 5-2 1a12 12 0 0 0 6 6l1-2 5 2v3a2 2 0 0 1-2 2A18 18 0 0 1 3 5z" /></svg>
                </div>
                <span className="ch-tag">Voice · 7 languages</span>
              </div>
              <h3>Phone<small>For urgent visa issues — talk to a consultant</small></h3>
              <div className="ch-body">
                <div className="big-read">
                  <div className="label">Asia · primary</div>
                  <div className="value mono">+65 6011 8842</div>
                  <div className="sub">English · 普通话 · Bahasa · हिन्दी · Tagalog</div>
                </div>
                <div className="big-read">
                  <div className="label">Americas &amp; Europe</div>
                  <div className="value mono">+1 (415) 802 9911</div>
                  <div className="sub">English · Español · Français · Português</div>
                </div>
              </div>
              <div className="ch-foot">
                <span className="hours"><span className="dot"></span>24/7 emergency line · always live</span>
                <span className="ch-action">Tap to dial ↗</span>
              </div>
            </div>

            {/* Email */}
            <div className="ch-card tone-email">
              <div className="ch-head">
                <div className="ch-glyph">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><polyline points="3 7 12 13 21 7" /></svg>
                </div>
                <span className="ch-tag">Async · written</span>
              </div>
              <h3>Email<small>Best for documents, attachments, long context</small></h3>
              <div className="ch-body">
                <div className="big-read">
                  <div className="label">General enquiries</div>
                  <div className="value">hello@viza.travel</div>
                  <div className="sub">Routed to the right desk within an hour.</div>
                </div>
                <div className="big-read">
                  <div className="label">Press &amp; partnerships</div>
                  <div className="value">press@viza.travel<br /><span style={{ fontSize: "18px" }}>partners@viza.travel</span></div>
                </div>
              </div>
              <div className="ch-foot">
                <span className="hours"><span className="dot"></span>4 hour SLA on weekdays</span>
                <span className="ch-action">Compose ↗</span>
              </div>
            </div>

          </div>

          <div style={{ display: "none" }}>
            <div className="pass">
              <div className="corner tl"></div><div className="corner tr"></div>
              <div className="corner bl"></div><div className="corner br"></div>
              <div className="pass-row">
                <div>
                  <div className="pass-key">Republic of</div>
                  <div className="pass-val">VIZA</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="pass-key">Type</div>
                  <div className="pass-val">Contact card</div>
                </div>
              </div>
              <h3>Reach the<br />VIZA help desk</h3>
              <ul className="pass-list">
                <li>
                  <span className="pic"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><polyline points="3 7 12 13 21 7" /></svg></span>
                  <div>hello@viza.travel<small>Replies within 4 working hours</small></div>
                </li>
                <li>
                  <span className="pic"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5a2 2 0 0 1 2-2h3l2 5-2 1a12 12 0 0 0 6 6l1-2 5 2v3a2 2 0 0 1-2 2A18 18 0 0 1 3 5z" /></svg></span>
                  <div>+65 6011 8842<small>24/7 hotline · seven languages</small></div>
                </li>
                <li>
                  <span className="pic"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg></span>
                  <div>1 Marina Boulevard, #20-01<small>VIZA HQ · Singapore</small></div>
                </li>
              </ul>
              <div className="pass-foot">
                <div>
                  <div className="ref-lab">Reference</div>
                  <span className="ref">VIZA-CON-2026</span>
                </div>
                <div className="pass-stamp">VERIFIED<br />VIZA · 26</div>
              </div>
            </div>

            <div className="float-card float-1">
              <div className="ic"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg></div>
              <div>
                <div className="lab">Live response</div>
                <div>~2 min on WhatsApp</div>
              </div>
            </div>
            <div className="float-card float-2">
              <div className="ic"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></div>
              <div>
                <div className="lab">Today</div>
                <div>All desks online</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================== CHANNELS (moved into hero) ============================== */}
      <section className="channels" id="channels-removed" style={{ display: "none" }}>
        <div className="section">
          <div className="sec-head">
            <div className="sec-eyebrow">Choose your channel</div>
            <h2>Five ways to reach us.<br />Pick whichever you <em>actually use.</em></h2>
            <p>Each channel is staffed by humans on our consultant floor — not a chatbot, not a forwarding inbox. Scan a QR, dial a number, or send a brief. We{'’'}ll meet you where you are.</p>
          </div>

          <div className="channel-grid">

            {/* WeChat */}
            <div className="ch-card tone-wechat">
              <div className="ch-head">
                <div className="ch-glyph">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 4C5.4 4 2 6.7 2 10c0 1.7.9 3.3 2.4 4.4L3.5 17l3-1.5c.6.1 1.3.2 2 .2" /><path d="M22 14.5c0-2.8-2.7-5.1-6-5.1s-6 2.3-6 5.1 2.7 5.1 6 5.1c.5 0 1 0 1.5-.1L20 21l-.4-1.9c1.5-1 2.4-2.4 2.4-3.9z" /><circle cx="7" cy="9" r="0.5" fill="currentColor" /><circle cx="12" cy="9" r="0.5" fill="currentColor" /><circle cx="14" cy="14" r="0.5" fill="currentColor" /><circle cx="18" cy="14" r="0.5" fill="currentColor" /></svg>
                </div>
                <span className="ch-tag">QR · 微信</span>
              </div>
              <h3>WeChat<small>For our clients in mainland China &amp; SEA</small></h3>
              <div className="ch-body">
                <div className="qr-block">
                  <div className="qr-frame">
                    <svg viewBox="0 0 33 33" id="qr-wechat" preserveAspectRatio="xMidYMid meet"></svg>
                    <div className="qr-logo">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 4C5.4 4 2 6.7 2 10c0 1.7.9 3.3 2.4 4.4L3.5 17l3-1.5c.6.1 1.3.2 2 .2" /><path d="M22 14.5c0-2.8-2.7-5.1-6-5.1s-6 2.3-6 5.1 2.7 5.1 6 5.1c.5 0 1 0 1.5-.1L20 21l-.4-1.9c1.5-1 2.4-2.4 2.4-3.9z" /></svg>
                    </div>
                  </div>
                  <div className="qr-meta">
                    <strong>Scan to add</strong>
                    <span className="qr-handle">@viza_help</span>
                  </div>
                </div>
              </div>
              <div className="ch-foot">
                <span className="hours"><span className="dot"></span>Mon–Sun · 9am–11pm SGT</span>
                <span className="ch-action">Open in WeChat ↗</span>
              </div>
            </div>

            {/* WhatsApp */}
            <div className="ch-card tone-whatsapp">
              <div className="ch-head">
                <div className="ch-glyph">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /><path d="M8.5 10.5c.4 1.6 1.9 3.1 3.5 3.5l1-1c.3-.3.7-.4 1.1-.2l1.7.7c.4.1.6.5.6.9V16c0 .6-.5 1.1-1.1 1-2.2-.2-4.5-1.3-6.1-3-1.6-1.7-2.5-3.9-2.6-6.1 0-.6.4-1.1 1-1.1h1.5c.4 0 .8.2.9.6l.7 1.7c.2.4.1.8-.2 1.1l-1 1z" /></svg>
                </div>
                <span className="ch-tag">QR · live chat</span>
              </div>
              <h3>WhatsApp<small>Fastest channel · median 2 min reply</small></h3>
              <div className="ch-body">
                <div className="qr-block">
                  <div className="qr-frame">
                    <svg viewBox="0 0 33 33" id="qr-whatsapp" preserveAspectRatio="xMidYMid meet"></svg>
                    <div className="qr-logo">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
                    </div>
                  </div>
                  <div className="qr-meta">
                    <strong>Scan to chat</strong>
                    <span className="qr-handle">+65 9013 4421</span>
                  </div>
                </div>
              </div>
              <div className="ch-foot">
                <span className="hours"><span className="dot"></span>24/7 · all working hours covered</span>
                <span className="ch-action">Start a chat ↗</span>
              </div>
            </div>

            {/* Phone */}
            <div className="ch-card tone-phone">
              <div className="ch-head">
                <div className="ch-glyph">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5a2 2 0 0 1 2-2h3l2 5-2 1a12 12 0 0 0 6 6l1-2 5 2v3a2 2 0 0 1-2 2A18 18 0 0 1 3 5z" /></svg>
                </div>
                <span className="ch-tag">Voice · 7 languages</span>
              </div>
              <h3>Phone<small>For urgent visa issues — talk to a consultant</small></h3>
              <div className="ch-body">
                <div className="big-read">
                  <div className="label">Asia · primary</div>
                  <div className="value mono">+65 6011 8842</div>
                  <div className="sub">English · 普通话 · Bahasa · हिन्दी · Tagalog</div>
                </div>
                <div className="big-read">
                  <div className="label">Americas &amp; Europe</div>
                  <div className="value mono">+1 (415) 802 9911</div>
                  <div className="sub">English · Español · Français · Português</div>
                </div>
              </div>
              <div className="ch-foot">
                <span className="hours"><span className="dot"></span>24/7 emergency line · always live</span>
                <span className="ch-action">Tap to dial ↗</span>
              </div>
            </div>

            {/* Email */}
            <div className="ch-card tone-email">
              <div className="ch-head">
                <div className="ch-glyph">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><polyline points="3 7 12 13 21 7" /></svg>
                </div>
                <span className="ch-tag">Async · written</span>
              </div>
              <h3>Email<small>Best for documents, attachments, long context</small></h3>
              <div className="ch-body">
                <div className="big-read">
                  <div className="label">General enquiries</div>
                  <div className="value">hello@viza.travel</div>
                  <div className="sub">Routed to the right desk within an hour.</div>
                </div>
                <div className="big-read">
                  <div className="label">Press &amp; partnerships</div>
                  <div className="value">press@viza.travel<br /><span style={{ fontSize: "18px" }}>partners@viza.travel</span></div>
                </div>
              </div>
              <div className="ch-foot">
                <span className="hours"><span className="dot"></span>4 hour SLA on weekdays</span>
                <span className="ch-action">Compose ↗</span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ============================== FORM + ASIDE ============================== */}
      <section className="section" id="form">
        <div className="sec-head">
          <div className="sec-eyebrow">Send us a brief</div>
          <h2>The fastest way to a useful reply.</h2>
          <p>Tell us your nationality, where you{'’'}re going, and what{'’'}s blocking you. The form below routes you to a consultant who handles that exact corridor — not a generalist who{'’'}ll forward your email twice.</p>
        </div>

        <div className="contact-form-wrap">
          <form
            className="form-shell"
            onSubmit={(event) => {
              event.preventDefault();
              alert("Demo only — your brief would now be routed to the right desk.");
            }}
          >
            <div className="form-head">
              <div>
                <h3>Contact brief</h3>
                <p>Fields marked <span style={{ color: "var(--brand-500)" }}>▲</span> are required. We typically respond within 4 working hours.</p>
              </div>
              <div className="form-ref">
                <div className="lab">Form ID</div>
                <div className="ref">VIZA-CON-FORM-26</div>
              </div>
            </div>

            <div className="form-row">
              <div className="field">
                <label>Full name <span className="req">▲</span></label>
                <input type="text" placeholder="As it appears on your passport" />
              </div>
              <div className="field">
                <label>Email <span className="req">▲</span></label>
                <input type="email" placeholder="you@example.com" />
              </div>
            </div>

            <div className="form-row">
              <div className="field">
                <label>Phone (with country code)</label>
                <div className="phone-combo">
                  <select>
                    <option>🇸🇬 +65</option>
                    <option>🇺🇸 +1</option>
                    <option>🇬🇧 +44</option>
                    <option>🇦🇪 +971</option>
                    <option>🇨🇳 +86</option>
                    <option>🇮🇳 +91</option>
                    <option>🇵🇭 +63</option>
                  </select>
                  <input type="tel" placeholder="9012 3456" />
                </div>
              </div>
              <div className="field">
                <label>Preferred channel for reply</label>
                <select>
                  <option>WhatsApp (fastest)</option>
                  <option>Email</option>
                  <option>Phone call</option>
                  <option>WeChat</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="field">
                <label>Passport / nationality <span className="req">▲</span></label>
                <select>
                  <option>Select your passport…</option>
                  <option>🇸🇬 Singapore</option>
                  <option>🇮🇳 India</option>
                  <option>🇨🇳 China</option>
                  <option>🇵🇭 Philippines</option>
                  <option>🇮🇩 Indonesia</option>
                  <option>🇺🇸 United States</option>
                  <option>🇬🇧 United Kingdom</option>
                  <option>Other / not listed</option>
                </select>
              </div>
              <div className="field">
                <label>Destination</label>
                <select>
                  <option>I{'’'}m exploring…</option>
                  <option>Schengen / EU</option>
                  <option>United States</option>
                  <option>United Kingdom</option>
                  <option>UAE</option>
                  <option>Australia</option>
                  <option>Japan</option>
                  <option>Other / not listed</option>
                </select>
              </div>
            </div>

            <div className="form-row solo">
              <div className="field">
                <label>What{'’'}s this about? <span className="req">▲</span></label>
                <div className="reasons">
                  <label className="reason"><input type="checkbox" /><span className="ck"></span>Start a new application</label>
                  <label className="reason"><input type="checkbox" defaultChecked /><span className="ck"></span>Status of an existing one</label>
                  <label className="reason"><input type="checkbox" /><span className="ck"></span>Urgent / time-sensitive</label>
                  <label className="reason"><input type="checkbox" /><span className="ck"></span>Refund or cancellation</label>
                  <label className="reason"><input type="checkbox" /><span className="ck"></span>Partnership</label>
                  <label className="reason"><input type="checkbox" /><span className="ck"></span>Press</label>
                  <label className="reason"><input type="checkbox" /><span className="ck"></span>Just a question</label>
                </div>
              </div>
            </div>

            <div className="form-row solo">
              <div className="field">
                <label>Tell us what{'’'}s going on <span className="req">▲</span></label>
                <textarea placeholder="A few lines is fine. If you have a flight date, an application reference (VIZA-XXXX-XXXX), or a screenshot of a portal error, include it."></textarea>
              </div>
            </div>

            <div className="form-foot">
              <label className="consent">
                <input type="checkbox" defaultChecked />
                <span>I agree to VIZA processing my message and contact details under the <a href="#">Privacy Policy</a>. We never share your passport details with third parties.</span>
              </label>
              <button className="btn-submit" type="submit">
                Send brief
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></svg>
              </button>
            </div>
          </form>

          <aside className="form-aside">
            <div className="aside-card tone-brand">
              <h4><span className="glyph"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg></span>Response promise</h4>
              <p>Every brief lands on a real consultant{'’'}s desk within minutes — never a shared inbox. Here{'’'}s how fast we typically reply, by channel.</p>
              <div style={{ marginTop: "14px" }}>
                <div className="sla-row"><span className="k" style={{ color: "rgba(255,255,255,0.7)" }}>WhatsApp</span><span className="v" style={{ color: "#fff" }}>~2 min</span></div>
                <div className="sla-row" style={{ borderColor: "rgba(255,255,255,0.18)" }}><span className="k" style={{ color: "rgba(255,255,255,0.7)" }}>WeChat</span><span className="v" style={{ color: "#fff" }}>~5 min</span></div>
                <div className="sla-row" style={{ borderColor: "rgba(255,255,255,0.18)" }}><span className="k" style={{ color: "rgba(255,255,255,0.7)" }}>Phone (urgent)</span><span className="v" style={{ color: "#fff" }}>Live, 24/7</span></div>
                <div className="sla-row" style={{ borderColor: "rgba(255,255,255,0.18)" }}><span className="k" style={{ color: "rgba(255,255,255,0.7)" }}>Email / form</span><span className="v" style={{ color: "#fff" }}>&lt; 4 hrs</span></div>
              </div>
            </div>

            <div className="aside-card">
              <h4><span className="glyph"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9 12l2 2 4-4" /></svg></span>What to include</h4>
              <p>The more of these you share up front, the faster we can quote a price and timeline.</p>
              <ul>
                <li><span className="tick"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></span>Passport country &amp; expiry</li>
                <li><span className="tick"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></span>Destination &amp; intended travel dates</li>
                <li><span className="tick"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></span>Purpose (tourism, work, study, family)</li>
                <li><span className="tick"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></span>Past refusals, if any</li>
                <li><span className="tick"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></span>Application reference (VIZA-XXXX)</li>
              </ul>
            </div>

            <div className="aside-card">
              <h4><span className="glyph"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg></span>Your data, briefly</h4>
              <p>We{'’'}re SOC 2 Type II and ISO 27001 certified. Passport scans live in a separate vault, encrypted at rest and in transit, with audit logs on every read.</p>
              <div style={{ marginTop: "14px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <span className="pill-status"><span className="dot"></span>SOC 2 Type II</span>
                <span className="pill-status"><span className="dot"></span>ISO 27001</span>
                <span className="pill-status"><span className="dot"></span>GDPR</span>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {/* ============================== REGIONAL DESKS ============================== */}
      <section className="desks" id="desks">
        <div className="section">
          <div className="sec-head">
            <div className="sec-eyebrow">Regional desks</div>
            <h2>The local number<br />for the local consulate.</h2>
            <p>Visa rules are nationality- and consulate-specific, so our consultants are too. Each desk speaks the language of the embassies they file with every day.</p>
          </div>

          <div className="desks-grid">
            <div className="desk">
              <div className="desk-head">
                <span className="desk-flag"><CircleFlag countryCode="sg" height={32}/></span>
                <span className="desk-status"><span className="dot"></span>Online · 9 consultants</span>
              </div>
              <h4>Singapore — HQ<small>Asia-Pacific operations</small></h4>
              <div className="desk-info">
                <div className="row">
                  <span className="ic"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5a2 2 0 0 1 2-2h3l2 5-2 1a12 12 0 0 0 6 6l1-2 5 2v3a2 2 0 0 1-2 2A18 18 0 0 1 3 5z" /></svg></span>
                  <div><small>Direct line</small>+65 6011 8842</div>
                </div>
                <div className="row">
                  <span className="ic"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><polyline points="3 7 12 13 21 7" /></svg></span>
                  <div><small>Email</small>singapore@viza.travel</div>
                </div>
                <div className="row">
                  <span className="ic"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg></span>
                  <div><small>Address</small>1 Marina Boulevard, #20-01, SG 018989</div>
                </div>
              </div>
              <div className="desk-foot">
                <span className="tz">GMT+8 · 9am–8pm</span>
                <a href="#">Open in Maps →</a>
              </div>
            </div>

            <div className="desk">
              <div className="desk-head">
                <span className="desk-flag"><CircleFlag countryCode="us" height={32}/></span>
                <span className="desk-status"><span className="dot"></span>Online · 6 consultants</span>
              </div>
              <h4>San Francisco<small>Americas operations</small></h4>
              <div className="desk-info">
                <div className="row">
                  <span className="ic"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5a2 2 0 0 1 2-2h3l2 5-2 1a12 12 0 0 0 6 6l1-2 5 2v3a2 2 0 0 1-2 2A18 18 0 0 1 3 5z" /></svg></span>
                  <div><small>Direct line</small>+1 (415) 802 9911</div>
                </div>
                <div className="row">
                  <span className="ic"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><polyline points="3 7 12 13 21 7" /></svg></span>
                  <div><small>Email</small>sf@viza.travel</div>
                </div>
                <div className="row">
                  <span className="ic"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg></span>
                  <div><small>Address</small>301 Mission Street, San Francisco, CA 94105</div>
                </div>
              </div>
              <div className="desk-foot">
                <span className="tz">PST · 8am–6pm</span>
                <a href="#">Open in Maps →</a>
              </div>
            </div>

            <div className="desk">
              <div className="desk-head">
                <span className="desk-flag"><CircleFlag countryCode="ae" height={32}/></span>
                <span className="desk-status"><span className="dot"></span>Online · 5 consultants</span>
              </div>
              <h4>Dubai<small>Middle East &amp; Africa</small></h4>
              <div className="desk-info">
                <div className="row">
                  <span className="ic"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5a2 2 0 0 1 2-2h3l2 5-2 1a12 12 0 0 0 6 6l1-2 5 2v3a2 2 0 0 1-2 2A18 18 0 0 1 3 5z" /></svg></span>
                  <div><small>Direct line</small>+971 4 887 2210</div>
                </div>
                <div className="row">
                  <span className="ic"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><polyline points="3 7 12 13 21 7" /></svg></span>
                  <div><small>Email</small>dubai@viza.travel</div>
                </div>
                <div className="row">
                  <span className="ic"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg></span>
                  <div><small>Address</small>M16, Al Makateb Bldg, Al Quoz 3</div>
                </div>
              </div>
              <div className="desk-foot">
                <span className="tz">GMT+4 · 9am–8pm</span>
                <a href="#">Open in Maps →</a>
              </div>
            </div>

            <div className="desk">
              <div className="desk-head">
                <span className="desk-flag"><CircleFlag countryCode="gb" height={32}/></span>
                <span className="desk-status closed"><span className="dot"></span>Reopens 8am GMT</span>
              </div>
              <h4>London<small>UK &amp; Schengen filing</small></h4>
              <div className="desk-info">
                <div className="row">
                  <span className="ic"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5a2 2 0 0 1 2-2h3l2 5-2 1a12 12 0 0 0 6 6l1-2 5 2v3a2 2 0 0 1-2 2A18 18 0 0 1 3 5z" /></svg></span>
                  <div><small>Direct line</small>+44 20 4538 1192</div>
                </div>
                <div className="row">
                  <span className="ic"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><polyline points="3 7 12 13 21 7" /></svg></span>
                  <div><small>Email</small>london@viza.travel</div>
                </div>
                <div className="row">
                  <span className="ic"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg></span>
                  <div><small>Address</small>Suite 203, Davina House, 137-149 Goswell Rd</div>
                </div>
              </div>
              <div className="desk-foot">
                <span className="tz">GMT · 8am–6pm</span>
                <a href="#">Open in Maps →</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================== EMERGENCY ============================== */}
      <div className="emergency" data-screen-label="Emergency">
        <div>
          <span className="tag-line">▲ Emergency helpline · 24/7</span>
          <h2>Stuck at the airport? Visa expiring tomorrow?</h2>
          <p>If you{'’'}re traveling in the next 48 hours and something has gone wrong, skip the form. Call our emergency desk — it{'’'}s staffed around the clock, every day of the year, by senior consultants only.</p>
        </div>
        <div className="right">
          <span className="lab">Emergency hotline (Asia / global)</span>
          <span className="number">+65 6011 8800</span>
          <a className="em-btn" href="tel:+6560118800">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5a2 2 0 0 1 2-2h3l2 5-2 1a12 12 0 0 0 6 6l1-2 5 2v3a2 2 0 0 1-2 2A18 18 0 0 1 3 5z" /></svg>
            Call emergency desk
          </a>
        </div>
      </div>

      {/* ============================== FAQ ============================== */}
      <section className="section" id="faq" style={{ paddingTop: 0 }}>
        <div className="sec-head">
          <div className="sec-eyebrow">Before you write</div>
          <h2>A few questions we get every day.</h2>
          <p>If your question is in here, you{'’'}ll get an answer faster from reading than from waiting for a reply. If not — please do write.</p>
        </div>

        <div className="faq-grid">
          <details className="faq" open>
            <summary>How fast will I actually hear back?<span className="plus">+</span></summary>
            <p>Median: 2 minutes on WhatsApp, 5 minutes on WeChat, and under 4 hours on email. Phone is always live. If your trip is in the next 48 hours, call the emergency line — it skips the queue.</p>
          </details>
          <details className="faq">
            <summary>Do you charge for an initial consult?<span className="plus">+</span></summary>
            <p>No. Quotes and corridor-specific advice are free. You only pay once you decide to file an application through us, and we publish the full fee breakdown before you commit.</p>
          </details>
          <details className="faq">
            <summary>Will my passport be safe?<span className="plus">+</span></summary>
            <p>Passport scans live in a separate encrypted vault with audit logs on every read. We{'’'}re SOC 2 Type II and ISO 27001 certified. We do not share your data with third parties under any circumstances.</p>
          </details>
          <details className="faq">
            <summary>Can I add VIZA on WeChat from outside China?<span className="plus">+</span></summary>
            <p>Yes — scan the QR above from any WeChat app, anywhere. Our SEA and China desks both staff the WeChat channel, so you get a reply in your business hours, not ours.</p>
          </details>
          <details className="faq">
            <summary>I had a visa refusal. Can you still help?<span className="plus">+</span></summary>
            <p>Often, yes. Send us the refusal letter (or as much detail as you have) on the form above and we{'’'}ll come back with a corridor-specific refile plan and the realistic odds. Refusals are not the end of the road.</p>
          </details>
          <details className="faq">
            <summary>I{'’'}m a partner / agent / OTA. Different inbox?<span className="plus">+</span></summary>
            <p>Yes — please email <a href="#">partners@viza.travel</a> directly. Partnerships are handled by a dedicated BD team and routed separately from consumer queries.</p>
          </details>
        </div>
      </section>

      {/* ============================== FOOTER ============================== */}
      <footer className="site-foot" data-screen-label="Footer">
        <div className="foot-rule"></div>
        <div className="foot-main">
          <div className="foot-brand">
            <a className="foot-logo" href="/"><img src="/assets/viza-logo-black.svg" alt="VIZA" /></a>
            <p className="foot-tag">VIZA helps you plan, apply, and track visas seamlessly across the world.</p>
          </div>
          <div>
            <h4 className="col-head">Company</h4>
            <ul className="col-list">
              <li><a href="/careers">Careers</a></li>
              <li><a href="/contact">Contact</a></li>
              <li><a href="/security">Security</a></li>
              <li><a href="/refunds">Refunds Policy</a></li>
              <li><a href="/legal/privacy">Privacy</a></li>
              <li><a href="/legal/terms">Terms</a></li>
            </ul>
          </div>
          <div>
            <h4 className="col-head">Products</h4>
            <ul className="col-list">
              <li><a href="/">Visa Requirements</a></li>
              <li><a href="#">Schengen Appointment Checker</a></li>
              <li><a href="#">Visa Photo Creator</a></li>
              <li><a href="#">VIZA Emergency Helpline</a></li>
              <li><a href="#">Student Visa</a></li>
            </ul>
          </div>
          <div>
            <h4 className="col-head">Offices</h4>
            <ul className="col-list">
              <li><a href="#desks">Singapore — HQ</a></li>
              <li><a href="#desks">San Francisco</a></li>
              <li><a href="#desks">Dubai</a></li>
              <li><a href="#desks">London</a></li>
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
          <div className="foot-mark"><img src="/assets/viza-logo-black.svg" alt="VIZA" /></div>
        </div>
      </footer>
    </>
  );
}
