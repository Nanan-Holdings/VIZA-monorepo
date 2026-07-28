import Link from "next/link";
import { LifeBuoy, ShieldAlert } from "lucide-react";

export default function AccountRecoveryPage() {
  return (
    <main className="min-h-screen bg-[#fafafa] px-6 py-10">
      <div className="mx-auto max-w-xl space-y-5">
        <header>
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
            <LifeBuoy className="h-6 w-6 text-brand-500" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Account recovery</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Lost both your authenticator device <em>and</em> your recovery codes? We can help — but
            only after we&apos;ve verified your identity manually.
          </p>
        </header>

        <section className="rounded-xl border border-input bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-foreground">What to do</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>
              Email <a className="font-medium text-brand-500 hover:underline" href="mailto:support@viza.app?subject=Account%20recovery">support@viza.app</a> from the email address tied to your account.
            </li>
            <li>
              Include: full name, application ID (if any), passport number, and a selfie holding your
              passport so the support team can match your face to the scan we have on file.
            </li>
            <li>
              We respond within one business day. Once your identity is verified, a staff member
              will reset your MFA and force a password reset; you&apos;ll get a fresh email link.
            </li>
          </ol>
        </section>

        <section className="rounded-xl border border-input bg-white p-5 shadow-sm">
          <h2 className="inline-flex items-center gap-2 text-base font-semibold text-foreground">
            <ShieldAlert className="h-5 w-5 text-brand-500" /> Why this is manual
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Self-service recovery would let an attacker who&apos;s already compromised your email
            walk into your account. The manual identity check exists so we can refuse a takeover
            before any reset goes through.
          </p>
        </section>

        <p className="text-xs text-muted-foreground">
          Still know your password but lost MFA only? Try{" "}
          <Link href="/account/security" className="font-medium text-brand-500 hover:underline">
            /account/security
          </Link>{" "}
          while signed in.
        </p>
      </div>
    </main>
  );
}
