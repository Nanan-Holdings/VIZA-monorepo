import type { NotificationTemplate } from "./index.js";
import { renderText } from "./index.js";

export const applicationSubmittedTemplate: NotificationTemplate = {
  key: "application_submitted",
  schema: {
    applicant_name: "string",
    country: "string",
    visa_type: "string",
    application_url: "url",
  },
  subject: (p: Record<string, unknown>) => `Your ${String(p.country)} application is submitted`,
  emailHtml: (p: Record<string, unknown>) =>
    renderText(
      `<p>Hi {{applicant_name}},</p>
       <p>Your <strong>{{country}} {{visa_type}}</strong> application is submitted to the
       government. Track status here:</p>
       <p><a href="{{application_url}}">{{application_url}}</a></p>
       <p>VIZA</p>`,
      p,
    ),
  emailText: (p: Record<string, unknown>) =>
    renderText(
      `Hi {{applicant_name}}, your {{country}} {{visa_type}} app is submitted. Track: {{application_url}}`,
      p,
    ),
  smsText: (p: Record<string, unknown>) => renderText(`VIZA: {{country}} app submitted. {{application_url}}`, p),
};
