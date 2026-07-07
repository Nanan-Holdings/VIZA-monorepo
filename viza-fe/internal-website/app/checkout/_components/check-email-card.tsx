import Image from "next/image";
import Link from "next/link";

/**
 * Shared branded confirmation card for the guest-checkout
 * "check your email" landings (card + WeChat variants differ only in
 * copy). Server Component — no interactivity.
 */

export interface CheckEmailCopy {
  badge: string;
  title: string;
  body: string;
  steps: [string, string, string];
  stepsTitle: string;
  signIn: string;
  footer: string;
}

export const CHECK_EMAIL_COPY: Record<"en" | "zh-CN", Omit<CheckEmailCopy, "title" | "body">> = {
  en: {
    badge: "Payment confirmed",
    stepsTitle: "What happens next",
    steps: [
      "Open the sign-in link we just emailed you",
      "Review your application details in the portal",
      "We prepare and submit your visa — you track every step",
    ],
    signIn: "Go to sign in",
    footer: "Didn't get the email? Check your spam folder, or sign in with the same email address.",
  },
  "zh-CN": {
    badge: "支付成功",
    stepsTitle: "接下来",
    steps: [
      "打开我们刚发送到您邮箱的登录链接",
      "在客户端确认您的申请信息",
      "我们为您准备并递交签证申请，进度全程可查",
    ],
    signIn: "前往登录",
    footer: "没收到邮件？请检查垃圾邮件，或使用同一邮箱直接登录。",
  },
};

export function CheckEmailCard({ copy }: { copy: CheckEmailCopy }) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-brand-50 to-white flex flex-col items-center px-6 py-10">
      <div className="w-full max-w-lg">
        <Image src="/logo/viza-logo-blue.svg" alt="VIZA" width={80} height={24} priority />
      </div>

      <div className="w-full max-w-lg mt-6 rounded-2xl border border-brand-100 bg-white shadow-[0_8px_30px_rgba(3,52,110,0.08)] overflow-hidden">
        <div className="px-8 pt-10 pb-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 ring-8 ring-brand-50/60">
            <svg
              width="30"
              height="30"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-brand-500"
              aria-hidden="true"
            >
              <rect x="2" y="4" width="20" height="16" rx="3" />
              <path d="m2 7 10 6 10-6" />
            </svg>
          </div>

          <span className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {copy.badge}
          </span>

          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-brand-500">
            {copy.title}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {copy.body}
          </p>
        </div>

        <div className="border-t border-brand-100 bg-brand-50/50 px-8 py-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-brand-400">
            {copy.stepsTitle}
          </div>
          <ol className="mt-3 space-y-3">
            {copy.steps.map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-foreground">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[11px] font-semibold text-white">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <Link
            href="/client/login"
            className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-brand-500 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-400"
          >
            {copy.signIn}
          </Link>
        </div>
      </div>

      <p className="mt-6 max-w-lg text-center text-xs leading-relaxed text-muted-foreground">
        {copy.footer}
      </p>
    </main>
  );
}
