import type { NotificationTemplate } from "./index.js";
import { renderText } from "./index.js";

export const passwordResetTemplate: NotificationTemplate = {
  key: "password_reset",
  schema: { applicant_name: "string", reset_url: "url", expiry_minutes: "number" },
  subject: (_p: Record<string, unknown>) => "Reset your VIZA password",
  emailHtml: (p: Record<string, unknown>) =>
    renderText(
      `<p>Hi {{applicant_name}},</p>
       <p>Reset your password (link expires in {{expiry_minutes}} minutes):</p>
       <p><a href="{{reset_url}}">{{reset_url}}</a></p>
       <p>If you didn't request this, ignore this email.</p>
       <p>VIZA</p>`,
      p,
    ),
  emailText: (p: Record<string, unknown>) =>
    renderText(
      `Hi {{applicant_name}}, reset your password (expires {{expiry_minutes}} min): {{reset_url}}. Ignore if not requested.`,
      p,
    ),
  smsText: (p: Record<string, unknown>) => renderText(`VIZA reset link (expires {{expiry_minutes}}m): {{reset_url}}`, p),
};
