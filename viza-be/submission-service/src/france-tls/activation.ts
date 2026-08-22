import type { InboundMessage, WaitForMessageOpts } from "../inbox/wait-for-message";

const TLS_ACTIVATION_URL_PATTERN = /https?:\/\/[^\s"'<>]+/gi;
const DEFAULT_TLS_ALIAS_DOMAIN = "viza.it.com";

export interface FranceTlsActivationEmailResult {
  alias: string;
  messageId: string;
  activationUrl: URL;
  receivedAt: string;
}

export interface FranceTlsPasswordResetEmailResult {
  messageId: string;
  resetUrl: URL;
  receivedAt: string;
}

export interface FranceTlsAliasRotationResult {
  alias: string;
  created: boolean;
}

export function isFranceTlsActivationMessage(
  message: Pick<InboundMessage, "from_addr" | "subject" | "html" | "text">,
): boolean {
  const subject = message.subject ?? "";
  const activationSubject = /activate|activation|verify|confirm.{0,30}account|account.{0,30}confirm/i
    .test(subject);
  const trustedDeliveryPath = /tlscontact|amazonaws|ses/i.test(message.from_addr ?? "");
  return activationSubject
    && trustedDeliveryPath
    && extractFranceTlsActivationUrlFromMessage(message) !== null;
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

export function extractFranceTlsPasswordResetUrlFromMessage(
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
      try {
        const url = new URL(candidate);
        if (url.hostname !== "visas-fr.tlscontact.com"
          && url.hostname !== "i2-auth.visas-fr.tlscontact.com") continue;
        if (!/reset|forgot|credential|action-token|execute-actions|required-action|login-actions/i
          .test(`${url.pathname} ${url.search}`)) continue;
        return url;
      } catch {
        // Keep scanning.
      }
    }
  }
  return null;
}

export function isFranceTlsPasswordResetMessage(
  message: Pick<InboundMessage, "from_addr" | "subject" | "html" | "text">,
): boolean {
  const resetSubject = /reset.{0,30}password|password.{0,30}reset|forgot.{0,30}password|change.{0,30}password|r[ée]initialis.{0,30}mot de passe/i
    .test(message.subject ?? "");
  const trustedDeliveryPath = /tlscontact|amazonaws|ses/i.test(message.from_addr ?? "");
  return resetSubject
    && trustedDeliveryPath
    && extractFranceTlsPasswordResetUrlFromMessage(message) !== null;
}

export function isFranceTlsPasswordResetCompletedText(text: string): boolean {
  return /password.{0,40}(?:updated|reset|changed)|(?:updated|reset|changed).{0,40}password|mot de passe.{0,40}(?:modifi[ée]|r[ée]initialis[ée])/i
    .test(text.replace(/\s+/g, " "));
}

export function isFranceTlsActivationExpiredText(text: string): boolean {
  return /action expired|activation expired|link expired|expired.*start again|请重新开始|链接.*过期/i.test(text);
}

export function isFranceTlsActivationRequiredText(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ");
  return /activate your account|check your email.{0,80}(?:activate|activation)|account.{0,40}not activated/i
    .test(normalized);
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
    isFranceTlsActivationMessage,
    timeoutMs,
    { ...opts, newestFirst: true },
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

export async function waitForFranceTlsPasswordResetEmail(
  input: {
    applicationId: string;
    applicantId: string;
    accountId: string;
  },
  timeoutMs: number,
  opts: WaitForMessageOpts = {},
): Promise<FranceTlsPasswordResetEmailResult> {
  const { inbox } = await import("../inbox/wait-for-message");
  const message = await inbox.waitForAppointmentAccountMessage(
    { ...input, portal: "tlscontact_cn_fr" },
    isFranceTlsPasswordResetMessage,
    timeoutMs,
    { ...opts, newestFirst: true },
  );
  const resetUrl = extractFranceTlsPasswordResetUrlFromMessage(message);
  if (!resetUrl) {
    throw new Error("TLScontact password-reset email matched but no reset URL was found");
  }
  return {
    messageId: message.id,
    resetUrl,
    receivedAt: message.received_at,
  };
}
