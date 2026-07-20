"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { AlertTriangle, CreditCard, ExternalLink, Eye, EyeOff, RotateCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BrandActionButton } from "@/components/client/brand-action-button";
import { isChineseLocale } from "@/lib/i18n/locale";
import type { SubmissionMode } from "@/lib/submission-queue";
import { translateOfficialImagePortalError } from "@/lib/document-image-validation";

interface FailureCardProps {
  applicationId?: string;
  errorMessage?: string;
  retryModes?: Array<{ mode: SubmissionMode; label: string }>;
  onRetry?: (
    mode: SubmissionMode,
    vietnamPaymentCard?: VietnamOneTimePaymentCard,
  ) => Promise<void> | void;
  showFranceAccount?: boolean;
  requiresOfficialPaymentCard?: boolean;
  requiresVietnamPaymentCard?: boolean;
}

export interface VietnamOneTimePaymentCard {
  pan: string;
  expiry: string;
  cvv: string;
  holderName: string;
}

type FvOfficialAccount = {
  email: string | null;
  password: string | null;
  portalUrl: string;
  updatedAt: string | null;
};

const VALIDATION_LABELS: Record<string, string> = {
  "trip.purpose": "旅行目的 / Purpose of travel",
  "trip.accommodationName": "住宿名称 / Accommodation name",
  "answers.given_name": "名字 / Given names",
  "answers.re_enter_email_address": "确认电子邮箱地址 / Re-enter email",
  "answers.religion": "宗教信仰 / Religion",
  "answers.has_multiple_nationalities": "是否拥有其他国籍 / Other nationalities",
  "answers.has_violated_vietnam_laws": "是否曾违反越南法律 / Vietnam law declaration",
  "answers.visa_type_requested": "申请签证类型 / Visa type requested",
  "answers.visa_valid_from": "签证生效日期 / Valid from",
  "answers.visa_valid_to": "签证有效期至 / Valid to",
  "answers.passport_type": "护照类型 / Passport type",
  "answers.permanent_residential_address": "永久居住地址 / Permanent address",
  "answers.contact_address": "联系地址 / Contact address",
  "answers.telephone_number": "联系电话 / Telephone number",
  "answers.emergency_contact_full_name": "紧急联系人姓名 / Emergency contact name",
  "answers.emergency_contact_current_address": "紧急联系人地址 / Emergency contact address",
  "answers.emergency_contact_telephone": "紧急联系人电话 / Emergency contact phone",
  "answers.emergency_contact_relationship": "紧急联系人关系 / Emergency contact relationship",
  "answers.purpose_of_entry": "入境目的 / Purpose of entry",
  "answers.intended_date_of_entry": "计划入境日期 / Intended entry date",
  "answers.intended_length_of_stay": "预计停留时间 / Length of stay",
  "answers.accommodation_name": "住宿名称 / Accommodation name",
  "answers.residential_address_in_vietnam": "越南住宿地址 / Address in Viet Nam",
  "answers.intended_province_city": "拟停留省/市 / Province or city",
  "answers.intended_ward_commune": "拟停留坊/社 / Ward or commune",
  "answers.intended_border_gate_of_entry": "预计入境口岸 / Entry border gate",
  "answers.intended_border_gate_of_exit": "预计出境口岸 / Exit border gate",
  "answers.declaration_temporary_residence": "临时居住申报承诺 / Temporary residence declaration",
  "answers.visited_vietnam_in_last_year": "过去一年是否到访越南 / Previous Viet Nam visit",
  "answers.has_relatives_in_vietnam": "是否有亲属在越南 / Relatives in Viet Nam",
  "answers.relative_date_of_birth": "在越亲属出生日期 / Relative date of birth",
  "answers.relative_nationality": "在越亲属国籍 / Relative nationality",
  "answers.relative_relationship": "与在越亲属关系 / Relative relationship",
  "answers.final_declaration": "最终声明确认 / Final declaration",
};

