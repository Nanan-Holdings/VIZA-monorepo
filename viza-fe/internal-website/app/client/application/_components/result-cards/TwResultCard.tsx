"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import {
  Warning as AlertTriangle,
  CheckCircle as CheckCircle2,
  Clock,
  FileX as FileWarning,
  CircleNotch as Loader2,
  ShieldCheck,
  CloudArrowUp as UploadCloud,
  ArrowClockwise as RotateCw,
} from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApplicationCheckbox } from "@/components/ui/application-checkbox";
import { isChineseLocale } from "@/lib/i18n/locale";
import type { TwSubmissionResult, TwSubmissionStatus } from "@/lib/submission-result";
import type { ApplicationCompletenessResult } from "@/lib/application-completeness";
import type {
  SubmissionMode,
  TaiwanOfficialTermsConsentInput,
} from "@/lib/submission-queue";

interface TwResultCardProps {
  applicationId?: string;
  result: TwSubmissionResult;
  retryBusy?: boolean;
  retryError?: string | null;
  retryCompleteness?: ApplicationCompletenessResult | null;
  onRetry?: (
    mode: SubmissionMode,
    taiwanOfficialTermsConsent?: TaiwanOfficialTermsConsentInput,
  ) => Promise<void> | void;
}

type FailureCategory =
  | "missing_required_field"
  | "document_invalid"
  | "official_field_changed"
  | "otp_timeout"
  | "network_failure"
  | "unknown";

const STATUS_ORDER: TwSubmissionStatus[] = [
  "queued",
  "logging_in",
  "otp_required",
  "filling",
  "uploading",
  "validating",
  "stopped_at_captcha",
  "submitted",
];

