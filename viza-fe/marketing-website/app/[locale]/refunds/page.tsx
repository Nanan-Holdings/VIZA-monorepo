"use client";
import "./refunds.css";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import SiteNav from "@/components/SiteNav";

/** Anchor ids, in page order — drives the TOC and the scroll-spy. */
const SECTION_IDS = [
  "summary",
  "fees",
  "scenarios",
  "timeline",
  "exceptions",
  "claim",
  "faq",
  "changelog",
] as const;

/** Refund matrix rows: copy lives in messages, the value colour class lives here. */
const MATRIX_COLS = ["gov", "service", "partner"] as const;
const MATRIX_ROWS = [
  { key: "cancelBefore", cls: { gov: "full", service: "full", partner: "full" } },
  { key: "cancelAfter", cls: { gov: "none", service: "partial", partner: "full" } },
  { key: "missDate", cls: { gov: "none", service: "full", partner: "full" } },
  { key: "rejectedFault", cls: { gov: "full", service: "full", partner: "partial" } },
  { key: "rejectedDiscretion", cls: { gov: "none", service: "partial", partner: "none" } },
  { key: "withdrew", cls: { gov: "none", service: "none", partner: "none" } },
  { key: "lostDoc", cls: { gov: "full", service: "full", partner: "full" } },
] as const;

const FEE_CELLS = [
  { key: "gov", badgeCls: "fa-refundable no" },
  { key: "service", badgeCls: "fa-refundable" },
  { key: "partner", badgeCls: "fa-refundable partial" },
] as const;

const TIMELINE_STEPS = [
  { key: "file", done: true },
  { key: "ack", done: true },
  { key: "review", done: false },
  { key: "decision", done: false },
  { key: "money", done: false },
] as const;

const EXCEPTION_KEYS = ["govFees", "misrep", "forceMajeure", "fx", "addons"] as const;
const FAQ_KEYS = [
  "cancelTrip",
  "rejected",
  "settleTime",
  "paidDirect",
  "holiday",
  "cashCredit",
] as const;
const CHANGELOG_KEYS = ["v42", "v41", "v40", "v36"] as const;

const PRODUCT_KEYS = [
  "prodMockInterview",
  "prodVisaReq",
  "prodSchengen",
  "prodPhoto",
  "prodHelpline",
  "prodStudent",
] as const;

/** Office addresses are proper nouns — intentionally untranslated (matches SiteFooter). */
const OFFICES: Array<[string, string]> = [
  ["中国（上海）自由贸易试验区罗山路1502弄", "No. 67, Kangcheng Road, Lane 958, Xinsong Road, Minhang District, Shanghai, China"],
  ["225 Pasir Panjang Rd,", "Singapore"],
];

const richTags = {
  strong: (chunks: ReactNode) => <strong>{chunks}</strong>,
  em: (chunks: ReactNode) => <em>{chunks}</em>,
};

const PlusIcon = () => (
  <span className="plus">
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  </span>
);

