import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY?.trim();
const resend = resendApiKey ? new Resend(resendApiKey) : null;

const OPERATOR_EMAIL = "edward.zehua.zhang@gmail.com";
const UUID_PATTERN =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const CEAC_APPLICATION_ID_PATTERN = /\bAA[A-Z0-9]{8,10}\b/g;

function redactIdentifier(value: string): string {
  if (value.length <= 8) return "<redacted>";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function redactSensitiveText(value: string): string {
  return value
    .replace(UUID_PATTERN, (match) => redactIdentifier(match))
    .replace(CEAC_APPLICATION_ID_PATTERN, (match) => redactIdentifier(match));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendFailureAlert(
  applicationId: string,
  lastError: string
): Promise<void> {
  const redactedApplicationId = redactSensitiveText(applicationId);
  const redactedLastError = redactSensitiveText(lastError);

  if (!resend) {
    console.warn(
      `[alert] RESEND_API_KEY is missing. Skipping failure email for application ${redactedApplicationId}.`
    );
    return;
  }

  const { error } = await resend.emails.send({
    from: "VIZA Submission Service <noreply@viza.app>",
    to: OPERATOR_EMAIL,
    subject: `[VIZA] Submission failed after 3 attempts — ${redactedApplicationId}`,
    html: `
      <h2>Submission Failure Alert</h2>
      <p>Application <strong>${redactedApplicationId}</strong> has failed to submit after 3 attempts and requires manual intervention.</p>
      <h3>Last Error</h3>
      <pre>${escapeHtml(redactedLastError)}</pre>
      <p>Please review the submission_queue table and resolve the issue manually.</p>
    `,
  });

  if (error) {
    console.error("[alert] Failed to send email alert:", error);
  } else {
    console.log(`[alert] Failure alert sent for application ${redactedApplicationId}`);
  }
}
