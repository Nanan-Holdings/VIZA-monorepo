"use client";

import { useTranslations } from "next-intl";
import { portalUrl } from "@/lib/utils";

interface Props {
  /** Internal country code (matches the portal application route). */
  country: string;
  /** Internal visa-type code (matches the portal application route). */
  visaType: string;
  className?: string;
}

/**
 * Final-step CTA on `/apply`. VIZA's service is free, so this hands the
 * visitor straight to the portal application for the chosen destination.
 * Signed-out visitors are sent to portal login first and returned here.
 * Plain <a>: the marketing site has no auth or payment SDK imports.
 */
export function StartApplicationButton({ country, visaType, className }: Props) {
  const t = useTranslations("cta");
  const href = portalUrl(
    `/client/application?country=${encodeURIComponent(country)}` +
      `&visaType=${encodeURIComponent(visaType)}`,
  );

  return (
    <a
      href={href}
      data-country={country}
      data-cta="start-application"
      className={`inline-flex items-center justify-center gap-2 w-full rounded-full bg-brand-500 px-5 py-3 text-sm font-medium text-white hover:bg-brand-400 transition-colors ${className ?? ""}`}
    >
      <span>{t("startFreeApplication")}</span>
    </a>
  );
}
