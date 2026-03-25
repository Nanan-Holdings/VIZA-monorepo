import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const OPERATOR_EMAIL = "edward.zehua.zhang@gmail.com";

export async function sendFailureAlert(
  applicationId: string,
  lastError: string
): Promise<void> {
  const { error } = await resend.emails.send({
    from: "VIZA Submission Service <noreply@viza.app>",
    to: OPERATOR_EMAIL,
    subject: `[VIZA] Submission failed after 3 attempts — ${applicationId}`,
    html: `
      <h2>Submission Failure Alert</h2>
      <p>Application <strong>${applicationId}</strong> has failed to submit after 3 attempts and requires manual intervention.</p>
      <h3>Last Error</h3>
      <pre>${lastError}</pre>
      <p>Please review the submission_queue table and resolve the issue manually.</p>
    `,
  });

  if (error) {
    console.error("[alert] Failed to send email alert:", error);
  } else {
    console.log(`[alert] Failure alert sent for application ${applicationId}`);
  }
}