const STATUS_META: Record<TwSubmissionStatus, {
  labelZh: string;
  labelEn: string;
  titleZh: string;
  titleEn: string;
  bodyZh: string;
  bodyEn: string;
  badgeZh: string;
  badgeEn: string;
}> = {
  queued: {
    labelZh: "已排队",
    labelEn: "Queued",
    titleZh: "台湾官网自动填写任务已排队",
    titleEn: "Taiwan official-site automation is queued",
    bodyZh: "VIZA 已收到申请资料，正在等待云端浏览器开始处理。尚未进入官网，也尚未提交。",
    bodyEn: "VIZA has received the application data and is waiting for the cloud browser to start. The official site has not been entered and nothing has been submitted.",
    badgeZh: "等待开始",
    badgeEn: "Waiting",
  },
  logging_in: {
    labelZh: "登录官网",
    labelEn: "Official login",
    titleZh: "正在进入移民署官网",
    titleEn: "Opening the NIA portal",
    bodyZh: "云端浏览器正在打开官网并准备一次性邮箱验证会话。尚未填写最终申请，也尚未提交。",
    bodyEn: "The cloud browser is opening the official portal and preparing the one-time email verification session. The final application has not been submitted.",
    badgeZh: "登录中",
    badgeEn: "Logging in",
  },
  otp_required: {
    labelZh: "邮箱验证码",
    labelEn: "Email OTP",
    titleZh: "正在处理官网邮箱验证码",
    titleEn: "Handling the official email OTP",
    bodyZh: "官网要求一次性邮箱验证码。VIZA 会等待授权收件箱或运营处理；验证码完成前不会继续填写。",
    bodyEn: "The official site requires a one-time email code. VIZA will wait for the authorized inbox or operations handling before continuing.",
    badgeZh: "等待验证码",
    badgeEn: "OTP required",
  },
  filling: {
    labelZh: "填写表单",
    labelEn: "Filling",
    titleZh: "正在填写台湾官网申请表",
    titleEn: "Filling the Taiwan official form",
    bodyZh: "VIZA 正在把你保存的答案填入官网页面，并检查必填字段是否可定位。尚未提交。",
    bodyEn: "VIZA is entering your saved answers into the official page and checking that required fields can be located. Nothing has been submitted.",
    badgeZh: "填写中",
    badgeEn: "Filling",
  },
  uploading: {
    labelZh: "上传文件",
    labelEn: "Uploading",
    titleZh: "正在上传台湾申请文件",
    titleEn: "Uploading Taiwan supporting files",
    bodyZh: "VIZA 正在上传照片、旅行证件和资格材料，并确认官网接收状态。尚未提交。",
    bodyEn: "VIZA is uploading the photo, travel document, and eligibility files, then confirming the official page accepted them. Nothing has been submitted.",
    badgeZh: "上传中",
    badgeEn: "Uploading",
  },
  validating: {
    labelZh: "校验页面",
    labelEn: "Validating",
    titleZh: "正在校验官网页面",
    titleEn: "Validating the official page",
    bodyZh: "VIZA 正在核对必填字段、上传状态和官网错误。全部通过后才会处理验证码并点击「确认资料」。",
    bodyEn: "VIZA is checking required fields, uploads, and official validation errors. Only after they pass will it handle CAPTCHA and click the final confirmation.",
    badgeZh: "校验中",
    badgeEn: "Validating",
  },
  stopped_at_captcha: {
    labelZh: "旧流程未完成",
    labelEn: "Legacy flow incomplete",
    titleZh: "台湾官网提交尚未完成",
    titleEn: "Taiwan official submission is incomplete",
    bodyZh: "这是旧版接管流程留下的状态，不代表已提交。重新确认两项官网条款授权后，VIZA 可在后台重新执行正式提交。",
    bodyEn: "This is a legacy handoff state and does not mean submitted. Confirm both official-terms authorizations to run the formal background submission again.",
    badgeZh: "未提交",
    badgeEn: "Not submitted",
  },
  submitted: {
    labelZh: "已提交",
    labelEn: "Submitted",
    titleZh: "已向台湾官网提交",
    titleEn: "Submitted to the Taiwan official site",
    bodyZh: "VIZA 已向台湾官网提交申请，并取得官网回执编号。后续审核与缴费请以官网通知为准。",
    bodyEn: "VIZA has submitted the application to the Taiwan official site and captured the official receipt number. Follow the official site's notices for review and payment.",
    badgeZh: "已提交",
    badgeEn: "Submitted",
  },
  failed: {
    labelZh: "失败",
    labelEn: "Failed",
    titleZh: "台湾官网自动填写未完成",
    titleEn: "Taiwan official-site automation did not complete",
    bodyZh: "VIZA 已停止本次执行，避免用不完整或无法校验的资料继续推进。请根据下方类别补充资料或交由运营复核。",
    bodyEn: "VIZA stopped this run so incomplete or unverified data is not pushed forward. Use the category below to fix the data or route it to operations.",
    badgeZh: "需处理",
    badgeEn: "Needs action",
  },
};

