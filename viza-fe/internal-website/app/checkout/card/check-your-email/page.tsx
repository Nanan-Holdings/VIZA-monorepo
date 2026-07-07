import {
  CHECK_EMAIL_COPY,
  CheckEmailCard,
} from "../../_components/check-email-card";

interface PageProps {
  searchParams: Promise<{ locale?: string }>;
}

const TITLE_BODY = {
  en: {
    title: "Check your inbox",
    body: "Thanks for your payment. We've emailed you a secure sign-in link — open it on this device to enter your VIZA client portal and track your application.",
  },
  "zh-CN": {
    title: "请查收您的邮箱",
    body: "感谢您的付款。我们已向您的邮箱发送了一封安全登录链接邮件，请在本设备打开，进入 VIZA 客户端并跟踪申请进度。",
  },
} as const;

/**
 * Stripe `success_url` landing for the guest card checkout. Payment
 * confirmation is webhook-driven (the guest branch of /api/stripe/webhook),
 * so this page only tells the visitor to watch their inbox for the
 * magic-link sign-in email.
 */
export default async function CheckYourEmailPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const locale = params.locale === "zh-CN" ? "zh-CN" : "en";
  return (
    <CheckEmailCard copy={{ ...CHECK_EMAIL_COPY[locale], ...TITLE_BODY[locale] }} />
  );
}
