import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import en from "@/messages/en.json";
import zh from "@/messages/zh.json";
import VerifyEmailPage from "@/app/verify-email/page";
import ResetPasswordPage from "@/app/auth/reset-password/page";

const auth = vi.hoisted(() => ({ resend: vi.fn().mockResolvedValue({ error: { status: 429 } }) }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("email=test%40example.invalid"),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth }) }));
vi.mock("@/app/actions/password-reset", () => ({ updatePassword: vi.fn() }));
vi.mock("@/lib/supabase/env", () => ({ normalizeSupabaseEnvValue: () => "test-only" }));
vi.mock("@supabase/ssr", () => ({ createBrowserClient: () => ({ auth: {
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
  getSession: async () => ({ data: { session: {} } }),
} }) }));

function localized(locale: "en" | "zh", child: ReactNode) {
  return <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : zh}>{child}</NextIntlClientProvider>;
}

describe("standalone authentication locale alignment", () => {
  it("updates an existing resend failure without sending another email", async () => {
    const result = render(localized("en", <VerifyEmailPage />));
    fireEvent.click(screen.getByRole("button", { name: "Resend verification email" }));
    await screen.findByText(en.emailVerification.rateLimited);
    result.rerender(localized("zh", <VerifyEmailPage />));
    expect(screen.getByText(zh.emailVerification.rateLimited)).toBeTruthy();
    expect(auth.resend).toHaveBeenCalledTimes(1);
    expect(screen.getByText("test@example.invalid")).toBeTruthy();
  });

  it("keeps password input while switching all reset labels and validation", async () => {
    const result = render(localized("en", <ResetPasswordPage />));
    const input = await screen.findByLabelText("New password");
    fireEvent.change(input, { target: { value: "short" } });
    fireEvent.submit(input.closest("form")!);
    await waitFor(() => expect(screen.getByText(en.passwordReset.shortPassword)).toBeTruthy());
    result.rerender(localized("zh", <ResetPasswordPage />));
    expect(screen.getByLabelText("新密码")).toHaveProperty("value", "short");
    expect(screen.getByText(zh.passwordReset.shortPassword)).toBeTruthy();
    expect(screen.getByRole("button", { name: "显示密码" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "更新密码" })).toBeTruthy();
  });
});