const OfficePin = () => (
  <svg
    className="office-pin"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

export default function RefundsPage() {
  const t = useTranslations("refunds");
  const tf = useTranslations("footer");

  // --- TOC scroll-spy ---
  const sectionRefs = useRef<Array<HTMLElement | null>>([]);
  const [activeIdx, setActiveIdx] = useState(0);

  const setSectionRef = (i: number) => (el: HTMLElement | null) => {
    sectionRefs.current[i] = el;
  };

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY + 120;
      let idx = 0;
      sectionRefs.current.forEach((el, i) => {
        if (el && el.offsetTop <= y) idx = i;
      });
      setActiveIdx(idx);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Smooth TOC scroll
  const onTocClick = (e: React.MouseEvent<HTMLAnchorElement>, i: number) => {
    const target = sectionRefs.current[i];
    if (!target) return;
    e.preventDefault();
    window.scrollTo({ top: target.offsetTop - 92, behavior: "smooth" });
    history.replaceState(null, "", `#${SECTION_IDS[i]}`);
  };

  return (
    <>
      {/* Top nav */}
      <SiteNav />

      {/* Breadcrumbs */}
      <div className="crumbs">
        <a href="/">VIZA</a>
        <span className="sep">/</span>
        <a href="#">{t("crumbs.transparency")}</a>
        <span className="sep">/</span>
        <span className="here">{t("crumbs.here")}</span>
      </div>

      {/* Hero */}
      <header className="hero" data-screen-label="Refunds Hero">
        <div>
          <div className="hero-eyebrow">{t("hero.eyebrow")}</div>
          <h1>
            {t.rich("hero.title1", richTags)}
            <br />
            {t("hero.title2")}
          </h1>
          <p className="lede">{t.rich("hero.lede", richTags)}</p>
        </div>
        <div className="hero-meta">
          <div className="meta-row">
            <div className="mk">{t("meta.effective")}</div>
            <div className="mv">{t("meta.effectiveValue")}</div>
          </div>
          <div className="meta-row">
            <div className="mk">{t("meta.version")}</div>
            <div className="mv">
              {t("meta.versionValue")} · <a href="#changelog">{t("meta.changelogLink")}</a>
            </div>
          </div>
          <div className="meta-row">
            <div className="mk">{t("meta.jurisdiction")}</div>
            <div className="mv">{t("meta.jurisdictionValue")}</div>
          </div>
          <div className="meta-row">
            <div className="mk">{t("meta.status")}</div>
            <div className="mv">
              <span className="dot"></span>
              {t("meta.statusValue")}
            </div>
          </div>
          <div className="meta-row">
            <div className="mk">{t("meta.coverage")}</div>
            <div className="mv">{t("meta.coverageValue")}</div>
          </div>
        </div>
      </header>

      {/* Promise strip */}
      <section className="promise">
        <div className="promise-cell">
          <div className="pnum">
            {t("promise.c1.num")}
            <small>{t("promise.c1.small")}</small>
          </div>
          <div className="ptitle">{t("promise.c1.title")}</div>
          <div className="pbody">{t("promise.c1.body")}</div>
        </div>
        <div className="promise-cell">
          <div className="pnum">
            {t("promise.c2.num")}
            <small>{t("promise.c2.small")}</small>
          </div>
          <div className="pbody-l ptitle">{t("promise.c2.title")}</div>
          <div className="pbody">{t("promise.c2.body")}</div>
        </div>
        <div className="promise-cell">
          <div className="pnum">{t("promise.c3.num")}</div>
          <div className="ptitle">{t("promise.c3.title")}</div>
          <div className="pbody">{t("promise.c3.body")}</div>
        </div>
        <div className="promise-cell">
          <div className="pnum">
            {t("promise.c4.num")}
            <small>{t("promise.c4.small")}</small>
          </div>
          <div className="ptitle">{t("promise.c4.title")}</div>
          <div className="pbody">{t("promise.c4.body")}</div>
        </div>
      </section>

      {/* Body layout */}
      <div className="layout">
        {/* TOC */}
        <aside className="toc">
          <h4>{t("toc.heading")}</h4>
          <ol id="tocList">
            {SECTION_IDS.map((id, i) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className={activeIdx === i ? "active" : undefined}
                  onClick={(e) => onTocClick(e, i)}
                >
                  {t(`toc.${id}`)}
                </a>
              </li>
            ))}
          </ol>
          <div className="toc-help">
            {t("toc.help")}
            <a href="#">
              {t("toc.download")}
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </a>
          </div>
        </aside>

        {/* Content */}
        <article className="content">
          <section id="summary" ref={setSectionRef(0)}>
            <div className="section-num">{t("summary.num")}</div>
            <h2>{t("summary.title")}</h2>
            <p className="intro">{t("summary.intro")}</p>

            <div className="callout">
              <div className="co-icon">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4" />
                  <path d="M12 16h.01" />
                </svg>
              </div>
              <div className="co-body">{t.rich("summary.callout", richTags)}</div>
            </div>
          </section>

          <section id="fees" ref={setSectionRef(1)}>
            <div className="section-num">{t("fees.num")}</div>
            <h2>{t("fees.title")}</h2>
            <p className="intro">{t("fees.intro")}</p>

            <div className="fee-anatomy">
              <div className="fa-title">{t("fees.fa.title")}</div>
              <div className="fa-sub">{t("fees.fa.sub")}</div>

              <div className="fa-bar">
                <div className="fa-seg gov">{t("fees.fa.segGov")}</div>
                <div className="fa-seg service">{t("fees.fa.segService")}</div>
                <div className="fa-seg partner">{t("fees.fa.segPartner")}</div>
              </div>

              <div className="fa-legend">
                {FEE_CELLS.map(({ key, badgeCls }) => (
                  <div className="fa-cell" key={key}>
                    <div className="fk">{t(`fees.fa.cells.${key}.k`)}</div>
                    <div className="fname">{t(`fees.fa.cells.${key}.name`)}</div>
                    <div className="fdesc">{t(`fees.fa.cells.${key}.desc`)}</div>
                    <div className={badgeCls}>{t(`fees.fa.cells.${key}.badge`)}</div>
                  </div>
                ))}
              </div>
            </div>

            <p className="muted">{t("fees.muted")}</p>
          </section>

          <section id="scenarios" ref={setSectionRef(2)}>
            <div className="section-num">{t("scenarios.num")}</div>
            <h2>{t("scenarios.title")}</h2>
            <p className="intro">{t("scenarios.intro")}</p>

            <div className="matrix" role="table" aria-label={t("scenarios.ariaLabel")}>
              <div className="matrix-row matrix-head" role="row">
                <div className="mc" role="columnheader">
                  {t("scenarios.head.what")}
                </div>
                <div className="mc" role="columnheader">
                  {t("scenarios.head.gov")}
                </div>
                <div className="mc" role="columnheader">
                  {t("scenarios.head.service")}
                </div>
                <div className="mc" role="columnheader">
                  {t("scenarios.head.partner")}
                </div>
              </div>

              {MATRIX_ROWS.map((row) => (
                <div className="matrix-row" role="row" key={row.key}>
                  <div className="mc scenario" role="cell">
                    {t(`scenarios.rows.${row.key}.title`)}
                    <span className="sub">{t(`scenarios.rows.${row.key}.sub`)}</span>
                  </div>
                  {MATRIX_COLS.map((col) => (
                    <div className="mc" role="cell" key={col}>
                      <div className="pct">
                        <span className={`v ${row.cls[col]}`}>
                          {t(`scenarios.rows.${row.key}.${col}.v`)}
                        </span>
                        <span>{t(`scenarios.rows.${row.key}.${col}.label`)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <p className="muted">{t("scenarios.muted")}</p>
          </section>

          <section id="timeline" ref={setSectionRef(3)}>
            <div className="section-num">{t("timeline.num")}</div>
            <h2>{t("timeline.title")}</h2>
            <p className="intro">{t("timeline.intro")}</p>

            <div className="timeline">
              {TIMELINE_STEPS.map(({ key, done }, i) => (
                <div className={done ? "tl-step done" : "tl-step"} key={key}>
                  <div className="tl-dot">{i + 1}</div>
                  <div className="tl-time">{t(`timeline.steps.${key}.time`)}</div>
                  <div className="tl-title">{t(`timeline.steps.${key}.title`)}</div>
                  <div className="tl-desc">{t.rich(`timeline.steps.${key}.desc`, richTags)}</div>
                </div>
              ))}
            </div>

            <h3>{t("timeline.overTitle")}</h3>
            <p>{t("timeline.overBody")}</p>
          </section>

          <section id="exceptions" ref={setSectionRef(4)}>
            <div className="section-num">{t("exceptions.num")}</div>
            <h2>{t("exceptions.title")}</h2>
            <p className="intro">{t("exceptions.intro")}</p>

            <ul>
              {EXCEPTION_KEYS.map((key) => (
                <li key={key}>{t.rich(`exceptions.items.${key}`, richTags)}</li>
              ))}
            </ul>
          </section>

          <section id="claim" ref={setSectionRef(5)}>
            <div className="section-num">{t("claim.num")}</div>
            <h2>{t("claim.title")}</h2>
            <p className="intro">{t("claim.intro")}</p>

            <ul>
              <li>{t.rich("claim.items.inapp", richTags)}</li>
              <li>
                {t.rich("claim.items.email", {
                  ...richTags,
                  link: (chunks) => <a href="mailto:refunds@viza.co">{chunks}</a>,
                })}
              </li>
              <li>{t.rich("claim.items.person", richTags)}</li>
            </ul>

            <p>{t("claim.escalate")}</p>
          </section>

          <section id="faq" ref={setSectionRef(6)}>
            <div className="section-num">{t("faq.num")}</div>
            <h2>{t("faq.title")}</h2>
            <p className="intro">{t("faq.intro")}</p>

            <div className="faq">
              {FAQ_KEYS.map((key, i) => (
                <details key={key} open={i === 0 || undefined}>
                  <summary>
                    {t(`faq.items.${key}.q`)}
                    <PlusIcon />
                  </summary>
                  <div className="answer">{t.rich(`faq.items.${key}.a`, richTags)}</div>
                </details>
              ))}
            </div>
          </section>

          <section id="changelog" ref={setSectionRef(7)}>
            <div className="section-num">{t("changelog.num")}</div>
            <h2>{t("changelog.title")}</h2>
            <p className="intro">{t("changelog.intro")}</p>

            <ul>
              {CHANGELOG_KEYS.map((key) => (
                <li key={key}>
                  <strong>{t(`changelog.items.${key}.tag`)}</strong>{" "}
                  {t(`changelog.items.${key}.text`)}
                </li>
              ))}
            </ul>

            <div className="final-cta">
              <div>
                <h3>{t("changelog.cta.title")}</h3>
                <p>{t("changelog.cta.body")}</p>
              </div>
              <div className="ctas">
                <button className="btn-white">
                  {t("changelog.cta.open")}
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
                <button className="btn-ghost-w">{t("changelog.cta.talk")}</button>
              </div>
            </div>
          </section>
        </article>
      </div>

      <div className="updated-strip">
        <div className="us-inner">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          {t.rich("updatedStrip", { link: (chunks) => <a href="#">{chunks}</a> })}
        </div>
      </div>

      {/* Footer */}
      <footer className="site-foot" data-screen-label="Footer">
        <div className="foot-rule"></div>
        <div className="foot-main">
          <div className="foot-brand">
            <a className="foot-logo" href="/">
              <img src="/assets/viza-logo-black.svg" alt="VIZA" />
            </a>
            <p className="foot-tag">{tf("tagline")}</p>
          </div>
          <div className="col-company">
            <h4 className="col-head">{tf("company")}</h4>
            <ul className="col-list">
              <li>
                <a href="/careers">{tf("careers")}</a>
              </li>
              <li>
                <a href="/contact">{tf("contact")}</a>
              </li>
              <li>
                <a href="/security">{tf("security")}</a>
              </li>
              <li>
                <a href="/refunds" className="here">
                  {tf("refundsPolicy")}
                </a>
              </li>
              <li>
                <a href="/status">{tf("status")}</a>
              </li>
              <li>
                <a href="/legal/privacy">{tf("privacy")}</a>
              </li>
              <li>
                <a href="/legal/terms">{tf("terms")}</a>
              </li>
            </ul>
          </div>
          <div className="col-products">
            <h4 className="col-head">{tf("product")}</h4>
            <ul className="col-list">
              {PRODUCT_KEYS.map((key) => (
                <li key={key}>
                  <a href="#">{tf(key)}</a>
                </li>
              ))}
            </ul>
          </div>
          <div className="col-offices">
            <h4 className="col-head">{tf("offices")}</h4>
            <ul className="col-list">
              {OFFICES.map(([line1, line2]) => (
                <li className="office-row" key={line2}>
                  <OfficePin />
                  <span>
                    {line1}
                    <br />
                    {line2}
                  </span>
                </li>
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
          <div className="foot-mark">
            <img src="/assets/viza-logo-black.svg" alt="VIZA" />
          </div>
        </div>
      </footer>
    </>
  );
}
