"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { normalizeInterfaceLocale } from "@/lib/i18n/locale";
import { ADMIN_APPLICATION_COPY } from "../copy";

/**
 * Live application-status pill (OPS-001).
 *
 * Subscribes to Postgres changes on `applications` filtered to the
 * row id we're rendering, so the page reflects runner-driven status
 * transitions without reload.
 */
export function RealtimeApplicationStatus({
  applicationId,
  initialStatus,
}: {
  applicationId: string;
  initialStatus: string;
}) {
  const locale = normalizeInterfaceLocale(useLocale());
  const copy = ADMIN_APPLICATION_COPY[locale];
  const [status, setStatus] = useState(initialStatus);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const lifecycleLabels = copy.status.lifecycle as Record<string, string>;

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`application-${applicationId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "applications",
          filter: `id=eq.${applicationId}`,
        },
        (payload) => {
          const next = payload.new as { status?: string; updated_at?: string };
          if (next.status) setStatus(next.status);
          if (next.updated_at) setUpdatedAt(next.updated_at);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [applicationId]);

  return (
    <div className="bg-white rounded-lg border border-[#efefef] shadow-sm p-4 flex items-center justify-between text-sm">
      <div>
        <p className="text-[#6b6b6b] uppercase tracking-wider text-xs">
          {locale === "zh" ? "申请状态（实时）" : "Application status (live)"}
        </p>
        <p className="text-base font-semibold text-[#232323] font-mono">
          {lifecycleLabels[status] ?? status.replaceAll("_", " ")}
        </p>
      </div>
      <p className="text-xs text-[#6b6b6b]">
        {updatedAt
          ? `${copy.common.updated} ${new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-SG", {
              hour: "2-digit",
              minute: "2-digit",
            }).format(new Date(updatedAt))}`
          : locale === "zh" ? "已订阅" : "subscribed"}
      </p>
    </div>
  );
}
