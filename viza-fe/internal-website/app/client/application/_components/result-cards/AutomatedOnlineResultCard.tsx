"use client";

import { ArrowSquareOut as ExternalLink, Download, ShieldCheck, Warning as AlertTriangle } from "@phosphor-icons/react";
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
