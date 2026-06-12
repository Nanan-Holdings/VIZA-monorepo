"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import {
  AlertTriangle,
  CalendarCheck,
  ExternalLink,
  Eye,
  EyeOff,
  FileDown,
  Loader2,
  MapPin,
  ShieldCheck,
} from "lucide-react";
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

type FvOfficialAccount = {
  email: string | null;
  password: string | null;
  portalUrl: string;
  updatedAt: string | null;
};

export function FrResultCard({ applicationId, result }: FrResultCardProps) {
  const isZh = isChineseLocale(useLocale());
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [manualAction, setManualAction] = useState<ManualAction | null>(null);
  const [manualAnswer, setManualAnswer] = useState("");
  const [manualActionError, setManualActionError] = useState<string | null>(null);
  const [completingAction, setCompletingAction] = useState(false);
  const [officialAccount, setOfficialAccount] = useState<FvOfficialAccount | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const liveAssisted = result.mode === "live_assisted" || result.status === "final_review_required";
  const officialConfirmed =
    result.officialStatus === "official_record_confirmed" ||
    Boolean(result.applicationReference && liveAssisted && !result.manualAction);
  const badgeLabel = officialConfirmed
    ? (isZh ? "提交成功" : "Submitted")
    : liveAssisted
      ? (isZh ? "需要后续操作" : "Follow-up required")
      : result.status === "appointment_held"
        ? (isZh ? "已保留预约" : "Appointment held")
        : (isZh ? "已准备" : "Prepared");

  const formatStatus = (value?: string) => {
    if (!value) return null;
    const zh: Record<string, string> = {
      not_run: "未运行",
      passed: "已通过",
      failed: "失败",
      manual_required: "需后续处理",
      not_required: "无需处理",
      blocked: "已阻塞",
      paid: "已付款",
      booked: "已预约",
      draft_prefilled: "草稿已填写",
      official_record_created: "官网记录已创建",
      official_record_confirmed: "官网已确认",
      payment_required: "需要付款",
      appointment_required: "需要预约",
      lodged_at_visa_centre: "已递交签证中心",
    };
    return isZh ? (zh[value] ?? value.replace(/_/g, " ")) : value.replace(/_/g, " ");
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

  useEffect(() => {
    if (!liveAssisted) return;
    let cancelled = false;

    const loadOfficialAccount = async () => {
      try {
        const response = await fetch(`/api/applications/${applicationId}/france-visas-account`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as {
          account?: FvOfficialAccount | null;
          error?: unknown;
        } | null;
        if (!response.ok) {
          throw new Error(
            typeof payload?.error === "string"
              ? payload.error
              : `France-Visas account returned ${response.status}`,
          );
        }
        if (!cancelled) {
          setOfficialAccount(payload?.account ?? null);
          setAccountError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setAccountError(error instanceof Error ? error.message : String(error));
        }
      }
    };

    void loadOfficialAccount();
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
            {officialConfirmed
              ? (isZh ? "France-Visas 已提交" : "France-Visas submission completed")
              : liveAssisted
                ? (isZh ? "France-Visas 提交状态" : "France-Visas submission status")
                : (isZh ? "France-Visas 申请已准备" : "France-Visas application prepared")}
          </CardTitle>
          <Badge variant={officialConfirmed || result.status === "appointment_held" ? "default" : "secondary"}>
            {badgeLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-input bg-background px-3 py-2">
          <div className="text-xs text-muted-foreground">
            {isZh ? "官方申请编号" : liveAssisted ? "Official reference" : "Application reference"}
          </div>
          <div className="mt-0.5 font-mono text-sm text-foreground">{result.applicationReference}</div>
        </div>

        {officialConfirmed && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-800">
              <ShieldCheck className="h-4 w-4" />
              {isZh ? "官网记录已确认" : "Official record confirmed"}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-emerald-950">
              {isZh
                ? "VIZA 已在 France-Visas 官网创建并确认这份申请。请使用上方官方编号作为核验证据；如官网后续要求付款、预约或打印签署，请继续按官网提示完成。"
                : "VIZA created and confirmed this application on France-Visas. Use the official reference above as evidence; continue with any payment, appointment, print, or signature steps shown by the portal."}
            </p>
          </div>
        )}

        {liveAssisted && !officialConfirmed && result.manualAction && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-amber-700">
              <AlertTriangle className="h-4 w-4" />
              {isZh ? "官网检查点" : "Manual checkpoint"}: {formatStatus(result.manualAction.type)}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-amber-900">
              {result.manualAction.instructions}
            </p>
          </div>
        )}

        {liveAssisted && (officialAccount || accountError) && (
          <div className="space-y-3 rounded-md border border-brand-100 bg-brand-50 p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-brand-700">
              <ShieldCheck className="h-4 w-4" />
              {isZh ? "France-Visas 官方账号" : "France-Visas official account"}
            </div>
            {officialAccount && (
              <>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-md border border-brand-100 bg-white px-3 py-2">
                    <div className="text-xs text-brand-700">{isZh ? "账号邮箱" : "Account email"}</div>
                    <div className="mt-0.5 break-all font-mono text-sm text-foreground">
                      {officialAccount.email ?? (isZh ? "尚未生成" : "Not generated yet")}
                    </div>
                  </div>
                  <div className="rounded-md border border-brand-100 bg-white px-3 py-2">
                    <div className="text-xs text-brand-700">{isZh ? "账号密码" : "Account password"}</div>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <span className="break-all font-mono text-sm text-foreground">
                        {officialAccount.password
                          ? showPassword
                            ? officialAccount.password
                            : "••••••••••••"
                          : (isZh ? "尚未生成" : "Not generated yet")}
                      </span>
                      {officialAccount.password && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => setShowPassword((value) => !value)}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                <Button asChild variant="outline" className="w-full bg-white">
                  <a href={officialAccount.portalUrl} target="_blank" rel="noopener noreferrer">
                    {isZh ? "打开 France-Visas 官网核验申请" : "Open France-Visas to verify the application"}
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </>
            )}
            {accountError && (
              <p className="text-sm text-red-700">{accountError}</p>
            )}
          </div>
        )}

        {liveAssisted && !officialConfirmed && (manualAction || manualActionError) && (
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
                <div className="text-xs text-muted-foreground">{isZh ? "复核差异" : "Review diff"}</div>
                <div className="mt-0.5 text-sm font-medium text-foreground">
                  {formatStatus(result.reviewDiffStatus)}
                </div>
              </div>
            )}
            {result.officialStatus && (
              <div className="rounded-md border border-input bg-background px-3 py-2">
                <div className="text-xs text-muted-foreground">{isZh ? "官网状态" : "Official status"}</div>
                <div className="mt-0.5 text-sm font-medium text-foreground">
                  {formatStatus(result.officialStatus)}
                </div>
              </div>
            )}
            {result.paymentStatus && (
              <div className="rounded-md border border-input bg-background px-3 py-2">
                <div className="text-xs text-muted-foreground">{isZh ? "付款" : "Payment"}</div>
                <div className="mt-0.5 text-sm font-medium text-foreground">
                  {formatStatus(result.paymentStatus)}
                </div>
              </div>
            )}
            {result.appointmentStatus && (
              <div className="rounded-md border border-input bg-background px-3 py-2">
                <div className="text-xs text-muted-foreground">{isZh ? "预约" : "Appointment"}</div>
                <div className="mt-0.5 text-sm font-medium text-foreground">
                  {formatStatus(result.appointmentStatus)}
                </div>
              </div>
            )}
          </div>
        )}

        {result.fieldFallbacks?.length ? (
          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
            <div className="font-medium">
              {isZh
                ? `已记录 ${result.fieldFallbacks.length} 条官网字段规范`
                : `${result.fieldFallbacks.length} official field fallback(s) recorded`}
            </div>
            <p className="mt-1 leading-relaxed">
              {isZh
                ? "这些规范会用于改进 VIZA 表单校验，避免后续用户在官网同一字段卡住。"
                : "These constraints can be fed back into VIZA validation so future applicants do not get stuck on the same official fields."}
            </p>
          </div>
        ) : null}

        {result.postConfirmationContinue?.clickedContinue && (
          <div className="rounded-md border border-input bg-background px-3 py-2">
            <div className="text-xs text-muted-foreground">
              {isZh ? "声明与 Continue" : "Declaration and Continue"}
            </div>
            <div className="mt-0.5 text-sm font-medium text-foreground">
              {isZh ? "已勾选声明并继续" : "Declaration checked and continued"}
            </div>
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
            {isZh ? "下载可打印申请表 PDF" : "Download printable summary (PDF)"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
