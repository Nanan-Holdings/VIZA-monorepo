"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * EU cookie-consent banner (PRODUCT-008).
 *
 * Sets a first-party cookie `viza_cookie_consent={accept|reject|configure}`
 * once the user makes a choice. Until then we render the banner and any
 * non-essential script (analytics, Sentry session replay) is held back
 * by reading `getConsent()` before initialising.
 *
 * Lives in `components/` so it can be mounted from the root layout. Do
 * NOT call analytics SDKs until `getConsent() === 'accept'`.
 */

const COOKIE_KEY = "viza_cookie_consent";

type Choice = "accept" | "reject" | "configure";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function writeCookie(name: string, value: string): void {
  if (typeof document === "undefined") return;
  const maxAge = 60 * 60 * 24 * 365; // 1 year
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function getConsent(): Choice | null {
  const v = readCookie(COOKIE_KEY);
  if (v === "accept" || v === "reject" || v === "configure") return v;
  return null;
}

export function CookieConsentBanner() {
  const [choice, setChoice] = useState<Choice | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setChoice(getConsent());
    setHydrated(true);
  }, []);

  if (!hydrated || choice !== null) return null;

  const decide = (next: Choice): void => {
    writeCookie(COOKIE_KEY, next);
    setChoice(next);
  };

  return (
    <div
      role="dialog"
      aria-labelledby="cookie-consent-heading"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-input bg-white shadow-lg"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-foreground">
          <p id="cookie-consent-heading" className="font-medium">
            Cookies
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Essential cookies always on. Analytics + session-replay only with your consent.{" "}
            <Link href="/legal/cookies" className="font-medium text-brand-500 hover:underline">
              Details
            </Link>
            .
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => decide("reject")}>
            Reject
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => decide("configure")}>
            Configure
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => decide("accept")}
            className="bg-brand-500 hover:bg-brand-400"
          >
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
