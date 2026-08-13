import { inbox, type InboundMessage } from "../inbox/wait-for-message.js";

/**
 * coa.immigration.gov.tw email-OTP verification inbox helpers.
 *
 * The `/apply/verify` step is a one-time email OTP, not an account
 * registration: enter email → click send-code → an email arrives → enter
 * the code → click 驗證 → the field becomes read-only "xxx@gmail.com 已認證".
 * Reuses the shared inbox infrastructure (src/inbox/wait-for-message.ts)
 * rather than building new polling logic, mirroring src/uk/inbox.ts.
 *
 * Confirmed by operator-provided real-message evidence on 2026-08-01:
 * official application-form email verification messages come from the
 * immigration.gov.tw domain, use the "境外人士线上申办系统" verification subject,
 * and contain an approximately 15-character mixed alphanumeric token after
 * an explicit verification-code label. This is separate from authorized
 * official-account login OTP and separate from CAPTCHA.
 */

const TW_OFFICIAL_FROM_DOMAIN_REGEX = /(^|\.)immigration\.gov\.tw$/i;
const TW_SYSTEM_SUBJECT_REGEX = /境外人士[線线]上申辦系統|境外人士线上申办系统/i;
const TW_VERIFY_SUBJECT_REGEX = /驗證|验证|認證|认证|verification/i;
const TW_CODE_LABEL_REGEX = /(?:驗證碼|验证码|認證碼|认证码|verification\s*code)\s*[:：]?\s*/i;
const TW_CODE_TOKEN_REGEX = /^[A-Z0-9]{12,20}\b/i;

function messageBody(msg: InboundMessage): string {
  return [msg.text ?? "", msg.html ?? ""].join("\n");
}

function fromDomain(fromAddr: string): string | null {
  const address = fromAddr.match(/<([^<>@\s]+@[^<>\s]+)>/)?.[1] ?? fromAddr.trim();
  const domain = address.split("@").pop()?.trim().replace(/[>),;.\s]+$/g, "").toLowerCase();
  return domain && domain.includes(".") ? domain : null;
}

export function isTwVerificationEmail(msg: InboundMessage): boolean {
  const domain = fromDomain(msg.from_addr);
  if (!domain || !TW_OFFICIAL_FROM_DOMAIN_REGEX.test(domain)) return false;

  const subject = msg.subject ?? "";
  if (!TW_SYSTEM_SUBJECT_REGEX.test(subject) || !TW_VERIFY_SUBJECT_REGEX.test(subject)) return false;

  return TW_CODE_LABEL_REGEX.test(messageBody(msg));
}

export interface TwVerificationCodeEmail {
  message: InboundMessage;
  code: string;
}

/**
 * Extract only a labeled application-form email token. Do not fall back to
 * broad numeric scanning; unrelated official reference numbers often appear
 * in government email bodies and must not be treated as verification codes.
 */
export function extractTwVerificationCode(msg: InboundMessage): string | null {
  const haystack = messageBody(msg);
  const labelPattern = new RegExp(TW_CODE_LABEL_REGEX.source, TW_CODE_LABEL_REGEX.flags.includes("g") ? TW_CODE_LABEL_REGEX.flags : `${TW_CODE_LABEL_REGEX.flags}g`);
  for (const labelMatch of haystack.matchAll(labelPattern)) {
    const afterLabel = haystack.slice((labelMatch.index ?? 0) + labelMatch[0].length).trimStart();
    const token = TW_CODE_TOKEN_REGEX.exec(afterLabel)?.[0] ?? null;
    if (token && /[A-Z]/i.test(token) && /\d/.test(token)) return token;
  }
  return null;
}

export async function waitForTwVerificationCode(
  applicantId: string,
  timeoutMs: number = 120_000,
): Promise<TwVerificationCodeEmail> {
  const message = await inbox.waitForMessage(applicantId, isTwVerificationEmail, timeoutMs, {
    since: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  });
  const code = extractTwVerificationCode(message);
  if (!code) {
    throw new Error(`[tw-inbox] verification email ${message.id} matched but no code could be extracted`);
  }
  return { message, code };
}
