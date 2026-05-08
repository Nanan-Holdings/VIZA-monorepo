import type { NotificationTemplate } from "./index.js";
import { renderText } from "./index.js";

export const biometricsPendingTemplate: NotificationTemplate = {
  key: "biometrics_pending",
  schema: {
    applicant_name: "string",
    country: "string",
    booking_url: "url",
    deadline_date: "date",
  },
  subject: (_p: Record<string, unknown>) => `Book your biometrics appointment`,
  emailHtml: (p: Record<string, unknown>) =>
    renderText(
      `<p>Hi {{applicant_name}},</p>
       <p>Your {{country}} application has cleared the document review. Book your biometrics
       (fingerprints + photo) by <strong>{{deadline_date}}</strong>:</p>
       <p><a href="{{booking_url}}">{{booking_url}}</a></p>
       <p>VIZA</p>`,
      p,
    ),
  emailText: (p: Record<string, unknown>) =>
    renderText(
      `Hi {{applicant_name}}, your {{country}} app needs biometrics by {{deadline_date}}. Book: {{booking_url}}`,
      p,
    ),
  smsText: (p: Record<string, unknown>) =>
    renderText(`VIZA: Book {{country}} biometrics by {{deadline_date}} at {{booking_url}}`, p),
};
