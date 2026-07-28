"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { ExternalLink, Eye, EyeOff, Loader2, RotateCw, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isChineseLocale } from "@/lib/i18n/locale";
import type { UkSubmissionResult } from "@/lib/submission-result";

interface UkResultCardProps {
  applicationId: string;
  result: UkSubmissionResult;
  applicationCountry?: string | null;
  applicationVisaType?: string | null;
}

export function UkResultCard({
  applicationId,
  result,
  applicationCountry = null,
  applicationVisaType = null,
}: UkResultCardProps) {
  const isZh = isChineseLocale(useLocale());
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [revealError, setRevealError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  const atPayment = result.status === "stopped_at_pay";
  const progress = result.prefillProgress;
  const needsPrefillRetry = !atPayment;

  const loadPassword = useCallback(async (opts?: { silent?: boolean }) => {
    setRevealing(true);
    if (!opts?.silent) setRevealError(null);
    try {
      const res = await fetch(`/api/applications/${applicationId}/uk-portal-credentials`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const payload = (await res.json().catch(() => null)) as { password?: string; error?: string } | null;
      if (!res.ok) {
        const message =
          res.status === 401
            ? (isZh ? "登录已过期，请刷新页面或重新登录后再查看密码。" : "Session expired. Refresh or log in again to view the password.")
            : (payload?.error ?? (isZh ? "无法获取密码" : "Failed to fetch credentials"));
        setRevealError(message);
        return null;
      }
      if (!payload?.password) {
        setRevealError(isZh ? "密码暂不可用" : "Password not available yet");
        return null;
      }
      setRevealedPassword(payload.password);
      setRevealError(null);
      return payload.password;
    } catch {
      setRevealError(isZh ? "无法获取密码" : "Failed to fetch credentials");
      return null;
    } finally {
      setRevealing(false);
    }
  }, [applicationId, isZh]);

  useEffect(() => {
    void loadPassword({ silent: true });
  }, [loadPassword]);

  const togglePassword = async () => {
    if (revealedPassword) {
      setRevealedPassword(null);
      setRevealError(null);
      return;
    }
    await loadPassword();
  };

  const retryPrefill = async () => {
    if (retrying) return;
    const confirmed = window.confirm(
      isZh
        ? "这会在 gov.uk 上重新自动填写申请表（约 10–15 分钟），停在支付页由你本人完成付款。确认继续？"
        : "This will re-run automated pre-fill on gov.uk (~10–15 minutes) and stop at the payment page for you to pay. Continue?",
    );
    if (!confirmed) return;

    setRetrying(true);
    setRetryError(null);
    try {
      const response = await fetch(`/api/applications/${applicationId}/retry-submission`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "live_assisted",
          country: applicationCountry,
          visaType: applicationVisaType,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || `retry-submission returned ${response.status}`);
      }
      window.location.reload();
    } catch (error) {
      setRetryError(error instanceof Error ? error.message : String(error));
    } finally {
      setRetrying(false);
    }
  };

  return (
    <Card className="rounded-xl border-input">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-foreground">
            <ShieldCheck className="h-5 w-5 text-brand-500" />
            {atPayment
              ? (isZh ? "英国签证申请已填写完成" : "Your UK application is saved & pre-filled")
              : (isZh ? "英国签证账户已创建" : "Your UK visa account is ready")}
          </CardTitle>
          <Badge variant={atPayment ? "secondary" : "outline"}>
            {atPayment
              ? (isZh ? "待支付" : "Awaiting payment")
              : (isZh ? "填写进行中" : "Prefill in progress")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {atPayment
            ? (isZh
                ? "我们已在 gov.uk 上保存并填写你的英国签证申请。请使用下方邮箱和密码登录，核对答案、接受声明，并在官网支付 £135 签证费——这些最后步骤需由你本人完成。"
                : "We saved your UK visa application and pre-filled all your answers. Log back in with the email and password below to review your answers, accept the declaration, and pay the £135 visa fee on gov.uk — these final steps must be completed by you.")
            : (isZh
                ? "gov.uk 账户已创建，但自动填写尚未完成。请点击下方「重新提交到 gov.uk」启动自动填写；运行期间请保持 submission-service worker 运行。"
                : "Your gov.uk account is ready, but automated pre-fill has not finished yet. Click “Retry gov.uk prefill” below to start the fill — keep the submission-service worker running.")}
        </p>

        {needsPrefillRetry && (
          <div className="rounded-md border border-brand-100 bg-brand-50 p-3">
            <div className="flex items-start gap-2 text-sm leading-relaxed text-brand-900">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
              <span>
                {isZh
                  ? "自动填写会在后台用 Playwright 逐页保存答案，完成后此页会显示「待支付」。"
                  : "Pre-fill runs in the background via Playwright, saving each page. When complete, this card will show “Awaiting payment”."}
              </span>
            </div>
            <Button
              type="button"
              className="mt-3 w-full"
              onClick={() => {
                void retryPrefill();
              }}
              disabled={retrying}
            >
              {retrying ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RotateCw className="mr-2 h-4 w-4" />
              )}
              {retrying
                ? (isZh ? "正在提交到 gov.uk" : "Submitting to gov.uk")
                : (isZh ? "重新提交到 gov.uk" : "Retry gov.uk prefill")}
            </Button>
            {retryError && (
              <p className="mt-2 text-xs text-red-600">{retryError}</p>
            )}
          </div>
        )}

        {progress && !atPayment && (
          <p className="text-xs text-muted-foreground">
            {isZh
              ? `自动填写进度：约 ${progress.pagesFilled}/${progress.totalPages} 页已保存。`
              : `Prefill progress: about ${progress.pagesFilled}/${progress.totalPages} pages saved.`}
          </p>
        )}

        <div className="rounded-md border border-input bg-background px-3 py-2">
          <div className="text-xs text-muted-foreground">
            {isZh ? "登录邮箱" : "Username (email)"}
          </div>
          <div className="mt-0.5 break-all font-mono text-sm text-foreground">
            {result.portalUsername}
          </div>
        </div>

        <div className="rounded-md border border-input bg-background px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-xs text-muted-foreground">
                {isZh ? "密码" : "Password"}
              </div>
              <div className="mt-0.5 break-all font-mono text-sm text-foreground">
                {revealedPassword ?? "••••••••••"}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={togglePassword} disabled={revealing}>
              {revealedPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          {revealError && (
            <p className="mt-1 text-xs text-red-600">{revealError}</p>
          )}
        </div>

        {result.applicationReference && (
          <div className="rounded-md border border-input bg-background px-3 py-2">
            <div className="text-xs text-muted-foreground">
              {isZh ? "申请参考号" : "Application reference"}
            </div>
            <div className="mt-0.5 font-mono text-sm text-foreground">{result.applicationReference}</div>
          </div>
        )}

        <Button asChild className="w-full">
          <a href={result.portalUrl} target="_blank" rel="noopener noreferrer">
            {atPayment
              ? (isZh ? "前往 gov.uk 核对并支付" : "Review & pay on gov.uk")
              : (isZh ? "打开 gov.uk 继续填写" : "Continue on gov.uk")}
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
