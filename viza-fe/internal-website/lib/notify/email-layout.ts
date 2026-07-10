/**
 * Shared branded HTML shell for all VIZA transactional email.
 *
 * Email clients can't load Tailwind, so this is the one place in the
 * codebase where raw brand hex values are allowed — they mirror the
 * `brand` scale in tailwind.config.ts (brand-500 = #03346E). Keep the
 * two in sync if the brand palette ever changes.
 *
 * Layout: full-width brand-50 canvas → centred 560px white card with a
 * navy VIZA wordmark header, body slot, optional CTA button, and a
 * muted footer. All styles inline (Gmail strips <style> blocks).
 */

const BRAND_500 = "#03346E";
const BRAND_400 = "#3D6DAD";
const BRAND_50 = "#EEF3FA";
const FG_MUTED = "#5B6B7F";
const BORDER = "#D4E0F0"; // brand-100

export interface EmailLayoutInput {
  /** <title> + preview text fallback. */
  title: string;
  /** Inner HTML of the card body (already escaped/trusted). */
  bodyHtml: string;
  /** Optional primary CTA rendered as a bulletproof button. */
  cta?: { label: string; url: string };
  /** Small print under the CTA (e.g. "single-use link" note). */
  finePrint?: string;
  /** Footer line; defaults to the VIZA sign-off. */
  footer?: string;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Absolute URL for the brand logo — email clients can't load relative
 * paths, so this resolves against the deployed portal origin.
 */
function logoUrl(): string {
  const origin = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.viza.it.com"
  ).replace(/\/+$/, "");
  return `${origin}/logo/viza-logo-blue.svg`;
}

export function renderEmailLayout(input: EmailLayoutInput): string {
  const cta = input.cta
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 28px auto 0;">
        <tr>
          <td style="border-radius: 999px; background: ${BRAND_500};">
            <a href="${input.cta.url}"
               style="display: inline-block; padding: 13px 36px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 999px; font-family: -apple-system, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif;">
              ${escapeHtml(input.cta.label)}
            </a>
          </td>
        </tr>
      </table>`
    : "";

  const finePrint = input.finePrint
    ? `<p style="margin: 20px 0 0; font-size: 12px; line-height: 1.6; color: ${FG_MUTED}; text-align: center;">${input.finePrint}</p>`
    : "";

  const footer =
    input.footer ??
    `VIZA · <a href="https://viza.it.com" style="color: ${BRAND_400}; text-decoration: none;">viza.it.com</a>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(input.title)}</title>
</head>
<body style="margin: 0; padding: 0; background: ${BRAND_50}; font-family: -apple-system, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: ${BRAND_50}; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width: 560px; width: 100%;">
          <tr>
            <td style="padding: 0 8px 20px; text-align: left;">
              <img src="${logoUrl()}" alt="VIZA" width="88" height="26" style="display: block; border: 0;" />
            </td>
          </tr>
          <tr>
            <td style="background: #ffffff; border: 1px solid ${BORDER}; border-radius: 16px; padding: 36px 36px 32px;">
              ${input.bodyHtml}
              ${cta}
              ${finePrint}
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 8px 0; text-align: center; font-size: 12px; line-height: 1.6; color: ${FG_MUTED};">
              ${footer}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Heading + paragraphs helper so per-event templates stay terse. */
export function emailBody(heading: string, paragraphs: string[]): string {
  const ps = paragraphs
    .map(
      (p) =>
        `<p style="margin: 14px 0 0; font-size: 15px; line-height: 1.7; color: #1E2A3A;">${p}</p>`,
    )
    .join("");
  return `<h2 style="margin: 0; font-size: 20px; line-height: 1.4; color: ${BRAND_500};">${escapeHtml(heading)}</h2>${ps}`;
}
