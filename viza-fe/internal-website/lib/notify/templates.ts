/**
 * Per-event notification templates (CS-002).
 *
 * Six transition events. Each renders to a subject + plaintext body
 * — html template is deferred (Resend supports plaintext + html, but
 * the runbook calls for "templated", which plaintext satisfies for
 * the MVP). Variables come from `TemplateContext`.
 */

export type TransitionEvent =
  | "paid"
  | "runner_started"
  | "runner_input_needed"
  | "submitted"
  | "decision_issued"
  | "doc_ready";

export interface TemplateContext {
  applicantName: string;
  applicationId: string;
  countryLabel: string;
  visaTypeLabel: string;
  /** Transition-specific extras. */
  detail?: string;
  appUrl?: string;
}

const FOOTER = `\n\n— VIZA · haggstorm.com\nManage notifications: /client/account/notifications`;

export interface RenderedTemplate {
  subject: string;
  text: string;
  /** True when the event is essential (transactional) — silencing forbidden. */
  essential: boolean;
}

export function renderTemplate(
  event: TransitionEvent,
  ctx: TemplateContext,
): RenderedTemplate {
  const link = ctx.appUrl ?? "/client/home";
  const lead = `Hi ${ctx.applicantName},\n\n`;
  switch (event) {
    case "paid":
      return {
        essential: true,
        subject: `Payment received — ${ctx.countryLabel} visa`,
        text:
          lead +
          `We received your payment for the ${ctx.countryLabel} ${ctx.visaTypeLabel} application (${ctx.applicationId}). The runner will start next.\n\n${link}` +
          FOOTER,
      };
    case "runner_started":
      return {
        essential: false,
        subject: `Submission started — ${ctx.countryLabel} visa`,
        text:
          lead +
          `We've started preparing your ${ctx.countryLabel} ${ctx.visaTypeLabel} application on the official portal. We'll let you know as soon as it's submitted.\n\n${link}` +
          FOOTER,
      };
    case "runner_input_needed":
      return {
        essential: true,
        subject: `Action needed on your ${ctx.countryLabel} application`,
        text:
          lead +
          `We need your input to continue your ${ctx.countryLabel} ${ctx.visaTypeLabel} application. ${ctx.detail ?? ""}\n\nOpen your portal: ${link}` +
          FOOTER,
      };
    case "submitted":
      return {
        essential: false,
        subject: `Submitted — ${ctx.countryLabel} visa`,
        text:
          lead +
          `Your ${ctx.countryLabel} ${ctx.visaTypeLabel} application is submitted. ${ctx.detail ?? "Decision typically arrives within the published SLA."}\n\n${link}` +
          FOOTER,
      };
    case "decision_issued":
      return {
        essential: true,
        subject: `Decision issued — ${ctx.countryLabel} visa`,
        text:
          lead +
          `The ${ctx.countryLabel} authorities issued a decision on your ${ctx.visaTypeLabel} application. ${ctx.detail ?? ""}\n\nOpen your portal: ${link}` +
          FOOTER,
      };
    case "doc_ready":
      return {
        essential: false,
        subject: `Document ready — ${ctx.countryLabel} visa`,
        text:
          lead +
          `Your visa document is ready. ${ctx.detail ?? "Download from the portal — keep a printed copy for travel."}\n\n${link}` +
          FOOTER,
      };
  }
}
