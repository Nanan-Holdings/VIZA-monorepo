"use client";

import { ArrowRight, FileText } from "lucide-react";
import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";

// =============================================================================
// Block Field Types (matching backend ApplicationBlockPayload)
// =============================================================================

export interface BlockField {
  name: string;
  label: string;
  type: "text" | "date" | "select" | "file";
  required?: boolean;
  options?: string[];
  placeholder?: string;
}

export interface ApplicationBlockPayload {
  blockType:
    | "trip_basics"
    | "traveller_identity"
    | "visa_route_specific"
    | "application_redirect"
    | string;
  title: string;
  description?: string;
  fields?: BlockField[];
  saveTarget:
    | "applicant_profile"
    | "application"
    | "visa_application_answers"
    | "application_redirect"
    | string;
  applicationId?: string;
  redirectUrl?: string;
  ctaLabel?: string;
  country?: string;
  visaType?: string | null;
  productCode?: string;
  productKind?: "visa" | "entry_permit" | "travel_authorization" | "arrival_declaration" | "departure_declaration";
  provider?: "viza" | "official";
  requirement?: "required" | "conditional" | "optional";
  supportLevel?: "form_only" | "assisted_submission" | "automated" | "official_redirect";
}

interface BlockMessageProps {
  payload: ApplicationBlockPayload;
  prefillData?: Record<string, string>;
  alreadySaved?: boolean;
}

export function BlockMessage({
  payload,
}: BlockMessageProps) {
  const locale = useLocale();
  const isZh = locale.toLowerCase().startsWith("zh");
  const isSingaporeArrivalCard = payload.visaType === "SG_ARRIVAL_CARD";
  const isOfficialRedirect = payload.provider === "official";
  const redirectUrl = payload.redirectUrl ?? "/client/application";
  const title =
    isZh && isSingaporeArrivalCard ? "填写新加坡电子入境卡" : payload.title;
  const description =
    isZh && isSingaporeArrivalCard
      ? "前往 VIZA 的新加坡专用表单继续填写。聊天顾问会保留当前行程信息。"
      : payload.description;
  const ctaLabel =
    isZh && isSingaporeArrivalCard
      ? "开始填写"
      : payload.ctaLabel ?? (isZh ? "打开申请表" : "Open application form");
  const supportNote = isZh
    ? payload.supportLevel === "form_only"
      ? "VIZA 可协助整理和填写资料，暂不代替您向官方提交。"
      : payload.supportLevel === "assisted_submission"
        ? "VIZA 可协助填写并引导您完成后续办理。"
        : payload.supportLevel === "automated"
          ? "VIZA 可协助填写并按您的确认提交。"
          : payload.supportLevel === "official_redirect"
            ? "该手续暂未提供 VIZA 内部代填，将前往官方页面办理。"
            : null
    : payload.supportLevel === "form_only"
      ? "VIZA can help prepare the form, but official submission is not automated."
      : payload.supportLevel === "assisted_submission"
        ? "VIZA can help prepare the form and guide the next steps."
        : payload.supportLevel === "automated"
          ? "VIZA can prepare and submit this after your confirmation."
          : payload.supportLevel === "official_redirect"
            ? "VIZA does not currently offer an internal form for this step; continue on the official website."
            : null;

  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-500/10">
        <FileText className="h-4 w-4 text-brand-500" />
      </div>

      <div className="max-w-sm flex-1 overflow-hidden rounded-xl rounded-tl-md border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 bg-gray-50 px-4 py-3">
          <p className="text-sm font-medium text-gray-800">{title}</p>
          {description ? (
            <p className="mt-0.5 text-xs text-gray-500">{description}</p>
          ) : null}
          {supportNote ? (
            <p className="mt-1 text-xs text-gray-500">{supportNote}</p>
          ) : null}
        </div>

        <div className="px-4 py-3">
          <a
            className={cn(
              "inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              "bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-700"
            )}
            href={redirectUrl}
            rel={isOfficialRedirect ? "noopener noreferrer" : undefined}
            target={isOfficialRedirect ? "_blank" : undefined}
          >
            {ctaLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
