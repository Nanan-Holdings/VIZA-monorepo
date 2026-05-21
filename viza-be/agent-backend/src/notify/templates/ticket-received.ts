import type { NotificationTemplate } from "./index.js";
import { renderText } from "./index.js";

export const ticketReceivedTemplate: NotificationTemplate = {
  key: "ticket_received",
  schema: { subject: "string", ticket_id: "string" },
  subject: (p: Record<string, unknown>) => `We got your message: ${String(p.subject)}`,
  emailHtml: (p: Record<string, unknown>) =>
    renderText(
      `<p>Thanks — your support ticket is open (ID {{ticket_id}}).</p>
       <p>A team member will reply within one business day.</p>
       <p>VIZA</p>`,
      p,
    ),
  emailText: (p: Record<string, unknown>) =>
    renderText(
      `Thanks — your support ticket is open (ID {{ticket_id}}). A team member will reply within one business day.`,
      p,
    ),
  smsText: (p: Record<string, unknown>) =>
    renderText(`VIZA: Ticket {{ticket_id}} received. We'll reply within 1 business day.`, p),
};
