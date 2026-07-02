import { inbox, type InboundMessage } from "../inbox/wait-for-message";
import { extractAuto } from "../inbox/extractors";

const US_VISA_SCHEDULING_FROM = /(^|@|\.)(usvisascheduling\.com|microsoftonline\.com)$/i;

function isUSVisaSchedulingVerification(msg: InboundMessage): boolean {
  if (!US_VISA_SCHEDULING_FROM.test(msg.from_addr)) return false;
  return /(us visa|american citizen services|verify|verification|code|account|email)/i.test(msg.subject ?? "");
}

export interface USAppointmentVerificationEmail {
  message: InboundMessage;
  code: string | null;
  link: string | null;
}

export async function waitForUSAppointmentVerificationEmail(
  applicantId: string,
  timeoutMs: number = 90_000,
): Promise<USAppointmentVerificationEmail> {
  const message = await inbox.waitForMessage(
    applicantId,
    isUSVisaSchedulingVerification,
    timeoutMs,
  );
  const parsed = extractAuto({
    from: message.from_addr,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
  if (parsed.profileId !== "usvisascheduling") {
    throw new Error(
      `[us-appointment-inbox] message ${message.id} matched but did not use usvisascheduling extractor`,
    );
  }
  return {
    message,
    code: parsed.code ?? null,
    link: parsed.link ?? null,
  };
}
