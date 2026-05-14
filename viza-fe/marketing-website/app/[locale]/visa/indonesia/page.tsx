"use client";

import { useEffect } from "react";
import { CircleFlag } from "react-circle-flags";
import SiteNav from "@/components/SiteNav";
import "./visa-indonesia.css";

export default function VisaIndonesiaPage() {
  useEffect(() => {
    const tabsEl = document.getElementById("navTabs");
    const pill = document.getElementById("navPill");
    if (!tabsEl || !pill) return;

    function movePill(t: Element) {
      if (!tabsEl || !pill) return;
      const r = (t as HTMLElement).getBoundingClientRect();
      const pr = tabsEl.getBoundingClientRect();
      (pill as HTMLElement).style.left = r.left - pr.left + "px";
      (pill as HTMLElement).style.width = r.width + "px";
    }

    const navTabHandlers: Array<{ el: Element; handler: () => void }> = [];
    tabsEl.querySelectorAll(".nav-tab").forEach((b) => {
      const handler = () => {
        tabsEl.querySelectorAll(".nav-tab").forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        movePill(b);
      };
      b.addEventListener("click", handler);
      navTabHandlers.push({ el: b, handler });
    });

    const initial = tabsEl.querySelector(".nav-tab.active");
    if (initial) requestAnimationFrame(() => movePill(initial));

    const onResize = () => {
      const active = tabsEl.querySelector(".nav-tab.active");
      if (active) movePill(active);
    };
    window.addEventListener("resize", onResize);

    const sectionTabs = document.querySelectorAll<HTMLButtonElement>(".section-tab");
    const sectionTabHandlers: Array<{ el: Element; handler: () => void }> = [];
    sectionTabs.forEach((t) => {
      const handler = () => {
        const target = document.getElementById(t.dataset.target || "");
        if (!target) return;
        window.scrollTo({ top: target.offsetTop - 140, behavior: "smooth" });
      };
      t.addEventListener("click", handler);
      sectionTabHandlers.push({ el: t, handler });
    });

    const sections = [...sectionTabs]
      .map((t) => document.getElementById(t.dataset.target || ""))
      .filter((s): s is HTMLElement => Boolean(s));

    function onScroll() {
      const y = window.scrollY + 200;
      let activeIdx = 0;
      sections.forEach((s, i) => {
        if (s.offsetTop <= y) activeIdx = i;
      });
      sectionTabs.forEach((t, i) => t.classList.toggle("active", i === activeIdx));
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      navTabHandlers.forEach(({ el, handler }) => el.removeEventListener("click", handler));
      sectionTabHandlers.forEach(({ el, handler }) => el.removeEventListener("click", handler));
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <>
      {/* Top nav */}
      <SiteNav />

      {/* Hero */}
      <header className="hero">
        <div className="hero-inner">
          <div>
            <a href="/" className="hero-back">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              Back to explore
            </a>
            <div className="hero-flag"><CircleFlag countryCode="id" height={56}/></div>
            <h1>Indonesia (Bali) e-VOA<br/>for Singapore passports</h1>
            <p className="lede">A single-entry electronic Visa on Arrival, valid 90 days from issue with a 30-day stay. Filed and tracked end-to-end by your VIZA consultant.</p>

            <div className="hero-meta">
              <div className="m"><div className="k">Type</div><div className="v">e-VOA</div></div>
              <div className="m"><div className="k">Length of stay</div><div className="v">30 days</div></div>
              <div className="m"><div className="k">Validity</div><div className="v">90 days</div></div>
              <div className="m"><div className="k">Entry</div><div className="v">Single</div></div>
            </div>

            <div className="hero-tags">
              <span className="hero-tag">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                Fast track · in 24 hrs
              </span>
              <span className="hero-tag">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
                On-time guarantee
              </span>
              <span className="hero-tag">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                Minimal documents
              </span>
            </div>
          </div>

          {/* Sticky pricing card */}
          <aside className="price-card">
            <div className="price-eta">
              <div className="ico">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              </div>
              <div className="text">
                <span className="lab">Guaranteed by</span>
                <span className="val">9 May 2026, 03:03 PM</span>
              </div>
            </div>

            <div className="price-head">
              <h3>e-VOA · 30-day stay</h3>
              <span className="saving">21 hrs faster</span>
            </div>
            <p className="price-sub">All-inclusive of government fee, document review, and on-time guarantee.</p>

            <div className="price-rows">
              <div className="price-row">
                <span className="lk">Government fee <span className="pill">Pay now</span></span>
                <span className="vk">SGD 40</span>
              </div>
              <div className="price-row">
                <span className="lk">VIZA processing <span className="pill later">On approval</span></span>
                <span className="vk">SGD 79</span>
              </div>
              <div className="price-total">
                <span className="lk">Total</span>
                <span className="vk">SGD 119</span>
              </div>
            </div>

            <a href="/apply" className="price-cta" style={{ textDecoration: 'none' }}>
              Start application
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </a>
            <div className="price-foot">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
              Money-back guarantee if your visa is delayed past the promised date.
            </div>
          </aside>
        </div>
      </header>

      {/* Section tabs */}
      <div className="section-tabs-wrap">
        <div className="section-tabs" id="sectionTabs">
          <button className="section-tab active" data-target="overview">Overview</button>
          <button className="section-tab" data-target="process">Application process</button>
          <button className="section-tab" data-target="docs">Documents</button>
          <button className="section-tab" data-target="rejection">Rejection reasons</button>
          <button className="section-tab" data-target="entry">Entry &amp; exit</button>
          <button className="section-tab" data-target="extension">Extension</button>
          <button className="section-tab" data-target="reviews">Reviews</button>
          <button className="section-tab" data-target="nearby">Nearby countries</button>
          <button className="section-tab" data-target="faq">FAQ</button>
        </div>
      </div>

      {/* Page */}
      <main className="page">
        <div className="col-main">

          {/* Overview */}
          <section className="block" id="overview">
            <h2>Indonesia, at a glance</h2>
            <p className="block-sub">An e-VOA lets Singapore passport holders enter Indonesia for tourism, family visits, business meetings, or medical care.</p>
            <div className="glance">
              <div className="g">
                <div className="ico"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 0 20"/><path d="M12 2a15 15 0 0 0 0 20"/></svg></div>
                <div className="k">Capital</div><div className="v">Jakarta</div>
                <div className="sub">UTC +7 (Western Indonesia)</div>
              </div>
              <div className="g">
                <div className="ico"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></div>
                <div className="k">Best time to visit</div><div className="v">Apr – Oct</div>
                <div className="sub">Dry season · 27 – 32°C</div>
              </div>
              <div className="g">
                <div className="ico"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M2 12h20"/></svg></div>
                <div className="k">Currency</div><div className="v">Indonesian Rupiah</div>
                <div className="sub">SGD 1 ≈ IDR 12,250</div>
              </div>
              <div className="g">
                <div className="ico"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></div>
                <div className="k">Top destinations</div><div className="v">Bali · Jakarta · Lombok</div>
                <div className="sub">Plus Yogyakarta, Mt. Bromo, Nusa Penida</div>
              </div>
            </div>
          </section>

          {/* Process */}
          <section className="block" id="process">
            <h2>How the e-VOA process works</h2>
            <p className="block-sub">Submit once. We handle every step with Indonesian Immigration and notify you the moment your visa is ready.</p>
            <div className="steps">

              <div className="step">
                <div className="num">1</div>
                <div>
                  <h3>Apply on VIZA</h3>
                  <p>Upload your passport, a recent photo, and your travel dates. Pay only the government fee upfront — VIZA{'’'}s processing fee is charged on approval.</p>
                </div>
              </div>

              <div className="step">
                <div className="num">2</div>
                <div>
                  <h3>Your documents are verified</h3>
                  <p>Your VIZA consultant cross-checks every field, then submits the application directly to Indonesian Immigration.</p>
                </div>
              </div>

              <div className="step">
                <div className="num">3</div>
                <div>
                  <h3>Your e-VOA gets processed</h3>
                  <p>We track each handoff inside Immigration so we can flag delays before they affect your trip.</p>
                  <div className="step-status">
                    <div className="row">
                      <span className="dot"></span>
                      Application sent to Immigration supervisor
                      <span className="ts">8 May, 5:45 AM</span>
                      <span className="ontime">On time</span>
                    </div>
                    <div className="row">
                      <span className="dot"></span>
                      Forwarded to internal intelligence
                      <span className="ts">8 May, 8:12 AM</span>
                      <span className="ontime">On time</span>
                    </div>
                    <div className="row">
                      <span className="dot"></span>
                      Awaiting final approval
                      <span className="ts">In progress</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="step delivered">
                <div className="num">4</div>
                <div>
                  <h3>Get your e-VOA on 9 May, 3:03 PM</h3>
                  <p>The PDF arrives in your inbox and your VIZA app. Print it, or save it to your wallet for the entry kiosk.</p>
                </div>
              </div>

            </div>
          </section>

          {/* Documents */}
          <section className="block" id="docs">
            <h2>Required documents</h2>
            <p className="block-sub">Your VIZA consultant double-checks each document before submission. Re-uploads are unlimited and free.</p>
            <div className="docs">
              <div className="doc">
                <div className="ico"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
                <div>
                  <div className="nm">Passport bio page</div>
                  <div className="sub">Valid for 6+ months · clear scan</div>
                </div>
                <svg className="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
              <div className="doc">
                <div className="ico"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M2 20a10 10 0 0 1 20 0"/></svg></div>
                <div>
                  <div className="nm">Recent photograph</div>
                  <div className="sub">Plain background · last 6 months</div>
                </div>
                <svg className="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
              <div className="doc">
                <div className="ico"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 8a5 5 0 0 1-10 0M3 22h18"/><path d="M5 8a7 7 0 0 1 14 0v6H5z"/></svg></div>
                <div>
                  <div className="nm">Return flight ticket</div>
                  <div className="sub">Departure within 30 days</div>
                </div>
                <svg className="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
              <div className="doc">
                <div className="ico"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7h18M5 7v13a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7"/><path d="M9 4h6v3H9z"/></svg></div>
                <div>
                  <div className="nm">Hotel or accommodation proof</div>
                  <div className="sub">Booking confirmation · any platform</div>
                </div>
                <svg className="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            </div>
          </section>

          {/* Rejection reasons */}
          <section className="block" id="rejection">
            <h2>Why e-VOAs get rejected</h2>
            <p className="block-sub">Indonesian Immigration may refuse an application for any of the following. VIZA flags these before you submit.</p>
            <div className="reasons">
              <div className="reason">
                <div className="ico">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                </div>
                <h4>Expired passport</h4>
                <p>Applying with a passport that has expired or expires within 6 months of arrival.</p>
              </div>
              <div className="reason">
                <div className="ico">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                </div>
                <h4>Criminal record</h4>
                <p>Convictions or open cases that disqualify you from a tourist visa under Indonesian law.</p>
              </div>
              <div className="reason">
                <div className="ico">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
                <h4>Previous violations</h4>
                <p>Overstaying or breaching the terms of a prior Indonesian visa within the last 5 years.</p>
              </div>
            </div>
          </section>

          {/* Entry / exit */}
          <section className="block" id="entry">
            <h2>Entry &amp; exit regulations</h2>
            <p className="block-sub">Carry your e-VOA PDF, a valid return ticket, and proof of accommodation. The visa permits a single entry and a 30-day stay from your arrival date.</p>
            <div className="glance">
              <div className="g">
                <div className="ico"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg></div>
                <div className="k">Entry</div><div className="v">Single</div>
                <div className="sub">Re-entry needs a fresh visa</div>
              </div>
              <div className="g">
                <div className="ico"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></div>
                <div className="k">Activate within</div><div className="v">90 days</div>
                <div className="sub">From the issue date</div>
              </div>
            </div>
          </section>

          {/* Extension */}
          <section className="block" id="extension">
            <h2>Visa extension &amp; overstays</h2>
            <p className="block-sub">An e-VOA can be extended once for an additional 30 days at any Immigration office in Indonesia. Overstays incur a daily fine and can affect future applications.</p>
            <div className="glance">
              <div className="g">
                <div className="ico"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div>
                <div className="k">Extension</div><div className="v">+30 days</div>
                <div className="sub">One-time, in-country</div>
              </div>
              <div className="g">
                <div className="ico"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
                <div className="k">Overstay fine</div><div className="v">IDR 1,000,000 / day</div>
                <div className="sub">≈ SGD 82 per day late</div>
              </div>
            </div>
          </section>

          {/* Reviews */}
          <section className="block" id="reviews">
            <h2>Reviews</h2>
            <div className="reviews-head">
              <div>
                <div className="score">4.5 <small>/ 5</small></div>
                <div className="stars">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/></svg>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/></svg>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/></svg>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/></svg>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/></svg>
                </div>
                <div className="score-sub">Highest rated visa platform in Singapore · 12,841 reviews</div>
              </div>
              <div className="platforms">
                <span className="platform-pill"><span className="star">★</span> 4.6 Trustpilot</span>
                <span className="platform-pill"><span className="star">★</span> 4.7 App Store</span>
              </div>
            </div>

            <div className="reviews">
              <div className="review">
                <div className="top">
                  <div className="av">PL</div>
                  <div className="meta">
                    <div className="nm">Priya Lim</div>
                    <div className="src">Trustpilot · 3 days ago</div>
                  </div>
                </div>
                <h4>Bali e-VOA in under a day</h4>
                <p>Submitted at 11pm, woke up to my visa PDF the next morning. The status updates inside the app made the whole thing feel transparent.</p>
              </div>
              <div className="review">
                <div className="top">
                  <div className="av">SK</div>
                  <div className="meta">
                    <div className="nm">Samuel Koh</div>
                    <div className="src">App Store · 1 week ago</div>
                  </div>
                </div>
                <h4>Saved me from a refused photo</h4>
                <p>The consultant flagged that my photo background was off and re-uploaded one for me. Wouldn{'’'}t have caught that if I filed direct.</p>
              </div>
            </div>
          </section>

          {/* Nearby */}
          <section className="block" id="nearby">
            <h2>Nearby countries</h2>
            <p className="block-sub">Travelling the region? Add another visa to your trip — your VIZA consultant batches them.</p>
            <div className="nearby">
              <a className="near" href="#">
                <div className="img" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1528181304800-259b08848526?w=600&auto=format&fit=crop&q=70')" }}></div>
                <div className="body"><div><div className="nm">Thailand</div><div className="eta">eVOA · in 24 hrs</div></div><span className="arrow"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span></div>
              </a>
              <a className="near" href="#">
                <div className="img" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1596422846543-75c6fc197f07?w=600&auto=format&fit=crop&q=70')" }}></div>
                <div className="body"><div><div className="nm">Malaysia</div><div className="eta">e-Visa · in 6 hrs</div></div><span className="arrow"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span></div>
              </a>
              <a className="near" href="#">
                <div className="img" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1528127269322-539801943592?w=600&auto=format&fit=crop&q=70')" }}></div>
                <div className="body"><div><div className="nm">Vietnam</div><div className="eta">e-Visa · in 3 days</div></div><span className="arrow"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span></div>
              </a>
              <a className="near" href="#">
                <div className="img" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1492571350019-22de08371fd3?w=600&auto=format&fit=crop&q=70')" }}></div>
                <div className="body"><div><div className="nm">Japan</div><div className="eta">Standard · in 9 days</div></div><span className="arrow"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span></div>
              </a>
            </div>
          </section>

          {/* FAQ */}
          <section className="block" id="faq">
            <h2>Frequently asked questions</h2>
            <p className="block-sub">Can{'’'}t find an answer? Ask the AI assistant at the bottom of this page or message your VIZA consultant.</p>
            <div className="faq">

              <div className="faq-cat">General information</div>
              <details className="q" open>
                <summary>What is an Indonesian e-VOA?<span className="plus"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></span></summary>
                <div className="a">An electronic Visa on Arrival is a 30-day, single-entry tourist visa issued by Indonesian Immigration before your trip. It replaces the paper VOA you used to get at the airport — you arrive with your visa already on file.</div>
              </details>
              <details className="q">
                <summary>Can I use the e-VOA for business meetings?<span className="plus"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></span></summary>
                <div className="a">Yes — the e-VOA covers tourism, family visits, transit, and short business meetings. For paid work or longer assignments, you{'’'}ll need a separate work visa.</div>
              </details>

              <div className="faq-cat">Application process</div>
              <details className="q">
                <summary>How long does VIZA take to process an e-VOA?<span className="plus"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></span></summary>
                <div className="a">Most e-VOAs are delivered within 24 hours. Filing direct with Immigration typically takes 2 – 3 days. We back the timeline with an on-time guarantee — your money back if we{'’'}re late.</div>
              </details>
              <details className="q">
                <summary>Can I apply for my whole family in one application?<span className="plus"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></span></summary>
                <div className="a">Yes. Add each traveller in the application — your consultant submits them together so they{'’'}re approved on the same timeline.</div>
              </details>

              <div className="faq-cat">Refunds, rejections &amp; reapplications</div>
              <details className="q">
                <summary>What happens if my e-VOA is rejected?<span className="plus"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></span></summary>
                <div className="a">Indonesian Immigration retains the government fee. VIZA{'’'}s processing fee is fully refunded, and your consultant will help you understand the rejection notice and reapply once eligible.</div>
              </details>

            </div>

            <div className="editorial">
              <div className="ico">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
              </div>
              <p>This page follows VIZA{'’'}s editorial policy. We rely on official government sources and update each requirement when policy changes. <a href="#">Read how we review</a>.</p>
            </div>
          </section>

          {/* Sources */}
          <section className="block" id="sources">
            <h2>Sources</h2>
            <div className="sources">
              <a className="source" href="https://evisa.imigrasi.go.id/" target="_blank" rel="noreferrer">
                <span className="ico"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></span>
                <span className="lk">Indonesia Official e-Visa portal</span>
                <span className="url">evisa.imigrasi.go.id</span>
              </a>
              <a className="source" href="https://www.imigrasi.go.id/" target="_blank" rel="noreferrer">
                <span className="ico"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></span>
                <span className="lk">Directorate General of Immigration, Indonesia</span>
                <span className="url">imigrasi.go.id</span>
              </a>
              <a className="source" href="https://kemlu.go.id/" target="_blank" rel="noreferrer">
                <span className="ico"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></span>
                <span className="lk">Ministry of Foreign Affairs, Indonesia</span>
                <span className="url">kemlu.go.id</span>
              </a>
            </div>
          </section>

        </div>

        <aside className="col-side">
          <div className="price-card">
            <div className="price-eta">
              <div className="ico">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              </div>
              <div className="text">
                <span className="lab">Apply now, get it by</span>
                <span className="val">9 May 2026, 03:03 PM</span>
              </div>
            </div>

            <div className="price-head">
              <h3>e-VOA · 30-day stay</h3>
            </div>
            <p className="price-sub">Indonesian Immigration · single entry · 90-day validity.</p>

            <div className="price-rows">
              <div className="price-row">
                <span className="lk">Government fee</span>
                <span className="vk">SGD 40</span>
              </div>
              <div className="price-row">
                <span className="lk">VIZA processing</span>
                <span className="vk">SGD 79</span>
              </div>
              <div className="price-total">
                <span className="lk">Total</span>
                <span className="vk">SGD 119</span>
              </div>
            </div>

            <a href="/apply" className="price-cta" style={{ textDecoration: 'none' }}>
              Start application
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </a>
            <div className="price-foot">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
              Pay only the government fee now. VIZA{'’'}s processing fee is charged only on approval.
            </div>
          </div>
        </aside>
      </main>

      {/* AI bar */}
      <div className="ai-bar">
        <div className="spark">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 14.39 8.84 22 9.27 16.5 14.5 17.62 22 12 18.27 6.38 22 7.5 14.5 2 9.27 9.61 8.84z"/></svg>
        </div>
        <input placeholder="Ask anything about Indonesia visas — fees, processing, documents…"/>
        <button className="send" aria-label="Ask">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>

      {/* =====================  Site footer  ===================== */}
      <footer className="site-foot" data-screen-label="Footer">
        <div className="foot-rule"></div>

        <div className="foot-main">
          <div className="foot-brand">
            <a className="foot-logo" href="/"><img src="/assets/viza-logo-black.svg" alt="VIZA"/></a>
            <p className="foot-tag">VIZA helps you plan, apply, and track visas seamlessly across the world.</p>

            <div className="ask-ai">Ask AI about VIZA</div>
            <div className="ai-chips">
              <button className="ai-chip c1" title="Ask in your AI assistant">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
              </button>
              <button className="ai-chip c2" title="Ask in your AI assistant">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="M11 8v6"/><path d="M8 11h6"/></svg>
              </button>
              <button className="ai-chip c3" title="Ask in your AI assistant">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 13.8 8.4 20 10.5 13.8 12.6 12 19 10.2 12.6 4 10.5 10.2 8.4 12 2Z"/></svg>
              </button>
              <button className="ai-chip c4" title="Ask in your AI assistant">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/></svg>
              </button>
            </div>
          </div>

          <div className="col-company">
            <h4 className="col-head">Company</h4>
            <ul className="col-list">
              <li><a href="/careers">Careers</a></li>
              <li><a href="/contact">Contact</a></li>
              <li><a href="/security">Security</a></li>
              <li><a href="/refunds">Refunds Policy</a></li>
              <li><a href="/status">Status</a></li>
              <li><a href="/legal/privacy">Privacy</a></li>
              <li><a href="/legal/terms">Terms</a></li>
            </ul>
          </div>

          <div className="col-products">
            <h4 className="col-head">Products</h4>
            <ul className="col-list">
              <li><a href="#">U.S. Mock Interview</a></li>
              <li><a href="#">Visa Requirements</a></li>
              <li><a href="#">Schengen Appointment Checker</a></li>
              <li><a href="#">Visa Photo Creator</a></li>
              <li><a href="#">VIZA Emergency Helpline</a></li>
              <li><a href="#">Student Visa</a></li>
            </ul>
          </div>

          <div className="col-offices">
            <h4 className="col-head">Offices</h4>
            <ul className="col-list">
              <li className="office-row">
                <svg className="office-pin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                <span>1 Marina Boulevard, #20-01,<br/>Singapore 018989</span>
              </li>
              <li className="office-row">
                <svg className="office-pin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                <span>301 Mission Street, San Francisco,<br/>CA 94105, USA</span>
              </li>
              <li className="office-row">
                <svg className="office-pin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                <span>M16 — Al Makateb Building,<br/>Al Quoz 3, Sheikh Zayed Rd, Dubai</span>
              </li>
              <li className="office-row">
                <svg className="office-pin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                <span>Suite 203, Davina House,<br/>137-149 Goswell Road, London EC1V 7ET</span>
              </li>
            </ul>
          </div>

          <div className="foot-apps">
            <a className="app-btn" href="#" aria-label="Download VIZA on the App Store">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 12.04c-.03-2.93 2.39-4.34 2.5-4.41-1.36-1.99-3.48-2.26-4.24-2.29-1.81-.18-3.53 1.06-4.45 1.06-.93 0-2.34-1.04-3.85-1.01-1.98.03-3.81 1.15-4.83 2.91-2.06 3.58-.53 8.86 1.48 11.77.98 1.42 2.15 3.02 3.68 2.96 1.48-.06 2.04-.96 3.83-.96 1.78 0 2.29.96 3.85.93 1.59-.03 2.6-1.45 3.57-2.88 1.13-1.65 1.59-3.25 1.61-3.34-.04-.02-3.08-1.18-3.11-4.69zM14.07 3.62c.81-.99 1.36-2.36 1.21-3.72-1.17.05-2.59.78-3.43 1.76-.75.87-1.41 2.27-1.23 3.6 1.31.1 2.65-.66 3.45-1.64z"/></svg>
              <span className="ab-text">
                <span className="ab-pre">Download on the</span>
                <span className="ab-name">App Store</span>
              </span>
            </a>
            <a className="app-btn" href="#" aria-label="Get VIZA on Google Play">
              <svg width="20" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 2 21 12 3 22 3 2" fill="currentColor"/><line x1="3" y1="2" x2="14" y2="13" stroke="#03110A"/><line x1="3" y1="22" x2="14" y2="11" stroke="#03110A"/></svg>
              <span className="ab-text">
                <span className="ab-pre">Get it on</span>
                <span className="ab-name">Google Play</span>
              </span>
            </a>
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
            <img src="/assets/viza-logo-black.svg" alt="VIZA"/>
          </div>
        </div>
      </footer>
    </>
  );
}
