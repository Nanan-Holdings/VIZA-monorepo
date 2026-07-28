"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, RotateCw } from "lucide-react";

export function OfficialStatusRefreshButton({
  applicationId,
  label,
  loadingLabel,
  errorLabel,
  locale,
}: {
  applicationId: string;
  label: string;
  loadingLabel: string;
  errorLabel: string;
  locale: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/applications/${applicationId}/official-status/refresh`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: unknown;
        status?: "queued" | "deduplicated" | "cooldown";
        retryAfterSeconds?: number;
      } | null;
      if (!response.ok) {
        throw new Error(typeof payload?.error === "string" ? payload.error : `${errorLabel} (${response.status})`);
      }
      if (payload?.status === "cooldown") {
        const minutes = Math.ceil((payload.retryAfterSeconds ?? 60) / 60);
        setNotice(locale.startsWith("zh") ? `请在 ${minutes} 分钟后重试。` : `Please try again in ${minutes} min.`);
      } else if (payload?.status === "deduplicated") {
        setNotice(locale.startsWith("zh") ? "已有官网查询正在排队。" : "A status check is already queued.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={refresh}
        disabled={loading}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-[#dce5f0] bg-white px-4 py-2 text-[14px] font-semibold text-brand-500 transition hover:border-brand-300 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
        {loading ? loadingLabel : label}
      </button>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {notice && <p className="text-sm text-[#66758a]">{notice}</p>}
    </div>
  );
}
