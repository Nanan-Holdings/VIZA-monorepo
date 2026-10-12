"use client";

import { useEffect } from "react";
import { CONSENT_COOKIE, hasAnalyticsConsent, type PurchaseEvent } from "@/lib/analytics/google";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function readConsentCookie(): string | undefined {
  if (typeof document === "undefined") return undefined;
  return document.cookie
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${CONSENT_COOKIE}=`))
    ?.split("=")[1];
}

/**
 * Fires the GA4 `purchase` event for a confirmed checkout return.
 *
 * Rendered only when Stripe has confirmed the payment, so reaching this
 * component is itself the success condition — there is no client-side status
 * check to get wrong.
 *
 * Consent is re-checked here rather than trusted from the layout: an applicant
 * can withdraw consent after the page was rendered, and this event is the one
 * carrying an order value.
 *
 * Guarded twice against double counting: a per-transaction sessionStorage key
 * survives a page reload, and GA4 independently discards repeat
 * `transaction_id` values. Storage access is wrapped because private-mode
 * browsers throw on it; if it throws we still send the event, since GA4's own
 * de-duplication is the stronger of the two guards.
 */
export function PurchaseAnalytics({ purchase }: { purchase: PurchaseEvent }) {
  const { transactionId, value, currency, country, visaType } = purchase;

  useEffect(() => {
    if (!hasAnalyticsConsent(readConsentCookie())) return;
    if (typeof window.gtag !== "function") return;

    const storageKey = `viza:purchase-sent:${transactionId}`;

    try {
      if (window.sessionStorage.getItem(storageKey)) return;
    } catch {
      // Private mode or blocked storage — fall through and let GA4 de-duplicate.
    }

    window.gtag("event", "purchase", {
      transaction_id: transactionId,
      value,
      currency,
      ...(country ? { country } : {}),
      ...(visaType ? { visa_type: visaType } : {}),
    });

    try {
      window.sessionStorage.setItem(storageKey, "1");
    } catch {
      // Non-fatal: the event has already been sent.
    }
  }, [transactionId, value, currency, country, visaType]);

  return null;
}
