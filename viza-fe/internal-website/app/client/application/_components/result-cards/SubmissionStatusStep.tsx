"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { AlertTriangle, Clock, Download, ExternalLink, FlaskConical, Loader2, Plus, RotateCw, ShieldCheck } from "lucide-react";
import type {
  DigitalArrivalCardSubmissionResult,
  GenericEvisaSubmissionResult,
  GenericSubmissionResult,
  SubmissionResult,
  SubmissionResultStatus,
  VnSubmissionResult,
} from "@/lib/submission-result";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isChineseLocale } from "@/lib/i18n/locale";
import {
  WaitingCard,
  type SubmissionVisualStage,
  type SubmissionVisualStatus,
} from "./WaitingCard";
import { FailureCard, type VietnamOneTimePaymentCard } from "./FailureCard";
import { UsResultCard } from "./UsResultCard";
import { FrResultCard } from "./FrResultCard";
import { UkResultCard } from "./UkResultCard";
import { VnResultCard } from "./VnResultCard";
import { AuResultCard } from "./AuResultCard";
import { JpResultCard } from "./JpResultCard";
import { KrResultCard } from "./KrResultCard";
import {
  isDs160VisaType,
  isMalaysiaMdacApplication,
  isFranceVisasVisaType,
  isPhilippinesEtravelApplication,
  isSgArrivalCardApplication,
  isThailandTdacApplication,
  isVietnamPrearrivalApplication,
  isVietnamEVisaApplication,
  isIndonesiaEVisaApplication,
  type SubmissionMode,
} from "@/lib/submission-queue";
import { GenericEvisaResultCard } from "./GenericEvisaResultCard";
import { SgArrivalCardResultCard } from "@/features/sgac/SgArrivalCardResultCard";

interface SubmissionStatusStepProps {
  applicationId: string | null;
  country: string | null;
  visaType: string | null;
  status: SubmissionResultStatus | null;
  result: SubmissionResult | null;
  onResubmit?: (
    mode: SubmissionMode,
    vietnamPaymentCard?: VietnamOneTimePaymentCard,
  ) => Promise<void> | void;
}

interface SubmissionStatusSnapshot {
  status: SubmissionVisualStatus;
  stage: SubmissionVisualStage;
  progress: number;
  message: string | null;
  result: SubmissionResult | null;
  error: string | null;
  updatedAt: string | null;
  applicationStatus: SubmissionResultStatus | null;
  country: string | null;
  visaType: string | null;
  queue: {
    id: string;
    status: string;
    mode: string | null;
    provider: string | null;
    currentStage?: string | null;
    heartbeatAt?: string | null;
    fieldFallbacks?: unknown[];
    createdAt?: string | null;
    updatedAt?: string | null;
  } | null;
}

