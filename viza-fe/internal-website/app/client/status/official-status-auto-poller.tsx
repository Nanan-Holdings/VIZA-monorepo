"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export function OfficialStatusAutoPoller({
  applicationId,
  enabled,
  pageRefreshMs = 15000,
  officialRefreshMs = SIX_HOURS_MS,
}: {
  applicationId: string;
  enabled: boolean;
  pageRefreshMs?: number;
  officialRefreshMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled || !applicationId) return;
    let cancelled = false;
    const storageKey = `viza:official-status-refresh:${applicationId}`;

    const queueOfficialRefreshIfDue = async () => {
      const last = Number(window.localStorage.getItem(storageKey) ?? "0");
      if (Number.isFinite(last) && Date.now() - last < officialRefreshMs) return;
      window.localStorage.setItem(storageKey, String(Date.now()));
      await fetch(`/api/applications/${applicationId}/official-status/refresh`, {
        method: "POST",
      }).catch(() => undefined);
    };

    void queueOfficialRefreshIfDue();
    const refreshTimer = window.setInterval(() => {
      if (!cancelled) router.refresh();
    }, pageRefreshMs);
    const officialTimer = window.setInterval(() => {
      if (!cancelled) void queueOfficialRefreshIfDue();
    }, officialRefreshMs);

    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
      window.clearInterval(officialTimer);
    };
  }, [applicationId, enabled, officialRefreshMs, pageRefreshMs, router]);

  return null;
}
