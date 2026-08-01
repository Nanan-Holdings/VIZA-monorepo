"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

function eventFromLink(anchor: HTMLAnchorElement) {
  const href = anchor.href;
  const url = new URL(href);
  const label = anchor.getAttribute("aria-label") || anchor.textContent?.trim() || undefined;
  const country = url.searchParams.get("country") || anchor.dataset.country || undefined;
  const paymentMethod = anchor.dataset.paymentMethod || undefined;

  if (url.hostname === "app.viza.it.com") {
    if (url.pathname.startsWith("/checkout/")) {
      return {
        event: "checkout_start" as const,
        params: { destination_country: country, payment_method: paymentMethod || url.pathname.split("/").pop() },
      };
    }
    return { event: "portal_click" as const, params: { link_text: label, destination_path: url.pathname } };
  }

  if (url.pathname.endsWith("/apply") || url.pathname === "/apply") {
    return { event: "apply_start" as const, params: { destination_country: country, link_text: label } };
  }

  if (url.protocol === "tel:" || url.protocol === "mailto:") {
    return { event: "contact_channel_click" as const, params: { channel: url.protocol.replace(":", ""), link_text: label } };
  }

  return null;
}

export default function MarketingAnalytics() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (!anchor?.href) return;

      try {
        const inferred = eventFromLink(anchor);
        if (inferred) trackEvent(inferred.event, inferred.params);
      } catch {
        // Ignore malformed hrefs or browser extensions mutating links.
      }
    };

    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
