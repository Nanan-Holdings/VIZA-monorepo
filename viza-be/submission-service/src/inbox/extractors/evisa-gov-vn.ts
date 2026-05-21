import type { ExtractorProfile } from "./types.js";

/**
 * Vietnam e-Visa confirmation mails from `evisa.xuatnhapcanh.gov.vn`.
 *
 * Two stages are observed:
 *   1. Application registration code (alphanumeric ~15-char) returned in
 *      the first acknowledgment email.
 *   2. Approval / decision email with a result-page URL.
 *
 * No 6-digit OTP — this provider authenticates via the registration
 * code itself.
 */
export const evisaGovVnProfile: ExtractorProfile = {
  id: "evisa-gov-vn",
  senderDomains: ["xuatnhapcanh.gov.vn", "evisa.xuatnhapcanh.gov.vn"],
  extract: ({ subject, text, html }) => {
    const haystack = [subject ?? "", text ?? "", html ?? ""].join("\n");
    const reference =
      /registration code[^A-Z0-9]{0,8}([A-Z0-9]{8,16})/i.exec(haystack)?.[1] ??
      /code[^A-Z0-9]{0,4}([A-Z0-9]{12,16})/i.exec(haystack)?.[1];
    const link = /https?:\/\/[^\s"'<>]*evisa\.xuatnhapcanh\.gov\.vn[^\s"'<>]+/i.exec(haystack)?.[0];
    return { reference, link };
  },
};