const FAILURE_META: Record<FailureCategory, {
  titleZh: string;
  titleEn: string;
  bodyZh: string;
  bodyEn: string;
  actionZh: string;
  actionEn: string;
}> = {
  missing_required_field: {
    titleZh: "缺必填字段",
    titleEn: "Missing required field",
    bodyZh: "申请答案里缺少官网必填字段，自动填写已停止。",
    bodyEn: "A required official-site field is missing from the saved answers, so automation stopped.",
    actionZh: "回到申请表补齐字段后重新排队。",
    actionEn: "Complete the missing field in the application form, then requeue.",
  },
  document_invalid: {
    titleZh: "缺文件或文件不合格",
    titleEn: "Missing or invalid document",
    bodyZh: "官网所需文件缺失、格式不合格，或上传后未被官网接受。",
    bodyEn: "A required official file is missing, has an invalid format, or was not accepted after upload.",
    actionZh: "到 Documents 重新上传对应材料；运营可按 key 定位。",
    actionEn: "Re-upload the matching file in Documents; operations can locate it by key.",
  },
  official_field_changed: {
    titleZh: "官网字段变化",
    titleEn: "Official field changed",
    bodyZh: "官网页面结构或字段名称与当前自动化映射不一致。",
    bodyEn: "The official page structure or field name no longer matches the current automation mapping.",
    actionZh: "交由运营/工程复核官网字段映射，不要让用户反复重试。",
    actionEn: "Route to operations/engineering to review the official field mapping instead of asking the user to keep retrying.",
  },
  otp_timeout: {
    titleZh: "OTP 超时",
    titleEn: "OTP timeout",
    bodyZh: "官网一次性邮箱验证码没有在有效时间内完成。",
    bodyEn: "The official one-time email code was not completed within its valid window.",
    actionZh: "确认授权邮箱/转发设置可用后重新排队。",
    actionEn: "Confirm the authorized inbox or forwarding setup, then requeue.",
  },
  network_failure: {
    titleZh: "网络或官网连接失败",
    titleEn: "Network or official-site failure",
    bodyZh: "云端浏览器、网络连接或官网临时响应失败。",
    bodyEn: "The cloud browser, network connection, or official portal temporarily failed.",
    actionZh: "稍后重试；若连续失败，请运营检查 worker 与官网可用性。",
    actionEn: "Retry later; if it repeats, operations should check the worker and official-site availability.",
  },
  unknown: {
    titleZh: "需要人工复核",
    titleEn: "Manual review needed",
    bodyZh: "本次失败没有匹配到安全的自动归因类别。",
    bodyEn: "This failure did not match a safe automatic category.",
    actionZh: "请运营查看脱敏日志定位原因。",
    actionEn: "Operations should review redacted logs to locate the cause.",
  },
};

function normalizeToken(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function normalizeTwStatus(
  status: string | null | undefined,
  currentStage?: string | null,
): TwSubmissionStatus {
  const raw = `${normalizeToken(currentStage)} ${normalizeToken(status)}`;

  if (/\bstopped_at_captcha\b|\bcaptcha_boundary\b|\bcaptcha_required\b/.test(raw)) return "stopped_at_captcha";
  if (/\bsubmitted\b|\bcompleted\b/.test(raw)) return "submitted";
  if (/\bfailed\b|\berror\b|\bstalled\b/.test(raw)) return "failed";
  if (/otp|one_time|verification_code|email_code/.test(raw)) return "otp_required";
  if (/login|logging|sign_in|official_portal_opening|open_portal/.test(raw)) return "logging_in";
  if (/validat|review|check|confirming_result|captcha/.test(raw)) return "validating";
  if (/upload|document|file/.test(raw)) return "uploading";
  if (/fill|form|field|mapping_answers/.test(raw)) return "filling";
  return "queued";
}

function safeList(values: Array<string | undefined | null>): string[] {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))))
    .slice(0, 8);
}

function parseBracketedField(error: string): string[] {
  return safeList(Array.from(error.matchAll(/\[([a-zA-Z0-9_.-]+)\]\s+(?:missing|required|unrecognized)/g)).map((match) => match[1]));
}

function parseQuotedDocument(error: string): string[] {
  return safeList(Array.from(error.matchAll(/required document ["']([^"']+)["']/gi)).map((match) => match[1]));
}

function categorizeTwFailure(result: TwSubmissionResult): {
  category: FailureCategory;
  fields: string[];
  documents: string[];
} {
  const error = result.error ?? result.errorCode ?? "";
  const normalized = normalizeToken(error);
  const fields = safeList([...(result.missingFields ?? []), ...parseBracketedField(error)]);
  const documents = safeList([...(result.missingDocuments ?? []), ...parseQuotedDocument(error)]);

  if (fields.length > 0 || /missing_required|missing_field|unrecognized_yes_no|required_field|field.*missing/.test(normalized)) {
    return { category: "missing_required_field", fields, documents };
  }
  if (documents.length > 0 || /document|upload|file|photo|image|unsupported_mime|invalid_data|not_uploaded/.test(normalized)) {
    return { category: "document_invalid", fields, documents };
  }
  if (/selector|locator|dom|control|field_mapping|not_found|layout|portal_controls|page_structure|official.*changed/.test(normalized)) {
    return { category: "official_field_changed", fields, documents };
  }
  if (/otp|one_time|verification_code|email.*timeout|inbox.*timeout|code.*expired/.test(normalized)) {
    return { category: "otp_timeout", fields, documents };
  }
  if (/network|timeout|browser|context|page.*closed|navigation|proxy|failed_to_launch|econn|socket|temporar/.test(normalized)) {
    return { category: "network_failure", fields, documents };
  }
  return { category: "unknown", fields, documents };
}

