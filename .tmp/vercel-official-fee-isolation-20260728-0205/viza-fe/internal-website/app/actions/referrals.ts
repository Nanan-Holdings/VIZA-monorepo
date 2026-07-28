"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { prepareAuthEmailLocale } from "@/app/actions/client-auth";
import { normalizeAuthEmailLocale } from "@/lib/i18n/locale";

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
  const emailLocale = normalizeAuthEmailLocale(locale);

  try {
    await prepareAuthEmailLocale(recipient, emailLocale);

    const { error } = await supabase.auth.signInWithOtp({
      email: recipient,
      options: {
        shouldCreateUser: true,
        data: {
          role: "client",
          user_type: "client",
          locale: emailLocale,
          language: emailLocale,
          preferred_language: emailLocale,
          referral_code: code,
          referral_inviter_name: inviterName,
          referral_invite_subject: copy.subject,
          referral_invite_text: copy.text,
        },
        emailRedirectTo: signupUrl,
      },
    });

    if (error) throw error;
  } catch (error) {
    console.error("[referrals] failed to send invite", error);
    return { success: false, error: "send_failed" };
  }

  return { success: true };
}
