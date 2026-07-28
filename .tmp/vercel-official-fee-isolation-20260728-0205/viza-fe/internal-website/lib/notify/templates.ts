/**
 * Per-event notification templates (CS-002).
 *
 * Each event renders to subject + plaintext + branded HTML (shared
 * shell in email-layout.ts). Plaintext is kept as the multipart
 * fallback. Variables come from `TemplateContext`.
 *
 * Locales: the guest-checkout welcome (`paid_welcome`) is fully
 * translated for the four client-portal locales (en, zh-CN, vi, es);
 * the status-transition events ship en + zh-CN and fall back to en
 * for vi/es until those translations are ops-reviewed.
 */

import { emailBody, escapeHtml, renderEmailLayout } from "./email-layout";

export type TransitionEvent =
  | "paid"
  | "runner_started"
  | "runner_input_needed"
  | "submitted"
  | "decision_issued"
  | "doc_ready"
  // Guest-checkout welcome + magic-link sign-in. `paid_welcome` is the
  // provider-agnostic key; `wechat_paid_welcome` is kept as an alias so
  // existing callers/tests don't break.
  | "paid_welcome"
  | "wechat_paid_welcome";

export type TemplateLocale = "en" | "zh-CN" | "vi" | "es";

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

const FOOTER = `\n\n— VIZA · viza.it.com\nManage notifications: /client/account/notifications`;

export interface RenderedTemplate {
  subject: string;
  text: string;
  /** Branded HTML body (email-layout.ts shell). */
  html: string;
  /** True when the event is essential (transactional) — silencing forbidden. */
  essential: boolean;
}

interface TransitionCopy {
  subject: string;
  heading: string;
  body: string;
  cta: string;
}

/** en + zh-CN copy per status event; vi/es fall back to en for now. */
const TRANSITION_COPY: Record<
  Exclude<TransitionEvent, "paid_welcome" | "wechat_paid_welcome">,
  { essential: boolean; en: TransitionCopy; "zh-CN": TransitionCopy }
> = {
  paid: {
    essential: true,
    en: {
      subject: "Payment received — {country} visa",
      heading: "Payment received",
      body: "We received your payment for the {country} {visa} application ({id}). The next step starts automatically — we'll keep you posted.",
      cta: "Open your portal",
    },
    "zh-CN": {
      subject: "付款成功 — {country} 签证",
      heading: "已收到您的付款",
      body: "我们已收到您 {country} {visa} 申请（{id}）的款项。下一步将自动开始，进展会及时通知您。",
      cta: "打开客户端",
    },
  },
  runner_started: {
    essential: false,
    en: {
      subject: "Submission started — {country} visa",
      heading: "Your application is being prepared",
      body: "We've started preparing your {country} {visa} application on the official portal. We'll let you know as soon as it's submitted.",
      cta: "Track progress",
    },
    "zh-CN": {
      subject: "开始递交 — {country} 签证",
      heading: "您的申请正在准备中",
      body: "我们已开始在官方网站上准备您的 {country} {visa} 申请，递交完成后会立即通知您。",
      cta: "查看进度",
    },
  },
  runner_input_needed: {
    essential: true,
    en: {
      subject: "Action needed on your {country} application",
      heading: "We need your input",
      body: "We need your input to continue your {country} {visa} application. {detail}",
      cta: "Continue application",
    },
    "zh-CN": {
      subject: "您的 {country} 申请需要补充信息",
      heading: "需要您补充信息",
      body: "继续办理您的 {country} {visa} 申请需要您的补充信息。{detail}",
      cta: "继续申请",
    },
  },
  submitted: {
    essential: false,
    en: {
      subject: "Submitted — {country} visa",
      heading: "Your application is submitted",
      body: "Your {country} {visa} application is submitted. {detail}",
      cta: "View application",
    },
    "zh-CN": {
      subject: "已递交 — {country} 签证",
      heading: "您的申请已递交",
      body: "您的 {country} {visa} 申请已递交。{detail}",
      cta: "查看申请",
    },
  },
  decision_issued: {
    essential: true,
    en: {
      subject: "Decision issued — {country} visa",
      heading: "A decision has been issued",
      body: "The {country} authorities issued a decision on your {visa} application. {detail}",
      cta: "View decision",
    },
    "zh-CN": {
      subject: "签证结果已出 — {country} 签证",
      heading: "签证结果已出",
      body: "{country} 官方已就您的 {visa} 申请作出决定。{detail}",
      cta: "查看结果",
    },
  },
  doc_ready: {
    essential: false,
    en: {
      subject: "Document ready — {country} visa",
      heading: "Your visa document is ready",
      body: "Your visa document is ready. {detail}",
      cta: "Download document",
    },
    "zh-CN": {
      subject: "签证文件已就绪 — {country} 签证",
      heading: "签证文件已就绪",
      body: "您的签证文件已生成。{detail}",
      cta: "下载文件",
    },
  },
};

const TRANSITION_DETAIL_DEFAULT: Record<string, { en: string; "zh-CN": string }> = {
  submitted: {
    en: "Decision typically arrives within the published SLA.",
    "zh-CN": "结果通常会在公示的处理时限内出具。",
  },
  doc_ready: {
    en: "Download from the portal — keep a printed copy for travel.",
    "zh-CN": "请在客户端下载，出行时建议随身携带打印件。",
  },
};

