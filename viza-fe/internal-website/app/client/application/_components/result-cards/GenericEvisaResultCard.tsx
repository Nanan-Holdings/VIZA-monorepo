"use client";

import { Download, Envelope as Mail, ShieldCheck } from "@phosphor-icons/react";
import { useLocale } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isChineseLocale } from "@/lib/i18n/locale";
import type { GenericEvisaSubmissionResult } from "@/lib/submission-result";

/**
 * POR-006: generic result card for the standard e-Visa launch countries
 * (ID/EG/SA/MY/TH/AE/CA/TR/IT/IN). Handles submitted and
 * and paper/VFS-ready states, and surfaces the e-visa artifact download when
 * the runner stored one (POR-007).
 */
const COUNTRY_LABEL: Record<GenericEvisaSubmissionResult["country"], string> = {
  ID: "Indonesia", EG: "Egypt", SA: "Saudi Arabia", MY: "Malaysia", TH: "Thailand",
  AE: "United Arab Emirates", CA: "Canada", TR: "Türkiye", IT: "Italy", IN: "India",
};

const COUNTRY_LABEL_ZH: Record<GenericEvisaSubmissionResult["country"], string> = {
  ID: "印度尼西亚", EG: "埃及", SA: "沙特阿拉伯", MY: "马来西亚", TH: "泰国",
  AE: "阿联酋", CA: "加拿大", TR: "土耳其", IT: "意大利", IN: "印度",
};

export function GenericEvisaResultCard({
  applicationId,
  result,
}: {
  applicationId: string | null;
  applicationCountry?: string | null;
  applicationVisaType?: string | null;
  result: GenericEvisaSubmissionResult;
}) {
  const isZh = isChineseLocale(useLocale());
  const country = (isZh ? COUNTRY_LABEL_ZH[result.country] : COUNTRY_LABEL[result.country]) ?? result.country;
  const hasArtifact = Boolean(result.artifactStoragePath);

  const heading =
    result.status === "submitted"
      ? isZh ? `${country}申请已提交` : `${country} application submitted`
      : result.status === "form_ready_for_agency"
        ? isZh ? `${country}申请资料包已准备好` : `${country} application pack ready`
        : isZh ? `${country}申请已准备好` : `${country} application prepared`;

  const badge =
    result.status === "stopped_at_pay"
      ? isZh ? "需要关注" : "Needs attention"
      : result.status === "form_ready_for_agency"
        ? isZh ? "下载并提交" : "Download & submit"
        : isZh ? "已提交" : "Submitted";

  return (
    <Card className="rounded-xl border-input">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-foreground">
            <ShieldCheck className="h-5 w-5 text-brand-500" />
            {heading}
          </CardTitle>
          <Badge variant="secondary">{badge}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {result.status === "stopped_at_pay"
            ? isZh
              ? `你的${country}申请需要在官网完成后续步骤。请联系支持团队获取下一步指引。`
              : `Your ${country} application needs attention for a later official-portal step. Contact support for next steps.`
            : result.status === "form_ready_for_agency"
              ? isZh
                ? `你的${country}申请资料包已准备好，可下载、打印并递交至签证中心。`
                : `Your ${country} application pack is ready to download, print, and submit at the visa centre.`
              : isZh
                ? `你的${country}申请已提交。我们会继续跟踪结果，并在这里保存获批签证。`
                : `Your ${country} application has been filed. We're tracking the decision and will store your approved visa here.`}
        </p>

        {result.reference ? (
          <div className="rounded-md border border-input bg-background px-3 py-2">
            <div className="text-xs text-muted-foreground">{isZh ? "参考号" : "Reference"}</div>
            <div className="mt-0.5 font-mono text-base font-medium text-foreground">{result.reference}</div>
          </div>
        ) : null}

        {hasArtifact && applicationId ? (
          <Button asChild className="w-full">
            <a href={`/api/applications/${applicationId}/evisa-artifact`}>
              <Download className="mr-2 h-4 w-4" />
              {result.country === "ID"
                ? isZh ? "下载官网成功凭证" : "Download official success evidence"
                : isZh ? "下载文件" : "Download document"}
            </a>
          </Button>
        ) : (
          <div className="rounded-md border border-brand-100 bg-brand-50 p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-brand-500">
              <Mail className="h-4 w-4" /> {isZh ? "后续步骤" : "What happens next"}
            </div>
            <p className="mt-2 text-sm text-foreground">
              {isZh
                ? "获批签证签发后会显示在这里供你下载。"
                : "Your approved visa will appear here for download as soon as it is issued."}
            </p>
          </div>
        )}

        {result.country === "ID" && result.status === "submitted" ? (
          <div className="space-y-3 rounded-md border border-brand-100 bg-brand-50 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-brand-700">
              <ShieldCheck className="h-4 w-4" />
              {isZh ? "官网成功凭证已保存" : "Official success evidence saved"}
            </div>
            <p className="text-sm text-foreground">
              {isZh
                ? "你现在可以前往状态页跟踪申请；官网状态或电子签证更新后会显示在那里。"
                : "You can now track the application on the status page, where official status and eVisa updates will appear."}
            </p>
            <Button asChild variant="outline" className="w-full bg-white">
              <a href="/client/status">
                {isZh ? "Track status / 跟踪状态" : "Track status"}
              </a>
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
