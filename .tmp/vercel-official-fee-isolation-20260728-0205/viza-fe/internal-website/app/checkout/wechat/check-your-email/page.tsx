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
    body: "Your WeChat payment is confirmed. We've emailed you a secure sign-in link — open it on this device to enter your VIZA client portal.",
  },
  "zh-CN": {
    title: "请查收您的邮箱",
    body: "您的微信支付已确认。我们已向您的邮箱发送了一封安全登录链接邮件，请在本设备打开，进入 VIZA 客户端。",
  },
} as const;

export default async function CheckYourEmailPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const locale = params.locale === "zh-CN" ? "zh-CN" : "en";
  return (
    <CheckEmailCard copy={{ ...CHECK_EMAIL_COPY[locale], ...TITLE_BODY[locale] }} />
  );
}
