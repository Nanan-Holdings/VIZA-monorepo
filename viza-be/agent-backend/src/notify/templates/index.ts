/**
 * Per-event notification templates (NOTIFY-002).
 *
 * One file per template_key. Each template exports:
 *   - subject(payload)        -> email subject
 *   - emailHtml(payload)      -> rendered HTML
 *   - emailText(payload)      -> plain-text fallback
 *   - smsText(payload)        -> SMS body (160-char target)
 *   - schema                  -> variable contract for QA + the worker
 */

import { docReadyTemplate } from "./doc-ready.js";
import { grantPendingTemplate } from "./grant-pending.js";
import { biometricsPendingTemplate } from "./biometrics-pending.js";
import { paymentReceivedTemplate } from "./payment-received.js";
import { applicationSubmittedTemplate } from "./application-submitted.js";
import { applicationDecisionTemplate } from "./application-decision.js";
import { passwordResetTemplate } from "./password-reset.js";
import { signupVerifyTemplate } from "./signup-verify.js";

export interface NotificationTemplate {
  key: string;
  schema: Record<string, "string" | "number" | "boolean" | "url" | "date" | "string?">;
  subject: (payload: Record<string, unknown>) => string;
  emailHtml: (payload: Record<string, unknown>) => string;
  emailText: (payload: Record<string, unknown>) => string;
  smsText: (payload: Record<string, unknown>) => string;
}

export const TEMPLATES: Record<string, NotificationTemplate> = {
  doc_ready: docReadyTemplate,
  grant_pending: grantPendingTemplate,
  biometrics_pending: biometricsPendingTemplate,
  payment_received: paymentReceivedTemplate,
  application_submitted: applicationSubmittedTemplate,
  application_decision: applicationDecisionTemplate,
  password_reset: passwordResetTemplate,
  signup_verify: signupVerifyTemplate,
};

export function resolveTemplate(key: string): NotificationTemplate | null {
  return TEMPLATES[key] ?? null;
}

export function validatePayload(template: NotificationTemplate, payload: Record<string, unknown>): string | null {
  for (const [field, kind] of Object.entries(template.schema)) {
    const optional = kind.endsWith("?");
    const value = payload[field];
    if (value === undefined || value === null) {
      if (optional) continue;
      return `Missing required field '${field}' for template '${template.key}'`;
    }
  }
  return null;
}

export function renderText(template: string, payload: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = payload[key];
    return value === undefined || value === null ? "" : String(value);
  });
}
