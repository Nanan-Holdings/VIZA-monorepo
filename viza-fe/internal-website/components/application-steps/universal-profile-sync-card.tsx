"use client";

import { useState } from "react";
import { CheckCircle2, Database, Loader2, RefreshCw } from "lucide-react";
import { useLocale } from "next-intl";
import { syncApplicationAnswersToUniversalProfile } from "@/app/actions/visa-application-answers";
import { BrandActionButton } from "@/components/client/brand-action-button";
import { Alert, AlertDescription, AlertIcon, AlertTitle } from "@/components/ui/alert";
import { isChineseLocale } from "@/lib/i18n/locale";

export function UniversalProfileSyncCard({ applicationId }: { applicationId: string }) {
  const locale = useLocale();
  const isZh = isChineseLocale(locale);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSync() {
    setStatus("saving");
    setMessage(null);
    const result = await syncApplicationAnswersToUniversalProfile(applicationId);
    if (result.error) {
      setStatus("error");
      setMessage(result.error);
      return;
    }

    setStatus("saved");
    setMessage(isZh
      ? `已将 ${result.savedCount ?? 0} 项可复用资料更新到通用资料。行程、付款和声明信息不会保存。`
      : `${result.savedCount ?? 0} reusable answers were added to Universal Profile. Trip, payment, and declaration details were not saved.`);
  }

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
        <div className="mt-3 flex gap-2">
          <BrandActionButton
            type="button"
            variant="secondary"
            onClick={handleSync}
            disabled={status === "saving"}
          >
            {status === "saving" ? (
              <Loader2 className="animate-spin" />
            ) : status === "saved" ? (
              <RefreshCw />
            ) : (
              <Database />
            )}
            {status === "saving"
              ? isZh ? "更新中" : "Updating"
              : status === "saved"
                ? isZh ? "再次更新" : "Update again"
                : isZh ? "保存本次新资料" : "Save new information"}
          </BrandActionButton>
        </div>
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
