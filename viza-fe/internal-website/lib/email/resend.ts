/**
 * Tiny Resend REST helper (PAY-005).
 *
 * Avoids the official `resend` npm package — we send transactional
 * mail with a single POST and only need a couple of fields.
 */

const RESEND_API = "https://api.resend.com/emails";

export interface SendEmailInput {
  from: string;
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  /** [{ filename, content (base64), contentType? }] */
  attachments?: Array<{
    filename: string;
    content: string;
    contentType?: string;
  }>;
}

export interface SendEmailResult {
  id: string;
}

export async function sendEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY env not set");
  const res = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Resend ${res.status}: ${detail}`);
  }
  return (await res.json()) as SendEmailResult;
}
