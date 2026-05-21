import { inbox, type InboundMessage } from "../inbox/wait-for-message.js";
import { extractAuto } from "../inbox/extractors/index.js";

/**
 * UK Apply-UK-Visa inbox helpers (INBOX-005).
 *
 * Wraps `inbox.waitForMessage` with predicates tuned to UKVI / GOV.UK
 * Notify's confirmation mails. Two artefacts the runner asks for:
 *
 *   - **Resume URL** — sent at registration; the runner navigates to
 *     this URL with the stored password to resume the in-flight
 *     application.
 *   - **Security code** — 6-digit MFA code emailed during sign-in.
 *
 * The legacy IMAP fallback (src/email/imap-poll.ts) is deprecated for
 * UK + VN flows. Set the applicant's `inbox_alias` and use these
 * helpers instead.
 */

const UK_FROM_REGEX = /@(notifications\.service\.gov\.uk|apply-uk-visa\.service\.gov\.uk|service\.gov\.uk)$/i;

function isUkResume(msg: InboundMessage): boolean {
  if (!UK_FROM_REGEX.test(msg.from_addr)) return false;
  return /(resume|continue your application|register an email)/i.test(msg.subject ?? "");
}

function isUkSecurityCode(msg: InboundMessage): boolean {
  if (!UK_FROM_REGEX.test(msg.from_addr)) return false;
  return /(security code|verification code)/i.test(msg.subject ?? "");
}

export interface UkResumeEmail {
  message: InboundMessage;
  resumeUrl: string;
}

export interface UkSecurityCodeEmail {
  message: InboundMessage;
  code: string;
}

export async function waitForUkResumeEmail(
  applicantId: string,
  timeoutMs: number = 90_000,
): Promise<UkResumeEmail> {
  const message = await inbox.waitForMessage(applicantId, isUkResume, timeoutMs);
  const parsed = extractAuto({
    from: message.from_addr,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
  if (!parsed.link) {
    throw new Error(`[uk-inbox] resume email ${message.id} matched but no link extracted`);
  }
  return { message, resumeUrl: parsed.link };
}

export async function waitForUkSecurityCode(
  applicantId: string,
  timeoutMs: number = 60_000,
): Promise<UkSecurityCodeEmail> {
  const message = await inbox.waitForMessage(applicantId, isUkSecurityCode, timeoutMs);
  const parsed = extractAuto({
    from: message.from_addr,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
  if (!parsed.code) {
    throw new Error(`[uk-inbox] security code email ${message.id} matched but code missing`);
  }
  return { message, code: parsed.code };
}
