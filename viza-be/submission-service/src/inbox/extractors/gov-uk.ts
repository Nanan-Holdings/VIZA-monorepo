import type { ExtractorProfile } from "./types.js";

/**
 * UKVI / Apply UK Visa confirmation and resume-link mails.
 * Sender families:
 *   - notifications.service.gov.uk (GOV.UK Notify)
 *   - apply-uk-visa.service.gov.uk (forceResume URL)
 */
export const govUkProfile: ExtractorProfile = {
  id: "gov-uk",
  senderDomains: [
    "notifications.service.gov.uk",
    "apply-uk-visa.service.gov.uk",
    "service.gov.uk",
  ],
  extract: ({ subject, text, html }) => {
    const haystack = [subject ?? "", text ?? "", html ?? ""].join("\n");
    const code =
      /(?:security|verification)\s+code[^0-9]{0,16}(\d{4,8})/i.exec(haystack)?.[1] ??
      /\b(\d{6})\b/.exec(subject ?? "")?.[1];
    const link =
      /https?:\/\/[^\s"'<>]*apply-uk-visa\.service\.gov\.uk[^\s"'<>]+/i.exec(haystack)?.[0] ??
      /https?:\/\/[^\s"'<>]*\.service\.gov\.uk[^\s"'<>]+/i.exec(haystack)?.[0];
    const reference =
      /(?:application|reference)\s*(?:number|id)[^A-Z0-9]{0,4}([A-Z0-9-]{6,})/i.exec(haystack)?.[1];
    return { code, link, reference };
  },
};
