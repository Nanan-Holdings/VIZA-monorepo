import type { InboundMessage } from "../inbox/wait-for-message";

const URL_PATTERN = /https?:\/\/[^\s"'<>]+/gi;
const OTP_PATTERNS = [
  /\b(?:verification|security|one[-\s]?time|otp|code)\D{0,40}(\d{4,8})\b/i,
  /\b(\d{6})\b/,
  /\b(\d{4})\b/,
];

function decodeHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeQuotedPrintable(value: string): string {
  return value
    .replace(/=\r?\n/g, "")
    .replace(/=3D/gi, "=")
    .replace(/=26/gi, "&");
}

function messageHaystacks(message: Pick<InboundMessage, "html" | "text" | "subject">): string[] {
  return [
    message.subject ?? "",
    message.html ?? "",
    message.html ? decodeHtml(message.html) : "",
    message.html ? decodeQuotedPrintable(message.html) : "",
    message.text ?? "",
    message.text ? decodeQuotedPrintable(message.text) : "",
  ].filter(Boolean);
}

function normalizeCandidateUrl(raw: string): string {
  return decodeQuotedPrintable(raw)
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[),.;\]]+$/g, "")
    .trim();
}

export function extractPhEtravelOtpFromMessage(message: Pick<InboundMessage, "html" | "text" | "subject">): string | null {
  for (const haystack of messageHaystacks(message)) {
    for (const pattern of OTP_PATTERNS) {
      const match = haystack.match(pattern);
      if (match?.[1]) return match[1].trim();
    }
  }
  return null;
}

export function extractPhEtravelVerificationUrlFromMessage(
  message: Pick<InboundMessage, "html" | "text" | "subject">,
): URL | null {
  for (const haystack of messageHaystacks(message)) {
    const matches = haystack.match(URL_PATTERN) ?? [];
    for (const match of matches) {
      const candidate = normalizeCandidateUrl(match);
      if (!/etravel\.gov\.ph|egovph/i.test(candidate)) continue;
      try {
        return new URL(candidate);
      } catch {
        // Keep scanning.
      }
    }
  }
  return null;
}

export interface PhEtravelMailboxProvider {
  waitForOtp(params: { timeoutMs: number; since?: string }): Promise<string>;
  waitForVerificationLink(params: { timeoutMs: number; since?: string }): Promise<URL>;
}

export function createPhEtravelMailboxProvider(applicantId: string): PhEtravelMailboxProvider {
  return {
    async waitForOtp(params) {
      const { inbox } = await import("../inbox/wait-for-message");
      const message = await inbox.waitForMessage(
        applicantId,
        (row) => {
          const senderMatches = /etravel|egov|gov\.ph/i.test(row.from_addr ?? "");
          const subjectMatches = /etravel|egov|verification|otp|code/i.test(row.subject ?? "");
          return (senderMatches || subjectMatches) && extractPhEtravelOtpFromMessage(row) !== null;
        },
        params.timeoutMs,
        { since: params.since },
      );
      const otp = extractPhEtravelOtpFromMessage(message);
      if (!otp) throw new Error("Philippines eTravel email matched but no OTP was found.");
      return otp;
    },

    async waitForVerificationLink(params) {
      const { inbox } = await import("../inbox/wait-for-message");
      const message = await inbox.waitForMessage(
        applicantId,
        (row) => {
          const senderMatches = /etravel|egov|gov\.ph/i.test(row.from_addr ?? "");
          const subjectMatches = /etravel|egov|verification|confirm|activate/i.test(row.subject ?? "");
          return (senderMatches || subjectMatches) && extractPhEtravelVerificationUrlFromMessage(row) !== null;
        },
        params.timeoutMs,
        { since: params.since },
      );
      const url = extractPhEtravelVerificationUrlFromMessage(message);
      if (!url) throw new Error("Philippines eTravel email matched but no verification URL was found.");
      return url;
    },
  };
}
