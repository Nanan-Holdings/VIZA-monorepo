"use client";
import "./refunds.css";
import { useEffect } from "react";
import SiteNav from "@/components/SiteNav";

export default function RefundsPage() {
  useEffect(() => {
    // --- Tab pill indicator (no active tab on this page; place pill off-screen / hidden) ---
    const pill = document.getElementById("navPill");
    if (pill) pill.style.display = "none";

    // --- TOC scroll-spy ---
    const tocLinks = Array.from(
      document.querySelectorAll<HTMLAnchorElement>("#tocList a")
    );
    const sections = tocLinks
      .map((a) => {
        const href = a.getAttribute("href");
        return href ? document.querySelector<HTMLElement>(href) : null;
      })
      .filter((el): el is HTMLElement => Boolean(el));

    function onScroll() {
      const y = window.scrollY + 120;
      let idx = 0;
      for (let i = 0; i < sections.length; i++) {
        if (sections[i].offsetTop <= y) idx = i;
      }
      tocLinks.forEach((a, i) => a.classList.toggle("active", i === idx));
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    // Smooth TOC scroll
    const clickHandlers: Array<{
      el: HTMLAnchorElement;
      handler: (e: Event) => void;
    }> = [];
    tocLinks.forEach((a) => {
      const handler = (e: Event) => {
        const href = a.getAttribute("href");
        if (!href) return;
        const t = document.querySelector<HTMLElement>(href);
        if (!t) return;
        e.preventDefault();
        window.scrollTo({ top: t.offsetTop - 92, behavior: "smooth" });
        history.replaceState(null, "", href);
      };
      a.addEventListener("click", handler);
      clickHandlers.push({ el: a, handler });
    });

    return () => {
      window.removeEventListener("scroll", onScroll);
      clickHandlers.forEach(({ el, handler }) =>
        el.removeEventListener("click", handler)
      );
    };
  }, []);

  return (
    <>
      {/* Top nav */}
      <SiteNav />

      {/* Breadcrumbs */}
      <div className="crumbs">
        <a href="/">VIZA</a>
        <span className="sep">/</span>
        <a href="#">Transparency</a>
        <span className="sep">/</span>
        <span className="here">Refunds policy</span>
      </div>

      {/* Hero */}
      <header className="hero" data-screen-label="Refunds Hero">
        <div>
          <div className="hero-eyebrow">Transparency · Refunds Policy</div>
          <h1>
            If we miss, <em>you don{"’"}t pay.</em>
            <br />
            If they miss, we still try.
          </h1>
          <p className="lede">
            Every visa application carries two costs — what the government charges, and
            what we charge for handling it. This page explains, line by line,{" "}
            <strong>what you get back, when, and why</strong>. No buried clauses, no
            {" "}{"“"}subject-to{"”"} footnotes.
          </p>
        </div>
        <div className="hero-meta">
          <div className="meta-row">
            <div className="mk">Effective</div>
            <div className="mv">1 May 2026</div>
          </div>
          <div className="meta-row">
            <div className="mk">Version</div>
            <div className="mv">
              v4.2 · <a href="#changelog">View changelog</a>
            </div>
          </div>
          <div className="meta-row">
            <div className="mk">Jurisdiction</div>
            <div className="mv">Singapore (CPA 2003)</div>
          </div>
          <div className="meta-row">
            <div className="mk">Status</div>
            <div className="mv">
              <span className="dot"></span>Active &amp; audited monthly
            </div>
          </div>
          <div className="meta-row">
            <div className="mk">Coverage</div>
            <div className="mv">All visa applications filed via VIZA</div>
          </div>
        </div>
      </header>

      {/* Promise strip */}
      <section className="promise">
        <div className="promise-cell">
          <div className="pnum">
            100<small>%</small>
          </div>
          <div className="ptitle">Service fee back if we miss the date</div>
          <div className="pbody">
            Our entire handling fee is refunded if your visa arrives after the date we
            guaranteed at checkout.
          </div>
        </div>
        <div className="promise-cell">
          <div className="pnum">
            7<small>days</small>
          </div>
          <div className="pbody-l ptitle">Refund settled to your card</div>
          <div className="pbody">
            From the moment a refund is approved, you{"’"}ll see the amount back on
            the original payment method within seven business days.
          </div>
        </div>
        <div className="promise-cell">
          <div className="pnum">SGD&nbsp;0</div>
          <div className="ptitle">To re-apply after a rejection</div>
          <div className="pbody">
            If a visa is refused for reasons within our control, we re-file once at our
            cost — including a fresh government fee.
          </div>
        </div>
        <div className="promise-cell">
          <div className="pnum">
            24<small>/7</small>
          </div>
          <div className="ptitle">Human, never a form</div>
          <div className="pbody">
            Claims are reviewed by a real consultant in our Singapore office, not a
            queueing bot. Always.
          </div>
        </div>
      </section>

      {/* Body layout */}
      <div className="layout">
        {/* TOC */}
        <aside className="toc">
          <h4>On this page</h4>
          <ol id="tocList">
            <li>
              <a href="#summary" className="active">
                In one line
              </a>
            </li>
            <li>
              <a href="#fees">What you{"’"}re paying for</a>
            </li>
            <li>
              <a href="#scenarios">Refund scenarios</a>
            </li>
            <li>
              <a href="#timeline">How a refund moves</a>
            </li>
            <li>
              <a href="#exceptions">Edge cases &amp; exclusions</a>
            </li>
            <li>
              <a href="#claim">Filing a claim</a>
            </li>
            <li>
              <a href="#faq">Common questions</a>
            </li>
            <li>
              <a href="#changelog">Changelog</a>
            </li>
          </ol>
          <div className="toc-help">
            Need this in writing for an employer or insurer?
            <a href="#">
              Download as PDF
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
          <section id="summary">
            <div className="section-num">§ 01</div>
            <h2>The whole policy, in one line.</h2>
            <p className="intro">
              If we don{"’"}t deliver on what we promised at checkout, you don
              {"’"}t pay us for it. Government fees follow each embassy{"’"}s
              own rules — we collect them on your behalf and pass on whatever the
              consulate returns.
            </p>

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
              <div className="co-body">
                The single thing worth remembering:{" "}
                <strong>our service fee is fully refundable</strong> if we miss your
                guaranteed delivery date, lose your documents, or refuse a re-file we
                promised. Government fees are{" "}
                <strong>refundable only if the embassy issues a refund</strong> — most
                never do once an application is filed.
              </div>
            </div>
          </section>

          <section id="fees">
            <div className="section-num">§ 02</div>
            <h2>What you{"’"}re actually paying for.</h2>
            <p className="intro">
              Every checkout total is the sum of three line items. We treat them as
              separate, refund them separately, and show them separately on your invoice.
            </p>

            <div className="fee-anatomy">
              <div className="fa-title">
                Sample: Indonesia e-Visa, Singapore passport
              </div>
              <div className="fa-sub">
                A real breakdown of a SGD 84 checkout. Proportions reflect the average
                across countries we file in.
              </div>

              <div className="fa-bar">
                <div className="fa-seg gov">Government fee · SGD 32</div>
                <div className="fa-seg service">VIZA service · SGD 27</div>
                <div className="fa-seg partner">Partner &amp; courier · SGD 25</div>
              </div>

              <div className="fa-legend">
                <div className="fa-cell">
                  <div className="fk">Line item 01</div>
                  <div className="fname">Government fee</div>
                  <div className="fdesc">
                    Paid directly to the destination consulate or VFS centre.
                    Non-refundable once filed in 92% of jurisdictions.
                  </div>
                  <div className="fa-refundable no">
                    Refunded only if embassy returns it
                  </div>
                </div>
                <div className="fa-cell">
                  <div className="fk">Line item 02</div>
                  <div className="fname">VIZA service</div>
                  <div className="fdesc">
                    Application prep, document review, fast-track filing, your
                    consultant, and on-time guarantee.
                  </div>
                  <div className="fa-refundable">Fully refundable on our promise</div>
                </div>
                <div className="fa-cell">
                  <div className="fk">Line item 03</div>
                  <div className="fname">Partner &amp; courier</div>
                  <div className="fdesc">
                    Biometrics centre, photo studio, doorstep passport courier. Refunded
                    if the service wasn{"’"}t rendered.
                  </div>
                  <div className="fa-refundable partial">
                    Refunded if service not rendered
                  </div>
                </div>
              </div>
            </div>

            <p className="muted">
              On your invoice, each line shows the merchant of record on the right. You
              {"’"}ll never see a single opaque {"“"}visa fee{"”"} — that
              practice is what the Singapore Consumer Protection Act was written against,
              and we agree with it.
            </p>
          </section>

          <section id="scenarios">
            <div className="section-num">§ 03</div>
            <h2>Every scenario, mapped to a refund.</h2>
            <p className="intro">
              The matrix below covers 98% of cases. The remaining 2% — exotic visa
              categories, dual-applicant family bundles, expedited weekend filings — are
              documented in §05.
            </p>

            <div className="matrix" role="table" aria-label="Refund scenarios">
              <div className="matrix-row matrix-head" role="row">
                <div className="mc" role="columnheader">
                  What happened
                </div>
                <div className="mc" role="columnheader">
                  Government fee
                </div>
                <div className="mc" role="columnheader">
                  VIZA service fee
                </div>
                <div className="mc" role="columnheader">
                  Partner &amp; courier
                </div>
              </div>

              <div className="matrix-row" role="row">
                <div className="mc scenario" role="cell">
                  You cancel before we file
                  <span className="sub">
                    Within 24h of payment, no documents reviewed yet
                  </span>
                </div>
                <div className="mc" role="cell">
                  <div className="pct">
                    <span className="v full">100%</span>
                    <span>Refunded in full</span>
                  </div>
                </div>
                <div className="mc" role="cell">
                  <div className="pct">
                    <span className="v full">100%</span>
                    <span>Refunded in full</span>
                  </div>
                </div>
                <div className="mc" role="cell">
                  <div className="pct">
                    <span className="v full">100%</span>
                    <span>Refunded in full</span>
                  </div>
                </div>
              </div>

              <div className="matrix-row" role="row">
                <div className="mc scenario" role="cell">
                  You cancel after we file
                  <span className="sub">Documents lodged with the embassy</span>
                </div>
                <div className="mc" role="cell">
                  <div className="pct">
                    <span className="v none">0%</span>
                    <span>Embassy retains the fee</span>
                  </div>
                </div>
                <div className="mc" role="cell">
                  <div className="pct">
                    <span className="v partial">50%</span>
                    <span>Half refunded for unused work</span>
                  </div>
                </div>
                <div className="mc" role="cell">
                  <div className="pct">
                    <span className="v full">100%</span>
                    <span>If biometrics not yet booked</span>
                  </div>
                </div>
              </div>

              <div className="matrix-row" role="row">
                <div className="mc scenario" role="cell">
                  We miss the guaranteed date
                  <span className="sub">Delay caused by VIZA or our network</span>
                </div>
                <div className="mc" role="cell">
                  <div className="pct">
                    <span className="v none">0%</span>
                    <span>Visa was still issued</span>
                  </div>
                </div>
                <div className="mc" role="cell">
                  <div className="pct">
                    <span className="v full">100%</span>
                    <span>Full service fee back</span>
                  </div>
                </div>
                <div className="mc" role="cell">
                  <div className="pct">
                    <span className="v full">100%</span>
                    <span>Full courier back</span>
                  </div>
                </div>
              </div>

              <div className="matrix-row" role="row">
                <div className="mc scenario" role="cell">
                  Visa rejected — our fault
                  <span className="sub">
                    Document error, wrong form, missed deadline
                  </span>
                </div>
                <div className="mc" role="cell">
                  <div className="pct">
                    <span className="v full">100%</span>
                    <span>We re-file at our cost</span>
                  </div>
                </div>
                <div className="mc" role="cell">
                  <div className="pct">
                    <span className="v full">100%</span>
                    <span>Full service fee back</span>
                  </div>
                </div>
                <div className="mc" role="cell">
                  <div className="pct">
                    <span className="v partial">50%</span>
                    <span>Courier re-used where possible</span>
                  </div>
                </div>
              </div>

              <div className="matrix-row" role="row">
                <div className="mc scenario" role="cell">
                  Visa rejected — embassy{"’"}s discretion
                  <span className="sub">Eligibility, intent, prior travel concerns</span>
                </div>
                <div className="mc" role="cell">
                  <div className="pct">
                    <span className="v none">0%</span>
                    <span>Non-refundable by embassy</span>
                  </div>
                </div>
                <div className="mc" role="cell">
                  <div className="pct">
                    <span className="v partial">25%</span>
                    <span>
                      {"“"}Did our part{"”"} goodwill credit
                    </span>
                  </div>
                </div>
                <div className="mc" role="cell">
                  <div className="pct">
                    <span className="v none">0%</span>
                    <span>Service was rendered</span>
                  </div>
                </div>
              </div>

              <div className="matrix-row" role="row">
                <div className="mc scenario" role="cell">
                  Visa rejected — applicant withdrew docs
                  <span className="sub">
                    You chose to stop responding after filing
                  </span>
                </div>
                <div className="mc" role="cell">
                  <div className="pct">
                    <span className="v none">0%</span>
                    <span>Embassy retains the fee</span>
                  </div>
                </div>
                <div className="mc" role="cell">
                  <div className="pct">
                    <span className="v none">0%</span>
                    <span>Service was rendered</span>
                  </div>
                </div>
                <div className="mc" role="cell">
                  <div className="pct">
                    <span className="v none">0%</span>
                    <span>Service was rendered</span>
                  </div>
                </div>
              </div>

              <div className="matrix-row" role="row">
                <div className="mc scenario" role="cell">
                  We lose a document
                  <span className="sub">
                    Original passport or supporting document misplaced in our chain
                  </span>
                </div>
                <div className="mc" role="cell">
                  <div className="pct">
                    <span className="v full">100%</span>
                    <span>Plus passport-replacement cost</span>
                  </div>
                </div>
                <div className="mc" role="cell">
                  <div className="pct">
                    <span className="v full">100%</span>
                    <span>Plus SGD 200 credit</span>
                  </div>
                </div>
                <div className="mc" role="cell">
                  <div className="pct">
                    <span className="v full">100%</span>
                    <span>Full courier back</span>
                  </div>
                </div>
              </div>
            </div>

            <p className="muted">
              {"“"}Goodwill credit{"”"} means VIZA travel credit redeemable
              against any future application, valid 24 months. You can convert credit to
              a cash refund on request — we just default to credit because most
              travellers come back.
            </p>
          </section>

          <section id="timeline">
            <div className="section-num">§ 04</div>
            <h2>How a refund actually moves.</h2>
            <p className="intro">
              Most refund pages stop at {"“"}we will process within reasonable time
              {"”"}. Here is the real internal SLA — the same one our refunds team
              is measured against.
            </p>

            <div className="timeline">
              <div className="tl-step done">
                <div className="tl-dot">1</div>
                <div className="tl-time">Hour 0</div>
                <div className="tl-title">You file</div>
                <div className="tl-desc">
                  Click <em>Open a claim</em> in your dashboard, or reply to any email
                  from our team.
                </div>
              </div>
              <div className="tl-step done">
                <div className="tl-dot">2</div>
                <div className="tl-time">Hour 4</div>
                <div className="tl-title">Acknowledged</div>
                <div className="tl-desc">
                  A real consultant — not a chatbot — confirms receipt and shares the
                  case ID.
                </div>
              </div>
              <div className="tl-step">
                <div className="tl-dot">3</div>
                <div className="tl-time">Day 1–2</div>
                <div className="tl-title">Reviewed</div>
                <div className="tl-desc">
                  Application log, embassy timestamps, and chat history are checked
                  against the scenarios in §03.
                </div>
              </div>
              <div className="tl-step">
                <div className="tl-dot">4</div>
                <div className="tl-time">Day 3</div>
                <div className="tl-title">Decision sent</div>
                <div className="tl-desc">
                  A short written outcome lands in your inbox, citing which row of §03
                  applies and the amount.
                </div>
              </div>
              <div className="tl-step">
                <div className="tl-dot">5</div>
                <div className="tl-time">Day 4–7</div>
                <div className="tl-title">Money back</div>
                <div className="tl-desc">
                  Funds settle on the original payment method. Card refunds may take 1–2
                  statement cycles to display.
                </div>
              </div>
            </div>

            <h3>If we go over seven days</h3>
            <p>
              We add a flat 5% late-handling credit to your refund — automatically,
              without you asking — for every business day past the seventh. The clock
              starts when the claim is acknowledged and pauses only if we{"’"}re
              waiting on a document from you (we{"’"}ll always say so in writing).
            </p>
          </section>

          <section id="exceptions">
            <div className="section-num">§ 05</div>
            <h2>Things we don{"’"}t refund, and why.</h2>
            <p className="intro">
              A shorter list than most providers, but we{"’"}d rather state it
              plainly than hide it.
            </p>

            <ul>
              <li>
                <strong>Government fees the embassy keeps.</strong> When an embassy
                explicitly states a fee is non-refundable once filed, we cannot return
                what we don{"’"}t hold. We list this on the country page{" "}
                <em>before</em> you pay.
              </li>
              <li>
                <strong>Applications voided by misrepresentation.</strong> If a document
                submitted via VIZA is later found to be falsified, every fee — ours
                included — is forfeit and may be reported to authorities.
              </li>
              <li>
                <strong>Force majeure beyond a 14-day window.</strong> Strikes, natural
                disasters, or sudden embassy closures pause the on-time clock. If service
                can{"’"}t resume within 14 days, the service fee is refunded in
                full.
              </li>
              <li>
                <strong>Currency conversion losses.</strong> Refunds are issued in the
                original payment currency. If your bank applied an FX margin on the way
                in, we cannot recover that — banks rarely return it.
              </li>
              <li>
                <strong>Bundled trip-protection add-ons.</strong> Optional travel
                insurance and trip-cancellation add-ons follow the partner insurer
                {"’"}s policy, linked at checkout.
              </li>
            </ul>
          </section>

          <section id="claim">
            <div className="section-num">§ 06</div>
            <h2>Filing a claim takes ninety seconds.</h2>
            <p className="intro">
              No forms, no ticket numbers, no {"“"}kindly revert{"”"}. One of
              three doors, all of them open.
            </p>

            <ul>
              <li>
                <strong>In-app.</strong> Open any application in your VIZA dashboard,
                scroll to <em>Money &amp; receipts</em>, click{" "}
                <em>Open refund claim</em>. Pre-filled with your case ID.
              </li>
              <li>
                <strong>By email.</strong> Reply to any thread from your consultant, or
                write to <a href="mailto:refunds@viza.co">refunds@viza.co</a> with the
                application reference.
              </li>
              <li>
                <strong>In person.</strong> Walk into any VIZA office — Singapore, Dubai,
                London, or San Francisco — between 09:00 and 18:00 local time. Bring your
                passport.
              </li>
            </ul>

            <p>
              Unhappy with the outcome? Every decision can be escalated to our refunds
              committee, chaired by our Chief Customer Officer, who reviews disputed
              cases weekly. From there, Singapore CASE mediation is available at no cost
              to you.
            </p>
          </section>

          <section id="faq">
            <div className="section-num">§ 07</div>
            <h2>Common questions, real answers.</h2>
            <p className="intro">
              Pulled from the most frequent threads our refunds team has handled this
              year.
            </p>

            <div className="faq">
              <details open>
                <summary>
                  I had to cancel my trip. Can I get a refund?
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
                </summary>
                <div className="answer">
                  If we haven{"’"}t filed yet, you receive a full refund of every
                  line item. If we{"’"}ve already filed, the embassy keeps the
                  government fee but you receive a 50% credit of our service fee (see
                  §03, row 2). The courier portion depends on whether biometrics have
                  been booked. The fastest way to know exactly which row applies to your
                  case is to open the claim — our consultant will quote the exact amount
                  within 4 working hours.
                </div>
              </details>
              <details>
                <summary>
                  My visa was rejected. Do I get my money back?
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
                </summary>
                <div className="answer">
                  It depends on <strong>why</strong> it was rejected. If the rejection
                  traces back to something we got wrong — a wrong form, an out-of-date
                  supporting document, a missed deadline — we refund our full fee{" "}
                  <strong>and</strong> re-file at our cost. If the rejection was the
                  embassy{"’"}s own discretion (intent, prior travel, eligibility),
                  the government fee is gone and we apply a 25% goodwill credit toward
                  your next application.
                </div>
              </details>
              <details>
                <summary>
                  How long does the money take to actually show up?
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
                </summary>
                <div className="answer">
                  From the moment the decision is sent, expect{" "}
                  <strong>4 to 7 business days</strong> on cards, instant on PayNow, and
                  1–3 days on bank transfers. Some card issuers batch refunds and only
                  show them on your next statement — if your refund is {"“"}approved
                  {"”"} but not yet visible after 10 days, that{"’"}s almost
                  always why. We can send a refund reference number for you to share with
                  your bank.
                </div>
              </details>
              <details>
                <summary>
                  What if I paid the government fee directly?
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
                </summary>
                <div className="answer">
                  For a handful of consulates (notably Australia and the UK), you pay the
                  government portal directly. In those cases the embassy{"’"}s own
                  refund policy applies and we have no visibility into the transaction.
                  We will, however, help you draft the refund request to the consulate
                  and follow up alongside you — at no charge.
                </div>
              </details>
              <details>
                <summary>
                  I missed a deadline because of a public holiday in another country. Is
                  that on me?
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
                </summary>
                <div className="answer">
                  No — that{"’"}s on us. Every guaranteed-delivery date already
                  accounts for declared public holidays in the destination country, plus
                  a buffer for embassy processing backlogs. If we got that math wrong, you
                  {"’"}re covered under {"“"}we miss the guaranteed date
                  {"”"} in §03.
                </div>
              </details>
              <details>
                <summary>
                  Can I get the goodwill credit as cash instead?
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
                </summary>
                <div className="answer">
                  Yes. Reply to the decision email with {"“"}convert to cash
                  {"”"} and we{"’"}ll switch it within one business day. We
                  default to credit because 73% of travellers come back within a year,
                  and credit doesn{"’"}t trigger an FX round-trip — but the choice
                  is always yours.
                </div>
              </details>
            </div>
          </section>

          <section id="changelog">
            <div className="section-num">§ 08</div>
            <h2>What changed, and when.</h2>
            <p className="intro">
              Every material change to this policy is logged here. Old versions remain
              accessible — your application is governed by the policy that was live the
              day you paid.
            </p>

            <ul>
              <li>
                <strong>v4.2 · 1 May 2026 —</strong> Late-handling credit raised from 3%
                to 5% per overdue day. Force-majeure window extended from 10 to 14 days.
              </li>
              <li>
                <strong>v4.1 · 12 Feb 2026 —</strong> Lost-document compensation now
                includes passport replacement fees in addition to the service refund.
              </li>
              <li>
                <strong>v4.0 · 4 Nov 2025 —</strong> Goodwill credit on discretionary
                rejections raised from 15% to 25% of service fee.
              </li>
              <li>
                <strong>v3.6 · 30 Jul 2025 —</strong> CASE mediation pathway added as a
                no-cost escalation route.
              </li>
            </ul>

            <div className="final-cta">
              <div>
                <h3>Have an open application that{"’"}s running late?</h3>
                <p>
                  Open a claim from your dashboard. A real consultant will review it
                  within 4 working hours — usually faster.
                </p>
              </div>
              <div className="ctas">
                <button className="btn-white">
                  Open a refund claim
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
                <button className="btn-ghost-w">Talk to a consultant</button>
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
          Last reviewed by VIZA Legal &amp; Customer teams on 1 May 2026 · Next scheduled
          review 1 Aug 2026 · <a href="#">View the audit log</a>
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
            <p className="foot-tag">
              VIZA helps you plan, apply, and track visas seamlessly across the world.
            </p>
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
                <a href="/refunds" className="here">
                  Refunds Policy
                </a>
              </li>
              <li>
                <a href="/status">Status</a>
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
                <a href="#">U.S. Mock Interview</a>
              </li>
              <li>
                <a href="#">Visa Requirements</a>
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
              <li>
                <a href="#">Student Visa</a>
              </li>
            </ul>
          </div>
          <div className="col-offices">
            <h4 className="col-head">Offices</h4>
            <ul className="col-list">
              <li className="office-row">
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
                <span>
                  1 Marina Boulevard, #20-01,
                  <br />
                  Singapore 018989
                </span>
              </li>
              <li className="office-row">
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
                <span>
                  301 Mission Street, San Francisco,
                  <br />
                  CA 94105, USA
                </span>
              </li>
              <li className="office-row">
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
                <span>
                  M16 — Al Makateb Building,
                  <br />
                  Al Quoz 3, Sheikh Zayed Rd, Dubai
                </span>
              </li>
              <li className="office-row">
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
                <span>
                  Suite 203, Davina House,
                  <br />
                  137-149 Goswell Road, London EC1V 7ET
                </span>
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
