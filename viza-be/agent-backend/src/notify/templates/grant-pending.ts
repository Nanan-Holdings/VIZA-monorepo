import type { NotificationTemplate } from "./index.js";
import { renderText } from "./index.js";

export const grantPendingTemplate: NotificationTemplate = {
  key: "grant_pending",
  schema: { applicant_name: "string", country: "string", trn: "string" },
  subject: (p: Record<string, unknown>) => `${String(p.country)}: waiting on government decision`,
  emailHtml: (p: Record<string, unknown>) =>
    renderText(
      `<p>Hi {{applicant_name}},</p>
       <p>Your {{country}} application is now in the government queue (TRN <strong>{{trn}}</strong>).
       We'll email again the moment the decision posts — usually within a few business days.</p>
       <p>VIZA</p>`,
      p,
    ),
  emailText: (p: Record<string, unknown>) =>
    renderText(
      `Hi {{applicant_name}}, your {{country}} application is awaiting a government decision (TRN {{trn}}). VIZA will email when it posts.`,
      p,
    ),
  smsText: (p: Record<string, unknown>) =>
    renderText(`VIZA: {{country}} app waiting on gov decision (TRN {{trn}}). We'll text when it posts.`, p),
};
