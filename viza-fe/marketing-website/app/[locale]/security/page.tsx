import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import SiteNav from "@/components/SiteNav";
import "./security.css";
import SiteFooter from "@/components/SiteFooter";

const NBSP = "\u00A0"; // matches the original &nbsp; entities

const MONO_STYLE = {
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
} as const;

/** Shared rich-text renderers for `t.rich` (plain <br/>, <em>, <strong>, <code>). */
const richTags = {
  br: () => <br />,
  em: (chunks: ReactNode) => <em>{chunks}</em>,
  strong: (chunks: ReactNode) => <strong>{chunks}</strong>,
  code: (chunks: ReactNode) => <code>{chunks}</code>,
};

const ArrowIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
);

const CheckMark = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
);

const CrossMark = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
);

const CLEARANCE_GRID_KEYS = ["encryption", "region", "audit", "retention"] as const;

const STAT_KEYS = ["docs", "retention", "pentests", "ack"] as const;

const DOC_CARDS = [
  {
    key: "payment",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /><path d="M6 15h4" /></svg>,
  },
  {
    key: "photos",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></svg>,
  },
  {
    key: "bank",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><path d="M8 13h8" /><path d="M8 17h5" /></svg>,
  },
  {
    key: "pastVisas",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>,
  },
  {
    key: "passport",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" /><circle cx="12" cy="10" r="3" /><path d="M7 17c1.5-2 8-2 10 0" /></svg>,
  },
] as const;

const FEATURE_KEYS = ["minimise", "payments", "atRest", "inTransit", "audits", "access", "education"] as const;

const VDP_META_KEYS = ["ack", "triage", "lang", "pgp"] as const;

const INCLUDE_KEYS = ["type", "url", "steps", "impact", "poc"] as const;
const DONT_SEND_KEYS = ["secrets", "malware", "scanners", "customerData", "socialEng"] as const;

const SCOPE_IN_KEYS = ["web", "infra", "mobile", "marketing"] as const;
const SCOPE_OUT_KEYS = ["devices", "phishing", "thirdParty", "scanners", "headers"] as const;

const PLEDGE_ITEM_NUMS = ["1", "2", "3", "4"] as const;

const LEGAL_CARDS = [
  {
    key: "safeHarbour",
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 3 7v6c0 5 4 8 9 9 5-1 9-4 9-9V7l-9-5z" /></svg>,
  },
  {
    key: "rewards",
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6" /><path d="m8.5 14-1 7 4.5-3 4.5 3-1-7" /></svg>,
  },
  {
    key: "updates",
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><path d="M9 13h6M9 17h4" /></svg>,
  },
] as const;

