"use client";

import { useLayoutEffect, useRef, useState, type RefObject } from "react";

/** Keep the form aligned with Home without dispatching for every form mutation. */
export function useContentAlignment(contentRef: RefObject<HTMLElement | null>): number {
  const [alignment, setAlignment] = useState(0);
  const appliedAlignment = useRef(0);

  useLayoutEffect(() => {
    let pendingFrame: number | null = null;
    let disposed = false;

    const measure = () => {
      pendingFrame = null;
      if (disposed) return;
      const homeAnchor = Array.from(document.querySelectorAll<HTMLElement>("[data-nav-anchor='Home']"))
        .find((element) => element.getBoundingClientRect().width > 0);
      const content = contentRef.current;
      if (!homeAnchor || !content) return;

      const nextAlignment = Math.max(0,
        homeAnchor.getBoundingClientRect().left - content.getBoundingClientRect().left);
      // Radix portals mutate the DOM while opening/closing. Avoid scheduling a
      // React update from their observer microtasks when geometry is unchanged.
      if (Math.abs(appliedAlignment.current - nextAlignment) < 0.5) return;
      appliedAlignment.current = nextAlignment;
      setAlignment(nextAlignment);
    };

    const scheduleMeasure = () => {
      if (!disposed && pendingFrame === null) {
        pendingFrame = window.requestAnimationFrame(measure);
      }
    };

    measure();
    scheduleMeasure();
    const timer = window.setTimeout(scheduleMeasure, 100);
    const observer = new MutationObserver(scheduleMeasure);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-nav-anchor"],
    });
    window.addEventListener("resize", scheduleMeasure);
    return () => {
      disposed = true;
      if (pendingFrame !== null) window.cancelAnimationFrame(pendingFrame);
      window.clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
    };
  }, [contentRef]);

  return alignment;
}
