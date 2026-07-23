import type { InboundMessage } from "../inbox/wait-for-message";
import { imapConfigFromEnv, waitForEmail } from "../email/imap-poll";

const URL_PATTERN = /https?:\/\/[^\s"'<>]+/gi;
const OTP_PATTERNS = [
  /\bemail\s+code\D{0,40}(\d{4,8})\b/i,
  /\b(?:verification|security|one[-\s]?time|otp|code)\D{0,40}(\d{4,8})\b/i,
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
    .replace(/=26/gi, "&")
    .replace(/(?<![A-Za-z])=([0-9A-F]{2})/gi, (_, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    );
}

function decodeBase64MimeParts(value: string): string {
  const decoded: string[] = [];
  const pattern = /Content-Transfer-Encoding:\s*base64[\s\S]*?\r?\n\r?\n([A-Za-z0-9+/=\r\n]+?)(?=\r?\n--|$)/gi;
  for (const match of value.matchAll(pattern)) {
    const encoded = match[1]?.replace(/\s+/g, "");
    if (!encoded) continue;
    try {
      decoded.push(Buffer.from(encoded, "base64").toString("utf8"));
    } catch {
      // Keep scanning other MIME parts.
    }
  }
  return decoded.join("\n");
}

function messageHaystacks(message: Pick<InboundMessage, "html" | "text" | "subject">): string[] {
  const decodedHtml = message.html ? decodeHtml(decodeQuotedPrintable(message.html)) : "";
  const decodedText = message.text ? decodeQuotedPrintable(message.text) : "";
  const base64Text = message.text ? decodeBase64MimeParts(message.text) : "";
  const base64Html = message.html ? decodeBase64MimeParts(message.html) : "";
  return [
    message.subject ?? "",
    base64Text,
    base64Html ? decodeHtml(base64Html) : "",
    decodedText,
    decodedHtml,
    message.text ?? "",
  ].filter(Boolean);
}

function messageUrlHaystacks(message: Pick<InboundMessage, "html" | "text" | "subject">): string[] {
  return [
    message.subject ?? "",
    message.text ? decodeBase64MimeParts(message.text) : "",
    message.html ? decodeBase64MimeParts(message.html) : "",
    message.text ? decodeQuotedPrintable(message.text) : "",
    message.html ? decodeQuotedPrintable(message.html) : "",
    message.html ? decodeHtml(decodeQuotedPrintable(message.html)) : "",
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
  for (const source of [message.html, message.text].filter((value): value is string => Boolean(value))) {
    const emphasizedCode = decodeQuotedPrintable(source).match(
      /<(?:b|strong)\b[^>]*>\s*(\d{6})\s*<\/(?:b|strong)>/i,
    );
    if (emphasizedCode?.[1]) return emphasizedCode[1];
  }
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
  for (const haystack of messageUrlHaystacks(message)) {
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

export function isPhEtravelExistingAccountNotice(
  message: Pick<InboundMessage, "html" | "text" | "subject">,
): boolean {
  return messageHaystacks(message).some((value) =>
    /registration attempt notice|account is already registered|already registered using this email/i.test(value),
  );
}

export function extractPhEtravelTemporaryPasswordFromMessage(
  message: Pick<InboundMessage, "html" | "text" | "subject">,
): string | null {
  for (const haystack of messageHaystacks(message)) {
    const match = haystack.match(
      /temporary\s+password\s*[:：-]\s*([A-Za-z0-9!@#$%^&*._~-]{6,64})/i,
    );
    if (match?.[1]) return match[1];
  }
  return null;
}

export interface PhEtravelMailboxProvider {
  waitForOtp(params: { timeoutMs: number; since?: string }): Promise<string>;
  waitForVerificationLink(params: { timeoutMs: number; since?: string }): Promise<URL>;
  waitForExistingAccountNotice(params: { timeoutMs: number; since?: string }): Promise<void>;
  waitForTemporaryPassword(params: { timeoutMs: number; since?: string }): Promise<string>;
}

async function waitForMessageToAddress(
  address: string,
  predicate: (row: InboundMessage) => boolean,
  timeoutMs: number,
  opts: { since?: string; pollIntervalMs?: number; includeProcessed?: boolean } = {},
): Promise<InboundMessage> {
  const { supabase } = await import("../supabase");
  const pollIntervalMs = opts.pollIntervalMs ?? 5_000;
  const since = opts.since ?? new Date(Date.now() - 60_000).toISOString();
  const deadline = Date.now() + timeoutMs;
  const normalizedAddress = address.toLowerCase();

  while (Date.now() < deadline) {
    let query = supabase
      .from("inbound_email")
      .select("id, to_addr, from_addr, subject, message_id, text, html, headers, raw_size, r2_key, spam_score, received_at, processed")
      .eq("to_addr", normalizedAddress)
      .gte("received_at", since)
      .order("received_at", { ascending: true })
      .limit(20);
    if (!opts.includeProcessed) {
      query = query.eq("processed", false);
    }
    const { data, error } = await query;
    if (error) throw new Error(`PH eTravel mailbox poll failed: ${error.message}`);
    for (const row of (data ?? []) as InboundMessage[]) {
      if (!predicate(row)) continue;
      if (row.processed) return row;
      const { error: markError } = await supabase
        .from("inbound_email")
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq("id", row.id);
      if (markError) throw new Error(`PH eTravel mailbox markProcessed failed: ${markError.message}`);
      return row;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`PH eTravel mailbox timeout after ${timeoutMs}ms for the configured account alias.`);
}

export function createPhEtravelMailboxProvider(applicantId: string, mailboxAddress?: string): PhEtravelMailboxProvider {
  const waitForOfficialMessage = async (
    predicate: (row: InboundMessage) => boolean,
    timeoutMs: number,
    since?: string,
  ): Promise<InboundMessage> => {
    if (mailboxAddress?.trim()) {
      return waitForMessageToAddress(mailboxAddress, predicate, timeoutMs, { since });
    }
    const { inbox } = await import("../inbox/wait-for-message");
    return inbox.waitForMessage(applicantId, predicate, timeoutMs, { since });
  };

  return {
    async waitForOtp(params) {
      const message = await waitForOfficialMessage(
        (row) => {
          const senderMatches = /etravel|egov|gov\.ph/i.test(row.from_addr ?? "");
          const subjectMatches = /etravel|egov|verification|otp|code/i.test(row.subject ?? "");
          return (senderMatches || subjectMatches) && extractPhEtravelOtpFromMessage(row) !== null;
        },
        params.timeoutMs,
        params.since,
      );
      const otp = extractPhEtravelOtpFromMessage(message);
      if (!otp) throw new Error("Philippines eTravel email matched but no OTP was found.");
      return otp;
    },

    async waitForVerificationLink(params) {
      const message = await waitForOfficialMessage(
        (row) => {
          const senderMatches = /etravel|egov|gov\.ph/i.test(row.from_addr ?? "");
          const subjectMatches = /etravel|egov|verification|confirm|activate/i.test(row.subject ?? "");
          return (senderMatches || subjectMatches) && extractPhEtravelVerificationUrlFromMessage(row) !== null;
        },
        params.timeoutMs,
        params.since,
      );
      const url = extractPhEtravelVerificationUrlFromMessage(message);
      if (!url) throw new Error("Philippines eTravel email matched but no verification URL was found.");
      return url;
    },

    async waitForExistingAccountNotice(params) {
      await waitForOfficialMessage(
        (row) => {
          const senderMatches = /etravel|egov|gov\.ph/i.test(row.from_addr ?? "");
          return senderMatches && isPhEtravelExistingAccountNotice(row);
        },
        params.timeoutMs,
        params.since,
      );
    },

    async waitForTemporaryPassword(params) {
      const predicate = (row: InboundMessage) => {
        const senderMatches = /etravel|egov|gov\.ph/i.test(row.from_addr ?? "");
        return senderMatches && extractPhEtravelTemporaryPasswordFromMessage(row) !== null;
      };
      const message = mailboxAddress?.trim()
        ? await waitForMessageToAddress(mailboxAddress, predicate, params.timeoutMs, {
            since: params.since,
            includeProcessed: true,
          })
        : await waitForOfficialMessage(predicate, params.timeoutMs, params.since);
      const password = extractPhEtravelTemporaryPasswordFromMessage(message);
      if (!password) throw new Error("Philippines eTravel temporary-password email did not contain a password.");
      return password;
    },
  };
}

/**
 * Local smoke-test fallback for a configured IMAP inbox. The official account
 * email should be a unique plus-address of that inbox so the registration does
 * not reuse the mailbox's primary address. Credentials remain in local env.
 */
export function createPhEtravelImapMailboxProvider(mailboxAddress: string): PhEtravelMailboxProvider {
  const config = imapConfigFromEnv();
  const escapedAddress = mailboxAddress.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const recipient = new RegExp(`^${escapedAddress}$`, "i");
  const waitForOfficialEmail = async (timeoutMs: number, since?: string) => waitForEmail({
    config,
    from: /etravel|egov|gov\.ph/i,
    to: recipient,
    subject: /etravel|egov|verification|confirm|activate|otp|code/i,
    since: since ? new Date(since) : new Date(Date.now() - 60_000),
    timeoutMs,
  });

  return {
    async waitForOtp(params) {
      const email = await waitForOfficialEmail(params.timeoutMs, params.since);
      const otp = extractPhEtravelOtpFromMessage({
        subject: email.subject,
        text: email.textBody,
        html: email.htmlBody,
      });
      if (!otp) throw new Error("Philippines eTravel IMAP email matched but no OTP was found.");
      return otp;
    },

    async waitForVerificationLink(params) {
      const email = await waitForOfficialEmail(params.timeoutMs, params.since);
      const url = extractPhEtravelVerificationUrlFromMessage({
        subject: email.subject,
        text: email.textBody,
        html: email.htmlBody,
      });
      if (!url) throw new Error("Philippines eTravel IMAP email matched but no verification URL was found.");
      return url;
    },

    async waitForExistingAccountNotice(params) {
      await waitForEmail({
        config,
        from: /etravel|egov|gov\.ph/i,
        to: recipient,
        subject: /registration attempt|already registered/i,
        since: params.since ? new Date(params.since) : new Date(Date.now() - 60_000),
        timeoutMs: params.timeoutMs,
      });
    },

    async waitForTemporaryPassword(params) {
      const email = await waitForEmail({
        config,
        from: /etravel|egov|gov\.ph/i,
        to: recipient,
        subject: /temporary password/i,
        since: params.since ? new Date(params.since) : new Date(Date.now() - 24 * 60 * 60 * 1000),
        timeoutMs: params.timeoutMs,
      });
      const password = extractPhEtravelTemporaryPasswordFromMessage({
        subject: email.subject,
        text: email.textBody,
        html: email.htmlBody,
      });
      if (!password) throw new Error("Philippines eTravel IMAP temporary-password email did not contain a password.");
      return password;
    },
  };
}
