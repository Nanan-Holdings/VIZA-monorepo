export const metadata = {
  title: "Privacy Policy — VIZA",
  description: "VIZA privacy policy.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#fafafa] px-6 py-10">
      <div className="prose prose-neutral mx-auto max-w-3xl text-foreground">
        <h1>Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">Effective date: TBD on counsel review.</p>

        <section>
          <h2>1. What we collect</h2>
          <ul>
            <li>Account: email, password hash (via Supabase Auth), name.</li>
            <li>Application: passport image, applicant photo, answers to the visa question set, payment metadata.</li>
            <li>Operational: IP address, browser fingerprint (used to deflect anti-bot challenges on government portals), timestamps.</li>
          </ul>
        </section>

        <section>
          <h2>2. Why we collect it</h2>
          <p>To fill out and submit your visa application on your behalf, to verify your identity (Stripe Identity + face-match), and to comply with applicable law.</p>
        </section>

        <section>
          <h2>3. Who we share with</h2>
          <ul>
            <li>The relevant government portal (the entire point).</li>
            <li>Sub-processors: Stripe (payments + Identity), Resend (email), Twilio (SMS), Supabase (database + storage), AWS Rekognition (face-match), Bright Data (proxy).</li>
          </ul>
          <p>See <a href="/legal/subprocessors">/legal/subprocessors</a> for the live list.</p>
        </section>

        <section>
          <h2>4. Retention</h2>
          <p>
            We delete passport scans + applicant photos 90 days after the application reaches a
            terminal state (delivered / denied / cancelled). Answer sets are retained for 2 years
            for compliance and audit. Account records are retained until you ask us to delete the
            account.
          </p>
        </section>

        <section>
          <h2>5. Your rights</h2>
          <p>You can: download your data, request deletion of your account, withdraw consent for non-essential cookies. Email <a href="mailto:privacy@viza.app">privacy@viza.app</a>.</p>
        </section>

        <section>
          <h2>6. Cookies</h2>
          <p>
            We use first-party cookies for session + locale. Non-essential cookies (analytics) are
            gated behind your consent — see the banner at the bottom of every page. You can update
            your choice any time at <a href="/legal/cookies">/legal/cookies</a>.
          </p>
        </section>

        <section>
          <h2>7. Children</h2>
          <p>VIZA is not for users under 18, except as dependants under a parent's account. Dependants under 18 are managed by their parent and do not have their own account.</p>
        </section>

        <section>
          <h2>8. Contact + DPO</h2>
          <p>privacy@viza.app · VIZA Pte. Ltd., 1 North Bridge Road, Singapore.</p>
        </section>

        <p className="rounded-md border border-dashed border-input bg-white p-3 text-xs text-muted-foreground">
          Placeholder draft. Replace each section with counsel-reviewed text before launch. Tracking
          review in <code>docs/legal/review-log.md</code>.
        </p>
      </div>
    </main>
  );
}
