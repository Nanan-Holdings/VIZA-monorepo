interface PageProps {
  searchParams: Promise<{ locale?: string }>;
}

const COPY = {
  en: {
    title: "Check your inbox",
    body: "We've sent you a sign-in link. Open it on this device to enter your VIZA client portal.",
    footer: "Didn't get it? Check spam, or sign in with the same email at /client/login.",
  },
  "zh-CN": {
    title: "请前往邮箱查收登录链接",
    body: "我们已向您的邮箱发送了一封登录链接邮件。请在本设备打开链接，进入 VIZA 客户端。",
    footer: "没收到？请检查垃圾邮件，或在 /client/login 使用同一邮箱登录。",
  },
} as const;

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
