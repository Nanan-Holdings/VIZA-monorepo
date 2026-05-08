import type { NotificationTemplate } from "./index.js";
import { renderText } from "./index.js";

export const paymentReceivedTemplate: NotificationTemplate = {
  key: "payment_received",
  schema: {
    applicant_name: "string",
    amount_display: "string",
    receipt_url: "url",
  },
  subject: (_p: Record<string, unknown>) => `Payment received — VIZA`,
  emailHtml: (p: Record<string, unknown>) =>
    renderText(
      `<p>Hi {{applicant_name}},</p>
       <p>We received your payment of <strong>{{amount_display}}</strong>. Receipt:
       <a href="{{receipt_url}}">{{receipt_url}}</a></p>
       <p>VIZA</p>`,
      p,
    ),
  emailText: (p: Record<string, unknown>) =>
    renderText(
      `Hi {{applicant_name}}, payment of {{amount_display}} received. Receipt: {{receipt_url}}`,
      p,
    ),
  smsText: (p: Record<string, unknown>) => renderText(`VIZA: Payment {{amount_display}} received.`, p),
};
