"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle as CheckCircle2, Database, CircleNotch as Loader2, ArrowsClockwise as RefreshCw } from "@phosphor-icons/react";
import { useLocale } from "next-intl";
import {
  loadApplicationUniversalProfileChanges,
  syncApplicationAnswersToUniversalProfile,
} from "@/app/actions/visa-application-answers";
import {
  Alert,
  AlertAction,
  AlertActions,
  AlertDescription,
  AlertIcon,
  AlertTitle,
} from "@/components/ui/alert";
import { isChineseLocale } from "@/lib/i18n/locale";
import type { UniversalProfileSyncChange } from "@/lib/universal-profile-sync";

export function UniversalProfileSyncCard({ applicationId }: { applicationId: string }) {
  const locale = useLocale();
  const isZh = isChineseLocale(locale);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [changes, setChanges] = useState<UniversalProfileSyncChange[]>([]);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const refreshChanges = useCallback(async () => {
    setPreviewLoading(true);
    setPreviewError(null);
    const result = await loadApplicationUniversalProfileChanges(applicationId);
    if (result.error) {
      setPreviewError(result.error);
      setPreviewLoading(false);
      return;
    }
    setChanges(result.changes);
    setPreviewLoading(false);
  }, [applicationId]);

  useEffect(() => {
    void refreshChanges();
  }, [refreshChanges]);

  async function handleSync() {
    setStatus("saving");
    setMessage(null);
    const result = await syncApplicationAnswersToUniversalProfile(applicationId);
    if (result.error) {
      setStatus("error");
      setMessage(isZh
        ? "无法更新通用资料，请稍后重试。"
        : result.error);
      return;
    }

    setStatus("saved");
    setMessage(isZh
      ? `已将 ${result.savedCount ?? 0} 项新增或变更资料保存到通用资料。行程、付款和声明信息不会保存。`
      : `${result.savedCount ?? 0} new or changed answers were saved to Universal Profile. Trip, payment, and declaration details were not saved.`);
    setChanges([]);
    await refreshChanges();
  }

  const isBusy = previewLoading || status === "saving";
  const hasChanges = changes.length > 0;

  return (
    <Alert variant="info">
      <AlertIcon variant="info" />
      <AlertTitle>
        {isZh ? "更新通用资料" : "Update Universal Profile"}
      </AlertTitle>
      <AlertDescription>
        <p>
          {isZh
            ? "把本次申请中新填写的身份、家庭、联系方式、护照、工作教育和过往签证资料保存起来，下次申请自动预填空白字段。"
            : "Save reusable identity, family, contact, passport, work, education, and visa-history answers from this application. Future applications will use them to prefill empty fields."}
        </p>
        {previewLoading ? (
          <div className="mt-2.5 flex items-center gap-1.5 text-[13px] font-medium text-[#3d5878]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {isZh ? "正在对比通用资料" : "Comparing with Universal Profile"}
          </div>
        ) : hasChanges ? (
          <ul className="mt-2.5 list-disc space-y-1 pl-5 text-[13px] !text-[#3f3f46]">
            {changes.map((change) => {
              const label = isZh ? change.labelZh : change.labelEn;
              const value = isZh ? change.valueZh : change.valueEn;
              const previousValue = isZh
                ? change.previousValueZh
                : change.previousValueEn;
              const showsReplacement = change.kind === "updated"
                && Boolean(previousValue)
                && previousValue !== value;
              return (
                <li key={change.canonicalKey}>
                  <span className="font-medium text-[#27272a]">{label}:</span>{" "}
                  {showsReplacement ? (
                    <>
                      <del className="text-[#71717a]">{previousValue}</del>{" "}
                      <span aria-hidden="true" className="text-[#71717a]">→</span>{" "}
                    </>
                  ) : null}
                  <span className="text-[#27272a]">{value}</span>
                </li>
              );
            })}
          </ul>
        ) : !previewError ? (
          <p className="mt-2.5 font-medium !text-[#3d5878]">
            {isZh
              ? "本次申请没有新增或变更的可复用资料。"
              : "This application has no new or changed reusable information."}
          </p>
        ) : null}
        <AlertActions>
          <AlertAction
            onClick={handleSync}
            disabled={isBusy || !hasChanges || Boolean(previewError)}
          >
            {isBusy ? (
              <Loader2 className="animate-spin" />
            ) : status === "saved" ? (
              <RefreshCw />
            ) : (
              <Database />
            )}
            {previewLoading
              ? isZh ? "检查中" : "Checking"
              : status === "saving"
              ? isZh ? "更新中" : "Updating"
              : status === "saved"
                ? isZh ? "已保存" : "Saved"
                : isZh ? "保存本次新资料" : "Save new information"}
          </AlertAction>
        </AlertActions>
        {previewError ? (
          <div role="alert" className="mt-2.5 text-[13px] font-medium text-[hsl(0_72%_35%)]">
            {isZh
              ? "无法对比通用资料，请稍后重试。"
              : `Could not compare Universal Profile: ${previewError}`}
          </div>
        ) : null}
        {message ? (
          <div
            role={status === "error" ? "alert" : "status"}
            className={status === "error"
              ? "mt-2.5 text-[13px] font-medium text-[hsl(0_72%_35%)]"
              : "mt-2.5 flex items-start gap-1.5 text-[13px] font-medium text-[#166534]"}
          >
            {status === "saved" ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : null}
            {message}
          </div>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
