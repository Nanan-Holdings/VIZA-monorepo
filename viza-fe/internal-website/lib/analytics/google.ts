/**
 * GA4 / Google Ads sink.
 *
 * This is a second analytics sink alongside the PostHog taxonomy in
 * `events.ts`, not a replacement for it. It exists because the marketing site
 * reports to GA4 and checkout completes on this origin — without a tag here, a
 * purchase cannot be attributed to the campaign or channel that produced it.
 *
 * Event names here are Google's, not ours. GA4 ecommerce reporting and Google
 * Ads conversion import both key off the literal recommended event name
 * `purchase`, so it deliberately does not come from the `EVENT` enum. Product
 * events still belong in `events.ts` — see that module's README.
 *
 * Privacy: never send passport values, emails, phone numbers, names, or
 * checkout prefill payloads. Amounts, currency, country slug, visa type, and
 * opaque provider references only.
 */

/** Consent cookie written by `components/cookie-consent.tsx` (PRODUCT-008). */
export const CONSENT_COOKIE = "viza_cookie_consent";

/**
 * Domains GA4 stitches into a single session. The marketing site and the portal
 * are separate origins, so without this a visitor who lands on viza.it.com and
 * pays on app.viza.it.com is counted as two unattributed sessions and the
 * purchase loses its original source.
 *
 * Both apps must send the same list, and both must report to the same GA4
 * property.
 */
export const ANALYTICS_LINKER_DOMAINS: string[] = (
  process.env.NEXT_PUBLIC_ANALYTICS_LINKER_DOMAINS ?? "viza.it.com,app.viza.it.com"
)
  .split(",")
  .map((domain) => domain.trim())
  .filter(Boolean);

/**
 * Consent is opt-in: anything other than an explicit "accept" means no tag.
 * Mirrors the gate in `events.ts` so both sinks obey the same choice.
 */
export function hasAnalyticsConsent(cookieValue: string | undefined | null): boolean {
  return cookieValue === "accept";
}

/**
 * A confirmed purchase, in the shape GA4's `purchase` event expects.
 *
 * `transactionId` is the payment provider's session reference. It is opaque and
 * carries no personal data, and GA4 uses it to discard duplicates if the
 * success page is reloaded or shared.
 */
export interface PurchaseEvent {
  transactionId: string;
  /** Major currency units, e.g. 49.9 — not cents. */
  value: number;
  /** ISO 4217, uppercase. */
  currency: string;
  /** Coarse, non-identifying context. */
  country?: string | null;
  visaType?: string | null;
}

/** Converts a minor-unit amount (cents) to the major units GA4 expects. */
export function toMajorUnits(amountMinor: number): number {
  return Math.round(amountMinor) / 100;
}
