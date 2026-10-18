/**
 * Sender and locale resolution for applicant notification email.
 *
 * Every applicant-facing status email goes out through
 * `lib/notify/dispatch.ts`, which uses these helpers so the admin
 * "status email" button, staff outcome actions and the external
 * submission ingest all share one verified sender.
 *
 * The Resend sandbox sender (`onboarding@resend.dev`) only delivers to
 * the Resend account owner, so it is never accepted: a sandbox or
 * malformed value falls through to the next candidate and finally to
 * the verified `viza.it.com` default.
 */

import type { TemplateLocale } from "./templates";

export const DEFAULT_NOTIFY_FROM = "VIZA <updates@viza.it.com>";

const ADDRESS_PATTERN = /<?([^<>\s@]+@([^<>\s@]+\.[^<>\s@]+))>?\s*$/;

export function senderDomain(from: string): string | null {
  const match = from.trim().match(ADDRESS_PATTERN);
  return match ? match[2].toLowerCase() : null;
}

function isUsableSender(value: string | undefined | null): value is string {
  if (!value || !value.trim()) return false;
  const domain = senderDomain(value);
  if (!domain) return false;
  return domain !== "resend.dev" && !domain.endsWith(".resend.dev");
}

/**
 * RESEND_FROM_EMAIL wins, then NOTIFY_FROM_EMAIL, then the verified
 * default. A bare address gets the "VIZA" display name.
 */
export function resolveNotifyFrom(
  env: Record<string, string | undefined> = process.env,
): string {
  const candidate = [env.RESEND_FROM_EMAIL, env.NOTIFY_FROM_EMAIL].find(isUsableSender);
  if (!candidate) return DEFAULT_NOTIFY_FROM;
  const trimmed = candidate.trim();
  return trimmed.includes("<") ? trimmed : `VIZA <${trimmed}>`;
}

const CHINESE_NATIONALITIES = new Set(["cn", "chn", "china", "中国", "prc", "people's republic of china"]);

/**
 * Applicant email locale: an explicit `language_pref` wins; with no
 * preference, a Chinese nationality gets Chinese, everyone else English.
 */
export function resolveApplicantLocale(
  languagePref: string | null | undefined,
  nationality?: string | null,
): TemplateLocale {
  const pref = languagePref?.trim().toLowerCase();
  if (pref) return pref.startsWith("zh") ? "zh-CN" : "en";
  const nat = nationality?.trim().toLowerCase();
  return nat && CHINESE_NATIONALITIES.has(nat) ? "zh-CN" : "en";
}

export function portalOrigin(env: Record<string, string | undefined> = process.env): string {
  return (env.NEXT_PUBLIC_SITE_URL || env.NEXT_PUBLIC_APP_URL || "https://app.viza.it.com").replace(/\/+$/, "");
}
