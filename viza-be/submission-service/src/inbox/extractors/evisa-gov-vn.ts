import type { ExtractorProfile } from "./types";

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
  senderDomains: [
    "xuatnhapcanh.gov.vn",
    "evisa.xuatnhapcanh.gov.vn",
    "immigration.gov.vn",
    "evisa.gov.vn",
  ],
  extract: ({ subject, text, html }) => {
    const normalizedHtml = (html ?? "")
      .replace(/<[^>]*>/g, " ")
      .replace(/&(?:nbsp|ensp|emsp|#160);/gi, " ")
      .replace(/\s+/g, " ");
    const haystack = [subject ?? "", text ?? "", normalizedHtml].join("\n");
    const applicationId = [
      ...haystack.matchAll(/[Aa]pplication\s+[Ii][Dd][\s\S]{0,180}?\b([A-Z][A-Z0-9-]{7,31})\b/g),
    ]
      .map((match) => match[1])
      .find((candidate) => /\d/.test(candidate));
    const reference =
      /registration\s+code\s*(?:(?:is|:|#|-)\s*)?([A-Z0-9-]{8,32})\b/i.exec(haystack)?.[1] ??
      /code[^A-Z0-9]{0,4}([A-Z0-9-]{12,32})/i.exec(haystack)?.[1] ??
      applicationId;
    const link = /https?:\/\/[^\s"'<>]*(?:evisa\.xuatnhapcanh\.gov\.vn|evisa\.gov\.vn|thithucdientu\.gov\.vn)[^\s"'<>]*/i.exec(haystack)?.[0];
    return { reference, link };
  },
};
