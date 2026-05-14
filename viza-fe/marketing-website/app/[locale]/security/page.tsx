"use client";

import { useEffect } from "react";
import SiteNav from "@/components/SiteNav";
import "./security.css";

export default function SecurityPage() {
  useEffect(() => {
    const tabsEl = document.getElementById("navTabs");
    const pill = document.getElementById("navPill") as HTMLElement | null;
    const active = tabsEl?.querySelector(".nav-tab.active");
    if (!active && pill) pill.style.display = "none";
  }, []);

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
              Security at VIZA · last updated May 2026
            </div>
            <h1>Private. Transparent.<br /><em>Secure by default.</em></h1>
            <p className="lead">
              Customers around the world trust us with millions of sensitive documents — passports, bank statements, photos, payment details. Here{"’"}s exactly how we collect them, store them, and prove we{"’"}re doing it right.
            </p>
            <div className="hero-ctas">
              <a className="btn-hero-primary" href="#features">
                How we protect your data
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
              </a>
              <a className="btn-hero-ghost" href="#vdp">Report a vulnerability</a>
            </div>
          </div>

          <div className="clearance-wrap">
            <div className="clearance">
              <div className="corner tl"></div><div className="corner tr"></div>
              <div className="corner bl"></div><div className="corner br"></div>
              <div className="clearance-row">
                <div>
                  <div className="ck">Republic of</div>
                  <div className="cv">VIZA</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="ck">Issuing office</div>
                  <div className="cv">Trust &amp; Safety</div>
                </div>
              </div>
              <h3>Security clearance /<br />Customer data</h3>
              <div className="clearance-grid">
                <div>
                  <div className="ck">Encryption</div>
                  <div className="cv">AES-256 / TLS 1.3</div>
                </div>
                <div>
                  <div className="ck">Region</div>
                  <div className="cv">SG · US · EU</div>
                </div>
                <div>
                  <div className="ck">Audit cadence</div>
                  <div className="cv">Quarterly</div>
                </div>
                <div>
                  <div className="ck">Retention</div>
                  <div className="cv">90 days max</div>
                </div>
              </div>
              <div className="clearance-foot">
                <div>
                  <div className="ck">Reference</div>
                  <div className="cv" style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: "13px" }}>VIZA-SEC-2026</div>
                </div>
                <div className="clearance-glyph">CLEARED<br />VIZA · 26</div>
              </div>
            </div>

            <div className="float-chip float-1">
              <div className="ic">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              </div>
              <div>
                <div className="lab">In transit</div>
                <div>End-to-end TLS 1.3</div>
              </div>
            </div>
            <div className="float-chip float-2">
              <div className="ic">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
              </div>
              <div>
                <div className="lab">At rest</div>
                <div>AES-256, region-pinned</div>
              </div>
            </div>
          </div>
        </div>

        <div className="hero-stats">
          <div className="hstat">
            <div className="v">2.4M<small>+</small></div>
            <div className="k">Documents handled in 2025, zero customer-data breaches</div>
          </div>
          <div className="hstat">
            <div className="v">90<small>d</small></div>
            <div className="k">Maximum retention for source documents after issuance</div>
          </div>
          <div className="hstat">
            <div className="v">4×<small>/yr</small></div>
            <div className="k">External penetration tests, all reports published internally</div>
          </div>
          <div className="hstat">
            <div className="v">&lt;24<small>hr</small></div>
            <div className="k">Median time-to-acknowledge for a reported vulnerability</div>
          </div>
        </div>
      </section>

      {/* ============================= DOCUMENTS ============================= */}
      <section className="docs" id="documents">
        <div className="section">
          <div className="doc-grid">
            <div className="left">
              <div className="sec-eyebrow">What we collect</div>
              <h2 style={{ font: "500 40px/1.05 var(--font-heading)", letterSpacing: "-1.2px", marginBottom: "18px" }}>
                Five document types.<br /><em style={{ fontStyle: "italic", fontWeight: 400, color: "var(--brand-400)" }}>Nothing more.</em>
              </h2>
              <p className="copy">
                A visa application is a paperwork problem. We only collect what an embassy explicitly asks for — and we anonymise wherever possible. Each document is tied to a single application, encrypted on receipt, and purged on a fixed schedule.
              </p>
              <p className="copy">
                We never sell your data. We never share it with third parties beyond the consulate or partner directly involved in your visa.
              </p>
            </div>

            <div className="doc-cards">
              <div className="doc-card">
                <div className="ic">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /><path d="M6 15h4" /></svg>
                </div>
                <div className="name">Payment information<small>tokenised · PCI-DSS</small></div>
                <div className="seal">ENCRYPTED</div>
              </div>
              <div className="doc-card">
                <div className="ic">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></svg>
                </div>
                <div className="name">Visa photos<small>processed · 90d max</small></div>
                <div className="seal">ENCRYPTED</div>
              </div>
              <div className="doc-card">
                <div className="ic">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><path d="M8 13h8" /><path d="M8 17h5" /></svg>
                </div>
                <div className="name">Bank statements<small>masked · pdf only</small></div>
                <div className="seal">ENCRYPTED</div>
              </div>
              <div className="doc-card">
                <div className="ic">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>
                </div>
                <div className="name">Past visas<small>read-only · OCR</small></div>
                <div className="seal">ENCRYPTED</div>
              </div>
              <div className="doc-card">
                <div className="ic">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" /><circle cx="12" cy="10" r="3" /><path d="M7 17c1.5-2 8-2 10 0" /></svg>
                </div>
                <div className="name">Passport<small>MRZ extracted</small></div>
                <div className="seal">ENCRYPTED</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================= FEATURES ============================= */}
      <section className="section" id="features">
        <div className="sec-head">
          <div className="sec-eyebrow">Seven controls, always on</div>
          <h2>How your data stays<br />yours, end to <em>end.</em></h2>
          <p>The default state of every byte at VIZA is {"“"}encrypted, scoped, and time-bounded.{"”"} These are the seven controls that make that the case — not aspirations, but what{"’"}s actually wired into the platform today.</p>
        </div>

        <div className="feat-grid">
          <div className="feat-cell">
            <span className="tag">/minimise</span>
            <h3>Data minimisation &amp; anonymisation</h3>
            <p>We collect only what an embassy or partner actually requires for a given application — and anonymise wherever the rest of the platform allows it. The fields you don{"’"}t see in our forms are fields we don{"’"}t store.</p>
            <div className="why">
              <span className="check"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></span>
              <span><strong>Why:</strong> a breach can{"’"}t reveal data that was never collected.</span>
            </div>
          </div>

          <div className="feat-cell">
            <span className="tag">/payments</span>
            <h3>Secure payments</h3>
            <p>Card data is tokenised through a PCI-DSS Level 1 processor — we never see or store full card numbers. Every transaction goes through 3-D Secure 2.0, multi-factor authentication, and our internal fraud-detection layer.</p>
            <div className="why">
              <span className="check"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></span>
              <span><strong>Why:</strong> a stolen VIZA session cannot complete a payment alone.</span>
            </div>
          </div>

          <div className="feat-cell">
            <span className="tag">/at-rest</span>
            <h3>Encryption at rest</h3>
            <p>Every document, message, and metadata field on VIZA servers is encrypted with AES-256 before it touches disk. Keys are rotated automatically and stored in a hardware-backed KMS that even our infrastructure team can{"’"}t read directly.</p>
            <div className="why">
              <span className="check"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></span>
              <span><strong>Why:</strong> stolen drives or backups remain unreadable without the keys.</span>
            </div>
          </div>

          <div className="feat-cell">
            <span className="tag">/in-transit</span>
            <h3>End-to-end encryption</h3>
            <p>All traffic between your device, our servers, and partner consulates uses TLS 1.3 with strict pinning. Document uploads use a separate, signed channel so that even network-level adversaries can{"’"}t see what you{"’"}re sending.</p>
            <div className="why">
              <span className="check"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></span>
              <span><strong>Why:</strong> hostile networks, including airport Wi-Fi, can{"’"}t read your application.</span>
            </div>
          </div>

          <div className="feat-cell">
            <span className="tag">/audits</span>
            <h3>Regular security audits</h3>
            <p>We run an external penetration test every quarter, an annual SOC 2 Type II audit, and continuous automated vulnerability scanning. Every finding is logged with a fix-by date, and overdue items page the engineering lead.</p>
            <div className="why">
              <span className="check"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></span>
              <span><strong>Why:</strong> threats move; our defences are checked against them on a clock.</span>
            </div>
          </div>

          <div className="feat-cell">
            <span className="tag">/access</span>
            <h3>Secure access controls</h3>
            <p>Internal access to customer data is role-scoped, audited per-request, and granted with just-in-time elevation. Consultants only ever see the application they{"’"}re actively working on. Every read is logged for 12 months.</p>
            <div className="why">
              <span className="check"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></span>
              <span><strong>Why:</strong> insider mistakes &amp; misuse are contained, attributable, and reviewable.</span>
            </div>
          </div>

          <div className="feat-cell" style={{ gridColumn: "1 / -1" }}>
            <span className="tag">/education</span>
            <h3>User education &amp; awareness</h3>
            <p>The hardest part of security is the part we can{"’"}t ship for you. We send plain-English guides on phishing, passport-photo scams, and fake-embassy SMS the moment you start an application — and surface them again inside the product the second something looks off. You{"’"}re the last line of defence; we{"’"}d rather equip you than blame you.</p>
            <div className="why">
              <span className="check"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></span>
              <span><strong>Why:</strong> a well-informed applicant is the cheapest, most effective security control we have.</span>
            </div>
          </div>
        </div>
      </section>

      {/* ============================= VDP ============================= */}
      <section className="section" id="vdp" style={{ paddingTop: 0 }}>
        <div className="vdp">
          <div className="vdp-left">
            <div className="vdp-tag">▲ Vulnerability disclosure · open to all researchers</div>
            <h2>Found something?<br /><em>We want to hear about it.</em></h2>
            <p>The security of our users and partners is everything. If you believe you{"’"}ve identified a genuine vulnerability affecting VIZA services, we{"’"}d like you to tell us about it directly — and we{"’"}ll work with you respectfully and quickly to fix it.</p>
            <p>Email your findings to <strong style={{ color: "#fff" }}>security@viza.com</strong>. We{"’"}ll acknowledge receipt within one business day, even if it turns out to be already-known or out-of-scope.</p>

            <div className="vdp-meta">
              <div className="m">
                <span className="k">Acknowledged in</span>
                <span className="v">&lt; 24 hours</span>
              </div>
              <div className="m">
                <span className="k">Triaged in</span>
                <span className="v">3 business days</span>
              </div>
              <div className="m">
                <span className="k">Languages</span>
                <span className="v">EN · ID · AR</span>
              </div>
              <div className="m">
                <span className="k">PGP key</span>
                <span className="v">0xVIZA · 2026</span>
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <a className="btn-hero-primary" href="mailto:security@viza.com">
                Email security@viza.com
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
              </a>
              <a className="btn-hero-ghost" href="#scope">Read the scope</a>
            </div>
          </div>

          <div className="vdp-right">
            <div className="vdp-terminal">
              <div className="bar">
                <div className="lights"><span></span><span></span><span></span></div>
                <span className="title">draft-report · security@viza.com</span>
              </div>
              <div className="body">
                <div className="ln"><span className="ix">1</span><span className="cm"># vulnerability report</span></div>
                <div className="ln"><span className="ix">2</span><span className="ky">type:</span><span className="vl">&nbsp;authentication-bypass</span></div>
                <div className="ln"><span className="ix">3</span><span className="ky">url:</span><span className="vl">&nbsp;https://viza.com/apply/...</span></div>
                <div className="ln"><span className="ix">4</span><span className="ky">repro:</span><span className="vl">&nbsp;</span><span className="mt">[steps 1–4]</span></div>
                <div className="ln"><span className="ix">5</span><span className="ky">impact:</span><span className="vl">&nbsp;</span><span className="mt">account takeover</span></div>
                <div className="ln"><span className="ix">6</span><span className="ky">poc:</span><span className="vl">&nbsp;screencast.mp4</span></div>
                <div className="ln"><span className="ix">7</span><span className="cm"># ↳ encrypted to 0xVIZA</span></div>
                <div className="ln"><span className="ix">8</span><span className="ky">send</span><span className="cursor"></span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================= INCLUDE / DON'T SEND ============================= */}
      <section className="section" id="report" style={{ paddingTop: 0 }}>
        <div className="sec-head">
          <div className="sec-eyebrow">Reporting a vulnerability</div>
          <h2>What to put in your<br />report — and <em>what not to.</em></h2>
          <p>A good report saves both of us a week. Here{"’"}s the format that gets things triaged fastest, plus the things we{"’"}d really rather not receive in our inbox.</p>
        </div>

        <div className="listpair">
          <div className="listcol pos">
            <h4>
              <span className="pip"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></span>
              Please include
            </h4>
            <div className="sub">Five fields. The clearer they are, the faster we can confirm and fix.</div>
            <ul>
              <li><span className="mk"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></span><span><strong>Type of issue</strong> — e.g. authentication, access control, injection, IDOR, SSRF.</span></li>
              <li><span className="mk"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></span><span><strong>Affected URL, feature, or service</strong> — the exact endpoint, screen, or API route involved.</span></li>
              <li><span className="mk"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></span><span><strong>Clear steps to reproduce</strong> — numbered, in order, against a clean session if possible.</span></li>
              <li><span className="mk"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></span><span><strong>Potential security impact</strong> — what an attacker could do with this, in plain language.</span></li>
              <li><span className="mk"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></span><span><strong>Proof of concept</strong> — screenshots or a short screencast preferred; logs second.</span></li>
            </ul>
          </div>

          <div className="listcol neg">
            <h4>
              <span className="pip"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg></span>
              Please don{"’"}t send
            </h4>
            <div className="sub">These are unsafe, unhelpful, or both — and we{"’"}ll have to delete them on receipt.</div>
            <ul>
              <li><span className="mk"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg></span><span><strong>Passwords or authentication tokens</strong>, yours or anyone else{"’"}s. Show the vector, not the secret.</span></li>
              <li><span className="mk"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg></span><span><strong>Raw malware samples or stealer logs.</strong> Describe what you saw; don{"’"}t attach it.</span></li>
              <li><span className="mk"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg></span><span><strong>Large automated scanner reports</strong> without a hand-picked, demonstrated finding.</span></li>
              <li><span className="mk"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg></span><span><strong>Customer personal data or documents</strong> — even if they were the basis of your finding.</span></li>
              <li><span className="mk"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg></span><span><strong>Recordings of social-engineering attempts</strong> against our staff or consultants.</span></li>
            </ul>
          </div>
        </div>
      </section>

      {/* ============================= SCOPE ============================= */}
      <section className="scope" id="scope">
        <div className="section">
          <div className="sec-head">
            <div className="sec-eyebrow">Program scope</div>
            <h2>What{"’"}s in, what{"’"}s out.</h2>
            <p>If you{"’"}re unsure whether a report falls inside this list, send it anyway — and ask. We{"’"}d rather triage and move on than have you sit on a real issue because the boundary wasn{"’"}t obvious.</p>
          </div>

          <div className="scope-grid">
            <div className="scope-col in">
              <div className="badge-row">
                <span className="pill">In scope</span>
                <span style={{ fontSize: "12px", color: "var(--fg-2)", fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>/security/scope.md · v6</span>
              </div>
              <h3>Reports we{"’"}ll actively triage</h3>
              <ul>
                <li><span className="dot"></span><span>VIZA web applications and APIs at <code>*.viza.com</code> — including the applicant portal, consultant console, and partner endpoints.</span></li>
                <li><span className="dot"></span><span>VIZA-owned infrastructure and services — auth, payments, document pipeline, scheduling.</span></li>
                <li><span className="dot"></span><span>Mobile applications (iOS, Android) published under the VIZA developer account.</span></li>
                <li><span className="dot"></span><span>Public-facing marketing and content sites under VIZA-controlled domains.</span></li>
              </ul>
            </div>
            <div className="scope-col out">
              <div className="badge-row">
                <span className="pill">Out of scope</span>
                <span style={{ fontSize: "12px", color: "var(--fg-2)", fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>/security/scope.md · v6</span>
              </div>
              <h3>Reports we can{"’"}t action under this program</h3>
              <ul>
                <li><span className="dot"></span><span>Issues resulting from compromised user devices, browser extensions, or stolen credentials.</span></li>
                <li><span className="dot"></span><span>Social engineering or phishing attacks targeting VIZA employees, partners, or consultants.</span></li>
                <li><span className="dot"></span><span>Third-party services or integrations not directly operated by VIZA (consulate portals, courier sites).</span></li>
                <li><span className="dot"></span><span>Automated scanner findings without demonstrated, real-world exploitability.</span></li>
                <li><span className="dot"></span><span>Missing security headers or general best-practice recommendations without an exploit path.</span></li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ============================= PLEDGE ============================= */}
      <section className="section" id="pledge">
        <div className="sec-head">
          <div className="sec-eyebrow">Responsible disclosure</div>
          <h2>The deal we make<br />with each other.</h2>
          <p>Disclosure works because both sides act in good faith. Here{"’"}s what we ask of you, and here{"’"}s what you can hold us to in return — written down so nobody has to guess.</p>
        </div>

        <div className="pledge-grid">
          <div className="pledge">
            <div className="kicker">What we ask of you</div>
            <h3>Researcher <em>commitments.</em></h3>
            <p>By submitting a report, you agree to act in good faith and within the spirit of the program — not just the letter of it.</p>
            <ul>
              <li><span className="num">01</span><span>Act in good faith — avoid privacy violations, data destruction, or service disruption while researching.</span></li>
              <li><span className="num">02</span><span>Don{"’"}t exploit an issue beyond the minimum needed to confirm it, and never access data that isn{"’"}t your own.</span></li>
              <li><span className="num">03</span><span>Keep vulnerability details confidential until we{"’"}ve shipped a fix and confirmed it with you.</span></li>
              <li><span className="num">04</span><span>Don{"’"}t publicly disclose findings without prior written consent from VIZA{"’"}s security team.</span></li>
            </ul>
          </div>

          <div className="pledge">
            <div className="kicker">What you can hold us to</div>
            <h3>VIZA <em>commitments.</em></h3>
            <p>In return, we don{"’"}t ghost reporters, we don{"’"}t argue severity to dodge a fix, and we don{"’"}t sue people who help us.</p>
            <ul>
              <li><span className="num">01</span><span>We will review every valid report and respond within one business day, no matter the severity.</span></li>
              <li><span className="num">02</span><span>We will communicate respectfully — no defensive language, no {"“"}working as intended{"”"} hand-waving.</span></li>
              <li><span className="num">03</span><span>We will take appropriate remediation actions where required, and tell you when the fix has shipped.</span></li>
              <li><span className="num">04</span><span>We will credit you (with consent) in our security changelog when the issue is resolved.</span></li>
            </ul>
          </div>
        </div>
      </section>

      {/* ============================= LEGAL STRIP ============================= */}
      <section className="section" id="legal" style={{ paddingTop: 0 }}>
        <div className="sec-head">
          <div className="sec-eyebrow">Legal &amp; rewards</div>
          <h2>Safe harbour, bounties,<br />and the small print.</h2>
          <p>If you follow this policy in good faith, we treat your research as authorised. The rest of the page is the boring-but-important bit — laid out, not hidden.</p>
        </div>

        <div className="legal-strip">
          <div className="legal-card">
            <div className="ic">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 3 7v6c0 5 4 8 9 9 5-1 9-4 9-9V7l-9-5z" /></svg>
            </div>
            <h4>Legal safe harbour</h4>
            <p>If you follow this policy in good faith, VIZA will not initiate legal action against you for accidental or unintentional violations related to your research. You{"’"}re still expected to comply with applicable laws and regulations.</p>
            <span className="meta">/security/safe-harbor.md</span>
          </div>

          <div className="legal-card">
            <div className="ic">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6" /><path d="m8.5 14-1 7 4.5-3 4.5 3-1-7" /></svg>
            </div>
            <h4>Rewards &amp; bug bounty</h4>
            <p>VIZA does not currently run a public bug bounty. We do offer a discretionary token of appreciation for valid, responsibly reported issues — evaluated on impact, novelty, and the quality of the report.</p>
            <span className="meta">discretionary · case by case</span>
          </div>

          <div className="legal-card">
            <div className="ic">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><path d="M9 13h6M9 17h4" /></svg>
            </div>
            <h4>Program updates</h4>
            <p>VIZA reserves the right to modify or terminate this program at any time. If you are unsure whether your research aligns with the policy, please contact us at security@viza.com <em>before</em> you proceed.</p>
            <span className="meta">last revised · May 2026</span>
          </div>
        </div>
      </section>

      {/* ============================= CTA STRIP ============================= */}
      <div className="cta-strip">
        <div>
          <h2>See something off?<br />Tell our security team.</h2>
          <p>We{"’"}d rather hear about a small finding twice than miss a big one once. Reports go straight to a real human on the security team — no ticketing portal, no triage robot.</p>
        </div>
        <div className="right">
          <span className="lead">Direct to security</span>
          <a className="mail" href="mailto:security@viza.com">
            <span className="ic">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
            </span>
            security@viza.com
          </a>
          <small>Median response — under 24 hours, every day of the week.</small>
        </div>
      </div>

      {/* ============================= FOOTER ============================= */}
      <footer className="site-foot" data-screen-label="Footer">
        <div className="foot-rule"></div>
        <div className="foot-main">
          <div className="foot-brand">
            <a className="foot-logo" href="/"><img src="/assets/viza-logo-black.svg" alt="VIZA" /></a>
            <p className="foot-tag">VIZA helps you plan, apply, and track visas seamlessly across the world.</p>
          </div>
          <div className="col-company">
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
          <div className="col-products">
            <h4 className="col-head">Products</h4>
            <ul className="col-list">
              <li><a href="/">Visa Requirements</a></li>
              <li><a href="#">Schengen Appointment Checker</a></li>
              <li><a href="#">Visa Photo Creator</a></li>
              <li><a href="#">VIZA Emergency Helpline</a></li>
              <li><a href="#">Student Visa</a></li>
            </ul>
          </div>
          <div className="col-offices">
            <h4 className="col-head">Offices</h4>
            <ul className="col-list">
              <li><a href="#">Singapore — HQ</a></li>
              <li><a href="#">San Francisco</a></li>
              <li><a href="#">Dubai</a></li>
              <li><a href="#">London</a></li>
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
