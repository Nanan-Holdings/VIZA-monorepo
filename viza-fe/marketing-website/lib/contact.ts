/**
 * Single source of truth for every contact detail published on the marketing site.
 *
 * ⚠️ OPS ACTION REQUIRED — confirm each entry below before the next launch. These
 * addresses and numbers are printed on customer-facing pages, so a mailbox that
 * does not exist silently swallows enquiries, refund claims and vulnerability
 * reports.
 *
 * Mailboxes referenced across the site (contact, refunds, security, privacy, terms):
 *   support@viza.it.com   — general enquiries, refund claims, partnerships
 *   privacy@viza.it.com   — data-subject requests (named in the privacy policy)
 *   security@viza.it.com  — vulnerability reports (named on /security)
 *
 * The previous copy published `sales@kelin.studio` (the build studio's address) and
 * `refunds@viza.co` (wrong TLD). Both were replaced here.
 */

export const CONTACT = {
  /** Singapore line, also used for WhatsApp. */
  phoneSg: "+65 8410 6368",
  /** E.164, for tel: and wa.me links. */
  phoneSgE164: "+6584106368",
  whatsappNumber: "6584106368",
  /** WeChat ID — added manually in the WeChat app; there is no scannable code asset yet. */
  wechatId: "viza_help",
  emailSupport: "support@viza.it.com",
  emailPrivacy: "privacy@viza.it.com",
  emailSecurity: "security@viza.it.com",
} as const;

export const OFFICES = [
  {
    id: "sg" as const,
    address: "225 Pasir Panjang Rd, Singapore",
    mapsQuery: "225 Pasir Panjang Rd, Singapore",
  },
  {
    id: "cn" as const,
    address: "No. 67, Kangcheng Road, Lane 958, Xinsong Road, Minhang District, Shanghai",
    mapsQuery: "Kangcheng Road Lane 958 Xinsong Road Minhang District Shanghai",
  },
];

export function mapsHref(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