export default async function SecurityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("security");

  return (
    <>
      {/* Top nav */}
      <SiteNav />

      {/* ============================= HERO ============================= */}
      <section className="hero" data-screen-label="Hero">
        <div className="hero-inner">
          <div>
            <div className="hero-eyebrow">
              <span className="dot">▲</span>
              {t("hero.eyebrow")}
            </div>
            <h1>{t.rich("hero.title", richTags)}</h1>
            <p className="lead">{t("hero.lead")}</p>
            <div className="hero-ctas">
              <a className="btn-hero-primary" href="#features">
                {t("hero.ctaPrimary")}
                <ArrowIcon />
              </a>
              <a className="btn-hero-ghost" href="#vdp">{t("hero.ctaVdp")}</a>
            </div>
          </div>

          <div className="clearance-wrap">
            <div className="clearance">
              <div className="corner tl"></div><div className="corner tr"></div>
              <div className="corner bl"></div><div className="corner br"></div>
              <div className="clearance-row">
                <div>
                  <div className="ck">{t("clearance.republicKey")}</div>
                  <div className="cv">{t("clearance.republicVal")}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="ck">{t("clearance.officeKey")}</div>
                  <div className="cv">{t("clearance.officeVal")}</div>
                </div>
              </div>
              <h3>{t.rich("clearance.title", richTags)}</h3>
              <div className="clearance-grid">
                {CLEARANCE_GRID_KEYS.map((key) => (
                  <div key={key}>
                    <div className="ck">{t(`clearance.grid.${key}.k`)}</div>
                    <div className="cv">{t(`clearance.grid.${key}.v`)}</div>
                  </div>
                ))}
              </div>
              <div className="clearance-foot">
                <div>
                  <div className="ck">{t("clearance.referenceKey")}</div>
                  <div className="cv" style={{ ...MONO_STYLE, fontSize: "13px" }}>{t("clearance.referenceVal")}</div>
                </div>
                <div className="clearance-glyph">{t.rich("clearance.glyph", richTags)}</div>
              </div>
            </div>

            <div className="float-chip float-1">
              <div className="ic">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              </div>
              <div>
                <div className="lab">{t("chips.transitLabel")}</div>
                <div>{t("chips.transitVal")}</div>
              </div>
            </div>
            <div className="float-chip float-2">
              <div className="ic">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
              </div>
              <div>
                <div className="lab">{t("chips.restLabel")}</div>
                <div>{t("chips.restVal")}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="hero-stats">
          {STAT_KEYS.map((key) => (
            <div className="hstat" key={key}>
              <div className="v">{t(`stats.${key}.value`)}<small>{t(`stats.${key}.unit`)}</small></div>
              <div className="k">{t(`stats.${key}.label`)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ============================= DOCUMENTS ============================= */}
      <section className="docs" id="documents">
        <div className="section">
          <div className="doc-grid">
            <div className="left">
              <div className="sec-eyebrow">{t("docs.eyebrow")}</div>
              <h2 style={{ font: "500 40px/1.05 var(--font-heading)", letterSpacing: "-1.2px", marginBottom: "18px" }}>
                {t.rich("docs.title", {
                  ...richTags,
                  em: (chunks) => <em style={{ fontStyle: "italic", fontWeight: 400, color: "var(--brand-400)" }}>{chunks}</em>,
                })}
              </h2>
              <p className="copy">{t("docs.copy1")}</p>
              <p className="copy">{t("docs.copy2")}</p>
            </div>

            <div className="doc-cards">
              {DOC_CARDS.map(({ key, icon }) => (
                <div className="doc-card" key={key}>
                  <div className="ic">{icon}</div>
                  <div className="name">{t(`docs.cards.${key}.name`)}<small>{t(`docs.cards.${key}.meta`)}</small></div>
                  <div className="seal">{t("docs.seal")}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================= FEATURES ============================= */}
      <section className="section" id="features">
        <div className="sec-head">
          <div className="sec-eyebrow">{t("features.eyebrow")}</div>
          <h2>{t.rich("features.title", richTags)}</h2>
          <p>{t("features.intro")}</p>
        </div>

        <div className="feat-grid">
          {FEATURE_KEYS.map((key) => (
            <div className="feat-cell" key={key} style={key === "education" ? { gridColumn: "1 / -1" } : undefined}>
              <span className="tag">{t(`features.cells.${key}.tag`)}</span>
              <h3>{t(`features.cells.${key}.title`)}</h3>
              <p>{t(`features.cells.${key}.body`)}</p>
              <div className="why">
                <span className="check"><CheckMark /></span>
                <span>{t.rich(`features.cells.${key}.why`, richTags)}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ============================= VDP ============================= */}
      <section className="section" id="vdp" style={{ paddingTop: 0 }}>
        <div className="vdp">
          <div className="vdp-left">
            <div className="vdp-tag">{t("vdp.tag")}</div>
            <h2>{t.rich("vdp.title", richTags)}</h2>
            <p>{t("vdp.p1")}</p>
            <p>{t.rich("vdp.p2", { ...richTags, strong: (chunks) => <strong style={{ color: "#fff" }}>{chunks}</strong> })}</p>

            <div className="vdp-meta">
              {VDP_META_KEYS.map((key) => (
                <div className="m" key={key}>
                  <span className="k">{t(`vdp.meta.${key}.k`)}</span>
                  <span className="v">{t(`vdp.meta.${key}.v`)}</span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <a className="btn-hero-primary" href="mailto:security@viza.it.com">
                {t("vdp.ctaEmail")}
                <ArrowIcon />
              </a>
              <a className="btn-hero-ghost" href="#scope">{t("vdp.ctaScope")}</a>
            </div>
          </div>

          <div className="vdp-right">
            <div className="vdp-terminal">
              <div className="bar">
                <div className="lights"><span></span><span></span><span></span></div>
                <span className="title">{t("vdp.terminal.title")}</span>
              </div>
              <div className="body">
                <div className="ln"><span className="ix">1</span><span className="cm">{t("vdp.terminal.l1")}</span></div>
                <div className="ln"><span className="ix">2</span><span className="ky">{t("vdp.terminal.typeKey")}</span><span className="vl">{NBSP}{t("vdp.terminal.typeVal")}</span></div>
                <div className="ln"><span className="ix">3</span><span className="ky">{t("vdp.terminal.urlKey")}</span><span className="vl">{NBSP}{t("vdp.terminal.urlVal")}</span></div>
                <div className="ln"><span className="ix">4</span><span className="ky">{t("vdp.terminal.reproKey")}</span><span className="vl">{NBSP}</span><span className="mt">{t("vdp.terminal.reproVal")}</span></div>
                <div className="ln"><span className="ix">5</span><span className="ky">{t("vdp.terminal.impactKey")}</span><span className="vl">{NBSP}</span><span className="mt">{t("vdp.terminal.impactVal")}</span></div>
                <div className="ln"><span className="ix">6</span><span className="ky">{t("vdp.terminal.pocKey")}</span><span className="vl">{NBSP}{t("vdp.terminal.pocVal")}</span></div>
                <div className="ln"><span className="ix">7</span><span className="cm">{t("vdp.terminal.l7")}</span></div>
                <div className="ln"><span className="ix">8</span><span className="ky">{t("vdp.terminal.send")}</span><span className="cursor"></span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================= INCLUDE / DON'T SEND ============================= */}
      <section className="section" id="report" style={{ paddingTop: 0 }}>
        <div className="sec-head">
          <div className="sec-eyebrow">{t("report.eyebrow")}</div>
          <h2>{t.rich("report.title", richTags)}</h2>
          <p>{t("report.intro")}</p>
        </div>

        <div className="listpair">
          <div className="listcol pos">
            <h4>
              <span className="pip"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></span>
              {t("report.include.heading")}
            </h4>
            <div className="sub">{t("report.include.sub")}</div>
            <ul>
              {INCLUDE_KEYS.map((key) => (
                <li key={key}><span className="mk"><CheckMark /></span><span>{t.rich(`report.include.items.${key}`, richTags)}</span></li>
              ))}
            </ul>
          </div>

          <div className="listcol neg">
            <h4>
              <span className="pip"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg></span>
              {t("report.dontSend.heading")}
            </h4>
            <div className="sub">{t("report.dontSend.sub")}</div>
            <ul>
              {DONT_SEND_KEYS.map((key) => (
                <li key={key}><span className="mk"><CrossMark /></span><span>{t.rich(`report.dontSend.items.${key}`, richTags)}</span></li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ============================= SCOPE ============================= */}
      <section className="scope" id="scope">
        <div className="section">
          <div className="sec-head">
            <div className="sec-eyebrow">{t("scope.eyebrow")}</div>
            <h2>{t("scope.title")}</h2>
            <p>{t("scope.intro")}</p>
          </div>

          <div className="scope-grid">
            <div className="scope-col in">
              <div className="badge-row">
                <span className="pill">{t("scope.in.pill")}</span>
                <span style={{ fontSize: "12px", color: "var(--fg-2)", ...MONO_STYLE }}>{t("scope.fileRef")}</span>
              </div>
              <h3>{t("scope.in.heading")}</h3>
              <ul>
                {SCOPE_IN_KEYS.map((key) => (
                  <li key={key}><span className="dot"></span><span>{t.rich(`scope.in.items.${key}`, richTags)}</span></li>
                ))}
              </ul>
            </div>
            <div className="scope-col out">
              <div className="badge-row">
                <span className="pill">{t("scope.out.pill")}</span>
                <span style={{ fontSize: "12px", color: "var(--fg-2)", ...MONO_STYLE }}>{t("scope.fileRef")}</span>
              </div>
              <h3>{t("scope.out.heading")}</h3>
              <ul>
                {SCOPE_OUT_KEYS.map((key) => (
                  <li key={key}><span className="dot"></span><span>{t.rich(`scope.out.items.${key}`, richTags)}</span></li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ============================= PLEDGE ============================= */}
      <section className="section" id="pledge">
        <div className="sec-head">
          <div className="sec-eyebrow">{t("pledge.eyebrow")}</div>
          <h2>{t.rich("pledge.title", richTags)}</h2>
          <p>{t("pledge.intro")}</p>
        </div>

        <div className="pledge-grid">
          {(["researcher", "viza"] as const).map((side) => (
            <div className="pledge" key={side}>
              <div className="kicker">{t(`pledge.${side}.kicker`)}</div>
              <h3>{t.rich(`pledge.${side}.title`, richTags)}</h3>
              <p>{t(`pledge.${side}.p`)}</p>
              <ul>
                {PLEDGE_ITEM_NUMS.map((n) => (
                  <li key={n}><span className="num">{`0${n}`}</span><span>{t(`pledge.${side}.items.${n}`)}</span></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ============================= LEGAL STRIP ============================= */}
      <section className="section" id="legal" style={{ paddingTop: 0 }}>
        <div className="sec-head">
          <div className="sec-eyebrow">{t("legal.eyebrow")}</div>
          <h2>{t.rich("legal.title", richTags)}</h2>
          <p>{t("legal.intro")}</p>
        </div>

        <div className="legal-strip">
          {LEGAL_CARDS.map(({ key, icon }) => (
            <div className="legal-card" key={key}>
              <div className="ic">{icon}</div>
              <h4>{t(`legal.cards.${key}.title`)}</h4>
              <p>{t.rich(`legal.cards.${key}.body`, richTags)}</p>
              <span className="meta">{t(`legal.cards.${key}.meta`)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ============================= CTA STRIP ============================= */}
      <div className="cta-strip">
        <div>
          <h2>{t.rich("cta.title", richTags)}</h2>
          <p>{t("cta.body")}</p>
        </div>
        <div className="right">
          <span className="lead">{t("cta.lead")}</span>
          <a className="mail" href="mailto:security@viza.it.com">
            <span className="ic">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
            </span>
            {t("cta.email")}
          </a>
          <small>{t("cta.small")}</small>
        </div>
      </div>

      <SiteFooter />
    </>
  );
}
