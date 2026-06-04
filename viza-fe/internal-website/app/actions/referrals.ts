"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/resend";

type InviteLocale = "en" | "zh";

export type SendReferralInviteResult =
  | { success: true }
  | {
      success: false;
      error:
        | "not_authenticated"
        | "invalid_email"
        | "missing_referral_code"
        | "email_not_configured"
        | "send_failed";
    };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeLocale(locale: string): InviteLocale {
  return locale.toLowerCase().startsWith("zh") ? "zh" : "en";
}

async function getAppBaseUrl() {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_BASE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL;

  if (configured) return configured.replace(/\/$/, "");

  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  const proto = requestHeaders.get("x-forwarded-proto") ?? "http";

  return host ? `${proto}://${host}` : "http://127.0.0.1:3000";
}

function textFor(locale: InviteLocale, input: { inviterName: string; referralCode: string; signupUrl: string }) {
  if (locale === "zh") {
    return {
      subject: `${input.inviterName} 邀请您加入 VIZA，双方各得 99 积分`,
      text: [
        `${input.inviterName} 邀请您加入 VIZA。`,
        "",
        `注册时使用 referral code：${input.referralCode}`,
        "新用户成功注册后，您和邀请人各获得 99 VIZA 积分。",
        "",
        `开始注册：${input.signupUrl}`,
        "",
        "VIZA 团队",
      ].join("\n"),
      cta: "开始注册",
      intro: `${input.inviterName} 邀请您加入 VIZA。`,
      body: `注册时使用 referral code：${input.referralCode}。新用户成功注册后，您和邀请人各获得 99 VIZA 积分。`,
    };
  }

  return {
    subject: `${input.inviterName} invited you to VIZA. You both get 99 points`,
    text: [
      `${input.inviterName} invited you to join VIZA.`,
      "",
      `Use referral code: ${input.referralCode}`,
      "After a new user signs up successfully, both accounts receive 99 VIZA points.",
      "",
      `Start here: ${input.signupUrl}`,
      "",
      "The VIZA team",
    ].join("\n"),
    cta: "Start registration",
    intro: `${input.inviterName} invited you to join VIZA.`,
    body: `Use referral code ${input.referralCode}. After a new user signs up successfully, both accounts receive 99 VIZA points.`,
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderHtmlEmail(copy: ReturnType<typeof textFor>, signupUrl: string) {
  return `
    <div style="font-family: Inter, Arial, sans-serif; color: #172033; line-height: 1.6; max-width: 560px; margin: 0 auto;">
      <h1 style="color: #03346E; font-size: 24px; line-height: 1.25; margin: 0 0 16px;">VIZA referral</h1>
      <p style="font-size: 16px; margin: 0 0 12px;">${escapeHtml(copy.intro)}</p>
      <p style="font-size: 16px; margin: 0 0 24px;">${escapeHtml(copy.body)}</p>
      <a href="${escapeHtml(signupUrl)}" style="display: inline-block; background: #03346E; color: #ffffff; text-decoration: none; border-radius: 999px; padding: 12px 20px; font-weight: 600;">${escapeHtml(copy.cta)}</a>
      <p style="font-size: 13px; color: #667085; margin: 24px 0 0;">${escapeHtml(signupUrl)}</p>
    </div>
  `;
}

export async function sendReferralInvite(
  email: string,
  locale: string,
): Promise<SendReferralInviteResult> {
  const recipient = email.trim().toLowerCase();

  if (!EMAIL_RE.test(recipient)) {
    return { success: false, error: "invalid_email" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "not_authenticated" };
  }

  const code = `VIZA-${user.id.toUpperCase()}`;

  const { data: profile } = await supabase
    .from("applicant_profiles")
    .select("full_name")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const inviterName =
    profile?.full_name?.trim() || user.email?.split("@")[0] || "A VIZA user";
  const signupUrl = `${await getAppBaseUrl()}/client/signup?referral=${encodeURIComponent(code)}`;
  const copy = textFor(normalizeLocale(locale), { inviterName, referralCode: code, signupUrl });

  try {
    await sendEmail({
      from: "VIZA <updates@haggstorm.com>",
      to: recipient,
      subject: copy.subject,
      text: copy.text,
      html: renderHtmlEmail(copy, signupUrl),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("RESEND_API_KEY")) {
      return { success: false, error: "email_not_configured" };
    }

    console.error("[referrals] failed to send invite", error);
    return { success: false, error: "send_failed" };
  }

  return { success: true };
}
