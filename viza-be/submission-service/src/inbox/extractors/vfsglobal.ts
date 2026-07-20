import type { ExtractorProfile } from "./types";

function unfoldQuotedPrintableSoftBreaks(value: string): string {
  return value.replace(/=\r?\n/g, "");
}

function encodeActivationToken(link: string | undefined): string | undefined {
  if (!link) return undefined;
  const marker = "/activateemail?q=";
  const markerIndex = link.toLowerCase().indexOf(marker);
  if (markerIndex < 0) return link;
  const tokenIndex = markerIndex + marker.length;
  const token = link.slice(tokenIndex);
  return `${link.slice(0, tokenIndex)}${token
    .replace(/\+/g, "%2B")
    .replace(/\//g, "%2F")
    .replace(/=/g, "%3D")}`;
}

/**
 * VFS Global account confirmation mails (used by ZA, IT, IN consular
 * submissions, and most VFS-managed corridors).
 *
 * Patterns observed in anonymised samples:
 *   - subject: "Verification code: 123456" / "Activation OTP for VFS Online"
 *   - body inline: "Your one-time password is 123456"
 *   - link: "https://visa.vfsglobal.com/<region>/<lang>/<service>/account/activate?token=..."
 */
export const vfsGlobalProfile: ExtractorProfile = {
  id: "vfsglobal",
  senderDomains: ["vfsglobal.com", "noreply.vfsglobal.com", "vfshelpzone.com"],
  extract: ({ subject, text, html }) => {
    // Some VFS messages reach inbound_email with their quoted-printable
    // transfer encoding intact. Activation URLs are long enough to be folded
    // with a soft "=\r\n"; extracting before unfolding silently truncates q.
    const haystack = [
      subject ?? "",
      unfoldQuotedPrintableSoftBreaks(text ?? ""),
      unfoldQuotedPrintableSoftBreaks(html ?? ""),
    ].join("\n");
    const code =
      /(?:verification code|one[- ]?time password|otp)[^0-9]{0,16}(\d{4,8})/i.exec(haystack)?.[1] ??
      /\b(\d{6})\b/.exec(subject ?? "")?.[1];
    const link = encodeActivationToken(
      /https?:\/\/[^\s"'<>]*vfsglobal\.com\/[^\s"'<>]+/i.exec(haystack)?.[0],
    );
    const reference = /(?:reference|application)\s*(?:no\.?|number|id)[^A-Z0-9]{0,4}([A-Z0-9-]{6,})/i
      .exec(haystack)?.[1];
    return { code, link, reference };
  },
};
