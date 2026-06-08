import type { ExtractorProfile } from "./types";

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
    const haystack = [subject ?? "", text ?? "", html ?? ""].join("\n");
    const code =
      /(?:verification code|one[- ]?time password|otp)[^0-9]{0,16}(\d{4,8})/i.exec(haystack)?.[1] ??
      /\b(\d{6})\b/.exec(subject ?? "")?.[1];
    const link = /https?:\/\/[^\s"'<>]*vfsglobal\.com\/[^\s"'<>]+/i.exec(haystack)?.[0];
    const reference = /(?:reference|application)\s*(?:no\.?|number|id)[^A-Z0-9]{0,4}([A-Z0-9-]{6,})/i
      .exec(haystack)?.[1];
    return { code, link, reference };
  },
};
