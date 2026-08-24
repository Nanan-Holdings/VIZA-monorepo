"use client";

import { ArrowLeft } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import type { ButtonHTMLAttributes, MouseEvent } from "react";

import { cn } from "@/lib/utils";

const DEFAULT_BACK_FALLBACK = "/client/home";

type BackButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "type"> & {
  fallbackHref: string;
  label?: string;
};

export function getSafeInternalBackHref(
  href: string | null | undefined,
  origin = "https://app.viza.it.com",
  defaultHref = DEFAULT_BACK_FALLBACK,
): string {
  if (!href) return defaultHref;

  try {
    const parsed = new URL(href, origin);
    if (parsed.origin !== origin) return defaultHref;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return defaultHref;
  }
}

export function hasSameOriginHistoryEntry({
  historyLength,
  referrer,
  currentOrigin,
}: {
  historyLength: number;
  referrer: string;
  currentOrigin: string;
}): boolean {
  if (historyLength <= 1 || !referrer) return false;

  try {
    return new URL(referrer).origin === currentOrigin;
  } catch {
    return false;
  }
}

export function BackButton({
  className,
  fallbackHref,
  label = "返回",
  onClick,
  ...props
}: BackButtonProps) {
  const router = useRouter();

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    onClick?.(event);
    if (event.defaultPrevented) return;

    if (
      hasSameOriginHistoryEntry({
        historyLength: window.history.length,
        referrer: document.referrer,
        currentOrigin: window.location.origin,
      })
    ) {
      window.history.back();
      return;
    }

    router.push(getSafeInternalBackHref(fallbackHref, window.location.origin));
  }

  return (
    <button
      {...props}
      type="button"
      onClick={handleClick}
      className={cn(
        "inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[#03346E] transition hover:text-[#022754] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#03346E] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
    >
      <ArrowLeft aria-hidden="true" className="h-4 w-4" weight="bold" />
      <span>{label}</span>
    </button>
  );
}
