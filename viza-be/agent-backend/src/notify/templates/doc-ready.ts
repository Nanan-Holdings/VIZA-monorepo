import type { NotificationTemplate } from "./index.js";
import { renderText } from "./index.js";

export const docReadyTemplate: NotificationTemplate = {
  key: "doc_ready",
  schema: {
    applicant_name: "string",
    country: "string",
    visa_type: "string",
    download_url: "url",
  },
  subject: (p: Record<string, unknown>) => `Your ${String(p.country)} visa is ready`,
  emailHtml: (p: Record<string, unknown>) => renderText(
    `<p>Hi {{applicant_name}},</p>
     <p>Your <strong>{{country}} {{visa_type}}</strong> visa document is ready. Download it here:</p>
     <p><a href="{{download_url}}">{{download_url}}</a></p>
     <p>VIZA</p>`,
    p,
  ),
  emailText: (p: Record<string, unknown>) => renderText(
    `Hi {{applicant_name}},\nYour {{country}} {{visa_type}} visa document is ready.\nDownload: {{download_url}}\n\nVIZA`,
    p,
  ),
  smsText: (p: Record<string, unknown>) => renderText(`VIZA: Your {{country}} visa is ready. {{download_url}}`, p),
};
