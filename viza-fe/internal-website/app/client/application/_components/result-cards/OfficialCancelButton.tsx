"use client";

import { useState } from "react";
import { CircleNotch as Loader2, XCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { ClientErrorAlert } from "@/components/client/client-error-alert";

/** Visa types whose official submission the applicant can cancel (migrations 0209, 0211). */
const OFFICIAL_CANCEL_VISA_TYPES = new Set(["ID_C1_TOURIST", "ID_B1_EVOA", "VN_E_VISA", "VIETNAM_E_VISA"]);

export function supportsOfficialCancel(visaType: string | null | undefined): boolean {
  return OFFICIAL_CANCEL_VISA_TYPES.has((visaType ?? "").trim().toUpperCase());
}

/**
 * Cancel the applicant's official submission. Queued work and open handoffs
 * stop at once; a run already filling the official site stops at its next
 * step. Answers stay saved so the applicant can submit again later.
 */
export function OfficialCancelButton({
  applicationId,
  isZh,
  onCancelled,
}: {
  applicationId: string;
  isZh: boolean;
  onCancelled?: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [requested, setRequested] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/applications/${applicationId}/official-handoff/cancel`, {
        method: "POST",
        cache: "no-store",
      });
      const body = (await response.json().catch(() => null)) as { outcome?: string } | null;
      if (!response.ok) {
        setError(
          response.status === 409
            ? isZh ? "现在没有可以取消的提交。" : "There is no submission to cancel right now."
            : isZh ? "取消服务暂时不可用，请稍后再试或联系支持。" : "Cancellation is temporarily unavailable. Try again shortly or contact support.",
        );
        return;
      }
      if (body?.outcome === "cancel_requested") {
        setRequested(true);
        return;
      }
      if (onCancelled) onCancelled();
      else window.location.reload();
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  if (requested) {
    return (
      <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
        {isZh
          ? "已请求取消。VIZA 会在当前步骤结束后停止填写官网，本页会自动更新。你的资料已保存，之后可以重新提交。"
          : "Cancellation requested. VIZA stops filling the official site after the current step and this page updates automatically. Your answers stay saved."}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {confirming ? (
        <div className="space-y-2 rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-900">
            {isZh
              ? "确定取消这次提交吗？VIZA 会停止填写官网，官网上不会提交任何内容。你的资料会保留。"
              : "Cancel this submission? VIZA stops filling the official site and nothing is submitted there. Your answers stay saved."}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1 bg-white" disabled={busy} onClick={() => setConfirming(false)}>
              {isZh ? "继续提交" : "Keep going"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1 border-red-300 bg-white text-red-700 hover:bg-red-100"
              disabled={busy}
              onClick={() => void cancel()}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isZh ? "确定取消" : "Yes, cancel"}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
          onClick={() => setConfirming(true)}
        >
          <XCircle className="mr-2 h-4 w-4" />
          {isZh ? "取消提交" : "Cancel submission"}
        </Button>
      )}
      {error ? <ClientErrorAlert message={error} /> : null}
    </div>
  );
}