function parseValidationError(errorMessage?: string): { title: string; fields: string[] } | null {
  if (!errorMessage) return null;
  const marker = errorMessage.match(/^(Dry-run validation failed|Live-assisted validation failed):\s*(?:missing\s*)?/i);
  if (!marker) return null;
  const rawFields = errorMessage
    .slice(marker[0].length)
    .replace(/。.*$/u, "")
    .replace(/请先.*$/u, "")
    .replace(/\.\s*$/u, "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (rawFields.length === 0) return null;
  return {
    title: marker[1]?.toLowerCase().startsWith("live")
      ? "Live assisted needs more information before it can start."
      : "Dry-run validation found missing information.",
    fields: rawFields.map((field) => VALIDATION_LABELS[field] ?? field),
  };
}

function isWorkerPickupError(errorMessage?: string): boolean {
  const normalized = (errorMessage ?? "").toLowerCase();
  return normalized.includes("worker did not pick up") ||
    normalized.includes("worker heartbeat stopped") ||
    normalized.includes("submission job stalled");
}

function isVnPrearrivalVisaNumberError(errorMessage?: string): boolean {
  const normalized = (errorMessage ?? "").toLowerCase();
  const isPreciseError =
    normalized.includes("vn_prearrival_invalid_evisa_number") ||
    normalized.includes("rejected the e-visa number") ||
    normalized.includes("9-digit numeric value from the “số / no.” line");
  const isLegacyTransitionCascade =
    normalized.includes("trip_information_form_not_ready") &&
    normalized.includes("mode_of_travel") &&
    normalized.includes("flight_number") &&
    normalized.includes("accommodation_address");

  return isPreciseError || isLegacyTransitionCascade;
}

function getVnPrearrivalOtpErrorKind(
  errorMessage?: string,
): "rejected" | "timeout" | null {
  const normalized = (errorMessage ?? "").toLowerCase();
  if (
    normalized.includes("vn_prearrival_otp_rejected") ||
    normalized.includes("rejected the email verification code")
  ) {
    return "rejected";
  }
  if (
    normalized.includes("vn_prearrival_otp_confirmation_timeout") ||
    normalized.includes("email verification dialog remained open") ||
    normalized.includes("did not finish email verification")
  ) {
    return "timeout";
  }
  return null;
}

function FormattedFailureText({ message }: { message: string }) {
  const lines = message
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) return <p>{message}</p>;

  return (
    <div className="space-y-2">
      <p className="font-medium">{lines[0]}</p>
      <ul className="list-disc space-y-1 pl-5">
        {lines.slice(1).map((line) => (
          <li key={line}>{line.replace(/^-\s*/u, "")}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * FailureCard — renders when applications.submission_result_status === 'failed'.
 * Surfaces the error and offers a retry that requeues the application.
 */
export function FailureCard({
  applicationId,
  errorMessage,
  retryModes,
  onRetry,
  showFranceAccount = false,
  requiresOfficialPaymentCard = false,
  requiresVietnamPaymentCard = false,
}: FailureCardProps) {
  const isZh = isChineseLocale(useLocale());
  const [retryingMode, setRetryingMode] = useState<SubmissionMode | null>(null);
  const [localWorkerStarting, setLocalWorkerStarting] = useState(false);
  const [localWorkerError, setLocalWorkerError] = useState<string | null>(null);
  const [officialAccount, setOfficialAccount] = useState<FvOfficialAccount | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardHolderName, setCardHolderName] = useState("");
  const validationError = parseValidationError(errorMessage);
  const workerPickupError = isWorkerPickupError(errorMessage);
  const vnPrearrivalVisaNumberError = isVnPrearrivalVisaNumberError(errorMessage);
  const vnPrearrivalOtpErrorKind = getVnPrearrivalOtpErrorKind(errorMessage);
  const officialImageError = translateOfficialImagePortalError(errorMessage, isZh ? "zh" : "en");
  const modes = retryModes && retryModes.length > 0
    ? retryModes
    : [{ mode: "dry_run" as const, label: "Retry submission" }];
  const requiresPaymentCard = requiresOfficialPaymentCard || requiresVietnamPaymentCard;
  const cardReady =
    !requiresPaymentCard ||
    (
      cardNumber.replace(/\D/g, "").length >= 12 &&
      cardExpiry.trim().length >= 4 &&
      cardCvv.replace(/\D/g, "").length >= 3
    );
  const vietnamPaymentCard: VietnamOneTimePaymentCard | undefined = requiresPaymentCard
    ? {
        pan: cardNumber,
        expiry: cardExpiry,
        cvv: cardCvv,
        holderName: cardHolderName,
      }
    : undefined;

  useEffect(() => {
    if (!applicationId || !showFranceAccount) return;
    let cancelled = false;

    const loadAccount = async () => {
      try {
        const response = await fetch(`/api/applications/${applicationId}/france-visas-account`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as {
          account?: FvOfficialAccount | null;
        } | null;
        if (!cancelled && response.ok) {
          setOfficialAccount(payload?.account ?? null);
        }
      } catch {
        if (!cancelled) {
          setOfficialAccount(null);
        }
      }
    };

    void loadAccount();
    return () => {
      cancelled = true;
    };
  }, [applicationId, showFranceAccount]);

  const handleRetry = async (mode: SubmissionMode) => {
    if (!onRetry) return;
    if (!cardReady) return;
    setRetryingMode(mode);
    try {
      await onRetry(mode, vietnamPaymentCard);
      if (requiresPaymentCard) {
        setCardCvv("");
      }
    } finally {
      setRetryingMode(null);
    }
  };

  const handleLocalWorkerRetry = async () => {
    if (!applicationId || !onRetry) return;
    const mode = modes.find((item) => item.mode === "live_assisted")?.mode ?? modes[0]?.mode;
    if (!mode) return;
    setLocalWorkerError(null);
    setLocalWorkerStarting(true);
    try {
      const response = await fetch(`/api/applications/${applicationId}/local-submission-worker`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restart: true }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
      if (!response.ok) {
        throw new Error(typeof payload?.error === "string" ? payload.error : `Worker start failed with ${response.status}`);
      }
      await handleRetry(mode);
    } catch (error) {
      setLocalWorkerError(error instanceof Error ? error.message : String(error));
    } finally {
      setLocalWorkerStarting(false);
    }
  };

  return (
    <Card className="rounded-xl border-destructive/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-foreground">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          {vnPrearrivalVisaNumberError
            ? (isZh ? "电子签证号码错误" : "Invalid E-Visa number")
            : vnPrearrivalOtpErrorKind
            ? (isZh ? "邮箱验证码未完成" : "Email verification was not completed")
            : workerPickupError
            ? (isZh ? "提交服务没有接到任务" : "Submission worker did not pick up the job")
            : (isZh ? "提交没有完成" : "We couldn't complete your submission")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {vnPrearrivalVisaNumberError
            ? (isZh
                ? "官网拒绝了当前电子签证号码。请返回“旅客信息”，填写电子签证文件顶部“Số / No.”后的 9 位纯数字；不要填写申请代码、登记码，也不要添加“/EV”。"
                : "The official portal rejected the current E-Visa number. Return to Passenger Information and enter the 9-digit numeric value shown after “Số / No.”; do not enter the application or registration code, and do not add “/EV”.")
            : vnPrearrivalOtpErrorKind === "rejected"
            ? (isZh
                ? "官网明确拒绝了本次邮箱验证码，验证码可能已过期或不正确。你的答案已保存；重新提交后，系统会请求并使用一封新的验证码邮件。"
                : "The official portal rejected this email verification code because it was invalid or expired. Your answers are saved; retrying will request and consume a new code.")
            : vnPrearrivalOtpErrorKind === "timeout"
            ? (isZh
                ? "官网在验证码确认后没有及时完成页面切换。你的答案已保存；系统重试时会等待官方确认完成，并避免重复使用旧验证码。"
                : "The official portal did not finish the page transition after email verification. Your answers are saved; the retry will wait for confirmation and avoid reusing an old code.")
            : workerPickupError
            ? (isZh
                ? "这不是表单内容错误，而是本地 submission-service worker 没有运行、端口未匹配，或没有及时消费队列。你的答案已保存；启动 worker 后可直接重试。"
                : "This is not a form-data error. The local submission-service worker was not running, was on a different port, or did not consume the queue in time. Your answers are saved; retry after the worker is running.")
            : (isZh
                ? "官网在填写申请时返回错误。你的答案已保存，可以直接重新提交。"
                : "The portal returned an error while we were filing your application. Your answers are saved — you can retry without re-entering anything.")}
        </p>
        {vnPrearrivalVisaNumberError ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm leading-relaxed text-red-950">
            {isZh
              ? "正确格式示例：106527303（共 9 位，只能包含数字）。修改并保存后再重新提交。"
              : "Correct format example: 106527303 (exactly 9 digits, numbers only). Save the corrected value before retrying."}
          </div>
        ) : vnPrearrivalOtpErrorKind ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-relaxed text-amber-950">
            {isZh
              ? "可以直接点击下方“提交”重试，无需重新填写表单。"
              : "Use the Submit button below to retry; you do not need to re-enter the form."}
          </div>
        ) : officialImageError ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-relaxed text-amber-950">
            <FormattedFailureText message={officialImageError} />
          </div>
        ) : validationError ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            <p className="font-medium">{validationError.title}</p>
            <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {validationError.fields.map((field) => (
                <li key={field} className="rounded-md bg-white/70 px-2 py-1 text-xs leading-relaxed text-foreground">
                  {field}
                </li>
              ))}
            </ul>
          </div>
        ) : errorMessage && (
          <pre className="whitespace-pre-wrap break-words rounded-md border border-input bg-muted/50 p-3 text-xs leading-relaxed text-foreground">
            {errorMessage}
          </pre>
        )}
        {requiresPaymentCard && (
          <div className="space-y-3 rounded-lg border border-brand-100 bg-brand-50 p-4">
            <div className="flex items-start gap-3">
              <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-foreground">
                  {isZh ? "补填本次官方付款银行卡" : "Add one-time official payment card"}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {isZh
                    ? "重新提交前，请补填本次官方付款使用的银行卡号、有效期和 CVV。卡号和 CVV 只会发送到本机 submission-service 的短时内存会话，不会保存。"
                    : "Before retrying, enter the card number, expiry, and CVV for this official payment. Card number and CVV are sent only to the local submission-service memory session and are not stored."}
                </p>
              </div>
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
              <label className="space-y-1 sm:col-span-2">
                <span className="text-xs text-muted-foreground">{isZh ? "持卡人姓名（可选）" : "Cardholder name (optional)"}</span>
                <input
                  value={cardHolderName}
                  onChange={(event) => setCardHolderName(event.target.value)}
                  autoComplete="cc-name"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-brand-500"
                  placeholder={isZh ? "不填则使用 VIZA" : "Defaults to VIZA"}
                />
              </label>
            </div>
            {!cardReady && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {isZh
                  ? "请填写银行卡号、有效期和 CVV 后再提交。"
                  : "Enter the card number, expiry, and CVV before submitting."}
              </p>
            )}
          </div>
        )}
        {applicationId && onRetry && (
          <div className={workerPickupError || modes.length <= 1 ? "grid gap-2" : "grid gap-2 sm:grid-cols-2"}>
            {workerPickupError ? (
              <BrandActionButton
                  onClick={() => {
                    void handleLocalWorkerRetry();
                  }}
                  disabled={!cardReady}
                  loading={localWorkerStarting}
                loadingText={isZh ? "正在提交" : "Submitting"}
              >
                <RotateCw className="mr-2 h-4 w-4" />
                {isZh ? "提交" : "Submit"}
              </BrandActionButton>
            ) : (
              modes.map((item) => (
                <BrandActionButton
                  key={item.mode}
                  onClick={() => {
                    void handleRetry(item.mode).catch(() => undefined);
                  }}
                  disabled={!cardReady}
                  loading={retryingMode === item.mode}
                  loadingText={isZh ? "正在提交" : "Submitting"}
                >
                  <RotateCw className="mr-2 h-4 w-4" />
                  {item.label}
                </BrandActionButton>
              ))
            )}
          </div>
        )}
        {localWorkerError ? (
          <p className="text-sm text-red-700">{localWorkerError}</p>
        ) : null}
        {officialAccount?.email && (
          <div className="rounded-lg border border-brand-200 bg-brand-50/60 p-4">
            <div className="text-sm font-semibold text-foreground">
              {isZh ? "France-Visas 官方账号" : "France-Visas official account"}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-brand-100 bg-white px-3 py-2">
                <div className="text-xs text-muted-foreground">{isZh ? "账号" : "Email"}</div>
                <div className="mt-0.5 break-all font-mono text-sm text-foreground">
                  {officialAccount.email}
                </div>
              </div>
              <div className="rounded-md border border-brand-100 bg-white px-3 py-2">
                <div className="text-xs text-muted-foreground">{isZh ? "密码" : "Password"}</div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <span className="break-all font-mono text-sm text-foreground">
                    {showPassword ? officialAccount.password : "••••••••••••"}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
            <Button asChild variant="outline" className="mt-3 bg-white">
              <a href={officialAccount.portalUrl} target="_blank" rel="noopener noreferrer">
                {isZh ? "打开 France-Visas 官网" : "Open France-Visas"}
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