function fill(tpl: string, ctx: TemplateContext, detail: string): string {
  return tpl
    .replace(/\{country\}/g, ctx.countryLabel)
    .replace(/\{visa\}/g, ctx.visaTypeLabel)
    .replace(/\{id\}/g, ctx.applicationId)
    .replace(/\{detail\}/g, detail)
    .trim();
}

export function renderTemplate(
  event: TransitionEvent,
  ctx: TemplateContext,
  locale: TemplateLocale = "en",
): RenderedTemplate {
  if (event === "paid_welcome" || event === "wechat_paid_welcome") {
    return renderPaidWelcome(ctx, locale);
  }

  const entry = TRANSITION_COPY[event];
  const loc: "en" | "zh-CN" = locale === "zh-CN" ? "zh-CN" : "en";
  const copy = entry[loc];
  const detail =
    ctx.detail ?? TRANSITION_DETAIL_DEFAULT[event]?.[loc] ?? "";
  const link = ctx.appUrl ?? "/client/home";
  const greeting =
    loc === "zh-CN" ? `您好 ${ctx.applicantName}，` : `Hi ${ctx.applicantName},`;

  const subject = fill(copy.subject, ctx, detail);
  const bodyLine = fill(copy.body, ctx, detail);

  return {
    essential: entry.essential,
    subject,
    text: `${greeting}\n\n${bodyLine}\n\n${link}` + FOOTER,
    html: renderEmailLayout({
      title: subject,
      bodyHtml: emailBody(copy.heading, [
        escapeHtml(greeting),
        escapeHtml(bodyLine),
      ]),
      cta: { label: copy.cta, url: link },
      finePrint:
        loc === "zh-CN"
          ? "如需管理通知偏好，请前往客户端的通知设置。"
          : "Manage your notification preferences from the client portal.",
    }),
  };
}

interface WelcomeCopy {
  subject: string;
  heading: string;
  greeting: string;
  body: string;
  cta: string;
  finePrint: string;
}

const WELCOME_COPY: Record<TemplateLocale, WelcomeCopy> = {
  en: {
    subject: "Payment received — {country} visa (VIZA)",
    heading: "Welcome to VIZA",
    greeting: "Hi {name},",
    body: "We received your payment for the {country} {visa} application. Click the button below to sign in to your VIZA client portal and track your application.",
    cta: "Sign in to your portal",
    finePrint:
      "This is a single-use sign-in link. If it expires, sign in with the same email at /client/login. Do not share it with anyone.",
  },
  "zh-CN": {
    subject: "付款成功 — {country} 签证 (VIZA)",
    heading: "欢迎来到 VIZA",
    greeting: "您好 {name}，",
    body: "我们已收到您 {country} {visa} 申请的款项。点击下方按钮登录 VIZA 客户端，跟踪您的申请进度。",
    cta: "登录客户端",
    finePrint:
      "此登录链接仅可使用一次。如链接失效，请前往 /client/login 使用同一邮箱重新登录。请勿分享给任何人。",
  },
  vi: {
    subject: "Đã nhận thanh toán — thị thực {country} (VIZA)",
    heading: "Chào mừng đến với VIZA",
    greeting: "Xin chào {name},",
    body: "Chúng tôi đã nhận được khoản thanh toán cho hồ sơ thị thực {country} {visa} của bạn. Nhấn nút bên dưới để đăng nhập cổng khách hàng VIZA và theo dõi hồ sơ.",
    cta: "Đăng nhập cổng khách hàng",
    finePrint:
      "Liên kết đăng nhập chỉ dùng một lần. Nếu hết hạn, hãy đăng nhập bằng cùng email tại /client/login. Không chia sẻ liên kết này với bất kỳ ai.",
  },
  es: {
    subject: "Pago recibido — visado de {country} (VIZA)",
    heading: "Bienvenido a VIZA",
    greeting: "Hola {name},",
    body: "Hemos recibido tu pago para la solicitud de visado {visa} de {country}. Haz clic en el botón para iniciar sesión en tu portal de cliente VIZA y seguir tu solicitud.",
    cta: "Iniciar sesión en el portal",
    finePrint:
      "Este enlace de inicio de sesión es de un solo uso. Si caduca, inicia sesión con el mismo correo en /client/login. No lo compartas con nadie.",
  },
};

function renderPaidWelcome(
  ctx: TemplateContext,
  locale: TemplateLocale,
): RenderedTemplate {
  if (!ctx.magicLink) {
    throw new Error("paid_welcome template requires magicLink");
  }
  const copy = WELCOME_COPY[locale] ?? WELCOME_COPY.en;
  const sub = (s: string) =>
    s
      .replace(/\{name\}/g, ctx.applicantName)
      .replace(/\{country\}/g, ctx.countryLabel)
      .replace(/\{visa\}/g, ctx.visaTypeLabel);

  const subject = sub(copy.subject);
  const greeting = sub(copy.greeting);
  const body = sub(copy.body);

  return {
    essential: true,
    subject,
    text:
      `${greeting}\n\n${body}\n\n${ctx.magicLink}\n\n(${copy.finePrint})\n` +
      `\n— VIZA · viza.it.com`,
    html: renderEmailLayout({
      title: subject,
      bodyHtml: emailBody(copy.heading, [
        escapeHtml(greeting),
        escapeHtml(body),
      ]),
      cta: { label: copy.cta, url: ctx.magicLink },
      finePrint: escapeHtml(copy.finePrint),
    }),
  };
}
