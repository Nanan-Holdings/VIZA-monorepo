"use client";

/**
 * Warms the portal's other tabs once the current page has gone quiet.
 *
 * Tab switches are dominated by round trips the applicant has to wait through
 * after clicking. Most of that work can be done while they are still reading
 * the page they are on: the destination route's code, and — for the
 * application wizard — the reads it opens with. By the time they click, the
 * answer is usually already in memory.
 *
 * It runs after an idle callback so it never competes with the current page's
 * own loading, and only for signed-in portal routes.
 */

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  getActiveApplicationFormHref,
} from "@/lib/client/active-application-selection";
import {
  getRecentApplicationFormHref,
  readApplicationFormTarget,
} from "@/lib/client/recent-application-form";
import { prefetchApplicationForm } from "@/lib/client/portal-data";

/** Routes worth having ready; the applicant reaches these from every page. */
const WARM_ROUTES = ["/client/home", "/client/application", "/client/settings"];

function whenIdle(callback: () => void) {
  const requestIdle = (
    window as unknown as {
      requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number;
    }
  ).requestIdleCallback;
  if (requestIdle) {
    requestIdle(callback, { timeout: 2_000 });
    return;
  }
  window.setTimeout(callback, 500);
}

export function PortalPrefetcher() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname.startsWith("/client/login") || pathname.startsWith("/client/signup")) {
      return;
    }

    let cancelled = false;
    whenIdle(() => {
      if (cancelled) return;

      for (const route of WARM_ROUTES) {
        if (!pathname.startsWith(route)) router.prefetch(route);
      }

      // The Application tab reopens whichever form the applicant had last, so
      // warm that one specifically rather than the chooser page.
      if (pathname.startsWith("/client/application")) return;
      const href = getActiveApplicationFormHref() ?? getRecentApplicationFormHref();
      const target = href ? readApplicationFormTarget(href) : null;
      if (!target) return;
      router.prefetch(target.href);
      prefetchApplicationForm({
        applicationId: target.applicationId,
        visaType: target.visaType,
        country: target.country,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  return null;
}
