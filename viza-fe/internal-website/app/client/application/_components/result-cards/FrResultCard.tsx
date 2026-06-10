"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { AlertTriangle, CalendarCheck, FileDown, Loader2, MapPin, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isChineseLocale } from "@/lib/i18n/locale";
import type { FrSubmissionResult } from "@/lib/submission-result";

interface FrResultCardProps {
  applicationId: string;
  result: FrSubmissionResult;
}

type ManualAction = {
  id: string;
  actionType: string;
  status: string;
  instruction: string | null;
  screenshotUrl: string | null;
};

export function FrResultCard({ applicationId, result }: FrResultCardProps) {
  const isZh = isChineseLocale(useLocale());
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [manualAction, setManualAction] = useState<ManualAction | null>(null);
  const [manualAnswer, setManualAnswer] = useState("");
  const [manualActionError, setManualActionError] = useState<string | null>(null);
  const [completingAction, setCompletingAction] = useState(false);
  const liveAssisted = result.mode === "live_assisted" || result.status === "final_review_required";
  const badgeLabel = liveAssisted
    ? "Manual review required"
    : result.status === "appointment_held"
      ? "Appointment held"
      : "Dry-run prepared";

  const formatStatus = (value?: string) => {
    if (!value) return null;
    return value.replace(/_/g, " ");
  };

  const expectsTextAnswer = manualAction?.actionType === "captcha_required";

  useEffect(() => {
    if (!liveAssisted) return;
    let cancelled = false;

    const loadManualAction = async () => {
      try {
        const statusResponse = await fetch(`/api/applications/${applicationId}/submission-status`, {
          cache: "no-store",
        });
        const statusPayload = (await statusResponse.json().catch(() => null)) as {
          jobId?: string | null;
          error?: unknown;
        } | null;
        if (!statusResponse.ok) {
          throw new Error(
            typeof statusPayload?.error === "string"
              ? statusPayload.error
              : `Submission status returned ${statusResponse.status}`,
          );
        }

        const nextJobId = statusPayload?.jobId ?? null;
        if (!nextJobId) return;
        if (!cancelled) setJobId(nextJobId);

        const actionsResponse = await fetch(`/api/submissions/${nextJobId}/manual-actions`, {
          cache: "no-store",
        });
        const actionsPayload = (await actionsResponse.json().catch(() => null)) as {
          error?: unknown;
          manualActions?: ManualAction[];
        } | null;
        if (!actionsResponse.ok) {
          throw new Error(
            typeof actionsPayload?.error === "string"
              ? actionsPayload.error
              : `Manual actions returned ${actionsResponse.status}`,
          );
        }

        const pending = actionsPayload?.manualActions?.find((action) => action.status === "pending") ?? null;
        if (!cancelled) {
          setManualAction(pending);
          setManualActionError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setManualActionError(error instanceof Error ? error.message : String(error));
        }
      }
    };

    void loadManualAction();
    return () => {
      cancelled = true;
    };
  }, [applicationId, liveAssisted]);

  const completeManualAction = async (withAnswer: boolean) => {
    if (!jobId || !manualAction || completingAction) return;
    setCompletingAction(true);
    setManualActionError(null);
    try {
      const response = await fetch(
        `/api/submissions/${jobId}/manual-actions/${manualAction.id}/complete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            confirmed: true,
            ...(withAnswer && manualAnswer.trim() ? { answer: manualAnswer.trim() } : {}),
          }),
        },
      );
      const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : `Manual action completion returned ${response.status}`,
        );
      }
      setManualAnswer("");
      window.location.reload();
    } catch (error) {
      setManualActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setCompletingAction(false);
    }
  };

  const handlePdfDownload = async () => {
    if (!result.printablePdfStoragePath) return;
    setDownloadingPdf(true);
    try {
      const res = await fetch(
        `/api/applications/${applicationId}/artifact-url?path=${encodeURIComponent(result.printablePdfStoragePath)}`,
      );
      if (!res.ok) throw new Error("Failed to mint signed URL");
      const { url } = (await res.json()) as { url: string };
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <Card className="rounded-xl border-input">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-foreground">
            <ShieldCheck className="h-5 w-5 text-brand-500" />
            {liveAssisted ? "France-Visas live assisted checkpoint" : "France-Visas application prepared"}
          </CardTitle>
          <Badge variant={liveAssisted ? "secondary" : result.status === "appointment_held" ? "default" : "secondary"}>
            {badgeLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-input bg-background px-3 py-2">
          <div className="text-xs text-muted-foreground">
            {liveAssisted ? "Official reference (redacted)" : "Application reference"}
          </div>
          <div className="mt-0.5 font-mono text-sm text-foreground">{result.applicationReference}</div>
        </div>

        {liveAssisted && result.manualAction && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-amber-700">
              <AlertTriangle className="h-4 w-4" />
              Manual checkpoint: {formatStatus(result.manualAction.type)}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-amber-900">
              {result.manualAction.instructions}
            </p>
          </div>
        )}

        {liveAssisted && (manualAction || manualActionError) && (
          <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-amber-700">
              <AlertTriangle className="h-4 w-4" />
              {isZh ? "需要你完成官网验证 / 操作" : "Official-site action required"}
            </div>
            {manualAction && (
              <>
                <div className="rounded-md border border-amber-100 bg-white px-3 py-2">
                  <div className="text-xs text-amber-700">{isZh ? "操作类型" : "Action type"}</div>
                  <div className="mt-0.5 font-mono text-sm text-foreground">
                    {formatStatus(manualAction.actionType)}
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-amber-950">
                  {manualAction.instruction ??
                    (isZh
                      ? "France-Visas 官网需要人工操作。请在打开的官方浏览器中完成后继续。"
                      : "France-Visas requires manual action. Complete it in the official browser, then continue.")}
                </p>
                {manualAction.screenshotUrl && (
                  <img
                    src={manualAction.screenshotUrl}
                    alt={isZh ? "官网检查点截图" : "Official checkpoint screenshot"}
                    className="max-h-80 w-full rounded-md border border-amber-200 object-contain"
                  />
                )}
                {expectsTextAnswer && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-amber-800" htmlFor="france-manual-answer">
                      {isZh ? "验证码答案（一次性使用，不会保存）" : "CAPTCHA answer (one-time use, not stored)"}
                    </label>
                    <input
                      id="france-manual-answer"
                      value={manualAnswer}
                      onChange={(event) => setManualAnswer(event.target.value)}
                      className="min-h-10 w-full rounded-md border border-amber-200 bg-white px-3 text-sm outline-none focus:border-brand-500"
                      autoComplete="off"
                    />
                  </div>
                )}
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="bg-white"
                    onClick={() => completeManualAction(false)}
                    disabled={completingAction}
                  >
                    {completingAction && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isZh ? "我已在官网完成，继续" : "I completed it, continue"}
                  </Button>
                  {expectsTextAnswer && (
                    <Button
                      type="button"
                      onClick={() => completeManualAction(true)}
                      disabled={completingAction || !manualAnswer.trim()}
                    >
                      {completingAction && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {isZh ? "提交答案并继续" : "Submit answer and continue"}
                    </Button>
                  )}
                </div>
              </>
            )}
            {manualActionError && (
              <p className="text-sm text-red-700">{manualActionError}</p>
            )}
          </div>
        )}

        {(result.reviewDiffStatus || result.officialStatus || result.paymentStatus || result.appointmentStatus) && (
          <div className="grid gap-2 sm:grid-cols-2">
            {result.reviewDiffStatus && (
              <div className="rounded-md border border-input bg-background px-3 py-2">
                <div className="text-xs text-muted-foreground">Review diff</div>
                <div className="mt-0.5 text-sm font-medium text-foreground">
                  {formatStatus(result.reviewDiffStatus)}
                </div>
              </div>
            )}
            {result.officialStatus && (
              <div className="rounded-md border border-input bg-background px-3 py-2">
                <div className="text-xs text-muted-foreground">Official status</div>
                <div className="mt-0.5 text-sm font-medium text-foreground">
                  {formatStatus(result.officialStatus)}
                </div>
              </div>
            )}
            {result.paymentStatus && (
              <div className="rounded-md border border-input bg-background px-3 py-2">
                <div className="text-xs text-muted-foreground">Payment</div>
                <div className="mt-0.5 text-sm font-medium text-foreground">
                  {formatStatus(result.paymentStatus)}
                </div>
              </div>
            )}
            {result.appointmentStatus && (
              <div className="rounded-md border border-input bg-background px-3 py-2">
                <div className="text-xs text-muted-foreground">Appointment</div>
                <div className="mt-0.5 text-sm font-medium text-foreground">
                  {formatStatus(result.appointmentStatus)}
                </div>
              </div>
            )}
          </div>
        )}

        {result.appointment && (
          <div className="rounded-md border border-brand-100 bg-brand-50 p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-brand-500">
              <CalendarCheck className="h-4 w-4" />
              Appointment slot
            </div>
            <div className="mt-2 text-sm font-medium text-foreground">
              {new Date(result.appointment.atIso).toLocaleString()}
            </div>
            <div className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
              <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
              <span>
                {result.appointment.centerName}
                <br />
                {result.appointment.address}
              </span>
            </div>
          </div>
        )}

        {result.printablePdfStoragePath && (
          <Button onClick={handlePdfDownload} disabled={downloadingPdf} className="w-full">
            {downloadingPdf ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="mr-2 h-4 w-4" />
            )}
            Download printable summary (PDF)
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
