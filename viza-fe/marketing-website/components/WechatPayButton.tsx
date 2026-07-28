"use client";

import { useLocale, useTranslations } from "next-intl";
import { portalUrl } from "@/lib/utils";

interface Props {
  /** Internal country code (matches portal `lib/pricing.ts`). */
  country: string;
  /** Internal visa-type code (matches portal `lib/pricing.ts`). */
  visaType: string;
  /** Visual variant: `block` matches the existing full-width CTA pill;
   *  `inline` is for chip-style placement next to another button. */
  variant?: "block" | "inline";
  className?: string;
  /** Prefill for the portal checkout form (collected by the /apply wizard). */
  email?: string;
  fullName?: string;
  /** Base64url wizard payload (passport OCR, arrival date, tier) — opaque here,
   *  decoded server-side by the portal (lib/checkout/prefill.ts). */
  prefill?: string;
}

/**
 * Marketing-side CTA that deep-links into the portal's WeChat Pay
 * Native checkout. Plain <a> — by design, this file has zero payment
 * or auth SDK imports (per marketing-website CLAUDE.md non-negotiables).
 *
 * The actual checkout flow lives in
 * `viza-fe/internal-website/app/checkout/wechat`.
 */
export function WechatPayButton({
  country,
  visaType,
  variant = "block",
  className,
  email,
  fullName,
  prefill,
}: Props) {
  const locale = useLocale();
  const t = useTranslations("cta");
  const href = portalUrl(
    `/checkout/wechat?country=${encodeURIComponent(country)}` +
      `&visa=${encodeURIComponent(visaType)}` +
      `&locale=${encodeURIComponent(locale)}` +
      (email ? `&email=${encodeURIComponent(email)}` : "") +
      (fullName ? `&name=${encodeURIComponent(fullName)}` : "") +
      (prefill ? `&prefill=${encodeURIComponent(prefill)}` : ""),
  );

  const base =
    variant === "block"
      ? "inline-flex items-center justify-center gap-2 w-full rounded-full px-5 py-3 text-sm font-medium"
      : "inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium";

  return (
    <a
      href={href}
      className={`${base} bg-wechat text-white hover:bg-wechat-hover transition-colors ${className ?? ""}`}
    >
      <WechatGlyph />
      <span>{t("payWithWechat")}</span>
    </a>
  );
}

function WechatGlyph() {
  // Minimal mark — official WeChat green (#07C160) was tested above.
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8.5 4C4.91 4 2 6.46 2 9.5c0 1.69.91 3.2 2.34 4.21l-.5 1.86 2.13-1.07c.79.22 1.64.34 2.53.34.27 0 .54-.01.81-.04A4.96 4.96 0 0 1 9 14c0-2.76 2.91-5 6.5-5 .27 0 .54.01.8.04C15.7 7.06 12.45 4 8.5 4Zm-2.5 4.3a.85.85 0 1 1 0-1.7.85.85 0 0 1 0 1.7Zm5 0a.85.85 0 1 1 0-1.7.85.85 0 0 1 0 1.7Zm9.7 4.7c0-2.49-2.42-4.5-5.4-4.5-3 0-5.42 2.01-5.42 4.5 0 2.5 2.42 4.5 5.42 4.5.71 0 1.39-.11 2.02-.31l1.78.97-.49-1.62A4.18 4.18 0 0 0 20.7 13Zm-7.05-1a.7.7 0 1 1 0-1.4.7.7 0 0 1 0 1.4Zm3.85 0a.7.7 0 1 1 0-1.4.7.7 0 0 1 0 1.4Z" />
    </svg>
  );
}
