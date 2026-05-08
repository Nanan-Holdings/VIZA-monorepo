import type { NotificationTemplate } from "./index.js";
import { renderText } from "./index.js";

export const signupVerifyTemplate: NotificationTemplate = {
  key: "signup_verify",
  schema: { verify_url: "url", applicant_name: "string?" },
  subject: (_p: Record<string, unknown>) => "Verify your VIZA account",
  emailHtml: (p: Record<string, unknown>) =>
    renderText(
      `<p>Welcome to VIZA{{applicant_name}}.</p>
       <p>Click below to verify your email address — link is single-use:</p>
       <p><a href="{{verify_url}}">{{verify_url}}</a></p>
       <p>VIZA</p>`,
      p,
    ),
  emailText: (p: Record<string, unknown>) =>
    renderText(
      `Welcome to VIZA. Verify email: {{verify_url}}`,
      p,
    ),
  smsText: (p: Record<string, unknown>) => renderText(`VIZA: Verify {{verify_url}}`, p),
};
