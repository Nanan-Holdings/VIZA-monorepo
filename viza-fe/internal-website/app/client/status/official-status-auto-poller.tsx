"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function OfficialStatusAutoPoller({
  applicationId,
  enabled,
  pageRefreshMs = 15000,
}: {
  applicationId: string;
  enabled: boolean;
  pageRefreshMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled || !applicationId) return;
    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, pageRefreshMs);

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(refreshTimer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [applicationId, enabled, pageRefreshMs, router]);

  return null;
}
