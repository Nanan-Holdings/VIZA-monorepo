import type { NotificationTemplate } from "./index.js";
import { renderText } from "./index.js";

export const applicationDecisionTemplate: NotificationTemplate = {
  key: "application_decision",
  schema: {
    applicant_name: "string",
    country: "string",
    decision: "string",
    application_url: "url",
  },
  subject: (p: Record<string, unknown>) => `${String(p.country)} application: ${String(p.decision)}`,
  emailHtml: (p: Record<string, unknown>) =>
    renderText(
      `<p>Hi {{applicant_name}},</p>
       <p>Your {{country}} application decision is in: <strong>{{decision}}</strong>.</p>
       <p>Details: <a href="{{application_url}}">{{application_url}}</a></p>
       <p>VIZA</p>`,
      p,
    ),
  emailText: (p: Record<string, unknown>) =>
    renderText(
      `Hi {{applicant_name}}, {{country}} decision: {{decision}}. Details: {{application_url}}`,
      p,
    ),
  smsText: (p: Record<string, unknown>) => renderText(`VIZA: {{country}} decision: {{decision}}. {{application_url}}`, p),
};
