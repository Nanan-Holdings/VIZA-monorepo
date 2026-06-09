"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { SmoothProgressBar } from "@/components/smooth-progress";
import { Button } from "@/components/ui/button";
import { useSmoothProgress } from "@/hooks/use-smooth-progress";

type PollStatus = "pending" | "paid" | "failed";

export function PaymentStatusPoller({ paymentId }: { paymentId: string }) {
  const [status, setStatus] = useState<PollStatus>("pending");
  const progressStatus = status === "paid" ? "completed" : status === "failed" ? "failed" : "running";
  const serverProgress = status === "paid" ? 100 : status === "failed" ? 0 : 92;
  const { displayedProgress } = useSmoothProgress({
    serverProgress,
    status: progressStatus,
    intervalMs: 120,
  });

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const response = await fetch(`/api/payments/status/${paymentId}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as { status?: PollStatus };
        if (!cancelled && payload.status) setStatus(payload.status);
      } catch {
        if (!cancelled) setStatus("pending");
      }
    }

    poll();
    const timer = window.setInterval(poll, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [paymentId]);

  if (status === "paid") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
          <CheckCircle2 className="h-4 w-4" />
          支付已确认，可以返回订阅页查看状态。
        </div>
        <SmoothProgressBar displayedProgress={displayedProgress} label="确认进度" />
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive">
          <XCircle className="h-4 w-4" />
          支付记录不可用，请返回订阅页重新发起。
        </div>
        <SmoothProgressBar
          displayedProgress={displayedProgress}
          label="确认进度"
          barClassName="bg-destructive"
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-lg border bg-brand-50 px-4 py-3 text-sm font-medium text-brand-900">
        <Loader2 className="h-4 w-4 animate-spin" />
        等待微信支付确认，页面会自动刷新状态。
      </div>
      <SmoothProgressBar displayedProgress={displayedProgress} label="确认进度" />
      <Button
        type="button"
        variant="outline"
        className="h-11 rounded-full"
        onClick={() => window.location.reload()}
      >
        手动刷新
      </Button>
    </div>
  );
}
