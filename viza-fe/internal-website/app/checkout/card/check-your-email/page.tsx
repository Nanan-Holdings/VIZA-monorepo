interface PageProps {
  searchParams: Promise<{ locale?: string }>;
}

const COPY = {
  en: {
    title: "Payment received — check your inbox",
    body: "Thanks for your payment. We've sent you a sign-in link. Open it on this device to enter your VIZA client portal and track your application.",
    footer:
      "Didn't get it? Check spam, or sign in with the same email at /client/login.",
  },
  "zh-CN": {
    title: "支付成功 — 请前往邮箱查收登录链接",
    body: "感谢您的付款。我们已向您的邮箱发送了一封登录链接邮件。请在本设备打开链接，进入 VIZA 客户端并跟踪申请进度。",
    footer: "没收到？请检查垃圾邮件，或在 /client/login 使用同一邮箱登录。",
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
  const t = COPY[locale];
  return (
    <main className="min-h-screen bg-bg-1 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-sm text-center">
        <h1 className="text-xl font-medium text-foreground">{t.title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{t.body}</p>
        <p className="mt-6 text-xs text-muted-foreground">{t.footer}</p>
      </div>
    </main>
  );
}
