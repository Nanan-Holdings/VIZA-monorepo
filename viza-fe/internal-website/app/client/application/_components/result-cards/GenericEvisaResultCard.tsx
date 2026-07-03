"use client";

import { useState } from "react";
import { Download, ExternalLink, Loader2, Mail, RotateCw, ShieldCheck } from "lucide-react";
import { useLocale } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isChineseLocale } from "@/lib/i18n/locale";
import type { GenericEvisaSubmissionResult } from "@/lib/submission-result";

/**
 * POR-006: generic result card for the standard e-Visa launch countries
 * (ID/EG/SA/MY/TH/AE/CA/TR/IT/IN). Handles the submitted, halted-before-pay,
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
  applicationCountry,
  applicationVisaType,
  result,
}: {
  applicationId: string | null;
  applicationCountry?: string | null;
  applicationVisaType?: string | null;
  result: GenericEvisaSubmissionResult;
}) {
  const isZh = isChineseLocale(useLocale());
  const [locatingPayment, setLocatingPayment] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const portalUrl = result.portalUrl;
  const checkpoint = (result as GenericEvisaSubmissionResult & { checkpoint?: string }).checkpoint;
  const userPaymentRequired = result.country === "ID" && checkpoint === "user_payment_required";
  const isIndonesiaHomePaymentUrl =
    result.country === "ID" &&
    portalUrl !== undefined &&
    /^https:\/\/evisa\.imigrasi\.go\.id\/?$/i.test(portalUrl.trim());
  const isIndonesiaPaymentGatewayUrl =
    result.country === "ID" &&
    portalUrl !== undefined &&
    /^https:\/\/live\.finpay\.id\//i.test(portalUrl.trim());
  const country = (isZh ? COUNTRY_LABEL_ZH[result.country] : COUNTRY_LABEL[result.country]) ?? result.country;
  const hasArtifact = Boolean(result.artifactStoragePath);

  async function locateOfficialPaymentPage(): Promise<void> {
    if (!applicationId) return;
    setLocatingPayment(true);
    setLocateError(null);
    try {
      const response = await fetch(`/api/applications/${applicationId}/retry-submission`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "live_assisted",
          country: applicationCountry ?? "indonesia",
          visaType: applicationVisaType ?? "ID_B1_EVOA",
        }),
      });
      const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
      if (!response.ok) {
        throw new Error(typeof body?.error === "string" ? body.error : `Retry failed with ${response.status}`);
      }
      window.location.reload();
    } catch (error) {
      setLocateError(error instanceof Error ? error.message : String(error));
      setLocatingPayment(false);
    }
  }

  const heading =
    result.status === "submitted"
      ? isZh ? `${country}申请已提交` : `${country} application submitted`
      : result.status === "form_ready_for_agency"
        ? isZh ? `${country}申请资料包已准备好` : `${country} application pack ready`
        : isZh ? `${country}申请已准备好` : `${country} application prepared`;

  const badge =
    result.status === "stopped_at_pay"
      ? isZh ? "等待付款" : "Action required: payment"
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
              ? userPaymentRequired
                ? `官方付款窗口已经打开。请在那个窗口里完成银行卡付款和 OTP 验证，完成后 VIZA 会继续跟踪结果。`
                : `我们已把你的${country}申请推进到官网付款节点。请在官方页面完成付款，付款后 VIZA 会继续跟踪结果并在这里保存获批签证。`
              : userPaymentRequired
                ? "The official payment window is open. Complete card payment and OTP verification there; VIZA will keep tracking the result."
                : `We prepared your ${country} application and stopped at the government payment step. Complete the payment to finalize; we monitor the outcome and store your approved visa here.`
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
              <Download className="mr-2 h-4 w-4" /> {isZh ? "下载文件" : "Download document"}
            </a>
          </Button>
        ) : result.status === "stopped_at_pay" && userPaymentRequired ? (
          <div className="space-y-2">
            {portalUrl && !isIndonesiaHomePaymentUrl ? (
              <Button asChild className="w-full">
                <a href={portalUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {isIndonesiaPaymentGatewayUrl
                    ? isZh ? "重新打开官方银行卡付款页" : "Reopen official card payment page"
                    : isZh ? "打开官方付款页" : "Open official payment page"}
                </a>
              </Button>
            ) : null}
            <Button type="button" className="w-full" onClick={() => window.location.reload()}>
              <RotateCw className="mr-2 h-4 w-4" />
              {isZh ? "我已完成付款，刷新状态" : "I finished payment, refresh status"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={!applicationId || locatingPayment}
              onClick={() => {
                void locateOfficialPaymentPage();
              }}
            >
              {locatingPayment ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="mr-2 h-4 w-4" />
              )}
              {locatingPayment
                ? isZh ? "正在重新生成付款页" : "Regenerating payment page"
                : isZh ? "付款超时，重新生成付款页" : "Payment timed out, regenerate payment page"}
            </Button>
            {locateError ? <p className="text-sm text-red-700">{locateError}</p> : null}
          </div>
        ) : result.status === "stopped_at_pay" && portalUrl && !isIndonesiaHomePaymentUrl ? (
          <Button asChild className="w-full">
            <a href={portalUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" /> {isZh ? "打开官方付款页" : "Continue to official payment page"}
            </a>
          </Button>
        ) : result.status === "stopped_at_pay" && isIndonesiaHomePaymentUrl ? (
          <div className="space-y-2">
            <Button
              type="button"
              className="w-full"
              disabled={!applicationId || locatingPayment}
              onClick={() => {
                void locateOfficialPaymentPage();
              }}
            >
              {locatingPayment ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="mr-2 h-4 w-4" />
              )}
              {locatingPayment
                ? isZh ? "正在定位官方付款页" : "Locating official payment page"
                : isZh ? "定位官方付款页" : "Locate official payment page"}
            </Button>
            {locateError ? <p className="text-sm text-red-700">{locateError}</p> : null}
          </div>
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
      </CardContent>
    </Card>
  );
}
