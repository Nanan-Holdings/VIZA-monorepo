"use client";

import { useEffect } from "react";

export function OfficialStatusAutoPoller({
  applicationId,
  enabled,
  pageRefreshMs = 60_000,
  onRefresh,
}: {
  applicationId: string;
  enabled: boolean;
  pageRefreshMs?: number;
  /**
   * A caller-owned, narrowly scoped refresh. This intentionally does not
   * call router.refresh(): the status page is a server-rendered history view,
   * and refreshing the whole route every 15 seconds fanned out reads for every
   * application. Leave unset to disable background refresh and use the manual
   * status action instead.
   */
  onRefresh?: () => Promise<void> | void;
}) {
  useEffect(() => {
    if (!enabled || !applicationId || !onRefresh) return;
    let cancelled = false;
    let timer: number | null = null;

    const schedule = () => {
      if (cancelled || document.visibilityState !== "visible") return;
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(async () => {
        timer = null;
        if (cancelled || document.visibilityState !== "visible") return;
        await onRefresh();
        schedule();
      }, Math.max(15_000, pageRefreshMs));
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") schedule();
      else if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    schedule();

    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [applicationId, enabled, onRefresh, pageRefreshMs]);

  return null;
}
