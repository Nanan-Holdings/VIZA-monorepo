"use client";

import { useLocale, useTranslations } from "next-intl";
import { portalUrl } from "@/lib/utils";

interface Props {
  /** Internal country code (matches portal `lib/pricing.ts`). */
  country: string;
  /** Internal visa-type code (matches portal `lib/pricing.ts`). */
  visaType: string;
  /** Visual variant: `block` matches the full-width CTA pill;
   *  `inline` is for chip-style placement next to another button. */
  variant?: "block" | "inline";
  className?: string;
  /** Prefill for the portal checkout form (collected by the /apply wizard). */
  email?: string;
  fullName?: string;
}

/**
 * Marketing-side CTA that deep-links into the portal's guest card
 * checkout (Stripe). Plain <a> — by design, this file has zero payment
 * or auth SDK imports (per marketing-website CLAUDE.md non-negotiables).
 *
 * The actual checkout flow lives in
 * `viza-fe/internal-website/app/checkout/card`. On payment the portal
 * emails a magic-link sign-in, so the visitor needs no account first.
 */
export function PayByCardButton({
  country,
  visaType,
  variant = "block",
  className,
  email,
  fullName,
}: Props) {
  const locale = useLocale();
  const t = useTranslations("cta");
  const href = portalUrl(
    `/checkout/card?country=${encodeURIComponent(country)}` +
      `&visa=${encodeURIComponent(visaType)}` +
      `&locale=${encodeURIComponent(locale)}` +
      (email ? `&email=${encodeURIComponent(email)}` : "") +
      (fullName ? `&name=${encodeURIComponent(fullName)}` : ""),
  );

  const base =
    variant === "block"
      ? "inline-flex items-center justify-center gap-2 w-full rounded-full px-5 py-3 text-sm font-medium"
      : "inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium";

  return (
    <a
      href={href}
      className={`${base} bg-brand-500 text-white hover:bg-brand-400 transition-colors ${className ?? ""}`}
    >
      <CardGlyph />
      <span>{t("payByCard")}</span>
    </a>
  );
}

function CardGlyph() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  );
}
