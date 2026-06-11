import type { ExtractorProfile } from "./types";

/**
 * USVisaScheduling account and appointment emails.
 *
 * The China assisted-live runner uses this only through the Cloudflare
 * Email Worker -> Supabase `inbound_email` path. It extracts verification
 * codes and links; booking decisions remain human-in-the-loop.
 */
export const usVisaSchedulingProfile: ExtractorProfile = {
  id: "usvisascheduling",
  senderDomains: [
    "usvisascheduling.com",
    "www.usvisascheduling.com",
    "do-not-reply.usvisascheduling.com",
  ],
  subjectMatch: /(verify|verification|code|appointment|schedule|account)/i,
  extract: ({ subject, text, html }) => {
    const haystack = [subject ?? "", text ?? "", html ?? ""].join("\n");
    const code =
      /(?:verification code|security code|one[- ]?time password|otp|code)[^0-9]{0,24}(\d{4,8})/i
        .exec(haystack)?.[1] ??
      /\b(\d{6})\b/.exec(haystack)?.[1];
    const link = /https?:\/\/[^\s"'<>]*usvisascheduling\.com\/[^\s"'<>]+/i
      .exec(haystack)?.[0];
    const reference =
      /(?:appointment|confirmation|reference)\s*(?:no\.?|number|id)?[^A-Z0-9]{0,8}([A-Z0-9-]{6,})/i
        .exec(haystack)?.[1];
    return { code, link, reference };
  },
};
