import type { InboundMessage } from "../inbox/wait-for-message";
import { inbox } from "../inbox/wait-for-message";
import type { MailboxProvider } from "./inbox-poller";

const URL_PATTERN = /https?:\/\/[^\s"'<>]+/gi;

function htmlToText(html: string): string {
  return html
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

function decodeQuotedPrintableSoftBreaks(value: string): string {
  return value
    .replace(/=\r?\n/g, "")
    .replace(/=3D/gi, "=")
    .replace(/=26/gi, "&");
}

function normalizeCandidateUrl(raw: string): string {
  return decodeQuotedPrintableSoftBreaks(raw)
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[),.;\]]+$/g, "")
    .trim();
}

export function extractVerificationUrlFromMessage(message: Pick<InboundMessage, "html" | "text">): URL | null {
  const haystacks = [
    message.html ?? "",
    message.html ? htmlToText(message.html) : "",
    message.text ?? "",
  ].filter(Boolean);

  for (const haystack of haystacks) {
    const matches = haystack.match(URL_PATTERN) ?? [];
    for (const match of matches) {
      const candidate = normalizeCandidateUrl(match);
      if (!/france-visas\.gouv\.fr/i.test(candidate)) continue;
      if (!/verify-email|execute-actions|login-actions\/action-token|kc_action/i.test(candidate)) continue;
      try {
        return new URL(candidate);
      } catch {
        // Keep scanning.
      }
    }
  }

  return null;
}

export function createSupabaseMailboxProvider(applicantId: string): MailboxProvider {
  return {
    async waitForVerificationLink(params) {
      const message = await inbox.waitForMessage(
        applicantId,
        (row) => {
          if (params.subjectPattern && !params.subjectPattern.test(row.subject ?? "")) return false;
          if (params.senderPattern && !params.senderPattern.test(row.from_addr ?? "")) return false;
          return extractVerificationUrlFromMessage(row) !== null;
        },
        params.timeoutMs,
      );

      const url = extractVerificationUrlFromMessage(message);
      if (!url) {
        throw new Error(`France-Visas verification email matched but no verification URL was found`);
      }
      return url;
    },
  };
}