function isRecoverableTwFailure(result: TwSubmissionResult, failure: ReturnType<typeof categorizeTwFailure> | null): boolean {
  if (result.status !== "failed") return false;
  const raw = normalizeToken([
    result.currentStage,
    result.errorCode,
    result.error,
  ].filter(Boolean).join(" "));
  return (
    /handoff|session.*expired|expired|abandon|otp|one_time|verification_code|network|timeout|browser|page_closed|temporar/.test(raw) ||
    failure?.category === "otp_timeout" ||
    failure?.category === "network_failure"
  );
}

function longFormUrl(applicationId: string, params: Record<string, string>): string {
  const search = new URLSearchParams({ applicationId, ...params });
  return `/client/application/long-form?${search.toString()}`;
}

function StepPill({
  status,
  activeStatus,
  isZh,
}: {
  status: TwSubmissionStatus;
  activeStatus: TwSubmissionStatus;
  isZh: boolean;
}) {
  const activeIndex = STATUS_ORDER.indexOf(activeStatus);
  const currentIndex = STATUS_ORDER.indexOf(status);
  const complete = activeIndex > currentIndex;
  const active = activeStatus === status;
  return (
    <div
      className={[
        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
        complete
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : active
            ? "border-brand-200 bg-brand-50 text-brand-900"
            : "border-input bg-background text-muted-foreground",
      ].join(" ")}
    >
      {complete ? <CheckCircle2 className="h-3.5 w-3.5" /> : active ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock className="h-3.5 w-3.5" />}
      <span>{isZh ? STATUS_META[status].labelZh : STATUS_META[status].labelEn}</span>
    </div>
  );
}

