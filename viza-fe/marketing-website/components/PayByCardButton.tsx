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
  /** Wizard payload posted to the portal handoff endpoint. It must never be
   *  placed in a URL because it contains applicant PII. */
  prefill?: string;
  betaToken?: string;
}

/**
 * Marketing-side CTA POSTs applicant state to the portal's encrypted handoff
 * endpoint before guest card checkout. This file has zero payment or auth SDK
 * imports (per marketing-website CLAUDE.md non-negotiables).
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
  prefill,
  betaToken,
}: Props) {
  const locale = useLocale();
  const t = useTranslations("cta");
  const action = portalUrl("/api/checkout/handoff");

  const base =
    variant === "block"
      ? "inline-flex items-center justify-center gap-2 w-full rounded-full px-5 py-3 text-sm font-medium"
      : "inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium";

  return (
    <form action={action} method="post">
      <input type="hidden" name="paymentMethod" value="card" />
      <input type="hidden" name="country" value={country} />
      <input type="hidden" name="visaType" value={visaType} />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="email" value={email ?? ""} />
      <input type="hidden" name="fullName" value={fullName ?? ""} />
      <input type="hidden" name="prefill" value={prefill ?? ""} />
      <input type="hidden" name="betaToken" value={betaToken ?? ""} />
      <button
        type="submit"
        data-country={country}
        data-payment-method="card"
        className={`${base} bg-brand-500 text-white hover:bg-brand-400 transition-colors ${className ?? ""}`}
      >
        <CardGlyph />
        <span>{t("payByCard")}</span>
      </button>
    </form>
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
