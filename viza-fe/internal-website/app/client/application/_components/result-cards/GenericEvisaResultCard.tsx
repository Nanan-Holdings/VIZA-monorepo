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
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [oneTimeCardLast4, setOneTimeCardLast4] = useState<string | null>(null);
  const portalUrl = result.portalUrl;
  const checkpoint = (result as GenericEvisaSubmissionResult & { checkpoint?: string }).checkpoint;
  const userPaymentRequired = result.country === "ID" && checkpoint === "user_payment_required";
  const indonesiaAutopayCheckpoint = result.country === "ID" && result.status === "stopped_at_pay" && userPaymentRequired;
  const cardReady =
    cardNumber.replace(/\D/g, "").length >= 12 &&
    cardExpiry.trim().length >= 4 &&
    cardCvv.replace(/\D/g, "").length >= 3;
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

  async function restartIndonesiaAutomatedPayment(): Promise<void> {
    if (!applicationId || !cardReady) return;
    setLocatingPayment(true);
    setLocateError(null);
    try {
      const response = await fetch(`/api/applications/${applicationId}/official-fee/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          card: {
            pan: cardNumber,
            expiry: cardExpiry,
            cvv: cardCvv,
          },
        }),
      });
      const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
      if (!response.ok) {
        throw new Error(typeof body?.error === "string" ? body.error : `official-fee/pay returned ${response.status}`);
      }
      const cardSession = body?.cardSession as Record<string, unknown> | undefined;
      const redactedCard = cardSession?.redactedCard as Record<string, unknown> | undefined;
      setOneTimeCardLast4(typeof redactedCard?.last4 === "string" ? redactedCard.last4 : null);
      setCardNumber("");
      setCardCvv("");
      window.setTimeout(() => window.location.reload(), 250);
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
    indonesiaAutopayCheckpoint
      ? isZh ? "等待银行验证" : "Waiting for bank verification"
      : result.status === "stopped_at_pay"
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
              ? indonesiaAutopayCheckpoint
                ? "VIZA 已经把你的银行卡提交到官方付款页，并会继续自动推进付款。若银行弹出 OTP / 3DS 验证，请只在官方窗口输入验证码；完成后 VIZA 会继续跟踪结果。"
                : `我们已把你的${country}申请推进到官网付款节点。请在官方页面完成付款，付款后 VIZA 会继续跟踪结果并在这里保存获批签证。`
              : indonesiaAutopayCheckpoint
                ? "VIZA has submitted your one-time card to the official payment page and will keep advancing the payment. If the bank shows OTP / 3DS verification, enter only that code in the official window; VIZA will keep tracking the result."
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
          <div className="space-y-3">
            {portalUrl && !isIndonesiaHomePaymentUrl ? (
              <Button asChild className="w-full">
                <a href={portalUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {isIndonesiaPaymentGatewayUrl
                    ? isZh ? "查看官方银行验证页" : "View official bank verification page"
                    : isZh ? "打开官方付款页" : "Open official payment page"}
                </a>
              </Button>
            ) : null}
            <Button type="button" className="w-full" onClick={() => window.location.reload()}>
              <RotateCw className="mr-2 h-4 w-4" />
              {isZh ? "我已完成银行验证，刷新状态" : "I finished bank verification, refresh status"}
            </Button>
            <div className="space-y-3 rounded-md border border-brand-100 bg-brand-50 p-3">
              <div className="text-sm font-semibold text-foreground">
                {isZh ? "重新自动付款银行卡" : "Restart automated payment card"}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 sm:col-span-2">
                  <span className="text-xs text-muted-foreground">{isZh ? "银行卡号" : "Card number"}</span>
                  <input
                    value={cardNumber}
                    onChange={(event) => setCardNumber(event.target.value)}
                    autoComplete="cc-number"
                    inputMode="numeric"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-brand-500"
                    placeholder={isZh ? "请输入银行卡号" : "Enter card number"}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">{isZh ? "有效期" : "Expiry"}</span>
                  <input
                    value={cardExpiry}
                    onChange={(event) => setCardExpiry(event.target.value)}
                    autoComplete="cc-exp"
                    inputMode="numeric"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-brand-500"
                    placeholder="MM/YY"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">CVV</span>
                  <input
                    value={cardCvv}
                    onChange={(event) => setCardCvv(event.target.value)}
                    autoComplete="cc-csc"
                    inputMode="numeric"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-brand-500"
                    placeholder="CVV"
                  />
                </label>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {isZh
                  ? "卡号和 CVV 只用于本次官方付款，会发送到本机 submission-service 的短时内存会话；不会保存到数据库、日志或个人资料。"
                  : "Card number and CVV are used only for this official payment through a short-lived local submission-service session."}
              </p>
              {oneTimeCardLast4 ? (
                <p className="text-xs text-brand-600">
                  {isZh ? `已刷新一次性卡会话：尾号 ${oneTimeCardLast4}` : `One-time card session refreshed: ending ${oneTimeCardLast4}`}
                </p>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={!applicationId || locatingPayment || !cardReady}
              onClick={() => {
                void restartIndonesiaAutomatedPayment();
              }}
            >
              {locatingPayment ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="mr-2 h-4 w-4" />
              )}
              {locatingPayment
                ? isZh ? "正在重新自动付款" : "Restarting automated payment"
                : isZh ? "付款超时，重新自动付款" : "Payment timed out, restart automated payment"}
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
