"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { useLocale } from "next-intl";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  createPhEtravelApplicantExperienceFromStatus,
  type PhEtravelStatusSnapshot,
} from "./applicant-experience";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { isChineseLocale } from "@/lib/i18n/locale";

type PhEtravelApplicantStatusCardProps = {
  applicationId: string | null;
  status: PhEtravelStatusSnapshot;
  onRefresh?: () => void;
};

export function PhEtravelApplicantStatusCard({
  applicationId,
  status,
  onRefresh,
}: PhEtravelApplicantStatusCardProps) {
  const isZh = isChineseLocale(useLocale());
  const presentation = useMemo(
    () =>
      createPhEtravelApplicantExperienceFromStatus({
        locale: isZh ? "zh" : "en",
        status,
      }),
    [isZh, status],
  );
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrRenderFailed, setQrRenderFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setQrDataUrl(null);
    setQrRenderFailed(false);

    if (!presentation.submitted || !presentation.result.referenceNumber) return;

    void QRCode.toDataURL(presentation.result.referenceNumber, {
      margin: 1,
      width: 224,
      errorCorrectionLevel: "M",
    })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrRenderFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [presentation.result.referenceNumber, presentation.submitted]);

  const displayRecovery = presentation.state === "recovery_required" || qrRenderFailed;
  const showSubmittedResult = presentation.submitted && !qrRenderFailed && Boolean(qrDataUrl);
  const isRenderingQr = presentation.submitted && !qrRenderFailed && !qrDataUrl;
  const isWaiting =
    presentation.state === "scheduled" ||
    presentation.state === "queued" ||
    presentation.state === "processing";
  const canRefresh = Boolean(applicationId && onRefresh);
  const actions = displayRecovery && presentation.actions.length === 0
    ? [{ id: "reread_official_result" as const }]
    : presentation.actions;

  return (
    <Card className="rounded-lg border-input" data-testid="ph-etravel-status-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          {showSubmittedResult ? (
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
          ) : isWaiting ? (
            <Clock3 className="h-6 w-6 text-blue-700" />
          ) : (
            <AlertTriangle className="h-6 w-6 text-amber-600" />
          )}
          {displayRecovery
            ? isZh
              ? "正在确认官方结果"
              : "Confirming the official result"
            : isRenderingQr
              ? isZh
                ? "正在生成参考号二维码"
                : "Rendering the reference QR code"
            : presentation.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-6 text-muted-foreground">
          {displayRecovery
            ? isZh
              ? "VIZA 暂时不能确认官方 eTravel 结果。系统只会重新读取已保存的官方结果状态，不会再次发送官网 Submit。"
              : "VIZA cannot confirm the official eTravel result yet. It can reread the saved official result status without sending another official Submit."
            : presentation.message}
        </p>

        {showSubmittedResult && presentation.result.referenceNumber ? (
          <div className="grid gap-4 border-l-2 border-emerald-600 pl-3 sm:grid-cols-[minmax(0,1fr)_14rem] sm:items-center">
            <div>
              <p className="text-xs text-muted-foreground">
                {isZh ? "官方登记参考号" : "Official registration reference"}
              </p>
              <p className="mt-1 break-all font-mono text-lg font-semibold">
                {presentation.result.referenceNumber}
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {isZh
                  ? "二维码由上方同一官方参考号在当前页面生成并核验。"
                  : "This QR code is rendered and verified from the same official reference shown above."}
              </p>
              {presentation.result.receipt === "available" ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {isZh ? "官方回执已保存。" : "An official receipt is available."}
                </p>
              ) : null}
            </div>
            <img
              src={qrDataUrl ?? undefined}
              alt={isZh ? "菲律宾 eTravel 参考号二维码" : "Philippines eTravel reference QR code"}
              className="h-56 w-56 border bg-white p-2"
            />
          </div>
        ) : null}

        <p className="text-xs leading-5 text-muted-foreground">
          {isZh
            ? "菲律宾 eTravel 免费，不是签证，也不保证获准在菲律宾边境入境。"
            : "Philippines eTravel is free, is not a visa, and does not guarantee admission at Philippine border control."}
        </p>

        {actions.map((action) => (
          <Button
            key={action.id}
            type="button"
            variant="outline"
            disabled={!canRefresh}
            onClick={onRefresh}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {action.id === "reread_official_result"
              ? isZh
                ? "重新读取官方结果状态"
                : "Reread official result status"
              : isZh
                ? "刷新状态"
                : "Refresh status"}
          </Button>
        ))}

        {isRenderingQr ? (
          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {isZh ? "正在生成参考号二维码" : "Rendering the reference QR code"}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
