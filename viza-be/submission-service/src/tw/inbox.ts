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
 * TODO(verify against a real message): the live walkthrough
 * (docs/tw-entry-permit-auto-submit-plan.md §2.5) confirmed the OTP *flow*
 * exists but did not capture an actual OTP email, so neither the sender
 * domain nor the exact code length/format is confirmed. The predicate/
 * extractor below assume a plausible bilingual subject and a 4-8 digit
 * numeric code (the common shape for Taiwanese government-portal OTPs).
 * Confirm both against a real message before relying on this for a live run
 * — do not widen/narrow the digit-count assumption without evidence.
 */

const TW_FROM_REGEX = /@(immigration\.gov\.tw|coa\.immigration\.gov\.tw)$/i;
const TW_VERIFY_SUBJECT_REGEX = /驗證碼|認證|verification code|來臺觀光|入境許可|coa\.immigration/i;

function messageBody(msg: InboundMessage): string {
  return [msg.subject ?? "", msg.text ?? "", msg.html ?? ""].join("\n");
}

function isTwVerificationEmail(msg: InboundMessage): boolean {
  if (TW_FROM_REGEX.test(msg.from_addr)) return true;
  if (!TW_VERIFY_SUBJECT_REGEX.test(msg.subject ?? "")) return false;
  return /\d{4,8}/.test(messageBody(msg));
}

export interface TwVerificationCodeEmail {
  message: InboundMessage;
  code: string;
}

/**
 * Extract the OTP digits from a matched message. See the file-level TODO —
 * this is a best-effort, format-unconfirmed regex, not a promoted extractor
 * profile in src/inbox/extractors/ (unlike UK/gov-uk.ts) because there is
 * no confirmed real sample to validate a profile against yet.
 */
function extractTwVerificationCode(msg: InboundMessage): string | null {
  const haystack = messageBody(msg);
  const m =
    /(?:驗證碼|認證碼|verification code|code)[^0-9]{0,12}(\d{4,8})/i.exec(haystack) ??
    /\b(\d{4,8})\b/.exec(haystack);
  return m ? m[1] : null;
}

export async function waitForTwVerificationCode(
  applicantId: string,
  timeoutMs: number = 120_000,
): Promise<TwVerificationCodeEmail> {
  const message = await inbox.waitForMessage(applicantId, isTwVerificationEmail, timeoutMs, {
    since: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  });
  const code = extractTwVerificationCode(message);
  if (!code) {
    throw new Error(`[tw-inbox] verification email ${message.id} matched but no code could be extracted`);
  }
  return { message, code };
}