export function TwResultCard({
  applicationId,
  result,
  retryBusy = false,
  retryError = null,
  retryCompleteness = null,
  onRetry,
}: TwResultCardProps) {
  const isZh = isChineseLocale(useLocale());
  const [entryPromptAccepted, setEntryPromptAccepted] = useState(false);
  const [termsModalAccepted, setTermsModalAccepted] = useState(false);
  const normalizedStatus = normalizeTwStatus(result.status, result.currentStage);
  const hasVerifiedReceipt = Boolean(
    result.officialReceipt?.caseNumber?.trim() &&
    result.officialReceipt.source === "official_success_page_with_application_number",
  );
  const status = normalizedStatus === "submitted" && !hasVerifiedReceipt
    ? "failed"
    : normalizedStatus;
  const meta = STATUS_META[status];
  const failed = status === "failed";
  const stopped = status === "stopped_at_captcha";
  const submitted = status === "submitted";
  const Icon = failed ? AlertTriangle : submitted ? CheckCircle2 : stopped ? ShieldCheck : status === "uploading" ? UploadCloud : Loader2;
  const failure = failed ? categorizeTwFailure(result) : null;
  const failureMeta = failure ? FAILURE_META[failure.category] : null;
  const recoverableFailure = isRecoverableTwFailure(result, failure);
  const canRetry = Boolean(applicationId && onRetry && !submitted && (stopped || recoverableFailure));
  const termsReady = entryPromptAccepted && termsModalAccepted;

  return (
    <Card className="rounded-xl border-input">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <CardTitle className="flex items-center gap-3 text-foreground">
            <Icon className={[
              "h-5 w-5",
              failed ? "text-amber-600" : submitted ? "text-emerald-600" : stopped ? "text-brand-500" : "animate-spin text-brand-500",
            ].join(" ")} />
            {isZh ? meta.titleZh : meta.titleEn}
          </CardTitle>
          <Badge variant="secondary" className="w-fit">{isZh ? meta.badgeZh : meta.badgeEn}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {isZh ? meta.bodyZh : meta.bodyEn}
        </p>

        {!failed && !submitted && (
          <div className="flex flex-wrap gap-2">
            {STATUS_ORDER.map((item) => (
              <StepPill key={item} status={item} activeStatus={status} isZh={isZh} />
            ))}
          </div>
        )}

        {stopped && (
          <div className="space-y-1 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            <div className="font-semibold">
              {isZh ? "已停在官方验证码前，尚未提交" : "Stopped before the official CAPTCHA and not submitted"}
            </div>
            <p>
              {isZh
                ? "该旧会话不再开放。VIZA 不会把它视为已提交，也不会沿用其中的验证码。"
                : "The legacy session is no longer opened. VIZA does not treat it as submitted or reuse its CAPTCHA."}
            </p>
            <p>
              {isZh
                ? "请重新确认下方两项官网条款授权，再由后台正式提交。"
                : "Confirm both official-terms authorizations below to start a formal background submission."}
            </p>
          </div>
        )}

        {(stopped || recoverableFailure) && !submitted && (
          <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-start gap-2 text-sm leading-relaxed text-amber-950">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div className="space-y-1">
                <div className="font-semibold">
                  {isZh ? "重新执行台湾官网正式提交" : "Run the formal Taiwan submission again"}
                </div>
                <p>
                  {isZh
                    ? "VIZA 会创建一条单次后台任务，自动填写、处理验证码并点击官网「确认资料」。只有取得官方回执编号才会显示提交成功；不会自动付款。"
                    : "VIZA creates one background job to fill the form, handle CAPTCHA, and click the official final confirmation. Success requires an official receipt number. Payment is never automatic."}
                </p>
              </div>
            </div>
            <ApplicationCheckbox
              id="tw-retry-entry-prompt-consent"
              checked={entryPromptAccepted}
              onCheckedChange={setEntryPromptAccepted}
              required
              label={isZh
                ? "我同意 VIZA 确认台湾官网进入申请时显示的提示（蓝色 OK）。"
                : "I authorize VIZA to accept the official entry prompt (blue OK)."}
            />
            <ApplicationCheckbox
              id="tw-retry-terms-modal-consent"
              checked={termsModalAccepted}
              onCheckedChange={setTermsModalAccepted}
              required
              label={isZh
                ? "我同意官网条款，并授权 VIZA 勾选「同意上述条款」后点击「确定」。"
                : "I accept the official terms and authorize VIZA to check the agreement before clicking Confirm."}
            />
            <Button
              type="button"
              className="w-full"
              disabled={!canRetry || retryBusy || !termsReady}
              onClick={() => {
                if (!canRetry || retryBusy) return;
                void onRetry?.("live_assisted", {
                  entryPromptAccepted,
                  termsModalAccepted,
                });
              }}
            >
              {retryBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCw className="mr-2 h-4 w-4" />}
              {retryBusy
                ? isZh ? "正在重新排队" : "Requeueing"
                : isZh ? "重新正式提交" : "Retry formal submission"}
            </Button>
            {retryError && <p className="text-xs text-red-600">{retryError}</p>}
          </div>
        )}

        {retryCompleteness && !retryCompleteness.complete && applicationId && (
          <div className="space-y-3 rounded-md border border-amber-200 bg-background p-3">
            <div>
              <div className="text-sm font-semibold text-foreground">
                {isZh
                  ? `还缺 ${retryCompleteness.missingInfoCount} 项信息、${retryCompleteness.missingDocumentCount} 份材料`
                  : `${retryCompleteness.missingInfoCount} information item(s) and ${retryCompleteness.missingDocumentCount} document(s) missing`}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {isZh
                  ? "缺失清单清零前不会创建新的台湾官网自动填写任务。"
                  : "No new Taiwan official-site filling job is created until this list is clear."}
              </p>
            </div>
            <div className="grid gap-2">
              {retryCompleteness.missingInfo.slice(0, 6).map((item) => (
                <a
                  key={`field-${item.fieldName}`}
                  href={longFormUrl(applicationId, { field: item.fieldName })}
                  className="flex items-center justify-between gap-3 rounded-md border border-input px-3 py-2 text-sm hover:bg-muted"
                >
                  <span className="min-w-0 truncate">{isZh ? item.labelZh : item.labelEn}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{isZh ? "去填写" : "Fill"}</span>
                </a>
              ))}
              {retryCompleteness.missingDocuments.slice(0, 6).map((item) => (
                <a
                  key={`document-${item.requirementKey}`}
                  href={longFormUrl(applicationId, { requirementKey: item.requirementKey })}
                  className="flex items-center justify-between gap-3 rounded-md border border-input px-3 py-2 text-sm hover:bg-muted"
                >
                  <span className="min-w-0 truncate">{isZh ? item.labelZh : item.labelEn}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{isZh ? "去上传" : "Upload"}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {submitted && result.officialReceipt && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
            <div className="flex items-start gap-2 text-sm leading-relaxed text-emerald-950">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <div className="space-y-2">
                <div className="font-semibold">
                  {isZh ? "已取得官网回执编号" : "Official receipt number captured"}
                </div>
                <p>
                  {isZh
                    ? "submitted 只代表官网已收件，不代表已核准，也不代表已缴费。"
                    : "Submitted only means the official site received the application. It does not mean approved or paid."}
                </p>
              </div>
            </div>
          </div>
        )}

        {failure && failureMeta && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-start gap-2 text-sm leading-relaxed text-amber-950">
              <FileWarning className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div className="space-y-2">
                <div className="font-semibold">{isZh ? failureMeta.titleZh : failureMeta.titleEn}</div>
                <p>{isZh ? failureMeta.bodyZh : failureMeta.bodyEn}</p>
                <p>{isZh ? failureMeta.actionZh : failureMeta.actionEn}</p>
              </div>
            </div>
          </div>
        )}

        {failure && (failure.fields.length > 0 || failure.documents.length > 0) && (
          <div className="rounded-md border border-input bg-background px-3 py-2">
            <div className="text-xs text-muted-foreground">
              {isZh ? "运营定位 key（已脱敏）" : "Operations locator keys (redacted)"}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {failure.fields.map((field) => (
                <Badge key={`field-${field}`} variant="outline" className="font-mono text-[11px]">
                  field:{field}
                </Badge>
              ))}
              {failure.documents.map((document) => (
                <Badge key={`document-${document}`} variant="outline" className="font-mono text-[11px]">
                  doc:{document}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {(result.pagesFilled?.length ?? 0) > 0 && !failed && (
          <div className="rounded-md border border-input bg-background px-3 py-2">
            <div className="text-xs text-muted-foreground">
              {isZh ? "已处理的官网阶段" : "Official-site stages handled"}
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {(result.pagesFilled ?? []).map((page) => (
                <Badge key={page} variant="outline" className="font-normal">
                  {page}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {result.caseNumber && (
          <div className="rounded-md border border-input bg-background px-3 py-2">
            <div className="text-xs text-muted-foreground">
              {submitted
                ? (isZh ? "官方申请/收件编号" : "Official application/receipt number")
                : (isZh ? "官网暂存号（如已捕获）" : "Official temporary number, if captured")}
            </div>
            <div className="mt-0.5 font-mono text-sm text-foreground">{result.caseNumber}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {submitted
                ? (isZh
                  ? "后续审核与缴费请以官网通知为准。"
                  : "Follow the official site's notices for review and payment.")
                : (isZh
                  ? "这不是最终提交收件号；VIZA 不会把它标记为提交成功。"
                  : "This is not a final submission receipt, and VIZA does not mark it as submitted.")}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
