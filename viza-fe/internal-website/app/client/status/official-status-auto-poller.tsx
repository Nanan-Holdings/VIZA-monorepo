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
      router.refresh();
    }, pageRefreshMs);

    return () => {
      window.clearInterval(refreshTimer);
    };
  }, [applicationId, enabled, pageRefreshMs, router]);

  return null;
}
