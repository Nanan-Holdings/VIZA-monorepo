"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowSquareOut as ExternalLink,
  Download,
  Eye,
  EyeSlash,
  Plus,
  ShieldCheck,
  SpinnerGap as Loader2,
  Warning as AlertTriangle,
  X,
} from "@phosphor-icons/react";
import { useLocale } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { isChineseLocale } from "@/lib/i18n/locale";
import type {
  JpVisitJapanWebSubmissionResult,
  KeEtaSubmissionResult,
} from "@/lib/submission-result";
import { getAutomatedOnlineSubmissionEvidence } from "@/lib/submission-result-evidence";

type AutomatedOnlineResult = JpVisitJapanWebSubmissionResult | KeEtaSubmissionResult;

interface JpVjwPortalCredentials {
  email: string;
  password: string;
  portalUrl: string;
  revealedAt: string;
}

export function isAutomatedOnlineResult(
  result: { country?: string; visaType?: string } | null,
): result is AutomatedOnlineResult {
  return (
    (result?.country === "JP" && result.visaType === "JP_VISIT_JAPAN_WEB") ||
    (result?.country === "KE" && result.visaType === "KE_ETA")
  );
}

export function AutomatedOnlineResultCard({ result }: { result: AutomatedOnlineResult }) {
  const isZh = isChineseLocale(useLocale());
  const isJapan = result.country === "JP";
  const evidence = getAutomatedOnlineSubmissionEvidence(result, result.visaType);
  const artifactPath = evidence.qrPaths[0] ?? evidence.pdfPaths[0] ?? null;
  const artifactIsQr = Boolean(evidence.qrPaths[0]);
  const artifactUrl = artifactPath
    ? `/api/applications/${encodeURIComponent(result.applicationId)}/submission-artifact?path=${encodeURIComponent(artifactPath)}&inline=${artifactIsQr ? "1" : "0"}&download=${encodeURIComponent(`${isJapan ? "visit-japan-web" : "kenya-eta"}-${result.applicationId}.${artifactIsQr ? "png" : "pdf"}`)}`
    : null;
  const blocked = result.status === "blocked" || result.status === "validation_failed" || result.status === "official_portal_error";
  const rejected = result.country === "KE" && result.status === "rejected";
  const success = evidence.qrReady || evidence.approved || (evidence.submitted && !isJapan);
  const safeSummary = success
    ? isZh
      ? isJapan
        ? "已取得日本官方入境与海关申报二维码。"
        : evidence.approved
          ? "已取得肯尼亚官方电子旅行授权批准文件。"
          : "肯尼亚官方电子旅行授权申请已提交。"
      : result.portalResponseSummary
    : rejected
      ? (isZh ? "肯尼亚移民部门未批准本次电子旅行授权；如需进一步信息，请联系 VIZA 支持。" : "Kenya Immigration did not approve this eTA. Contact VIZA support if you need more information.")
      : blocked
        ? (isZh ? "官方流程尚未完成。VIZA 工作人员会根据错误代码复核，内部门户详情不会在此显示。" : "The official flow has not completed. VIZA staff will review the structured error code; internal portal details are not shown here.")
        : (isZh ? "VIZA 正在核验官方结果。" : "VIZA is verifying the official result.");
  const title = success
    ? isJapan
      ? (isZh ? "日本入境与海关申报二维码已准备好" : "Visit Japan Web QR code is ready")
      : evidence.approved
        ? (isZh ? "肯尼亚电子旅行授权已批准" : "Kenya eTA approved")
        : (isZh ? "肯尼亚电子旅行授权已提交" : "Kenya eTA submitted")
    : blocked
      ? (isZh ? "官方自动提交暂不可用" : "Official automated submission is unavailable")
      : rejected
        ? (isZh ? "肯尼亚电子旅行授权未获批准" : "Kenya eTA was rejected")
        : (isZh ? "正在核验官方结果" : "Verifying the official result");
  const [startingAgain, setStartingAgain] = useState(false);
  const [revealingCredentials, setRevealingCredentials] = useState(false);
  const [credentials, setCredentials] = useState<JpVjwPortalCredentials | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!credentials) return;
    const clearCredentials = () => {
      setCredentials(null);
      setShowPassword(false);
    };
    const timeout = window.setTimeout(clearCredentials, 60_000);
    window.addEventListener("blur", clearCredentials);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("blur", clearCredentials);
    };
  }, [credentials]);

  const startAgain = useCallback(async () => {
    if (!isJapan || !success) return;
    setStartingAgain(true);
    setActionError(null);
    try {
      const response = await fetch(
        `/api/applications/${encodeURIComponent(result.applicationId)}/arrival-card-new-application`,
        { method: "POST" },
      );
      const body = (await response.json().catch(() => null)) as {
        applicationId?: string;
        error?: string;
      } | null;
      if (!response.ok || !body?.applicationId) {
        throw new Error(body?.error || (isZh ? "无法创建新的日本申报表。" : "Could not create a new Japan declaration."));
      }
      window.location.href = `/client/application/long-form?country=japan&visaType=JP_VISIT_JAPAN_WEB&applicationId=${encodeURIComponent(body.applicationId)}`;
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
      setStartingAgain(false);
    }
  }, [isJapan, isZh, result.applicationId, success]);

  const revealCredentials = useCallback(async () => {
    if (!isJapan || !success) return;
    setRevealingCredentials(true);
    setActionError(null);
    try {
      const response = await fetch(
        `/api/applications/${encodeURIComponent(result.applicationId)}/jp-vjw-portal-credentials`,
        { method: "POST", cache: "no-store" },
      );
      const body = (await response.json().catch(() => null)) as Partial<JpVjwPortalCredentials> & {
        error?: string;
      } | null;
      if (
        !response.ok
        || typeof body?.email !== "string"
        || typeof body.password !== "string"
        || typeof body.portalUrl !== "string"
        || typeof body.revealedAt !== "string"
      ) {
        throw new Error(body?.error || (isZh ? "无法读取日本官网登录信息。" : "Could not reveal the Visit Japan Web account."));
      }
      setCredentials({
        email: body.email,
        password: body.password,
        portalUrl: body.portalUrl,
        revealedAt: body.revealedAt,
      });
      setShowPassword(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setRevealingCredentials(false);
    }
  }, [isJapan, isZh, result.applicationId, success]);

  const clearCredentials = useCallback(() => {
    setCredentials(null);
    setShowPassword(false);
  }, []);

  return (
    <Card className="rounded-lg border-input">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          {success ? (
            <ShieldCheck className="h-6 w-6 text-emerald-600" />
          ) : (
            <AlertTriangle className="h-6 w-6 text-amber-600" />
          )}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {evidence.submitted && evidence.reference ? (
          <div className="border-l-2 border-emerald-600 pl-3">
            <div className="text-xs text-muted-foreground">
              {isZh ? "官方申请编号 / 参考号" : "Official application reference"}
            </div>
            <div className="mt-1 font-mono text-lg font-semibold">{evidence.reference}</div>
          </div>
        ) : null}

        <p className="text-sm leading-relaxed text-muted-foreground">
          {safeSummary}
        </p>

        {isJapan ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
            {isZh
              ? "日本官方线上入境与海关申报服务免费。VIZA 是独立服务，不是日本政府网站；根据官方使用条款，用户本人操作要求仍适用，VIZA 的自动化入口须经过合规授权，未获授权时不会执行官网操作。"
              : "Visit Japan Web is free. VIZA is an independent service, not a Japanese government website. Its terms require the traveller to operate the service unless delegated operation is authorized; VIZA will not access the portal while that compliance gate is closed."}
          </p>
        ) : (
          <p className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-900">
            {isZh
              ? "肯尼亚官方费用、支付手续费和 VIZA 服务费分别记录；VIZA 不会要求你在此页面输入官方门户卡号。"
              : "Kenya's official fee, payment processing fee, and VIZA service fee are recorded separately. VIZA will not ask you to enter an official-portal card number here."}
          </p>
        )}

        {artifactUrl && success ? (
          <Button asChild type="button">
            <a href={artifactUrl} target="_blank" rel="noopener noreferrer">
              <Download className="mr-2 h-4 w-4" />
              {isZh
                ? artifactIsQr ? "查看官方二维码" : "下载官方批准文件"
                : artifactIsQr ? "View official QR code" : "Download official approval"}
            </a>
          </Button>
        ) : null}

        {isJapan && success ? (
          <Button type="button" variant="outline" className="w-full" onClick={startAgain} disabled={startingAgain}>
            {startingAgain ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            {isZh ? "在此填写" : "Fill another form here"}
          </Button>
        ) : null}

        {isJapan && success ? (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={revealCredentials}
            disabled={revealingCredentials}
          >
            {revealingCredentials ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
            {isZh ? "查看官网登录信息" : "View official portal login"}
          </Button>
        ) : null}

        {credentials ? (
          <section className="space-y-3 rounded-md border bg-muted/30 p-3" aria-label={isZh ? "日本官网登录信息" : "Visit Japan Web login details"}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{isZh ? "日本官网登录信息" : "Visit Japan Web login details"}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isZh ? "信息会在 60 秒后或切换窗口时自动隐藏。" : "These details hide after 60 seconds or when you switch windows."}
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={clearCredentials} aria-label={isZh ? "隐藏官网登录信息" : "Hide portal login details"}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">{isZh ? "账号（邮箱）" : "Account email"}</dt>
                <dd className="mt-1 break-all font-mono">{credentials.email}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{isZh ? "密码" : "Password"}</dt>
                <dd className="mt-1 flex items-center justify-between gap-3">
                  <span className="break-all font-mono">{showPassword ? credentials.password : "••••••••••••••••"}</span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowPassword((visible) => !visible)}>
                    {showPassword ? <EyeSlash className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                    {showPassword
                      ? isZh ? "隐藏密码" : "Hide password"
                      : isZh ? "显示密码" : "Show password"}
                  </Button>
                </dd>
              </div>
            </dl>
          </section>
        ) : null}

        {actionError ? (
          <p role="alert" className="text-sm text-destructive">{actionError}</p>
        ) : null}

        <Button asChild variant="ghost" className="w-full">
          <a href={result.portalUrl} target="_blank" rel="noopener noreferrer">
            {isZh ? "打开官方门户" : "Open official portal"}
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
