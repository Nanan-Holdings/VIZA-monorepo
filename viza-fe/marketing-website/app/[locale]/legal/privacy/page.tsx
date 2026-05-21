"use client";

import SiteNav from "@/components/SiteNav";
import "../legal.css";

export default function PrivacyPage() {
  return (
    <div className="legal-page">
      <SiteNav />

      <header className="legal-hero">
        <div className="legal-eyebrow">Legal · Privacy</div>
        <h1>Privacy policy</h1>
        <p className="lede">
          What we collect when you apply for a visa with VIZA, why we need it,
          who sees it, and how long we keep it. Plain language. No dark patterns.
        </p>
        <div className="legal-meta">
          <span><b>Effective:</b> 1 May 2026</span>
          <span className="sep" />
          <span><b>Version:</b> 4.2</span>
          <span className="sep" />
          <span><b>Data controller:</b> VIZA Pte. Ltd. (Singapore)</span>
        </div>
      </header>

      <div className="legal-body">
        <aside className="legal-toc">
          <h4>On this page</h4>
          <a href="#scope">01 · Scope</a>
          <a href="#data-we-collect">02 · Data we collect</a>
          <a href="#why">03 · Why we collect it</a>
          <a href="#sharing">04 · Who we share with</a>
          <a href="#retention">05 · How long we keep it</a>
          <a href="#your-rights">06 · Your rights</a>
          <a href="#security">07 · Security</a>
          <a href="#international">08 · International transfers</a>
          <a href="#cookies">09 · Cookies &amp; analytics</a>
          <a href="#children">10 · Children</a>
          <a href="#changes">11 · Changes</a>
          <a href="#contact">12 · Contact us</a>
        </aside>

        <main className="legal-content">
          <section id="scope" className="legal-section">
            <span className="section-num">§ 01</span>
            <h2>Scope</h2>
            <p>
              This policy applies to everything you do on viza.com, the VIZA
              client portal, our mobile apps, and any communication with our
              consultants by email, WhatsApp, WeChat, or phone. It covers
              visa applicants, dependants on a joint application, and people
              who simply browse without signing up.
            </p>
            <p>
              <strong>Where we act as a controller:</strong> when you apply for
              a visa through us, sign up for an account, or contact our team.
              <strong> Where we act as a processor:</strong> when an enterprise
              partner enrolls their staff onto VIZA — that partner is the
              controller, and this policy operates alongside their own.
            </p>
          </section>

          <section id="data-we-collect" className="legal-section">
            <span className="section-num">§ 02</span>
            <h2>Data we collect</h2>
            <p>
              The minimum needed to file a visa correctly. Government portals
              dictate most of the fields; we never ask for more than the form
              requires.
            </p>
            <h3>From you, directly</h3>
            <ul>
              <li><strong>Identity:</strong> full legal name, date of birth, nationality, place of birth, passport number, expiry, and machine-readable passport image.</li>
              <li><strong>Contact:</strong> email, phone number, mailing address.</li>
              <li><strong>Travel:</strong> destination, dates, purpose of visit, accommodation, and onward itinerary where required.</li>
              <li><strong>Supporting documents:</strong> photographs, employment letters, bank statements, invitation letters — whatever the destination embassy asks for.</li>
              <li><strong>Payment:</strong> card or bank details processed by our payment provider; we never store full card numbers ourselves.</li>
            </ul>
            <h3>Automatically</h3>
            <ul>
              <li>Device, browser, IP address, and basic usage events (pages viewed, time on task) for security and product analytics.</li>
              <li>Cookies and similar technologies — see §09.</li>
            </ul>
            <h3>From third parties</h3>
            <ul>
              <li>Government visa portals (status updates, decision letters, reference numbers).</li>
              <li>Identity verification partners (when an embassy requires biometric or liveness checks).</li>
              <li>Enterprise partners who enroll you on a corporate plan.</li>
            </ul>
          </section>

          <section id="why" className="legal-section">
            <span className="section-num">§ 03</span>
            <h2>Why we collect it</h2>
            <p>Each piece of data has a defined lawful basis and a defined purpose.</p>
            <ul>
              <li><strong>Contract.</strong> We need your passport, travel details, and supporting documents to actually file your visa application — that is the service you are buying.</li>
              <li><strong>Legal obligation.</strong> Anti-fraud, anti-money-laundering, and government record-keeping rules require us to retain certain data for fixed periods.</li>
              <li><strong>Legitimate interest.</strong> Account security, abuse detection, internal analytics aggregated across users, and improving our document checks.</li>
              <li><strong>Consent.</strong> Marketing emails, optional add-ons (eSIM, travel insurance), and any data collection beyond what the visa filing requires.</li>
            </ul>
            <div className="legal-callout">
              <p>We never sell personal data, never share it with advertisers, and never use the contents of your application to train any model — ours or a third party{'’'}s.</p>
            </div>
          </section>

          <section id="sharing" className="legal-section">
            <span className="section-num">§ 04</span>
            <h2>Who we share with</h2>
            <p>The minimum set of recipients needed to deliver the visa.</p>
            <ul>
              <li><strong>The destination government.</strong> Your application is, by definition, submitted to them. The fields they receive are exactly what their portal requires.</li>
              <li><strong>Identity verification.</strong> Where required, we use a regulated KYC provider; their use of the data is restricted to the verification check.</li>
              <li><strong>Payment processing.</strong> Our payment service provider sees the card details needed to charge you, and a non-identifying transaction reference.</li>
              <li><strong>Infrastructure.</strong> Cloud hosting, storage, and email delivery providers operating under written data-processing agreements.</li>
              <li><strong>Legal.</strong> Where compelled by law, court order, or to defend a claim.</li>
            </ul>
            <p>
              A current sub-processor list is maintained on our trust page and
              we notify enterprise customers in writing before adding any new
              processor.
            </p>
          </section>

          <section id="retention" className="legal-section">
            <span className="section-num">§ 05</span>
            <h2>How long we keep it</h2>
            <p>Retention is keyed to the purpose, not the calendar.</p>
            <ul>
              <li><strong>Active applications</strong> — kept while the visa is being processed and for 30 days after issuance so you can download decisions.</li>
              <li><strong>Order &amp; payment records</strong> — 7 years to satisfy tax and finance regulations in Singapore.</li>
              <li><strong>Account profile</strong> — kept for as long as your account is open. Closing your account triggers deletion within 60 days, except where law requires longer retention.</li>
              <li><strong>Marketing data</strong> — purged within 30 days of unsubscribing.</li>
              <li><strong>Logs</strong> — security event logs retained for 12 months.</li>
            </ul>
          </section>

          <section id="your-rights" className="legal-section">
            <span className="section-num">§ 06</span>
            <h2>Your rights</h2>
            <p>
              Depending on where you live, you have some or all of the
              following rights. We honor them globally regardless of
              jurisdiction unless prevented by law.
            </p>
            <ul>
              <li><strong>Access</strong> — get a copy of the personal data we hold about you.</li>
              <li><strong>Rectification</strong> — correct anything inaccurate.</li>
              <li><strong>Erasure</strong> — request deletion (subject to retention rules above).</li>
              <li><strong>Portability</strong> — receive your data in a machine-readable format.</li>
              <li><strong>Restriction &amp; objection</strong> — limit or stop certain processing.</li>
              <li><strong>Withdraw consent</strong> — at any time, where processing is consent-based.</li>
              <li><strong>Lodge a complaint</strong> — with the Singapore PDPC, your local supervisory authority, or any data protection regulator with jurisdiction.</li>
            </ul>
            <p>
              Requests are answered within 30 days. Email{' '}
              <a href="mailto:privacy@viza.com">privacy@viza.com</a> or use
              the in-portal request form.
            </p>
          </section>

          <section id="security" className="legal-section">
            <span className="section-num">§ 07</span>
            <h2>Security</h2>
            <p>
              All applicant data is encrypted in transit (TLS 1.3) and at rest
              (AES-256). Production access is gated by hardware security keys
              with full audit logging. We run quarterly penetration tests and
              maintain a vulnerability disclosure program; details are on our
              <a href="/security"> security page</a>.
            </p>
          </section>

          <section id="international" className="legal-section">
            <span className="section-num">§ 08</span>
            <h2>International transfers</h2>
            <p>
              VIZA stores customer data on infrastructure located in
              Singapore, the European Union, and the United States. Where data
              must cross borders — for example, to file a visa with a
              destination government — we rely on appropriate safeguards:
              Standard Contractual Clauses, the EU{'–'}US Data Privacy
              Framework, and the destination country{'’'}s own visa
              processing rules. By submitting an application, you understand
              that the destination government will receive the application
              under its national laws.
            </p>
          </section>

          <section id="cookies" className="legal-section">
            <span className="section-num">§ 09</span>
            <h2>Cookies and analytics</h2>
            <p>We use four categories of cookies:</p>
            <ul>
              <li><strong>Strictly necessary</strong> — login session, CSRF tokens, language preference. Cannot be disabled.</li>
              <li><strong>Functional</strong> — remembers your saved passport, draft applications, currency.</li>
              <li><strong>Analytics</strong> — first-party, IP-anonymized event tracking. Disable via the cookie banner.</li>
              <li><strong>Marketing</strong> — only set after explicit opt-in.</li>
            </ul>
            <p>
              We do not use third-party advertising trackers and we do not
              build cross-site profiles.
            </p>
          </section>

          <section id="children" className="legal-section">
            <span className="section-num">§ 10</span>
            <h2>Children</h2>
            <p>
              VIZA is not directed at children under 13. Where a child{'’'}s
              visa is filed as part of a family application, the data is
              provided by a parent or legal guardian who is the account
              holder. We do not market to children and we do not use a child{'’'}s
              data for any purpose beyond the visa filing.
            </p>
          </section>

          <section id="changes" className="legal-section">
            <span className="section-num">§ 11</span>
            <h2>Changes</h2>
            <p>
              When this policy changes materially we email every active
              account holder at least 14 days before the new version takes
              effect. The version history is at the bottom of this page and
              previous versions are available on request.
            </p>
          </section>

          <section id="contact" className="legal-section">
            <span className="section-num">§ 12</span>
            <h2>Contact us</h2>
            <p>Privacy questions, requests, complaints — same address.</p>
            <ul>
              <li><strong>Email:</strong> <a href="mailto:privacy@viza.com">privacy@viza.com</a></li>
              <li><strong>Data Protection Officer:</strong> <a href="mailto:dpo@viza.com">dpo@viza.com</a></li>
              <li><strong>Mailing address:</strong> 1 Marina Boulevard, #20-01, Singapore 018989</li>
              <li><strong>Singapore PDPC:</strong> <a href="https://www.pdpc.gov.sg" target="_blank" rel="noopener">pdpc.gov.sg</a></li>
            </ul>
          </section>
        </main>
      </div>

      <footer className="legal-foot">
        <div className="legal-foot-inner">
          <span>{'©'} VIZA Pte. Ltd. {'·'} All rights reserved</span>
          <span>
            <a href="/legal/terms">Terms</a> {'·'} <a href="/refunds">Refunds</a> {'·'} <a href="/security">Security</a>
          </span>
        </div>
      </footer>
    </div>
  );
}
