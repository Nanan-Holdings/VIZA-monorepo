import { inbox, type InboundMessage } from "../inbox/wait-for-message";
import { extractAuto } from "../inbox/extractors";

export interface USAppointmentVerificationRequest {
  since: string;
  accountEmail: string;
  applicationId: string;
  accountId: string;
}

export function isUSVisaSchedulingVerification(
  msg: InboundMessage,
  request: USAppointmentVerificationRequest,
): boolean {
  if (msg.to_addr.trim().toLowerCase() !== request.accountEmail.trim().toLowerCase()) return false;
  const receivedAt = Date.parse(msg.received_at);
  if (!Number.isFinite(receivedAt) || receivedAt < Date.parse(request.since)) return false;
  const parsed = extractAuto({ from: msg.from_addr, subject: msg.subject, text: msg.text, html: msg.html });
  // B2C China uses a code. A link-only message must not be consumed as its OTP.
  return parsed.profileId === "usvisascheduling"
    && /(verify|verification|security code|one[- ]?time|otp)/i.test(msg.subject ?? "")
    && /^\d{4,8}$/.test(parsed.code ?? "");
}

export interface USAppointmentVerificationEmail {
  message: InboundMessage;
  code: string | null;
  link: string | null;
}

export async function waitForUSAppointmentVerificationEmail(
  applicantId: string,
  timeoutMs: number,
  request: USAppointmentVerificationRequest,
): Promise<USAppointmentVerificationEmail> {
  if (!request.accountEmail.trim() || !Number.isFinite(Date.parse(request.since))) {
    throw new Error("US appointment verification requires the bound email and current code-request time.");
  }
  const message = await inbox.waitForAppointmentAccountMessage(
    { applicantId, applicationId: request.applicationId, accountId: request.accountId, portal: "usvisascheduling" },
    (candidate) => isUSVisaSchedulingVerification(candidate, request),
    timeoutMs,
    { since: request.since, newestFirst: true },
  );
  const parsed = extractAuto({
    from: message.from_addr,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
  if (parsed.profileId !== "usvisascheduling") {
    throw new Error(
      "US appointment message did not use the expected verification extractor.",
    );
  }
  return {
    message,
    code: parsed.code ?? null,
    link: parsed.link ?? null,
  };
}
