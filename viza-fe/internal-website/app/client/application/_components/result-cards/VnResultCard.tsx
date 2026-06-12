"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { AlertTriangle, ExternalLink, FileCheck2, Loader2, Mail, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isChineseLocale } from "@/lib/i18n/locale";
import type { VnSubmissionResult } from "@/lib/submission-result";

type ManualAction = {
  id: string;
  actionType: string;
  status: string;
  instruction: string | null;
  screenshotUrl: string | null;
};

export function VnResultCard({
  result,
  jobId,
}: {
  result: VnSubmissionResult;
  jobId?: string | null;
}) {
  const isZh = isChineseLocale(useLocale());
  const [manualAction, setManualAction] = useState<ManualAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const hasRegistrationCode = Boolean(result.registrationCode);
  const isPaymentCheckpoint = result.status === "stopped_at_pay" || hasRegistrationCode;
  const isFormCheckpoint = result.status === "official_form_reached";
  const isManualCheckpoint = Boolean(result.manualAction);
  const title = isPaymentCheckpoint
    ? (isZh ? "越南 e-Visa 已提交到付款检查点" : "Vietnam e-Visa application captured")
    : isFormCheckpoint
      ? (isZh ? "已进入越南 e-Visa 官网表单" : "Vietnam e-Visa form reached")
      : isManualCheckpoint
        ? (isZh ? "越南 e-Visa 需要人工操作" : "Vietnam e-Visa action required")
        : (isZh ? "已进入越南官网流程" : "Vietnam official portal reached");
  const badge = isPaymentCheckpoint
    ? (isZh ? "等待付款" : "Action required: payment")
    : isManualCheckpoint
      ? (isZh ? "需要操作" : "Action required")
      : (isZh ? "官网检查点" : "Official checkpoint");
  const Icon = isPaymentCheckpoint ? ShieldCheck : isFormCheckpoint ? FileCheck2 : AlertTriangle;

  useEffect(() => {
    if (!jobId || !result.manualAction) return;
    let cancelled = false;
    const loadManualActions = async () => {
      try {
        const response = await fetch(`/api/submissions/${jobId}/manual-actions`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as {
          error?: unknown;
          manualActions?: ManualAction[];
        } | null;
        if (!response.ok) {
          throw new Error(
            typeof payload?.error === "string"
              ? payload.error
              : `Manual actions returned ${response.status}`,
          );
        }
        const pending = payload?.manualActions?.find((action) => action.status === "pending") ?? null;
        if (!cancelled) {
          setManualAction(pending);
          setActionError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setActionError(error instanceof Error ? error.message : String(error));
        }
      }
    };

    void loadManualActions();
    return () => {
      cancelled = true;
    };
  }, [jobId, result.manualAction]);

  const completeManualAction = async () => {
    if (!jobId || !manualAction || completing) return;
    setCompleting(true);
    setActionError(null);
    try {
      const response = await fetch(
        `/api/submissions/${jobId}/manual-actions/${manualAction.id}/complete`,
        { method: "POST" },
      );
      const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : `Manual action completion returned ${response.status}`,
        );
      }
      window.location.reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setCompleting(false);
    }
  };

  return (
    <Card className="rounded-xl border-input">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-foreground">
            <Icon className="h-5 w-5 text-brand-500" />
            {title}
          </CardTitle>
          <Badge variant="secondary">{badge}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {isPaymentCheckpoint
            ? isZh
              ? "VIZA 已将申请推进到越南 e-Visa 官网的付款/受理检查点。请使用下方编号和官网入口继续核对；如需要付款，付款必须由本人完成。"
              : "We pre-filled your e-Visa application on the official Vietnam portal. To finalize, complete payment yourself on the official site."
            : result.manualAction?.instructions ??
              (isZh
                ? "后台已进入越南 e-Visa 官网流程，并停在付款或最终确认前的安全检查点。"
                : "The worker reached the official Vietnam e-Visa portal and stopped at a safe checkpoint before payment or final submit.")}
        </p>

        {result.checkpoint && (
          <div className="rounded-md border border-input bg-background px-3 py-2">
            <div className="text-xs text-muted-foreground">{isZh ? "官网检查点" : "Checkpoint"}</div>
            <div className="mt-0.5 font-mono text-sm font-medium text-foreground">
              {result.checkpoint}
            </div>
          </div>
        )}

        {hasRegistrationCode && (
          <div className="rounded-md border border-input bg-background px-3 py-2">
            <div className="text-xs text-muted-foreground">{isZh ? "官网登记编号" : "Registration code"}</div>
            <div className="mt-0.5 font-mono text-base font-medium text-foreground">
              {result.registrationCode}
            </div>
          </div>
        )}

        {result.manualAction && (
          <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-3">
            <div className="text-xs font-medium text-amber-700">{isZh ? "需要人工操作" : "Manual action"}</div>
            <p className="mt-2 text-sm text-foreground">{result.manualAction.instructions}</p>
            {manualAction?.screenshotUrl && (
              <div className="rounded-md border border-amber-200 bg-white px-3 py-2">
                <div className="text-xs text-amber-700">{isZh ? "证据截图" : "Screenshot"}</div>
                <div className="mt-0.5 break-all font-mono text-xs text-foreground">
                  {manualAction.screenshotUrl}
                </div>
              </div>
            )}
            {manualAction && (
              <Button
                type="button"
                variant="outline"
                className="w-full bg-white"
                onClick={completeManualAction}
                disabled={completing}
              >
                {completing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isZh ? "我已在官网完成，继续" : "I completed this on the official page, continue"}
              </Button>
            )}
            {actionError && (
              <p className="text-sm text-red-700">{actionError}</p>
            )}
          </div>
        )}

        {result.noticeText && (
          <div className="rounded-md border border-brand-100 bg-brand-50 p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-brand-500">
              <Mail className="h-4 w-4" />
              {isZh ? "下一步" : "What happens next"}
            </div>
            <p className="mt-2 text-sm text-foreground">
              {isZh ? "e-Visa PDF 通常会在付款受理后约 3 个工作日通过邮件送达。" : result.noticeText}
            </p>
          </div>
        )}

        <Button asChild className="w-full">
          <a href={result.portalUrl ?? "https://evisa.gov.vn"} target="_blank" rel="noopener noreferrer">
            {isZh ? "打开越南 e-Visa 官网" : "Open official Vietnam e-Visa portal"}
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
