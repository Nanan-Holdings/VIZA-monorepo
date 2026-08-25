"use client";

import { useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CircleFlag } from "react-circle-flags";
import SiteNav from "@/components/SiteNav";
import "./contact.css";
import SiteFooter from "@/components/SiteFooter";
import { trackEvent } from "@/lib/analytics";
import { CONTACT, OFFICES, mapsHref } from "@/lib/contact";

/* ------------------------------ Small icons ------------------------------ */

const WhatsAppIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
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
const DIAL_CODES = ["🇸🇬 +65", "🇺🇸 +1", "🇬🇧 +44", "🇦🇪 +971", "🇨🇳 +86", "🇮🇳 +91", "🇵🇭 +63"] as const;

const FAQ_IDS = ["q1", "q2", "q3", "q4", "q5", "q6"] as const;

export default function ContactPage() {
  const t = useTranslations("contact");
  const locale = useLocale();
  const [formStatus, setFormStatus] = useState<
    "idle" | "sending" | "success" | "error"
  >("idle");

  async function submitBrief(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (formStatus === "sending") return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const reasonsChecked = data.getAll("reason").map(String);
    setFormStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: data.get("fullName"),
          email: data.get("email"),
          phone: [data.get("dialCode"), data.get("phone")]
            .filter(Boolean)
            .join(" ")
            .trim(),
          preferredChannel: data.get("preferredChannel"),
          passportNationality: data.get("passportNationality"),
          destination: data.get("destination"),
          reasons: reasonsChecked,
          message: data.get("message"),
          website: data.get("website"), // honeypot
          locale,
        }),
      });
      const json = (await res.json()) as { ok?: boolean };
      if (!res.ok || !json.ok) throw new Error("send failed");
      setFormStatus("success");
      trackEvent("lead_submit", {
        form_id: "VIZA-CON-FORM-26",
        preferred_channel: String(data.get("preferredChannel") ?? ""),
        reason_count: reasonsChecked.length,
        locale,
      });
      form.reset();
    } catch {
      setFormStatus("error");
    }
  }

  const channelOptions = t.raw("form.channelOptions") as string[];
  const passportOptions = t.raw("form.passportOptions") as string[];
  const destinationOptions = t.raw("form.destinationOptions") as string[];
  const reasons = t.raw("form.reasons") as string[];
  const slaRows = t.raw("aside.sla") as { k: string; v: string }[];
  const includeItems = t.raw("aside.includeItems") as string[];

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
          {/* Real, clickable channels only. The previous cards rendered decorative
              QR blocks (`FakeQr`) that scanned to nothing, and advertised a 24/7
              hotline and minute-level reply times we do not staff. */}
          <div className="channel-grid">

            {/* WhatsApp */}
            <a className="ch-card tone-whatsapp" href={`https://wa.me/${CONTACT.whatsappNumber}`} target="_blank" rel="noreferrer">
              <div className="ch-head">
                <div className="ch-glyph"><WhatsAppIcon size={22} /></div>
                <span className="ch-tag">{t("channels.whatsapp.tag")}</span>
              </div>
              <h3>{t("channels.whatsapp.title")}<small>{t("channels.whatsapp.sub")}</small></h3>
              <div className="ch-body">
                <div className="big-read">
                  <div className="label">{t("channels.whatsapp.numberLabel")}</div>
                  <div className="value mono">{CONTACT.phoneSg}</div>
                </div>
              </div>
              <div className="ch-foot">
                <span className="hours">{t("channels.whatsapp.hours")}</span>
                <span className="ch-action">{t("channels.whatsapp.action")}</span>
              </div>
            </a>

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
                <div className="big-read">
                  <div className="label">{t("channels.wechat.idLabel")}</div>
                  <div className="value mono">{CONTACT.wechatId}</div>
                  <div className="sub">{t("channels.wechat.idHint")}</div>
                </div>
              </div>
              <div className="ch-foot">
                <span className="hours">{t("channels.wechat.hours")}</span>
              </div>
            </div>

            {/* Phone */}
            <a className="ch-card tone-phone" href={`tel:${CONTACT.phoneSgE164}`}>
              <div className="ch-head">
                <div className="ch-glyph"><PhoneIcon size={22} /></div>
                <span className="ch-tag">{t("channels.phone.tag")}</span>
              </div>
              <h3>{t("channels.phone.title")}<small>{t("channels.phone.sub")}</small></h3>
              <div className="ch-body">
                <div className="big-read">
                  <div className="label">{t("channels.phone.asiaLabel")}</div>
                  <div className="value mono">{CONTACT.phoneSg}</div>
                  <div className="sub">{t("channels.phone.asiaLangs")}</div>
                </div>
              </div>
              <div className="ch-foot">
                <span className="hours">{t("channels.phone.hours")}</span>
                <span className="ch-action">{t("channels.phone.action")}</span>
              </div>
            </a>

            {/* Email */}
            <a className="ch-card tone-email" href={`mailto:${CONTACT.emailSupport}`}>
              <div className="ch-head">
                <div className="ch-glyph"><MailIcon size={22} /></div>
                <span className="ch-tag">{t("channels.email.tag")}</span>
              </div>
              <h3>{t("channels.email.title")}<small>{t("channels.email.sub")}</small></h3>
              <div className="ch-body">
                <div className="big-read">
                  <div className="label">{t("channels.email.generalLabel")}</div>
                  <div className="value">{CONTACT.emailSupport}</div>
                  <div className="sub">{t("channels.email.generalSub")}</div>
                </div>
              </div>
              <div className="ch-foot">
                <span className="hours">{t("channels.email.hours")}</span>
                <span className="ch-action">{t("channels.email.action")}</span>
              </div>
            </a>

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
          <form className="form-shell" onSubmit={submitBrief}>
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
                <input type="text" name="fullName" required placeholder={t("form.fullNamePh")} />
              </div>
              <div className="field">
                <label>{t("form.email")} <span className="req">▲</span></label>
                <input type="email" name="email" required placeholder={t("form.emailPh")} />
              </div>
            </div>

            <div className="form-row">
              <div className="field">
                <label>{t("form.phone")}</label>
                <div className="phone-combo">
                  <select name="dialCode">
                    {DIAL_CODES.map((code) => (
                      <option key={code}>{code}</option>
                    ))}
                  </select>
                  <input type="tel" name="phone" placeholder={t("form.phonePh")} />
                </div>
              </div>
              <div className="field">
                <label>{t("form.preferredChannel")}</label>
                <select name="preferredChannel">
                  {channelOptions.map((opt) => (
                    <option key={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="field">
                <label>{t("form.passport")} <span className="req">▲</span></label>
                <select name="passportNationality">
                  {passportOptions.map((opt) => (
                    <option key={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>{t("form.destination")}</label>
                <select name="destination">
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
                      <input type="checkbox" name="reason" value={reason} defaultChecked={i === 1} />
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
                <textarea name="message" required placeholder={t("form.messagePh")}></textarea>
              </div>
            </div>

            {/* Honeypot — hidden from humans, filled by naive bots. */}
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              style={{ position: "absolute", left: "-9999px", height: 0, width: 0, opacity: 0 }}
            />

            {formStatus === "success" && (
              <p role="status" style={{ margin: "10px 0 0", fontSize: "13px", color: "var(--brand-500)" }}>
                {t("form.success")}
              </p>
            )}
            {formStatus === "error" && (
              <p role="alert" style={{ margin: "10px 0 0", fontSize: "13px", color: "#b3261e" }}>
                {t("form.error")}
              </p>
            )}

            <div className="form-foot">
              <label className="consent">
                <input type="checkbox" required defaultChecked />
                <span>{t.rich("form.consent", { a: (chunks: ReactNode) => <a href="/legal/privacy">{chunks}</a> })}</span>
              </label>
              <button className="btn-submit" type="submit" disabled={formStatus === "sending"}>
                {formStatus === "sending" ? t("form.sending") : t("form.submit")}
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

          {/* Office cards, not a staffed-desk dashboard: the old markup claimed a live
              advisor headcount per city and linked "open in maps" to "#". */}
          <div className="desks-grid">
            {OFFICES.map((office) => (
              <div className="desk" key={office.id}>
                <div className="desk-head">
                  <span className="desk-flag"><CircleFlag countryCode={office.id} height={32} /></span>
                </div>
                <h4>{t(`desks.${office.id}.title`)}<small>{t(`desks.${office.id}.sub`)}</small></h4>
                <div className="desk-info">
                  <div className="row">
                    <span className="ic"><PhoneIcon size={12} strokeWidth="2.2" /></span>
                    <div><small>{t("desks.directLine")}</small>{CONTACT.phoneSg}</div>
                  </div>
                  <div className="row">
                    <span className="ic"><MailIcon size={12} strokeWidth="2.2" /></span>
                    <div><small>{t("desks.email")}</small>{CONTACT.emailSupport}</div>
                  </div>
                  <div className="row">
                    <span className="ic"><PinIcon size={12} /></span>
                    <div><small>{t("desks.address")}</small>{office.address}</div>
                  </div>
                </div>
                <div className="desk-foot">
                  <span className="tz">{t(`desks.${office.id}.tz`)}</span>
                  <a href={mapsHref(office.mapsQuery)} target="_blank" rel="noreferrer">{t("desks.maps")}</a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The 24/7 emergency hotline band was removed: there is no round-the-clock
          rota behind it. Time-critical cases are called out in the form copy instead. */}

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
              <p>{t.rich(`faq.${id}.a`, { a: (chunks: ReactNode) => <a href={`mailto:${CONTACT.emailSupport}`}>{chunks}</a> })}</p>
            </details>
          ))}
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
