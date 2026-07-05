"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { CircleFlag } from "react-circle-flags";
import SiteNav from "@/components/SiteNav";
import "./contact.css";

/* ----------------------------- Fake QR code ------------------------------ */
/**
 * Decorative QR-lookalike. Pseudo-random but deterministic per seed, with
 * finder/alignment/timing patterns so it LOOKS like a real 33x33 QR code.
 * Pure function — same seed always yields the exact same module grid.
 */
const QR_SIZE = 33;

function makeQrGrid(seed: string): number[][] {
  // deterministic PRNG
  let s = 0;
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
  function rand() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  }

  // grid: 0 = white, 1 = black
  const grid: number[][] = Array.from({ length: QR_SIZE }, () => Array(QR_SIZE).fill(0));

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
  placeFinder(0, QR_SIZE - 7);
  placeFinder(QR_SIZE - 7, 0);

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
  placeAlign(QR_SIZE - 9, QR_SIZE - 9);

  // timing patterns
  for (let i = 8; i < QR_SIZE - 8; i++) {
    grid[6][i] = i % 2 === 0 ? 1 : 0;
    grid[i][6] = i % 2 === 0 ? 1 : 0;
  }

  // "reserved" zones we won't overwrite
  function isReserved(r: number, c: number) {
    if (r < 9 && c < 9) return true;
    if (r < 9 && c > QR_SIZE - 9) return true;
    if (r > QR_SIZE - 9 && c < 9) return true;
    if (r >= QR_SIZE - 9 && c >= QR_SIZE - 9) return true;
    if (r === 6 || c === 6) return true;
    return false;
  }

  // fill data modules with deterministic noise
  for (let r = 0; r < QR_SIZE; r++) {
    for (let c = 0; c < QR_SIZE; c++) {
      if (isReserved(r, c)) continue;
      grid[r][c] = rand() < 0.48 ? 1 : 0;
    }
  }

  // clear a 5x5 in the very center (for the logo)
  const cx = Math.floor(QR_SIZE / 2);
  for (let i = cx - 2; i <= cx + 2; i++) {
    for (let j = cx - 2; j <= cx + 2; j++) {
      grid[i][j] = 0;
    }
  }

  return grid;
}

const QR_WHATSAPP = makeQrGrid("viza-whatsapp-help-desk");
const QR_WECHAT = makeQrGrid("viza-wechat-help-desk");

function FakeQr({ grid }: { grid: number[][] }) {
  return (
    <svg viewBox={`0 0 ${QR_SIZE} ${QR_SIZE}`} preserveAspectRatio="xMidYMid meet">
      <rect width={QR_SIZE} height={QR_SIZE} fill="#fff" />
      <g fill="#0a0a0a" shapeRendering="crispEdges">
        {grid.flatMap((row, r) =>
          row.map((on, c) => (on ? <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} /> : null)),
        )}
      </g>
    </svg>
  );
}

/* ------------------------------ Small icons ------------------------------ */

const WhatsAppIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
);

const WeChatLogoIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 4C5.4 4 2 6.7 2 10c0 1.7.9 3.3 2.4 4.4L3.5 17l3-1.5c.6.1 1.3.2 2 .2" /><path d="M22 14.5c0-2.8-2.7-5.1-6-5.1s-6 2.3-6 5.1 2.7 5.1 6 5.1c.5 0 1 0 1.5-.1L20 21l-.4-1.9c1.5-1 2.4-2.4 2.4-3.9z" /></svg>
);

