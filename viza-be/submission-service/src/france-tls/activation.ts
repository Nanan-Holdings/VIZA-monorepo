import type { InboundMessage, WaitForMessageOpts } from "../inbox/wait-for-message";

const TLS_ACTIVATION_URL_PATTERN = /https?:\/\/[^\s"'<>]+/gi;
const DEFAULT_TLS_ALIAS_DOMAIN = "haggstorm.com";

export interface FranceTlsActivationEmailResult {
  alias: string;
  messageId: string;
  activationUrl: URL;
  receivedAt: string;
}

export interface FranceTlsAliasRotationResult {
  alias: string;
  created: boolean;
}

function decodeQuotedPrintableSoftBreaks(value: string): string {
  return value
    .replace(/=\r?\n/g, "")
    .replace(/=3D/gi, "=")
    .replace(/=26/gi, "&")
    .replace(/=2F/gi, "/")
    .replace(/=3A/gi, ":");
}

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

function normalizeCandidateUrl(raw: string): string {
  return decodeQuotedPrintableSoftBreaks(raw)
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[),.;\]]+$/g, "")
    .trim();
}

export function extractFranceTlsActivationUrlFromMessage(
  message: Pick<InboundMessage, "html" | "text">,
): URL | null {
  const haystacks = [
    message.html ?? "",
    message.html ? decodeQuotedPrintableSoftBreaks(message.html) : "",
    message.html ? htmlToText(message.html) : "",
    message.text ?? "",
    message.text ? decodeQuotedPrintableSoftBreaks(message.text) : "",
  ].filter(Boolean);

  for (const haystack of haystacks) {
    const matches = haystack.match(TLS_ACTIVATION_URL_PATTERN) ?? [];
    for (const match of matches) {
      const candidate = normalizeCandidateUrl(match);
      if (!/visas-fr\.tlscontact\.com/i.test(candidate)) continue;
      if (!/activate|activation|action|token|confirm/i.test(candidate)) continue;
      try {
        return new URL(candidate);
      } catch {
        // Keep scanning.
      }
    }
  }

  return null;
}

export function isFranceTlsActivationExpiredText(text: string): boolean {
  return /action expired|activation expired|link expired|expired.*start again|请重新开始|链接.*过期/i.test(text);
}

export async function rotateFranceTlsApplicantAlias(
  applicantId: string,
  domain = process.env.FRANCE_TLS_ALIAS_DOMAIN?.trim() || DEFAULT_TLS_ALIAS_DOMAIN,
): Promise<FranceTlsAliasRotationResult> {
  const { ensureApplicantInboxAliasForDomain } = await import("../inbox/alias");
  return ensureApplicantInboxAliasForDomain(applicantId, domain);
}

export async function waitForFranceTlsActivationEmail(
  applicantId: string,
  timeoutMs: number,
  opts: WaitForMessageOpts = {},
): Promise<FranceTlsActivationEmailResult> {
  const { inbox } = await import("../inbox/wait-for-message");
  const message = await inbox.waitForMessage(
    applicantId,
    (row) => {
      if (!/activate.*tlscontact|tlscontact.*activate|tlscontact account/i.test(row.subject ?? "")) {
        return false;
      }
      if (!/tlscontact|amazonaws|ses/i.test(row.from_addr ?? "")) return false;
      return extractFranceTlsActivationUrlFromMessage(row) !== null;
    },
    timeoutMs,
    opts,
  );

  const activationUrl = extractFranceTlsActivationUrlFromMessage(message);
  if (!activationUrl) {
    throw new Error("TLScontact activation email matched but no activation URL was found");
  }

  return {
    alias: message.to_addr.toLowerCase(),
    messageId: message.id,
    activationUrl,
    receivedAt: message.received_at,
  };
}
