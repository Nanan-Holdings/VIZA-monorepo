"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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
  const [status, setStatus] = useState(initialStatus);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

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
          Application status (live)
        </p>
        <p className="text-base font-semibold text-[#232323] font-mono">
          {status}
        </p>
      </div>
      <p className="text-xs text-[#6b6b6b]">
        {updatedAt
          ? `updated ${new Date(updatedAt).toLocaleTimeString()}`
          : "subscribed"}
      </p>
    </div>
  );
}
