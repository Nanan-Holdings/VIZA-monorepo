"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { AlertTriangle, ExternalLink, Eye, EyeOff, RotateCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BrandActionButton } from "@/components/client/brand-action-button";
import { isChineseLocale } from "@/lib/i18n/locale";
import type { SubmissionMode } from "@/lib/submission-queue";

interface FailureCardProps {
  applicationId?: string;
  errorMessage?: string;
  retryModes?: Array<{ mode: SubmissionMode; label: string }>;
  onRetry?: (mode: SubmissionMode) => Promise<void> | void;
  showFranceAccount?: boolean;
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
}: FailureCardProps) {
  const isZh = isChineseLocale(useLocale());
  const [retryingMode, setRetryingMode] = useState<SubmissionMode | null>(null);
  const [officialAccount, setOfficialAccount] = useState<FvOfficialAccount | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const validationError = parseValidationError(errorMessage);
  const workerPickupError = isWorkerPickupError(errorMessage);
  const modes = retryModes && retryModes.length > 0
    ? retryModes
    : [{ mode: "dry_run" as const, label: "Retry submission" }];

  useEffect(() => {
    if (!applicationId || !showFranceAccount) return;
    let cancelled = false;

    const loadAccount = async () => {
      const response = await fetch(`/api/applications/${applicationId}/france-visas-account`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as {
        account?: FvOfficialAccount | null;
      } | null;
      if (!cancelled && response.ok) {
        setOfficialAccount(payload?.account ?? null);
      }
    };

    void loadAccount();
    return () => {
      cancelled = true;
    };
  }, [applicationId, showFranceAccount]);

  const handleRetry = async (mode: SubmissionMode) => {
    if (!onRetry) return;
    setRetryingMode(mode);
    try {
      await onRetry(mode);
    } finally {
      setRetryingMode(null);
    }
  };

  return (
    <Card className="rounded-xl border-destructive/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-foreground">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          {workerPickupError
            ? (isZh ? "提交服务没有接到任务" : "Submission worker did not pick up the job")
            : (isZh ? "提交没有完成" : "We couldn't complete your submission")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {workerPickupError
            ? (isZh
                ? "这不是 ICA 表单内容错误，而是本地 submission-service worker 没有运行或没有及时消费队列。你的答案已保存；启动 worker 后可直接重试。"
                : "This is not an ICA form-data error. The local submission-service worker was not running or did not consume the queue in time. Your answers are saved; retry after the worker is running.")
            : (isZh
                ? "官网在填写申请时返回错误。你的答案已保存，可以直接重新提交。"
                : "The portal returned an error while we were filing your application. Your answers are saved — you can retry without re-entering anything.")}
        </p>
        {validationError ? (
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
        {applicationId && onRetry && (
          <div className={modes.length > 1 ? "grid gap-2 sm:grid-cols-2" : "grid gap-2"}>
            {modes.map((item) => (
              <BrandActionButton
                key={item.mode}
                onClick={() => {
                  void handleRetry(item.mode).catch(() => undefined);
                }}
                loading={retryingMode === item.mode}
                loadingText={isZh ? "正在提交" : "Submitting"}
              >
                <RotateCw className="mr-2 h-4 w-4" />
                {item.label}
              </BrandActionButton>
            ))}
          </div>
        )}
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