const PhoneIcon = ({ size, strokeWidth = "1.8" }: { size: number; strokeWidth?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"><path d="M3 5a2 2 0 0 1 2-2h3l2 5-2 1a12 12 0 0 0 6 6l1-2 5 2v3a2 2 0 0 1-2 2A18 18 0 0 1 3 5z" /></svg>
);

const MailIcon = ({ size, strokeWidth = "1.8" }: { size: number; strokeWidth?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><polyline points="3 7 12 13 21 7" /></svg>
);

const PinIcon = ({ size, strokeWidth = "2.2" }: { size: number; strokeWidth?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
);

const TickIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
);

/* ------------------------------- Page data ------------------------------- */
/** Locale-invariant contact details (numbers, handles, addresses). */
const CONTACTS = {
  whatsapp: "+65 84106368",
  wechat: "@viza_help",
  phoneAsia: "+65 84106368",
  phoneAmericas: "+66 18930437448",
  emailGeneral: "sales@kelin.studio",
  emailPress: "sales@kelin.studio",
  emailPartners: "sales@kelin.studio",
  emergency: "+65 84106368",
} as const;

const DIAL_CODES = ["🇸🇬 +65", "🇺🇸 +1", "🇬🇧 +44", "🇦🇪 +971", "🇨🇳 +86", "🇮🇳 +91", "🇵🇭 +63"] as const;

const DESKS = [
  { id: "cn", phone: "+66 18930437448", email: "sales@kelin.studio", address: "No. 67, Kangcheng Road, Lane 958, Xinsong Road, Minhang District, Shanghai", closed: false },
  { id: "sg", phone: "+65 84106368", email: "sales@kelin.studio", address: "225 Pasir Panjang Rd, Singapore", closed: false },
] as const;

const FAQ_IDS = ["q1", "q2", "q3", "q4", "q5", "q6"] as const;

export default function ContactPage() {
  const t = useTranslations("contact");
  const tf = useTranslations("footer");

  const channelOptions = t.raw("form.channelOptions") as string[];
  const passportOptions = t.raw("form.passportOptions") as string[];
  const destinationOptions = t.raw("form.destinationOptions") as string[];
  const reasons = t.raw("form.reasons") as string[];
  const slaRows = t.raw("aside.sla") as { k: string; v: string }[];
  const includeItems = t.raw("aside.includeItems") as string[];
  const dataPills = t.raw("aside.dataPills") as string[];

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
              <span>{t("hero.crumb")}</span>
            </div>
            <div className="hero-status">
              <span className="dot"></span>
              {t("hero.status")}
              <span className="meta">{t("hero.statusMeta")}</span>
            </div>
          </div>

          <h1 className="hero-headline">
            {t.rich("hero.headline", {
              br: () => <br />,
              em: (chunks: ReactNode) => <em>{chunks}</em>,
              u: (chunks: ReactNode) => <span className="underline">{chunks}</span>,
            })}
          </h1>

          <div className="hero-band">
            <p className="hero-lead">
              {t.rich("hero.lead", { strong: (chunks: ReactNode) => <strong>{chunks}</strong> })}
            </p>
            <div className="hero-actions">
              <a className="btn-hero-primary" href="#form">
                {t("hero.sendBrief")}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
              </a>
              <a className="btn-hero-ghost" href="#channels">{t("hero.seeChannels")}</a>
            </div>
          </div>

          <div className="hero-channels-head" id="channels">
            <span className="lbl">{t("hero.channelsLabel")}</span>
            <span className="hint">{t("hero.channelsHint")}</span>
          </div>
          <div className="channel-grid">

            {/* WhatsApp */}
            <div className="ch-card tone-whatsapp">
              <div className="ch-head">
                <div className="ch-glyph"><WhatsAppIcon size={22} /></div>
                <span className="ch-tag">{t("channels.whatsapp.tag")}</span>
              </div>
              <h3>{t("channels.whatsapp.title")}<small>{t("channels.whatsapp.sub")}</small></h3>
              <div className="ch-body">
                <div className="qr-block">
                  <div className="qr-frame">
                    <FakeQr grid={QR_WHATSAPP} />
                    <div className="qr-logo"><WhatsAppIcon size={18} /></div>
                  </div>
                  <div className="qr-meta">
                    <strong>{t("channels.whatsapp.scan")}</strong>
                    <span className="qr-handle">{CONTACTS.whatsapp}</span>
                  </div>
                </div>
              </div>
              <div className="ch-foot">
                <span className="hours"><span className="dot"></span>{t("channels.whatsapp.hours")}</span>
                <span className="ch-action">{t("channels.whatsapp.action")}</span>
              </div>
            </div>

            {/* WeChat */}
            <div className="ch-card tone-wechat">
              <div className="ch-head">
                <div className="ch-glyph">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 4C5.4 4 2 6.7 2 10c0 1.7.9 3.3 2.4 4.4L3.5 17l3-1.5c.6.1 1.3.2 2 .2" /><path d="M22 14.5c0-2.8-2.7-5.1-6-5.1s-6 2.3-6 5.1 2.7 5.1 6 5.1c.5 0 1 0 1.5-.1L20 21l-.4-1.9c1.5-1 2.4-2.4 2.4-3.9z" /><circle cx="7" cy="9" r="0.5" fill="currentColor" /><circle cx="12" cy="9" r="0.5" fill="currentColor" /><circle cx="14" cy="14" r="0.5" fill="currentColor" /><circle cx="18" cy="14" r="0.5" fill="currentColor" /></svg>
                </div>
                <span className="ch-tag">{t("channels.wechat.tag")}</span>
              </div>
              <h3>{t("channels.wechat.title")}<small>{t("channels.wechat.sub")}</small></h3>
              <div className="ch-body">
                <div className="qr-block">
                  <div className="qr-frame">
                    <FakeQr grid={QR_WECHAT} />
                    <div className="qr-logo"><WeChatLogoIcon size={18} /></div>
                  </div>
                  <div className="qr-meta">
                    <strong>{t("channels.wechat.scan")}</strong>
                    <span className="qr-handle">{CONTACTS.wechat}</span>
                  </div>
                </div>
              </div>
              <div className="ch-foot">
                <span className="hours"><span className="dot"></span>{t("channels.wechat.hours")}</span>
                <span className="ch-action">{t("channels.wechat.action")}</span>
              </div>
            </div>

            {/* Phone */}
            <div className="ch-card tone-phone">
              <div className="ch-head">
                <div className="ch-glyph"><PhoneIcon size={22} /></div>
                <span className="ch-tag">{t("channels.phone.tag")}</span>
              </div>
              <h3>{t("channels.phone.title")}<small>{t("channels.phone.sub")}</small></h3>
              <div className="ch-body">
                <div className="big-read">
                  <div className="label">{t("channels.phone.asiaLabel")}</div>
                  <div className="value mono">{CONTACTS.phoneAsia}</div>
                  <div className="sub">{t("channels.phone.asiaLangs")}</div>
                </div>
                <div className="big-read">
                  <div className="label">{t("channels.phone.americasLabel")}</div>
                  <div className="value mono">{CONTACTS.phoneAmericas}</div>
                  <div className="sub">{t("channels.phone.americasLangs")}</div>
                </div>
              </div>
              <div className="ch-foot">
                <span className="hours"><span className="dot"></span>{t("channels.phone.hours")}</span>
                <span className="ch-action">{t("channels.phone.action")}</span>
              </div>
            </div>

            {/* Email */}
            <div className="ch-card tone-email">
              <div className="ch-head">
                <div className="ch-glyph"><MailIcon size={22} /></div>
                <span className="ch-tag">{t("channels.email.tag")}</span>
              </div>
              <h3>{t("channels.email.title")}<small>{t("channels.email.sub")}</small></h3>
              <div className="ch-body">
                <div className="big-read">
                  <div className="label">{t("channels.email.generalLabel")}</div>
                  <div className="value">{CONTACTS.emailGeneral}</div>
                  <div className="sub">{t("channels.email.generalSub")}</div>
                </div>
                <div className="big-read">
                  <div className="label">{t("channels.email.pressLabel")}</div>
                  <div className="value">{CONTACTS.emailPress}<br /><span style={{ fontSize: "18px" }}>{CONTACTS.emailPartners}</span></div>
                </div>
              </div>
              <div className="ch-foot">
                <span className="hours"><span className="dot"></span>{t("channels.email.hours")}</span>
                <span className="ch-action">{t("channels.email.action")}</span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ============================== FORM + ASIDE ============================== */}
      <section className="section" id="form">
        <div className="sec-head">
          <div className="sec-eyebrow">{t("form.eyebrow")}</div>
          <h2>{t("form.title")}</h2>
          <p>{t("form.lede")}</p>
        </div>

        <div className="contact-form-wrap">
          <form
            className="form-shell"
            onSubmit={(event) => {
              event.preventDefault();
              alert(t("form.demoAlert"));
            }}
          >
            <div className="form-head">
              <div>
                <h3>{t("form.cardTitle")}</h3>
                <p>{t.rich("form.cardNote", { req: (chunks: ReactNode) => <span style={{ color: "var(--brand-500)" }}>{chunks}</span> })}</p>
              </div>
              <div className="form-ref">
                <div className="lab">{t("form.formIdLabel")}</div>
                <div className="ref">VIZA-CON-FORM-26</div>
              </div>
            </div>

            <div className="form-row">
              <div className="field">
                <label>{t("form.fullName")} <span className="req">▲</span></label>
                <input type="text" placeholder={t("form.fullNamePh")} />
              </div>
              <div className="field">
                <label>{t("form.email")} <span className="req">▲</span></label>
                <input type="email" placeholder={t("form.emailPh")} />
              </div>
            </div>

            <div className="form-row">
              <div className="field">
                <label>{t("form.phone")}</label>
                <div className="phone-combo">
                  <select>
                    {DIAL_CODES.map((code) => (
                      <option key={code}>{code}</option>
                    ))}
                  </select>
                  <input type="tel" placeholder={t("form.phonePh")} />
                </div>
              </div>
              <div className="field">
                <label>{t("form.preferredChannel")}</label>
                <select>
                  {channelOptions.map((opt) => (
                    <option key={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="field">
                <label>{t("form.passport")} <span className="req">▲</span></label>
                <select>
                  {passportOptions.map((opt) => (
                    <option key={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>{t("form.destination")}</label>
                <select>
                  {destinationOptions.map((opt) => (
                    <option key={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row solo">
              <div className="field">
                <label>{t("form.reasonLabel")} <span className="req">▲</span></label>
                <div className="reasons">
                  {reasons.map((reason, i) => (
                    <label className="reason" key={reason}>
                      <input type="checkbox" defaultChecked={i === 1} />
                      <span className="ck"></span>
                      {reason}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="form-row solo">
              <div className="field">
                <label>{t("form.message")} <span className="req">▲</span></label>
                <textarea placeholder={t("form.messagePh")}></textarea>
              </div>
            </div>

            <div className="form-foot">
              <label className="consent">
                <input type="checkbox" defaultChecked />
                <span>{t.rich("form.consent", { a: (chunks: ReactNode) => <a href="#">{chunks}</a> })}</span>
              </label>
              <button className="btn-submit" type="submit">
                {t("form.submit")}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></svg>
              </button>
            </div>
          </form>

          <aside className="form-aside">
            <div className="aside-card tone-brand">
              <h4><span className="glyph"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg></span>{t("aside.promiseTitle")}</h4>
              <p>{t("aside.promiseBody")}</p>
              <div style={{ marginTop: "14px" }}>
                {slaRows.map((row, i) => (
                  <div className="sla-row" key={row.k} style={i === 0 ? undefined : { borderColor: "rgba(255,255,255,0.18)" }}>
                    <span className="k" style={{ color: "rgba(255,255,255,0.7)" }}>{row.k}</span>
                    <span className="v" style={{ color: "#fff" }}>{row.v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="aside-card">
              <h4><span className="glyph"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9 12l2 2 4-4" /></svg></span>{t("aside.includeTitle")}</h4>
              <p>{t("aside.includeBody")}</p>
              <ul>
                {includeItems.map((item) => (
                  <li key={item}><span className="tick"><TickIcon /></span>{item}</li>
                ))}
              </ul>
            </div>

            <div className="aside-card">
              <h4><span className="glyph"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg></span>{t("aside.dataTitle")}</h4>
              <p>{t("aside.dataBody")}</p>
              <div style={{ marginTop: "14px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {dataPills.map((pill) => (
                  <span className="pill-status" key={pill}><span className="dot"></span>{pill}</span>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>

      {/* ============================== REGIONAL DESKS ============================== */}
      <section className="desks" id="desks">
        <div className="section">
          <div className="sec-head">
            <div className="sec-eyebrow">{t("desks.eyebrow")}</div>
            <h2>{t.rich("desks.title", { br: () => <br /> })}</h2>
            <p>{t("desks.lede")}</p>
          </div>

          <div className="desks-grid">
            {DESKS.map((desk) => (
              <div className="desk" key={desk.id}>
                <div className="desk-head">
                  <span className="desk-flag"><CircleFlag countryCode={desk.id} height={32} /></span>
                  <span className={`desk-status${desk.closed ? " closed" : ""}`}><span className="dot"></span>{t(`desks.${desk.id}.status`)}</span>
                </div>
                <h4>{t(`desks.${desk.id}.title`)}<small>{t(`desks.${desk.id}.sub`)}</small></h4>
                <div className="desk-info">
                  <div className="row">
                    <span className="ic"><PhoneIcon size={12} strokeWidth="2.2" /></span>
                    <div><small>{t("desks.directLine")}</small>{desk.phone}</div>
                  </div>
                  <div className="row">
                    <span className="ic"><MailIcon size={12} strokeWidth="2.2" /></span>
                    <div><small>{t("desks.email")}</small>{desk.email}</div>
                  </div>
                  <div className="row">
                    <span className="ic"><PinIcon size={12} /></span>
                    <div><small>{t("desks.address")}</small>{desk.address}</div>
                  </div>
                </div>
                <div className="desk-foot">
                  <span className="tz">{t(`desks.${desk.id}.tz`)}</span>
                  <a href="#">{t("desks.maps")}</a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================== EMERGENCY ============================== */}
      <div className="emergency" data-screen-label="Emergency">
        <div>
          <span className="tag-line">{t("emergency.tag")}</span>
          <h2>{t("emergency.title")}</h2>
          <p>{t("emergency.body")}</p>
        </div>
        <div className="right">
          <span className="lab">{t("emergency.hotlineLabel")}</span>
          <span className="number">{CONTACTS.emergency}</span>
          <a className="em-btn" href="tel:+6584106368">
            <PhoneIcon size={14} strokeWidth="2.2" />
            {t("emergency.call")}
          </a>
        </div>
      </div>

      {/* ============================== FAQ ============================== */}
      <section className="section" id="faq" style={{ paddingTop: 0 }}>
        <div className="sec-head">
          <div className="sec-eyebrow">{t("faq.eyebrow")}</div>
          <h2>{t("faq.title")}</h2>
          <p>{t("faq.lede")}</p>
        </div>

        <div className="faq-grid">
          {FAQ_IDS.map((id, i) => (
            <details className="faq" key={id} open={i === 0}>
              <summary>{t(`faq.${id}.q`)}<span className="plus">+</span></summary>
              <p>{t.rich(`faq.${id}.a`, { a: (chunks: ReactNode) => <a href="#">{chunks}</a> })}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ============================== FOOTER ============================== */}
      {/* Bespoke contact-page footer — intentionally simpler than <SiteFooter/> (no AI chips / app badges); labels reuse the shared `footer` namespace. */}
      <footer className="site-foot" data-screen-label="Footer">
        <div className="foot-rule"></div>
        <div className="foot-main">
          <div className="foot-brand">
            <a className="foot-logo" href="/"><img src="/assets/viza-logo-black.svg" alt="VIZA" /></a>
            <p className="foot-tag">{tf("tagline")}</p>
          </div>
          <div>
            <h4 className="col-head">{tf("company")}</h4>
            <ul className="col-list">
              <li><a href="/careers">{tf("careers")}</a></li>
              <li><a href="/contact">{tf("contact")}</a></li>
              <li><a href="/security">{tf("security")}</a></li>
              <li><a href="/refunds">{tf("refundsPolicy")}</a></li>
              <li><a href="/legal/privacy">{tf("privacy")}</a></li>
              <li><a href="/legal/terms">{tf("terms")}</a></li>
            </ul>
          </div>
          <div>
            <h4 className="col-head">{tf("product")}</h4>
            <ul className="col-list">
              <li><a href="/">{tf("prodVisaReq")}</a></li>
              <li><a href="#">{tf("prodSchengen")}</a></li>
              <li><a href="#">{tf("prodPhoto")}</a></li>
              <li><a href="#">{tf("prodHelpline")}</a></li>
              <li><a href="#">{tf("prodStudent")}</a></li>
            </ul>
          </div>
          <div>
            <h4 className="col-head">{tf("offices")}</h4>
            <ul className="col-list">
              {DESKS.map((desk) => (
                <li key={desk.id}><a href="#desks">{t(`desks.${desk.id}.title`)}</a></li>
              ))}
            </ul>
          </div>
        </div>
        <div className="foot-rule"></div>
        <div className="foot-bottom">
          <div className="legal">
            <span>{tf("copyright")}</span>
            <span className="sep"></span>
            <a href="#">{tf("privacy")}</a>
            <span className="sep"></span>
            <a href="#">{tf("terms")}</a>
          </div>
          <div className="foot-mark"><img src="/assets/viza-logo-black.svg" alt="VIZA" /></div>
        </div>
      </footer>
    </>
  );
}
