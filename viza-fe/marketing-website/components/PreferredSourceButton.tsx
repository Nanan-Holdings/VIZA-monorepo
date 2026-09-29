"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Google's "Add to Preferred Sources" button, shown on the editorial and
 * informational pages only. Once a reader adds viza.it.com, Google favours it
 * in Top Stories and AI Mode for them.
 * https://developers.google.com/search/docs/appearance/preferred-sources
 *
 * publisher.js inflates `[google-add-preferred-source-btn]` divs only when its
 * init() runs, so after a client-side navigation the new div has to be handed
 * to init() again through the PREFERRED_SOURCE queue (which runs immediately
 * once the library has loaded, and is replayed by it before then).
 * news.google.com is allowlisted in script-src and frame-src in next.config.ts.
 */
const PATHS = /^(\/[a-z]{2}(-[a-z]{2,4})?)?\/(blog|visa|security|careers|events)(\/|$)/i;

const LIB = "https://news.google.com/swg/js/v1/publisher.js";

type PreferredSourceApi = { init: () => void };
type PreferredSourceQueue = { push: (fn: (api: PreferredSourceApi) => void) => void };

export default function PreferredSourceButton() {
  const pathname = usePathname() ?? "";
  const show = PATHS.test(pathname);

  useEffect(() => {
    if (!show) return;
    if (!document.querySelector(`script[src="${LIB}"]`)) {
      const s = document.createElement("script");
      s.async = true;
      s.src = LIB;
      document.head.appendChild(s);
    }
    const w = window as unknown as { PREFERRED_SOURCE?: PreferredSourceQueue | unknown[] };
    const queue = (w.PREFERRED_SOURCE ??= []) as PreferredSourceQueue;
    queue.push((api) => api.init());
  }, [show, pathname]);

  if (!show) return null;
  return (
    <div className="foot-preferred-source">
      <div google-add-preferred-source-btn="" data-theme="light" />
    </div>
  );
}
