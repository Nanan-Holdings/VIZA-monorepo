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
  | "doc_ready"
  | "wechat_paid_welcome";

export type TemplateLocale = "en" | "zh-CN";

export interface TemplateContext {
  applicantName: string;
  applicationId: string;
  countryLabel: string;
  visaTypeLabel: string;
  /** Transition-specific extras. */
  detail?: string;
  appUrl?: string;
  /** Magic-link URL — required for wechat_paid_welcome. */
  magicLink?: string;
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
  locale: TemplateLocale = "en",
): RenderedTemplate {
  const link = ctx.appUrl ?? "/client/home";
  if (event === "wechat_paid_welcome") {
    return renderWechatPaidWelcome(ctx, locale);
  }
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

function renderWechatPaidWelcome(
  ctx: TemplateContext,
  locale: TemplateLocale,
): RenderedTemplate {
  if (!ctx.magicLink) {
    throw new Error("wechat_paid_welcome template requires magicLink");
  }
  if (locale === "zh-CN") {
    return {
      essential: true,
      subject: `付款成功 — ${ctx.countryLabel} 签证 (VIZA)`,
      text:
        `您好 ${ctx.applicantName}，\n\n` +
        `我们已收到您 ${ctx.countryLabel} ${ctx.visaTypeLabel} 申请的微信支付款项。` +
        `点击下方链接登录 VIZA 客户端，继续您的申请：\n\n` +
        `${ctx.magicLink}\n\n` +
        `（链接有效期内一次性使用。如果链接失效，可前往 /client/login 使用同一邮箱重新登录。）\n` +
        `\n— VIZA · haggstorm.com`,
    };
  }
  return {
    essential: true,
    subject: `Payment received — ${ctx.countryLabel} visa (VIZA)`,
    text:
      `Hi ${ctx.applicantName},\n\n` +
      `We received your WeChat Pay payment for the ${ctx.countryLabel} ${ctx.visaTypeLabel} application. ` +
      `Click the link below to sign in to your VIZA client portal and continue:\n\n` +
      `${ctx.magicLink}\n\n` +
      `(Single-use link. If it expires, sign in with the same email at /client/login.)\n` +
      `\n— VIZA · haggstorm.com`,
  };
}
