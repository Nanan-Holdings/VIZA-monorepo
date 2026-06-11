import { fireEvent, render, screen } from "@testing-library/react";
import type { ImgHTMLAttributes } from "react";
import { describe, expect, it, vi } from "vitest";
import ClientSignupPage from "../page";

vi.mock("next/image", () => ({
  default: ({ priority: _priority, ...props }: ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) => (
    <img {...props} />
  ),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next-intl", () => {
  const messages: Record<string, string> = {
    "auth.signup.title": "创建您的账户",
    "auth.signup.subtitle": "输入电子邮件，开始设置您的 VIZA 账户。",
    "auth.signup.emailPlaceholder": "输入您的电子邮件",
    "auth.signup.referralCodePlaceholder": "Referral code（选填）",
    "auth.signup.referralCodeHint": "新用户注册时填写 referral code，两边账号各获得 99 积分。",
    "auth.signup.acceptTos": "我同意",
    "auth.signup.acceptPrivacy": "我同意",
    "auth.signup.acceptDisclaimer": "我同意",
    "auth.signup.termsOfService": "服务条款",
    "auth.signup.privacyPolicy": "隐私政策",
    "auth.signup.disclaimer": "免责声明",
    "auth.signup.sendCodeButton": "发送验证码",
    "auth.polaroids.sanFrancisco": "旧金山",
    "auth.polaroids.newYork": "纽约",
    "auth.polaroids.tokyo": "东京",
    "auth.polaroids.sydney": "悉尼",
    "auth.polaroids.beijing": "北京",
    "auth.polaroids.egypt": "埃及",
    "auth.polaroids.pisa": "比萨",
    "auth.polaroids.singapore": "新加坡",
  };

  return {
    useLocale: () => "zh",
    useTranslations: (namespace: string) => (key: string) =>
      messages[`${namespace}.${key}`] ?? `${namespace}.${key}`,
  };
});

vi.mock("cobe", () => ({
  default: () => ({
    update: vi.fn(),
    destroy: vi.fn(),
  }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/app/actions/client-auth", () => ({
  prepareAuthEmailLocale: vi.fn(),
}));

vi.mock("@/components/client/auth-language-switcher", () => ({
  AuthLanguageSwitcher: () => <div data-testid="language-switcher" />,
}));

vi.mock("@/lib/i18n/locale", () => ({
  normalizeAuthEmailLocale: () => "zh",
}));

describe("ClientSignupPage consent requirements", () => {
  it("requires terms, privacy, and disclaimer consent before sending a signup code", async () => {
    render(<ClientSignupPage />);

    const sendButton = screen.getByRole("button", { name: "发送验证码" });

    expect(screen.getAllByRole("link", { name: "服务条款" })[0]).toHaveAttribute("href", "/terms");
    expect(screen.getAllByRole("link", { name: "隐私政策" })[0]).toHaveAttribute("href", "/privacy");
    expect(screen.getAllByRole("link", { name: "免责声明" })[0]).toHaveAttribute("href", "/disclaimer");
    expect(sendButton).toBeDisabled();

    fireEvent.click(screen.getByLabelText(/服务条款/));
    fireEvent.click(screen.getByLabelText(/隐私政策/));
    expect(sendButton).toBeDisabled();

    fireEvent.click(screen.getByLabelText(/免责声明/));
    expect(sendButton).not.toBeDisabled();
  });
});
