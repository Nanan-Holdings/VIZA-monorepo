"use client";

import SiteNav from "@/components/SiteNav";
import "../legal.css";

export default function TermsPage() {
  return (
    <div className="legal-page">
      <SiteNav />

      <header className="legal-hero">
        <div className="legal-eyebrow">Legal · Terms of service</div>
        <h1>Terms of service</h1>
        <p className="lede">
          The agreement between you and VIZA when you use our visa application
          services. We file your application; you provide accurate information
          and pay the agreed fee. The rest is the detail.
        </p>
        <div className="legal-meta">
          <span><b>Effective:</b> 1 May 2026</span>
          <span className="sep" />
          <span><b>Version:</b> 3.1</span>
          <span className="sep" />
          <span><b>Governing law:</b> Singapore</span>
        </div>
      </header>

      <div className="legal-body">
        <aside className="legal-toc">
          <h4>On this page</h4>
          <a href="#agreement">01 · The agreement</a>
          <a href="#account">02 · Your account</a>
          <a href="#service">03 · What we do</a>
          <a href="#applicant">04 · What you do</a>
          <a href="#fees">05 · Fees and payment</a>
          <a href="#refunds">06 · Refunds</a>
          <a href="#government">07 · Government decisions</a>
          <a href="#timelines">08 · Timelines and guarantees</a>
          <a href="#prohibited">09 · Prohibited use</a>
          <a href="#ip">10 · Intellectual property</a>
          <a href="#liability">11 · Liability</a>
          <a href="#termination">12 · Suspension &amp; termination</a>
          <a href="#disputes">13 · Disputes</a>
          <a href="#changes">14 · Changes to terms</a>
          <a href="#contact">15 · Contact</a>
        </aside>

        <main className="legal-content">
          <section id="agreement" className="legal-section">
            <span className="section-num">§ 01</span>
            <h2>The agreement</h2>
            <p>
              By creating a VIZA account, paying for an application, or using
              the VIZA portal, you agree to these terms together with our
              <a href="/legal/privacy"> privacy policy</a> and
              <a href="/refunds"> refunds policy</a>. Together they form the
              full agreement between you and VIZA Pte. Ltd. (Singapore
              UEN 202312345A).
            </p>
            <p>
              If you are using VIZA on behalf of a company or another person,
              you confirm that you are authorised to bind them, and references
              to {'"'}you{'"'} include them.
            </p>
          </section>

          <section id="account" className="legal-section">
            <span className="section-num">§ 02</span>
            <h2>Your account</h2>
            <ul>
              <li>You must be at least 18 to open an account in your own name.</li>
              <li>Account credentials are personal and must not be shared.</li>
              <li>You are responsible for everything done under your account.</li>
              <li>Notify us immediately at <a href="mailto:security@viza.com">security@viza.com</a> if you suspect unauthorised access.</li>
              <li>We may verify your identity at any point as required by law or to prevent fraud.</li>
            </ul>
          </section>

          <section id="service" className="legal-section">
            <span className="section-num">§ 03</span>
            <h2>What we do</h2>
            <p>
              VIZA provides a managed visa application service. That includes:
            </p>
            <ul>
              <li>Reviewing the documents you upload for completeness.</li>
              <li>Auto-extracting data from your passport and forms.</li>
              <li>Filling and submitting the destination government{'’'}s visa application on your behalf.</li>
              <li>Tracking the application and notifying you of decisions.</li>
              <li>Providing a human consultant during business hours and an emergency line out of hours.</li>
            </ul>
            <div className="legal-callout">
              <p>
                VIZA is a private agency, not a law firm and not a government
                authority. We do not offer immigration legal advice. Where a
                visa decision turns on legal interpretation, we will tell you
                and recommend appropriate counsel.
              </p>
            </div>
          </section>

          <section id="applicant" className="legal-section">
            <span className="section-num">§ 04</span>
            <h2>What you do</h2>
            <ul>
              <li><strong>Provide accurate information.</strong> Misrepresentation may invalidate your visa and trigger criminal penalties under destination law. We rely on what you give us.</li>
              <li><strong>Provide authentic documents.</strong> Forged or doctored documents will be rejected by the embassy and may be reported to authorities.</li>
              <li><strong>Respond promptly.</strong> Some visas require additional information or interviews on short notice. Missing a deadline can void the application.</li>
              <li><strong>Comply with destination law.</strong> Our service ends when the visa is issued; what happens at the border or during your stay is between you and the destination government.</li>
            </ul>
          </section>

          <section id="fees" className="legal-section">
            <span className="section-num">§ 05</span>
            <h2>Fees and payment</h2>
            <p>
              Each application has two distinct components. We always show
              both before you pay.
            </p>
            <ul>
              <li><strong>Government fee.</strong> Set by the destination government. Paid by VIZA on your behalf and passed through at cost.</li>
              <li><strong>VIZA service fee.</strong> Our charge for handling the application. Includes consultant time, document review, automated checks, and our on-time delivery commitment.</li>
            </ul>
            <p>
              Payment is required up front. We accept major card networks and,
              for enterprise accounts, bank transfer on agreed payment terms.
              All amounts are in the currency shown at checkout and are
              inclusive of any applicable Singapore GST.
            </p>
          </section>

          <section id="refunds" className="legal-section">
            <span className="section-num">§ 06</span>
            <h2>Refunds</h2>
            <p>
              The full refund matrix lives at <a href="/refunds">/refunds</a>.
              In summary: if VIZA misses its delivery commitment, the service
              fee is refunded automatically. Government fees are refunded only
              when the destination government refunds them, since they are
              not ours to keep.
            </p>
          </section>

          <section id="government" className="legal-section">
            <span className="section-num">§ 07</span>
            <h2>Government decisions</h2>
            <p>
              VIZA does not, and cannot, guarantee a visa outcome. Approval
              rests entirely with the destination government. A rejection
              based on the applicant{'’'}s personal record (criminal history,
              prior overstay, ineligibility under destination law, etc.) is
              not a service failure on our part and does not entitle a
              service-fee refund. Where the rejection results from a VIZA
              filing error, the service fee is refunded in full and we will
              re-file at no additional cost.
            </p>
          </section>

          <section id="timelines" className="legal-section">
            <span className="section-num">§ 08</span>
            <h2>Timelines and guarantees</h2>
            <p>
              Each visa product is sold with a Guaranteed Delivery date based
              on the destination government{'’'}s published service-level and
              our internal processing buffer. {'"'}Guaranteed{'"'} means we
              refund the service fee if the visa is not issued by that date,
              provided you submitted complete information on time. It does not
              guarantee a positive outcome.
            </p>
          </section>

          <section id="prohibited" className="legal-section">
            <span className="section-num">§ 09</span>
            <h2>Prohibited use</h2>
            <p>You may not use VIZA to:</p>
            <ul>
              <li>Submit false, misleading, or fraudulent information.</li>
              <li>Apply on behalf of another person without their explicit, recorded consent.</li>
              <li>Circumvent immigration controls, sanctions regimes, or travel bans.</li>
              <li>Reverse-engineer, scrape, or automate access to the portal in a way that disrupts service.</li>
              <li>Resell, sublicense, or wrap our service into a third-party offering without a written commercial agreement.</li>
            </ul>
            <p>Breach of this section is grounds for immediate termination without refund and may be reported to authorities.</p>
          </section>

          <section id="ip" className="legal-section">
            <span className="section-num">§ 10</span>
            <h2>Intellectual property</h2>
            <p>
              The VIZA platform, brand, designs, and software are owned by
              VIZA Pte. Ltd. or our licensors. Use of the service does not
              transfer any rights in our IP to you. Likewise, content you
              upload remains yours; you grant VIZA a limited licence to
              process and submit it strictly to deliver your visa.
            </p>
          </section>

          <section id="liability" className="legal-section">
            <span className="section-num">§ 11</span>
            <h2>Liability</h2>
            <p>
              To the maximum extent permitted by law, VIZA{'’'}s aggregate
              liability for any claim arising out of or in connection with the
              service is capped at the greater of (a) the service fee paid for
              the affected application or (b) SGD 500. We are not liable for
              indirect, consequential, incidental, or punitive damages,
              including lost flights, accommodation, or business opportunity.
            </p>
            <p>
              Nothing in these terms excludes or limits liability for fraud,
              gross negligence, death or personal injury caused by negligence,
              or any other liability that cannot lawfully be excluded.
            </p>
          </section>

          <section id="termination" className="legal-section">
            <span className="section-num">§ 12</span>
            <h2>Suspension and termination</h2>
            <p>You may close your account at any time from the portal settings.</p>
            <p>We may suspend or terminate access if:</p>
            <ul>
              <li>You breach these terms or any applicable law.</li>
              <li>We reasonably suspect fraud, identity theft, or sanction breach.</li>
              <li>Continued service would expose VIZA to legal or regulatory risk.</li>
            </ul>
            <p>On termination, ongoing applications are completed where possible. Refunds follow the refunds policy.</p>
          </section>

          <section id="disputes" className="legal-section">
            <span className="section-num">§ 13</span>
            <h2>Disputes</h2>
            <p>
              These terms are governed by the laws of Singapore. Any dispute
              that cannot be resolved through good-faith discussion within 30
              days will be referred to the Singapore International Arbitration
              Centre (SIAC) under its rules in force at the time, with one
              arbitrator, in English, seated in Singapore. Either party may
              still seek injunctive relief in court for urgent IP or
              confidentiality matters.
            </p>
          </section>

          <section id="changes" className="legal-section">
            <span className="section-num">§ 14</span>
            <h2>Changes to terms</h2>
            <p>
              We may update these terms to reflect new features, regulatory
              changes, or operational improvements. Material changes are
              announced by email at least 14 days in advance. Continued use of
              the service after the effective date constitutes acceptance of
              the updated terms.
            </p>
          </section>

          <section id="contact" className="legal-section">
            <span className="section-num">§ 15</span>
            <h2>Contact</h2>
            <ul>
              <li><strong>Legal questions:</strong> <a href="mailto:legal@viza.com">legal@viza.com</a></li>
              <li><strong>Privacy / data requests:</strong> <a href="mailto:privacy@viza.com">privacy@viza.com</a></li>
              <li><strong>Mailing address:</strong> 1 Marina Boulevard, #20-01, Singapore 018989</li>
              <li><strong>UEN:</strong> 202312345A</li>
            </ul>
          </section>
        </main>
      </div>

      <footer className="legal-foot">
        <div className="legal-foot-inner">
          <span>{'©'} VIZA Pte. Ltd. {'·'} All rights reserved</span>
          <span>
            <a href="/legal/privacy">Privacy</a> {'·'} <a href="/refunds">Refunds</a> {'·'} <a href="/security">Security</a>
          </span>
        </div>
      </footer>
    </div>
  );
}
