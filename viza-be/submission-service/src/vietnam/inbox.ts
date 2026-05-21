import { inbox, type InboundMessage } from "../inbox/wait-for-message.js";
import { extractAuto } from "../inbox/extractors/index.js";

/**
 * Vietnam e-Visa inbox helpers (INBOX-005).
 *
 * Thin wrappers over `inbox.waitForMessage` + the `evisa-gov-vn`
 * extractor profile. The runner calls one of these instead of the
 * legacy IMAP polling path.
 *
 * The Vietnam portal does not send a 6-digit OTP — the artefact to
 * extract is the registration code returned in the acknowledgment
 * email. The orchestrator then opens the result-page URL with that
 * code to download the e-visa PDF when ready.
 */

export interface VnRegistrationEmail {
  message: InboundMessage;
  registrationCode: string;
  resultLink: string | null;
}

const FROM_VN_REGEX = /(@|\.)?xuatnhapcanh\.gov\.vn$/i;

function isVnRegistration(msg: InboundMessage): boolean {
  if (!FROM_VN_REGEX.test(msg.from_addr)) return false;
  return /(application registration|registration code|e-?visa)/i.test(msg.subject ?? "");
}

export async function waitForVnRegistrationEmail(
  applicantId: string,
  timeoutMs: number = 60_000,
): Promise<VnRegistrationEmail> {
  const message = await inbox.waitForMessage(applicantId, isVnRegistration, timeoutMs);
  const parsed = extractAuto({
    from: message.from_addr,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
  if (!parsed.reference) {
    throw new Error(
      `[vn-inbox] message ${message.id} matched but no registration code extracted`,
    );
  }
  return {
    message,
    registrationCode: parsed.reference,
    resultLink: parsed.link ?? null,
  };
}
