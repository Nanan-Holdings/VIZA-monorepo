import Link from "next/link";

export const metadata = {
  title: "Terms of Service — VIZA",
  description: "VIZA terms of service.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#fafafa] px-6 py-10">
      <div className="prose prose-neutral mx-auto max-w-3xl text-foreground">
        <h1>Terms of Service</h1>
        <p className="text-sm text-muted-foreground">Effective date: TBD on counsel review.</p>

        <section>
          <h2>1. Service</h2>
          <p>
            VIZA Pte. Ltd. operates an AI-assisted visa application platform. We help applicants
            prepare and submit visa applications to government portals; we are not a law firm and
            our services do not constitute legal advice. Government decisions remain at the sole
            discretion of the relevant authority.
          </p>
        </section>

        <section>
          <h2>2. Account</h2>
          <p>
            You must be at least 18 years old to create an account. You are responsible for
            keeping your credentials safe and for activity on your account.
          </p>
        </section>

        <section>
          <h2>3. Fees + refunds</h2>
          <p>
            Government fees pass through at cost. Our service fee is non-refundable once your
            application has been submitted to the government portal. Refund requests prior to
            submission are reviewed individually — see <Link href="/legal/refund-policy">/legal/refund-policy</Link>.
          </p>
        </section>

        <section>
          <h2>4. Data + privacy</h2>
          <p>
            We handle passport scans, photos, and personal data under the rules in our
            <Link href="/legal/privacy"> Privacy Policy</Link>. Our retention rules are time-bound;
            we do not sell your data.
          </p>
        </section>

        <section>
          <h2>5. Acceptable use</h2>
          <p>
            You agree not to submit forged documents, impersonate another person, or use VIZA in
            connection with any activity that violates applicable law. We may suspend accounts
            engaged in fraud and report to authorities where required.
          </p>
        </section>

        <section>
          <h2>6. Liability</h2>
          <p>
            To the maximum extent permitted by law, VIZA's aggregate liability is limited to the
            service fees you paid us in the 12 months preceding the claim. We are not liable for
            government decisions, processing delays, or third-party portal outages.
          </p>
        </section>

        <section>
          <h2>7. Changes</h2>
          <p>
            We may update these terms; material changes will be emailed 30 days before they take
            effect. Continued use after the change constitutes acceptance.
          </p>
        </section>

        <section>
          <h2>8. Contact</h2>
          <p>support@viza.app · VIZA Pte. Ltd., 1 North Bridge Road, Singapore.</p>
        </section>

        <p className="rounded-md border border-dashed border-input bg-white p-3 text-xs text-muted-foreground">
          Placeholder draft. Replace each section with counsel-reviewed text before launch. Tracking
          review in <code>docs/legal/review-log.md</code>.
        </p>
      </div>
    </main>
  );
}