type ManualAction = {
  id: string;
  actionType: string;
  status: string;
  instruction: string | null;
  screenshotUrl: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOfficialVietnamPrearrivalReference(value: string | null | undefined): value is string {
  if (!value) return false;
  const normalized = value.trim().toUpperCase();
  return /^(?:DE|VN|PAI|QR)[A-Z0-9-]{6,}$/.test(normalized) && /\d/.test(normalized);
}

function isVietnamPaymentCheckpointResult(
  result: SubmissionResult | null,
): result is VnSubmissionResult {
  if (!result || result.country !== "VN") return false;
  if (isDigitalArrivalCardResult(result)) return false;
  const record = result as VnSubmissionResult;
  return (
    record.status === "stopped_at_pay" ||
    record.checkpoint === "payment_page_visible" ||
    record.manualAction?.type === "payment_required" ||
    Boolean(record.registrationCode)
  );
}

function DigitalArrivalCardResultCard({ result }: { result: DigitalArrivalCardSubmissionResult }) {
  const isZh = isChineseLocale(useLocale());
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [startingAgain, setStartingAgain] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const scheduled = result.status === "scheduled";
  const rawReferenceNumber = result.referenceNumber ?? result.confirmationNumber;
  const referenceNumber =
    result.country === "VN" && !isOfficialVietnamPrearrivalReference(rawReferenceNumber)
      ? null
      : rawReferenceNumber;
  const storedPdfPath = result.confirmationPdfStoragePath ?? result.artifacts?.pdfs?.[0] ?? null;
  const qrPath = result.country === "VN"
    ? result.artifacts?.screenshots?.find((path) => /(?:^|[-_/])qr(?:[-_.]|$)|confirmation-qr/i.test(path)) ?? null
    : null;
  const vietnamFinalizing =
    result.country === "VN" &&
    result.submitted &&
    result.status === "submitted" &&
    !referenceNumber &&
    !storedPdfPath &&
    !qrPath;
  const successful = result.submitted && result.status === "submitted" && !vietnamFinalizing;
  const hasOfficialPdfDownload =
    (result.country === "TH" || result.country === "VN") &&
    Boolean(storedPdfPath) &&
    Boolean(
      result.artifacts?.logs?.some((log) =>
        log.includes("tdac_pdf_downloaded") ||
        log.includes("tdac_confirmation_page_pdf_saved") ||
        log.includes("vn_prearrival_pdf_downloaded") ||
        log.includes("vn_prearrival_confirmation_page_pdf_saved"),
      ),
    );
  const pdfPath = hasOfficialPdfDownload ? storedPdfPath : null;
  const arrivalCardMeta =
    result.country === "MY"
      ? { label: "MDAC", countryParam: "malaysia" }
      : result.country === "TH"
        ? { label: "TDAC", countryParam: "thailand" }
        : result.country === "VN"
          ? { label: "Vietnam Pre-Arrival", countryParam: "vietnam" }
          : { label: "eTravel", countryParam: "philippines" };
  const countryLabel = arrivalCardMeta.label;
  const countryParam = arrivalCardMeta.countryParam;
  const pdfUrl = pdfPath
    ? `/api/applications/${encodeURIComponent(result.applicationId)}/submission-artifact?path=${encodeURIComponent(pdfPath)}&download=${encodeURIComponent(`${countryLabel.toLowerCase()}-${referenceNumber ?? result.applicationId}.pdf`)}`
    : null;
  const qrUrl = qrPath
    ? `/api/applications/${encodeURIComponent(result.applicationId)}/submission-artifact?path=${encodeURIComponent(qrPath)}&inline=1&download=${encodeURIComponent(`${countryLabel.toLowerCase()}-${referenceNumber ?? result.applicationId}-qr.png`)}`
    : null;

  const downloadPdf = useCallback(async () => {
    if (!pdfUrl) return;
    setDownloadingPdf(true);
    setDownloadError(null);
    try {
      const response = await fetch(pdfUrl, { credentials: "include" });
      if (!response.ok) throw new Error(`PDF download failed with ${response.status}`);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `${countryLabel.toLowerCase()}-${referenceNumber ?? result.applicationId}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : String(error));
    } finally {
      setDownloadingPdf(false);
    }
  }, [countryLabel, pdfUrl, referenceNumber, result.applicationId]);

  const startAgain = useCallback(async () => {
    setStartingAgain(true);
    setDownloadError(null);
    try {
      const response = await fetch(`/api/applications/${result.applicationId}/arrival-card-new-application`, {
        method: "POST",
      });
      const body = (await response.json().catch(() => null)) as { applicationId?: string; error?: string } | null;
      if (!response.ok || !body?.applicationId) {
        throw new Error(body?.error || `Could not create a new application (${response.status})`);
      }
      window.location.href = `/client/application/long-form?country=${countryParam}&visaType=${result.visaType}&applicationId=${encodeURIComponent(body.applicationId)}`;
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : String(error));
      setStartingAgain(false);
    }
  }, [countryParam, result.applicationId, result.visaType]);

  return (
    <Card className="rounded-lg border-input">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          {successful ? (
            <ShieldCheck className="h-6 w-6 text-emerald-600" />
          ) : scheduled || vietnamFinalizing ? (
            <Clock className="h-6 w-6 text-blue-700" />
          ) : (
            <AlertTriangle className="h-6 w-6 text-amber-600" />
          )}
          {successful
            ? isZh ? `${countryLabel} 提交成功` : `${countryLabel} submitted`
            : vietnamFinalizing
              ? isZh ? "越南入境申报正在官网最终处理" : "Vietnam Pre-Arrival is being finalized by the official portal"
            : scheduled
              ? isZh ? `${countryLabel} 已排队，等待自动提交` : `${countryLabel} scheduled for automatic submission`
            : isZh ? `${countryLabel} 未完成` : `${countryLabel} not completed`}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {successful ? (
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_11rem] sm:items-center">
            <div className="border-l-2 border-emerald-600 pl-3">
              <div className="text-xs text-muted-foreground">
                {result.country === "VN"
                  ? (isZh ? "官方申报编号 / 参考号" : "Official declaration reference")
                  : (isZh ? "申请编号 / 参考号" : "Reference number")}
              </div>
              <div className="mt-1 font-mono text-lg font-semibold">
                {referenceNumber ?? (isZh ? "官网确认已保存" : "Official confirmation saved")}
              </div>
              {result.country === "VN" ? (
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {isZh
                    ? "请在入境时出示此二维码或下载的官方确认文件。"
                    : "Present this QR code or the official confirmation file when entering Vietnam."}
                </p>
              ) : null}
            </div>
            {qrUrl ? (
              <a
                className="block justify-self-start rounded-md border bg-white p-2 shadow-sm"
                href={qrUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={isZh ? "查看官方二维码" : "View official QR code"}
              >
                <img
                  src={qrUrl}
                  alt={isZh ? "越南入境前申报官方二维码" : "Vietnam Pre-Arrival official QR code"}
                  className="h-36 w-36 object-contain"
                />
              </a>
            ) : null}
          </div>
        ) : referenceNumber ? (
          <div className="border-l-2 border-emerald-600 pl-3">
            <div className="text-xs text-muted-foreground">{isZh ? "申请编号 / 参考号" : "Reference number"}</div>
            <div className="mt-1 font-mono text-lg font-semibold">{referenceNumber}</div>
          </div>
        ) : null}
        <p className="text-sm text-muted-foreground">
          {successful
            ? result.portalResponseSummary
            : vietnamFinalizing
              ? isZh
                ? "官网已接收申报并完成邮箱验证，正在生成最终二维码和 PDF。请勿重复提交；结果完成后会发送到邮箱并同步回此页面。"
                : "The official portal has received the declaration and verified the email. It is generating the final QR code and PDF. Do not submit again; the result will be emailed and synchronized here."
            : scheduled
              ? result.portalResponseSummary
            : result.errorDetails?.message || result.portalResponseSummary}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {pdfUrl ? (
            <Button type="button" onClick={downloadPdf} disabled={downloadingPdf}>
              {downloadingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {isZh ? "下载确认文件" : "Download confirmation"}
            </Button>
          ) : null}
          {successful && qrUrl ? (
            <Button asChild type="button" variant={pdfUrl ? "outline" : "default"}>
              <a href={qrUrl} download={`${countryLabel.toLowerCase()}-${referenceNumber ?? result.applicationId}-qr.png`}>
                <Download className="mr-2 h-4 w-4" />
                {isZh ? "下载官方二维码" : "Download official QR code"}
              </a>
            </Button>
          ) : null}
          {!vietnamFinalizing ? (
            <Button type="button" variant={pdfUrl ? "outline" : "default"} onClick={startAgain} disabled={startingAgain}>
              {startingAgain ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              {isZh ? "再次提交" : `Submit another ${countryLabel}`}
            </Button>
          ) : null}
        </div>
        {!pdfUrl && successful ? (
          <p className="text-xs text-muted-foreground">
            {result.country === "MY"
              ? isZh
                ? "马来西亚 MDAC 官网当前只返回提交确认，不提供可下载确认 PDF。"
                : "The Malaysia MDAC portal currently returns a submission confirmation but does not provide an official downloadable PDF."
              : result.country === "PH"
                ? isZh
                  ? "菲律宾 eTravel 通常返回 QR code / 参考号；当前没有可下载的官方 PDF。"
                  : "The Philippines eTravel portal usually returns a QR code/reference; no official downloadable PDF is available for this submission."
                : result.country === "VN"
                  ? isZh
                    ? "越南入境前申报通常返回 QR code，并在官网提供 PDF 下载；当前这次提交没有可下载的 PDF artifact。"
                    : "Vietnam Pre-Arrival usually returns a QR code and an official PDF download; no downloadable PDF artifact is available for this submission."
              : isZh
                ? "当前没有可下载的官方确认 PDF。"
                : "No official downloadable confirmation PDF is available for this submission."}
          </p>
        ) : null}
        {downloadError ? <p className="text-sm text-red-700">{downloadError}</p> : null}
        <Button asChild variant="ghost" className="w-full">
          <a href={result.portalUrl} target="_blank" rel="noopener noreferrer">
            {isZh ? "打开官方入境卡网站" : "Open official arrival card website"}
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}

function isDigitalArrivalCardResult(result: SubmissionResult): result is DigitalArrivalCardSubmissionResult {
  return (
    (result.country === "MY" && "visaType" in result && result.visaType === "MY_MDAC_ARRIVAL_CARD") ||
    (result.country === "TH" && "visaType" in result && result.visaType === "TH_TDAC_ARRIVAL_CARD") ||
    (result.country === "PH" && "visaType" in result && result.visaType === "PH_ETRAVEL_ARRIVAL_CARD") ||
    (result.country === "VN" && "visaType" in result && result.visaType === "VN_PREARRIVAL_DECLARATION")
  );
}

function isGenericEvisaResult(result: SubmissionResult): result is GenericEvisaSubmissionResult {
  return (
    ["ID", "EG", "SA", "MY", "TH", "AE", "CA", "TR", "IT", "IN"].includes(result.country) &&
    !isDigitalArrivalCardResult(result)
  );
}

function isVietnamPaymentCheckpointError(error: string | null | undefined): boolean {
  const normalized = (error ?? "").toLowerCase();
  return (
    normalized.includes("official vietnam e-visa portal reached payment") ||
    normalized.includes("payment_page_visible")
  );
}

function normalizeStatus(status: string | null | undefined): string {
  return (status ?? "").trim().toLowerCase();
}

function visualStatusFromApplication(status: SubmissionResultStatus | null): SubmissionVisualStatus {
  const normalized = normalizeStatus(status);
  if (!normalized || normalized === "waiting") return "queued";
  if (normalized === "scheduled") return "scheduled";
  if (normalized === "processing") return "running";
  if (normalized === "failed") return "failed";
  if (normalized === "stalled") return "stalled";
  if (
    normalized === "needs_user_action" ||
    normalized === "action_required" ||
    normalized === "stopped_at_sign" ||
    normalized === "stopped_at_pay" ||
    normalized === "stopped_at_review" ||
    normalized === "unsupported"
  ) {
    return "needs_user_action";
  }
  return "completed";
}

function isArrivalCardTarget(country: string | null | undefined, visaType: string | null | undefined): boolean {
  return (
    isSgArrivalCardApplication(country, visaType) ||
    isMalaysiaMdacApplication(country, visaType) ||
    isThailandTdacApplication(country, visaType) ||
    isPhilippinesEtravelApplication(country, visaType) ||
    isVietnamPrearrivalApplication(country, visaType)
  );
}

function fallbackProgressForStatus(
  status: SubmissionVisualStatus,
  country: string | null | undefined,
  visaType: string | null | undefined,
): number {
  switch (status) {
    case "scheduled":
      return 0;
    case "completed":
      return 100;
    case "needs_user_action":
    case "stalled":
      return 99;
    case "running":
      return 67;
    case "queued":
      if (isArrivalCardTarget(country, visaType)) return 52;
      return 12;
    case "failed":
      return 0;
    default:
      return 0;
  }
}

function extractError(result: SubmissionResult | null, fallback?: string | null): string | undefined {
  if (isRecord(result) && typeof result.error === "string" && result.error.trim()) {
    return result.error.trim();
  }
  return fallback?.trim() || undefined;
}

function isSnapshot(value: unknown): value is SubmissionStatusSnapshot {
  if (!isRecord(value)) return false;
  return (
    typeof value.status === "string" &&
    typeof value.stage === "string" &&
    typeof value.progress === "number"
  );
}

function isFranceCountry(country: string | null | undefined): boolean {
  const normalized = (country ?? "").trim().toLowerCase();
  return normalized === "france" || normalized === "fr" || normalized === "法国";
}

function localizeActionText(value: string | null | undefined, isZh: boolean): string | null {
  if (!value) return null;
  if (!isZh) return value;

  const normalized = value.trim();
  if (normalized === "managed_account_required") {
    return "VIZA 正在后台准备托管官网账号";
  }

  if (normalized === "managed_account_alias_unavailable") {
    return "正在准备专属邮箱 alias";
  }

  if (normalized === "official_fee_payment_required") {
    return "等待官方费用授权";
  }

  if (normalized === "official_fee_payment_failed") {
    return "官方付款失败，可重新自动付款";
  }

  if (normalized === "official_fee_otp_required") {
    return "等待银行 OTP 验证";
  }

  if (normalized === "live_portal_recon_required") {
    return "等待官网自动化验证";
  }

  if (normalized === "official_account_automation_required") {
    return "正在自动处理官网账号";
  }

  if (normalized === "official_form_reached") {
    return "已进入官网表单";
  }

  if (normalized === "captcha_required") {
    return "正在处理官网验证码";
  }

  if (normalized === "official_portal_error") {
    return "官网访问异常";
  }

  if (
    /managed Indonesia eVisa account/i.test(normalized) ||
    /VIZA-managed Indonesia official portal account/i.test(normalized)
  ) {
    return "VIZA 会使用托管的印尼官网账号和专属邮箱 alias 继续申请。当前需要先完成官网账号准备；邮箱验证应由 email worker 自动读取并继续，不需要用户手动处理。";
  }

  return value;
}

function supportsLiveRetry(country: string | null | undefined, visaType: string | null | undefined): boolean {
  return (
    isDs160VisaType(visaType) ||
    (isFranceCountry(country) && isFranceVisasVisaType(visaType)) ||
    isVietnamEVisaApplication(country, visaType) ||
    isIndonesiaEVisaApplication(country, visaType) ||
    isSgArrivalCardApplication(country, visaType) ||
    isMalaysiaMdacApplication(country, visaType) ||
    isThailandTdacApplication(country, visaType) ||
    isPhilippinesEtravelApplication(country, visaType) ||
    isVietnamPrearrivalApplication(country, visaType)
  );
}

function isActiveSnapshot(snapshot: SubmissionStatusSnapshot | null): boolean {
  return snapshot?.status === "scheduled" || snapshot?.status === "queued" || snapshot?.status === "running";
}

function GenericResultCard({
  applicationId,
  applicationCountry,
  applicationVisaType,
  jobId,
  result,
}: {
  applicationId: string | null;
  applicationCountry: string | null;
  applicationVisaType: string | null;
  jobId: string | null;
  result: GenericSubmissionResult;
}) {
  const isZh = isChineseLocale(useLocale());
  const [startingLive, setStartingLive] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [manualAction, setManualAction] = useState<ManualAction | null>(null);
  const [manualActionError, setManualActionError] = useState<string | null>(null);
  const [completingManualAction, setCompletingManualAction] = useState(false);
  const [indonesiaCardNumber, setIndonesiaCardNumber] = useState("");
  const [indonesiaCardExpiry, setIndonesiaCardExpiry] = useState("");
  const [indonesiaCardCvv, setIndonesiaCardCvv] = useState("");
  const [indonesiaCardLast4, setIndonesiaCardLast4] = useState<string | null>(null);
  const unsupported = result.status === "unsupported";
  const actionRequired = result.status === "action_required";
  const isDs160Action =
    actionRequired &&
    result.mode === "live_assisted" &&
    isDs160VisaType(applicationVisaType ?? result.visaType);
  const isFranceAction =
    actionRequired &&
    result.mode === "live_assisted" &&
    isFranceCountry(applicationCountry ?? result.targetCountry) &&
    isFranceVisasVisaType(applicationVisaType ?? result.visaType);
  const isIndonesiaAction =
    actionRequired &&
    result.mode === "live_assisted" &&
    isIndonesiaEVisaApplication(applicationCountry ?? result.targetCountry, applicationVisaType ?? result.visaType);
  const officialManualAction = isDs160Action || isFranceAction;
  const franceLiveEnabled =
    process.env.NEXT_PUBLIC_FRANCE_LIVE_SUBMISSION_ENABLED === "true" &&
    process.env.NEXT_PUBLIC_FRANCE_SUBMISSION_MODE === "live_assisted";
  const canStartDs160Live =
    Boolean(applicationId) &&
    result.status === "submitted_mock" &&
    result.mode === "dry_run" &&
    isDs160VisaType(applicationVisaType ?? result.visaType);
  const canStartFranceLive =
    Boolean(applicationId) &&
    result.status === "submitted_mock" &&
    result.mode === "dry_run" &&
    franceLiveEnabled &&
    isFranceCountry(applicationCountry) &&
    isFranceVisasVisaType(applicationVisaType ?? result.visaType);
  const canContinueIndonesiaLive = Boolean(applicationId) && isIndonesiaAction;
  const liveTarget = canStartDs160Live ? "ds160" : canStartFranceLive ? "france" : canContinueIndonesiaLive ? "indonesia" : null;
  const indonesiaPaymentAction =
    isIndonesiaAction &&
    (result.actionType === "official_fee_otp_required" ||
      result.actionType === "official_fee_payment_required" ||
      result.actionType === "official_fee_payment_failed");
  const indonesiaCardReady =
    indonesiaCardNumber.replace(/\D/g, "").length >= 12 &&
    indonesiaCardExpiry.trim().length >= 4 &&
    indonesiaCardCvv.replace(/\D/g, "").length >= 3;
  const Icon = unsupported || actionRequired ? AlertTriangle : FlaskConical;
  const title = isIndonesiaAction
    ? result.actionType === "official_fee_otp_required"
      ? (isZh ? "等待银行 OTP 验证" : "Waiting for bank OTP verification")
      : result.actionType === "official_fee_payment_failed"
      ? (isZh ? "官方付款失败，可重新自动付款" : "Official payment failed; automated retry is available")
      : result.actionType === "official_fee_payment_required"
      ? (isZh ? "等待官方费用授权" : "Waiting for official-fee authorization")
      : (isZh ? "印尼自动申请正在准备" : "Indonesia automated application is preparing")
    : actionRequired
      ? (isZh ? "需要人工操作" : "Manual action required")
    : unsupported
      ? (isZh ? "暂不支持自动提交" : "Automated submission unavailable")
      : (isZh ? "Dry-run 已完成" : "Dry-run submission complete");
  const badge = isIndonesiaAction
    ? (isZh ? "自动处理中" : "Automating")
    : actionRequired
      ? (isZh ? "需操作" : "Action required")
    : unsupported
      ? (isZh ? "暂不支持" : "Unsupported")
      : "Dry run";
  const body = unsupported
    ? (isZh
        ? "自动提交暂未支持该国家，我们可以先帮你整理材料和生成申请草稿。"
        : "Automated submission is not available for this country yet. We can still organize documents and prepare the draft.")
    : actionRequired
      ? (localizeActionText(result.actionInstructions, isZh) ??
          localizeActionText(result.message, isZh) ??
          result.actionInstructions ??
          result.message)
      : result.message;

  useEffect(() => {
    if (!jobId || !officialManualAction) return;
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
          setManualActionError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setManualActionError(error instanceof Error ? error.message : String(error));
        }
      }
    };

    void loadManualActions();
    return () => {
      cancelled = true;
    };
  }, [jobId, officialManualAction]);

  const startLiveAssisted = async () => {
    if (!applicationId || startingLive || !liveTarget) return;

    if (liveTarget !== "ds160" && liveTarget !== "indonesia") {
      const confirmed = window.confirm(
        isZh
          ? "这会创建 live_assisted 队列任务，并可用 VIZA 邮箱 alias 注册 France-Visas 账号；注册页图片验证码会使用 2captcha 处理。确认继续？"
          : "This will create a live_assisted queue job and may register a France-Visas account with a VIZA email alias; the registration image CAPTCHA may be solved with 2captcha. Continue?",
      );
      if (!confirmed) return;
    }

    setStartingLive(true);
    setLiveError(null);
    try {
      const response = await fetch(`/api/applications/${applicationId}/retry-submission`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "live_assisted",
          country: applicationCountry,
          visaType: applicationVisaType ?? result.visaType,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || `retry-submission returned ${response.status}`);
      }
      window.location.reload();
    } catch (error) {
      setLiveError(error instanceof Error ? error.message : String(error));
    } finally {
      setStartingLive(false);
    }
  };

  const restartIndonesiaOfficialPayment = async () => {
    if (!applicationId || !indonesiaCardReady) return;
    setStartingLive(true);
    setLiveError(null);
    try {
      const response = await fetch(`/api/applications/${applicationId}/official-fee/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          card: {
            pan: indonesiaCardNumber,
            expiry: indonesiaCardExpiry,
            cvv: indonesiaCardCvv,
          },
        }),
      });
      const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
      if (!response.ok) {
        throw new Error(typeof payload?.error === "string" ? payload.error : `official-fee/pay returned ${response.status}`);
      }
      const cardSession = payload?.cardSession as Record<string, unknown> | undefined;
      const redactedCard = cardSession?.redactedCard as Record<string, unknown> | undefined;
      setIndonesiaCardLast4(typeof redactedCard?.last4 === "string" ? redactedCard.last4 : null);
      setIndonesiaCardNumber("");
      setIndonesiaCardCvv("");
      window.setTimeout(() => window.location.reload(), 250);
    } catch (error) {
      setLiveError(error instanceof Error ? error.message : String(error));
    } finally {
      setStartingLive(false);
    }
  };

  const completeManualAction = async () => {
    if (!jobId || !manualAction || completingManualAction) return;
    setCompletingManualAction(true);
    setManualActionError(null);
    try {
      const response = await fetch(
        `/api/submissions/${jobId}/manual-actions/${manualAction.id}/complete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmed: true }),
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
      window.location.reload();
    } catch (error) {
      setManualActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setCompletingManualAction(false);
    }
  };

  return (
    <Card className="rounded-xl border-input">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-3 text-foreground">
            <Icon className="h-5 w-5 text-brand-500" />
            {title}
          </CardTitle>
          <Badge variant={unsupported || actionRequired ? "secondary" : "default"}>
            {badge}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {body}
        </p>

        <div className="rounded-md border border-input bg-background px-3 py-2">
          <div className="text-xs text-muted-foreground">{isZh ? "国家 / 签证类型" : "Country / visa type"}</div>
          <div className="mt-0.5 font-mono text-sm text-foreground">
            {result.targetCountry} / {result.visaType}
          </div>
        </div>

        {result.mode === "dry_run" && result.confirmationNumber && (
          <div className="rounded-md border border-brand-100 bg-brand-50 px-3 py-2">
            <div className="text-xs text-brand-500">Mock confirmation</div>
            <div className="mt-0.5 font-mono text-sm font-medium text-foreground">
              {result.confirmationNumber}
            </div>
          </div>
        )}

        {liveTarget && (
          <div className="rounded-md border border-brand-100 bg-brand-50 p-3">
            <div className="flex items-start gap-2 text-sm leading-relaxed text-brand-900">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
              <span>
                {liveTarget === "ds160"
                  ? (isZh
                      ? "点击提交后，系统会使用已保存的表单和照片在 CEAC 官方 DS-160 完成真实提交。页面会显示提交进度，成功后展示 DS-160 编号和提交证据。"
                      : "Submit will use the saved form and photo to file the DS-160 on CEAC. Progress appears here, followed by the DS-160 number and evidence.")
                  : liveTarget === "indonesia"
                    ? (isZh
                        ? "VIZA 会继续用托管的印尼官网账号和专属邮箱 alias 推进申请。邮箱验证由 email worker 自动读取；遇到 3DS、OTP 或官方风控时才会暂停。"
                        : "VIZA will continue with the managed Indonesia portal account and dedicated email alias. Email verification is handled by the email worker; only 3DS, OTP, or official risk gates pause the run.")
                  : (isZh
                      ? "这是旧的 dry-run 结果。可以从这里启动 France-Visas 官网辅助填写；如需新账号，VIZA 会用专属邮箱 alias 注册并用 2captcha 处理注册页图片验证码。"
                      : "This is the previous dry-run result. You can start the France-Visas live assisted fill from here; if a new account is needed, VIZA will use a dedicated email alias and 2captcha for the registration image CAPTCHA.")}
              </span>
            </div>
            {indonesiaPaymentAction ? (
              <div className="mt-3 space-y-3 rounded-md border border-brand-100 bg-white p-3">
                <div className="text-sm font-semibold text-foreground">
                  {isZh ? "重新自动付款银行卡" : "Restart automated payment card"}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 sm:col-span-2">
                    <span className="text-xs text-muted-foreground">{isZh ? "银行卡号" : "Card number"}</span>
                    <input
                      value={indonesiaCardNumber}
                      onChange={(event) => setIndonesiaCardNumber(event.target.value)}
                      autoComplete="cc-number"
                      inputMode="numeric"
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-brand-500"
                      placeholder={isZh ? "请输入银行卡号" : "Enter card number"}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-muted-foreground">{isZh ? "有效期" : "Expiry"}</span>
                    <input
                      value={indonesiaCardExpiry}
                      onChange={(event) => setIndonesiaCardExpiry(event.target.value)}
                      autoComplete="cc-exp"
                      inputMode="numeric"
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-brand-500"
                      placeholder="MM/YY"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-muted-foreground">CVV</span>
                    <input
                      value={indonesiaCardCvv}
                      onChange={(event) => setIndonesiaCardCvv(event.target.value)}
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
                {indonesiaCardLast4 ? (
                  <p className="text-xs text-brand-600">
                    {isZh ? `已刷新一次性卡会话：尾号 ${indonesiaCardLast4}` : `One-time card session refreshed: ending ${indonesiaCardLast4}`}
                  </p>
                ) : null}
              </div>
            ) : null}
            <Button
              type="button"
              className="mt-3 w-full"
              onClick={indonesiaPaymentAction ? restartIndonesiaOfficialPayment : startLiveAssisted}
              disabled={startingLive || (indonesiaPaymentAction && !indonesiaCardReady)}
            >
              {startingLive ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="mr-2 h-4 w-4" />
              )}
              {startingLive
                ? (isZh ? "正在提交" : "Submitting")
                : liveTarget === "ds160"
                  ? (isZh ? "提交" : "Submit")
                  : liveTarget === "indonesia"
                    ? indonesiaPaymentAction
                      ? (isZh ? "重新自动付款" : "Restart automated payment")
                      : (isZh ? "继续自动申请" : "Continue automated application")
                  : (isZh ? "启动 France-Visas 官网辅助填写" : "Start France-Visas live assisted fill")}
            </Button>
          </div>
        )}

        {liveError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {liveError}
          </div>
        )}

        {actionRequired && result.actionType && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
            <div className="text-xs text-amber-700">{isZh ? "检查点" : "Checkpoint"}</div>
            <div className="mt-0.5 font-mono text-sm font-medium text-foreground">
              {localizeActionText(result.actionType, isZh) ?? result.actionType}
            </div>
          </div>
        )}

        {officialManualAction && (
          <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <div>
                <div className="text-sm font-medium text-amber-900">
                  {isFranceAction
                    ? (isZh ? "需要你完成 France-Visas 官网操作" : "France-Visas official action required")
                    : (isZh ? "需要你完成 CEAC 官网验证" : "CEAC official verification required")}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-amber-900">
                  {localizeActionText(manualAction?.instruction, isZh) ??
                    localizeActionText(result.actionInstructions, isZh) ??
                    manualAction?.instruction ??
                    result.actionInstructions ??
                    (isFranceAction
                      ? (isZh
                          ? "请在 France-Visas 官方页面完成登录、验证码或邮箱验证，然后回到这里继续。"
                          : "Complete login, CAPTCHA, or email verification on the official France-Visas page, then return here to continue.")
                      : (isZh
                          ? "请在打开的 CEAC 官方页面完成地点选择或 CAPTCHA，然后回到这里继续。"
                          : "Complete the location or CAPTCHA checkpoint on the official CEAC page, then return here to continue."))}
                </p>
              </div>
            </div>

            {manualAction?.screenshotUrl && (
              <div className="rounded-md border border-amber-200 bg-white px-3 py-2">
                <div className="text-xs text-amber-700">{isZh ? "安全截图" : "Safe screenshot"}</div>
                <div className="mt-0.5 break-all font-mono text-xs text-foreground">
                  {manualAction.screenshotUrl}
                </div>
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              <Button asChild variant="outline" className="bg-white">
                <a
                  href={
                    isFranceAction
                      ? "https://application-form.france-visas.gouv.fr/fv-fo-dde/"
                      : "https://ceac.state.gov/genniv/"
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {isFranceAction
                    ? (isZh ? "打开 France-Visas 官网" : "Open France-Visas")
                    : (isZh ? "打开 CEAC 官网" : "Open CEAC")}
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button
                type="button"
                onClick={completeManualAction}
                disabled={!manualAction || completingManualAction}
              >
                {completingManualAction ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="mr-2 h-4 w-4" />
                )}
                {isZh ? "我已完成，继续" : "I completed it, continue"}
              </Button>
            </div>

            {!jobId && (
              <p className="text-xs text-amber-800">
                {isZh
                  ? "正在同步当前 live job，请稍后刷新状态。"
                  : "The current live job is still syncing. Refresh this status shortly."}
              </p>
            )}
            {manualActionError && (
              <p className="text-sm text-red-700">{manualActionError}</p>
            )}
          </div>
        )}

        {unsupported && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {result.message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ArrivalCardPreparedResultCard({
  applicationId,
  country,
  visaType,
  result,
}: {
  applicationId: string | null;
  country: "malaysia" | "thailand";
  visaType: string | null;
  result: GenericSubmissionResult;
}) {
  const isZh = isChineseLocale(useLocale());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [queuedSubmission, setQueuedSubmission] = useState<{
    jobId: string | null;
    queueStatus: string | null;
    provider: string | null;
  } | null>(null);
  const isMalaysia = country === "malaysia";
  const productName = isMalaysia ? "Malaysia Digital Arrival Card (MDAC)" : "Thailand Digital Arrival Card (TDAC)";
  const productNameZh = isMalaysia ? "马来西亚 MDAC 数字入境卡" : "泰国 TDAC 数字入境卡";
  const submitLive = useCallback(async () => {
    if (!applicationId || submitting || queuedSubmission) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const response = await fetch(`/api/applications/${applicationId}/retry-submission`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "live_assisted",
          visaType,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: unknown;
        jobId?: unknown;
        queueStatus?: unknown;
        provider?: unknown;
      } | null;
      if (!response.ok) {
        throw new Error(
          typeof body?.error === "string"
            ? body.error
            : `retry-submission returned ${response.status}`,
        );
      }
      setQueuedSubmission({
        jobId: typeof body?.jobId === "string" ? body.jobId : null,
        queueStatus: typeof body?.queueStatus === "string" ? body.queueStatus : null,
        provider: typeof body?.provider === "string" ? body.provider : null,
      });
      setSubmitting(false);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : String(error));
      setSubmitting(false);
    }
  }, [applicationId, queuedSubmission, submitting, visaType]);

  if (queuedSubmission) {
    return (
      <SubmissionStatusStep
        applicationId={applicationId}
        country={country}
        visaType={visaType}
        status="waiting"
        result={null}
      />
    );
  }

  return (
    <Card className="rounded-xl border-input">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-3 text-foreground">
            <ShieldCheck className="h-5 w-5 text-brand-500" />
            {isZh ? `${productNameZh}资料已完成` : `${productName} details ready`}
          </CardTitle>
          <Badge variant="secondary">{isZh ? "可提交" : "Ready to submit"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {isZh
            ? "你的答案已保存并完成本地校验。点击提交后，VIZA 会创建真实官网提交任务，自动填写官方表单，并在本页显示进度、官方编号和确认文件。"
            : "Your answers are saved and locally validated. Click Submit to create a real official-site submission job. VIZA will fill the official form and show progress, the official reference, and confirmation evidence here."}
        </p>
        <div className="rounded-md border border-input bg-background px-3 py-2">
          <div className="text-xs text-muted-foreground">{isZh ? "资料包状态" : "Pack status"}</div>
          <div className="mt-0.5 font-mono text-sm text-foreground">
            {result.confirmationNumber ?? "ARRIVAL-CARD-READY"}
          </div>
        </div>
        <Button type="button" className="w-full" onClick={submitLive} disabled={!applicationId || submitting || Boolean(queuedSubmission)}>
          {submitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ShieldCheck className="mr-2 h-4 w-4" />
          )}
          {submitting ? (isZh ? "正在提交" : "Submitting") : (isZh ? "提交" : "Submit")}
        </Button>
        {submitError ? <p className="text-sm text-red-700">{submitError}</p> : null}
      </CardContent>
    </Card>
  );
}

function FranceResubmitPanel({
  isZh,
  busy,
  disabled,
  error,
  onSubmitAgain,
}: {
  isZh: boolean;
  busy: boolean;
  disabled: boolean;
  error: string | null;
  onSubmitAgain: () => void;
}) {
  return (
    <Card className="rounded-xl border-brand-100 bg-brand-50/50">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">
            {isZh ? "重新提交 France-Visas 申请" : "Submit the France-Visas application again"}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {isZh
              ? "会先保存当前表单里的最新答案，再重新创建法国官网提交任务。"
              : "VIZA saves the latest answers from this form first, then creates a new France-Visas submission job."}
          </p>
          {error && <p className="text-xs text-red-700">{error}</p>}
        </div>
        <Button
          type="button"
          onClick={onSubmitAgain}
          disabled={disabled || busy}
          className="shrink-0"
        >
          {busy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RotateCw className="mr-2 h-4 w-4" />
          )}
          {busy
            ? (isZh ? "正在再次提交" : "Submitting again")
            : (isZh ? "再次提交申请" : "Submit again")}
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * Drives the final wizard step from the same-origin submission-status API,
 * with the parent application's realtime props as a terminal-state fallback.
 * Completed results wait until the visual progress reaches 100; failed and
 * needs_user_action states stop immediately.
 */
export function SubmissionStatusStep({
  applicationId,
  country,
  visaType,
  status,
  result,
  onResubmit,
}: SubmissionStatusStepProps) {
  const isZh = isChineseLocale(useLocale());
  const [snapshot, setSnapshot] = useState<SubmissionStatusSnapshot | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [resubmitting, setResubmitting] = useState(false);

  const handleRetry = useCallback(async (
    mode: SubmissionMode,
    vietnamPaymentCard?: VietnamOneTimePaymentCard,
  ) => {
    if (!applicationId) return;
    setRetryError(null);
    setResubmitting(true);
    try {
      if (onResubmit) {
        await onResubmit(mode, vietnamPaymentCard);
        setSnapshot(null);
        return;
      }
      const response = await fetch(`/api/applications/${applicationId}/retry-submission`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          country: snapshot?.country ?? country,
          visaType: snapshot?.visaType ?? visaType,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: unknown;
        jobId?: unknown;
        queueStatus?: unknown;
        provider?: unknown;
      } | null;
      if (!response.ok) {
        const message = typeof body?.error === "string" ? body.error : `Retry failed with ${response.status}`;
        setRetryError(message);
        throw new Error(message);
      }
      const now = new Date().toISOString();
      setSnapshot({
        status: "queued",
        stage: "preparing",
        progress: fallbackProgressForStatus("queued", snapshot?.country ?? country, snapshot?.visaType ?? visaType),
        message: isZh ? "自动提交任务已启动。" : "Automated submission has started.",
        result: null,
        error: null,
        updatedAt: now,
        applicationStatus: "waiting",
        country: snapshot?.country ?? country,
        visaType: snapshot?.visaType ?? visaType,
        queue: {
          id: typeof body?.jobId === "string" ? body.jobId : "",
          status: typeof body?.queueStatus === "string" ? body.queueStatus : "pending",
          mode,
          provider: typeof body?.provider === "string" ? body.provider : null,
          currentStage: null,
          heartbeatAt: null,
          fieldFallbacks: [],
          createdAt: now,
          updatedAt: now,
        },
      });
    } finally {
      setResubmitting(false);
    }
  }, [applicationId, country, isZh, onResubmit, snapshot?.country, snapshot?.visaType, visaType]);

  const fallbackVisualStatus = useMemo(
    () => visualStatusFromApplication(status),
    [status],
  );
  const snapshotIsActive = isActiveSnapshot(snapshot);
  const terminalPropsAvailable =
    !snapshotIsActive &&
    Boolean(result) &&
    fallbackVisualStatus !== "queued" &&
    fallbackVisualStatus !== "running";
  const effectiveStatus = terminalPropsAvailable
    ? fallbackVisualStatus
    : snapshot?.status ?? fallbackVisualStatus;
  const effectiveStage =
    snapshot?.stage ??
    (effectiveStatus === "scheduled"
      ? "scheduled"
      : effectiveStatus === "queued"
      ? "preparing"
      : effectiveStatus === "running"
        ? "filling_form"
        : effectiveStatus === "failed"
          ? "failed"
          : effectiveStatus === "completed"
            ? "completed"
            : "confirming_result");
  const effectiveProgress =
    snapshot?.progress ?? fallbackProgressForStatus(effectiveStatus, country, visaType);
  const effectiveResult = terminalPropsAvailable ? result : snapshot?.result ?? result;
  const effectiveError = extractError(effectiveResult, snapshot?.error);
  const effectiveApplicationStatus = terminalPropsAvailable
    ? status
    : snapshot?.applicationStatus ?? status;
  const completedWithResult = effectiveStatus === "completed" && Boolean(effectiveResult);
  const actionWithResult = effectiveStatus === "needs_user_action" && Boolean(effectiveResult);
  const failed =
    effectiveStatus === "failed" || (!snapshotIsActive && effectiveApplicationStatus === "failed");
  const stalled =
    effectiveStatus === "stalled" || (!snapshotIsActive && effectiveApplicationStatus === "stalled");
  const isFranceSubmissionCurrent = isFranceSubmission(
    snapshot?.country ?? country,
    snapshot?.visaType ?? visaType,
  );
  const isSgacSubmission = isSgArrivalCardApplication(
    snapshot?.country ?? country,
    snapshot?.visaType ?? visaType,
  );
  const isMdacSubmission = isMalaysiaMdacApplication(
    snapshot?.country ?? country,
    snapshot?.visaType ?? visaType,
  );
  const isTdacSubmission = isThailandTdacApplication(
    snapshot?.country ?? country,
    snapshot?.visaType ?? visaType,
  );
  const isDs160Submission = isDs160VisaType(snapshot?.visaType ?? visaType);
  const isVietnamSubmission = isVietnamEVisaApplication(
    snapshot?.country ?? country,
    snapshot?.visaType ?? visaType,
  );
  const isVnPrearrivalSubmission = isVietnamPrearrivalApplication(
    snapshot?.country ?? country,
    snapshot?.visaType ?? visaType,
  );
  const retryModes = isFranceSubmissionCurrent
    ? [{ mode: "live_assisted" as const, label: isZh ? "再次提交申请" : "Submit again" }]
    : isSgacSubmission || isMdacSubmission || isTdacSubmission || isDs160Submission || isVnPrearrivalSubmission
    ? [{ mode: "live_assisted" as const, label: isZh ? "提交" : "Submit" }]
    : supportsLiveRetry(snapshot?.country ?? country, snapshot?.visaType ?? visaType)
      ? [{ mode: "live_assisted" as const, label: isZh ? "提交" : "Submit" }]
      : [{ mode: "dry_run" as const, label: isZh ? "重新提交" : "Retry submission" }];

  useEffect(() => {
    setSnapshot(null);
    setRetryError(null);
  }, [applicationId, country, visaType]);

  useEffect(() => {
    if (!applicationId) return;
    if (completedWithResult) return;
    if ((failed || stalled) && snapshot?.queue) return;

    let cancelled = false;
    let pollingStoppedForAuth = false;
    const controller = new AbortController();
    const poll = async () => {
      if (pollingStoppedForAuth) return;

      try {
        const response = await fetch(`/api/applications/${applicationId}/submission-status`, {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        // Country switching may briefly render the outgoing application after its
        // auth cookie has been refreshed. Do not turn that transient 401 into a
        // failed submission for the application the user is leaving.
        if (response.status === 401) {
          pollingStoppedForAuth = true;
          return;
        }
        if (!response.ok) {
          throw new Error(`submission-status returned ${response.status}`);
        }
        const body: unknown = await response.json();
        if (!isSnapshot(body)) return;
        if (!cancelled) {
          setSnapshot({
            status: body.status,
            stage: body.stage,
            progress: body.progress,
            message: typeof body.message === "string" ? body.message : null,
            result: (body.result as SubmissionResult | null) ?? null,
            error: typeof body.error === "string" ? body.error : null,
            updatedAt: typeof body.updatedAt === "string" ? body.updatedAt : null,
            applicationStatus:
              typeof body.applicationStatus === "string"
                ? (body.applicationStatus as SubmissionResultStatus)
                : null,
            country: typeof body.country === "string" ? body.country : null,
            visaType: typeof body.visaType === "string" ? body.visaType : null,
            queue: isRecord(body.queue)
              ? {
                  id: typeof body.queue.id === "string" ? body.queue.id : "",
                  status: typeof body.queue.status === "string" ? body.queue.status : "",
                  mode: typeof body.queue.mode === "string" ? body.queue.mode : null,
                  provider: typeof body.queue.provider === "string" ? body.queue.provider : null,
                  currentStage:
                    typeof body.queue.currentStage === "string" ? body.queue.currentStage : null,
                  heartbeatAt:
                    typeof body.queue.heartbeatAt === "string" ? body.queue.heartbeatAt : null,
                  fieldFallbacks: Array.isArray(body.queue.fieldFallbacks)
                    ? body.queue.fieldFallbacks
                    : [],
                  createdAt:
                    typeof body.queue.createdAt === "string" ? body.queue.createdAt : null,
                  updatedAt:
                    typeof body.queue.updatedAt === "string" ? body.queue.updatedAt : null,
                }
              : null,
          });
        }
      } catch (err) {
        if (cancelled || (err instanceof DOMException && err.name === "AbortError")) return;
        const message = err instanceof Error ? err.message : String(err);
        setSnapshot((current) => ({
          status: "stalled",
          stage: "confirming_result",
          progress: Math.max(current?.progress ?? 0, 99),
          message: "Still confirming the submission result.",
          result: current?.result ?? result,
          error: message,
          updatedAt: current?.updatedAt ?? null,
          applicationStatus: current?.applicationStatus ?? status,
          country: current?.country ?? country,
          visaType: current?.visaType ?? visaType,
          queue: current?.queue ?? null,
        }));
      }
    };

    void poll();
    const timer = window.setInterval(poll, 3000);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [
    actionWithResult,
    applicationId,
    completedWithResult,
    failed,
    stalled,
    country,
    visaType,
    result,
    snapshot?.queue,
    status,
  ]);

  const vietnamPaymentCheckpointResult =
    isVietnamPaymentCheckpointResult(effectiveResult)
      ? effectiveResult
      : isVietnamEVisaApplication(country, visaType) &&
          isVietnamPaymentCheckpointError(retryError ?? effectiveError)
        ? ({
            country: "VN",
            status: "stopped_at_pay",
            mode: "live_assisted",
            provider: "vietnam_evisa_live",
            portalUrl: "https://evisa.gov.vn/e-visa/foreigners",
            checkpoint: "payment_page_visible",
            manualAction: {
              type: "payment_required",
              status: "open",
              instructions:
                retryError ??
                effectiveError ??
                "The official Vietnam e-Visa portal reached payment. Authorize payment in VIZA before continuing.",
            },
            paymentStatus: "manual_required",
          } as const)
        : null;

  if (
    vietnamPaymentCheckpointResult &&
    (failed || stalled || actionWithResult || completedWithResult)
  ) {
    return (
      <div className="space-y-4">
        {renderSubmissionResultCard(
          applicationId,
          country,
          visaType,
          vietnamPaymentCheckpointResult,
          snapshot?.queue?.id ?? null,
        )}
      </div>
    );
  }

  if (resubmitting) {
    return (
      <div className="space-y-4">
        <WaitingCard
          status="queued"
          stage="preparing"
          serverProgress={fallbackProgressForStatus("queued", country, visaType)}
          message={isZh ? "自动提交任务正在启动。" : "Starting the automated submission job."}
          applicationId={applicationId}
          country={country}
          visaType={visaType}
        />
      </div>
    );
  }

  if (failed) {
    return (
      <div className="space-y-4">
        <FailureCard
          applicationId={applicationId ?? undefined}
          errorMessage={retryError ?? effectiveError}
          retryModes={retryModes}
          onRetry={handleRetry}
          showFranceAccount={isFranceSubmission(country, visaType)}
          requiresOfficialPaymentCard={isVietnamSubmission}
        />
      </div>
    );
  }

  if (stalled) {
    return (
      <div className="space-y-4">
        <FailureCard
          applicationId={applicationId ?? undefined}
          errorMessage={
            retryError ??
            effectiveError ??
            "Submission job stalled because the worker did not pick it up in time."
          }
          retryModes={retryModes}
          onRetry={handleRetry}
          showFranceAccount={isFranceSubmission(country, visaType)}
          requiresOfficialPaymentCard={isVietnamSubmission}
        />
      </div>
    );
  }

  if (
    actionWithResult &&
    isRecord(effectiveResult) &&
    effectiveResult.country === "VN" &&
    typeof effectiveResult.registrationCode !== "string"
  ) {
    return (
      <div className="space-y-4">
        <FailureCard
          applicationId={applicationId ?? undefined}
          errorMessage={
            retryError ??
            effectiveError ??
            (typeof effectiveResult.manualAction === "object" &&
            effectiveResult.manualAction !== null &&
            "instructions" in effectiveResult.manualAction &&
            typeof effectiveResult.manualAction.instructions === "string"
              ? effectiveResult.manualAction.instructions
              : snapshot?.message ?? undefined)
          }
          retryModes={retryModes}
          onRetry={handleRetry}
          requiresOfficialPaymentCard={isVietnamSubmission}
        />
      </div>
    );
  }

  if (actionWithResult || completedWithResult) {
    return (
      <div className="space-y-4">
        {isFranceSubmissionCurrent && (
          <FranceResubmitPanel
            isZh={isZh}
            busy={resubmitting}
            disabled={!applicationId}
            error={retryError}
            onSubmitAgain={() => {
              void handleRetry("live_assisted").catch(() => undefined);
            }}
          />
        )}
        {renderSubmissionResultCard(
          applicationId,
          country,
          visaType,
          effectiveResult,
          snapshot?.queue?.id ?? null,
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isFranceSubmissionCurrent && (
        <FranceResubmitPanel
          isZh={isZh}
          busy={resubmitting}
          disabled={!applicationId}
          error={retryError}
          onSubmitAgain={() => {
            void handleRetry("live_assisted").catch(() => undefined);
          }}
        />
      )}
      <WaitingCard
        status={effectiveStatus}
        stage={effectiveStage}
        serverProgress={effectiveProgress}
        message={snapshot?.message}
        error={effectiveError}
        applicationId={applicationId}
        country={country}
        visaType={visaType}
      />
    </div>
  );
}

function isFranceSubmission(country: string | null, visaType: string | null): boolean {
  return (
    country?.toUpperCase() === "FR" ||
    country?.toLowerCase() === "france" ||
    visaType === "EU_SCHENGEN_C_SHORT_STAY"
  );
}

function renderSubmissionResultCard(
  applicationId: string | null,
  country: string | null,
  visaType: string | null,
  result: SubmissionResult | null,
  jobId: string | null = null,
) {
  if (!result) return <WaitingCard status="running" />;

  if (
    result.country === "GENERIC" &&
    isMalaysiaMdacApplication(country, visaType)
  ) {
    return (
      <ArrivalCardPreparedResultCard
        applicationId={applicationId}
        country="malaysia"
        visaType={visaType}
        result={result}
      />
    );
  }

  if (
    result.country === "GENERIC" &&
    isThailandTdacApplication(country, visaType)
  ) {
    return (
      <ArrivalCardPreparedResultCard
        applicationId={applicationId}
        country="thailand"
        visaType={visaType}
        result={result}
      />
    );
  }

  switch (result.country) {
    case "US":
      return <UsResultCard applicationId={applicationId ?? undefined} result={result} />;
    case "FR":
      return applicationId ? (
        <FrResultCard applicationId={applicationId} result={result} />
      ) : null;
    case "UK":
      return applicationId ? (
        <UkResultCard applicationId={applicationId} result={result} />
      ) : null;
    case "VN":
      if (isDigitalArrivalCardResult(result)) {
        return <DigitalArrivalCardResultCard result={result} />;
      }
      return <VnResultCard applicationId={applicationId} result={result} jobId={jobId} />;
    case "SG":
      return <SgArrivalCardResultCard result={result} />;
    case "AU":
      return applicationId ? (
        <AuResultCard applicationId={applicationId} result={result} />
      ) : null;
    case "JP":
      return applicationId ? (
        <JpResultCard applicationId={applicationId} result={result} />
      ) : null;
    case "KR":
      return applicationId ? (
        <KrResultCard applicationId={applicationId} result={result} />
      ) : null;
    case "GENERIC":
      return (
        <GenericResultCard
          applicationId={applicationId}
          applicationCountry={country}
          applicationVisaType={visaType}
          jobId={jobId}
          result={result}
        />
      );
    // POR-006: standard e-Visa launch countries share one generic card.
    case "ID":
    case "EG":
    case "SA":
    case "MY":
    case "TH":
      if (isDigitalArrivalCardResult(result)) {
        return <DigitalArrivalCardResultCard result={result} />;
      }
      return isGenericEvisaResult(result) ? (
        <GenericEvisaResultCard
          applicationId={applicationId}
          applicationCountry={country}
          applicationVisaType={visaType}
          result={result}
        />
      ) : (
        <WaitingCard status="running" />
      );
    case "AE":
    case "CA":
    case "TR":
    case "IT":
    case "IN":
      return isGenericEvisaResult(result) ? (
        <GenericEvisaResultCard
          applicationId={applicationId}
          applicationCountry={country}
          applicationVisaType={visaType}
          result={result}
        />
      ) : (
        <WaitingCard status="running" />
      );
    default:
      return <WaitingCard status="running" />;
  }
}
