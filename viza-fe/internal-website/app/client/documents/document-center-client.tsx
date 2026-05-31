"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useLocale } from "next-intl";
import {
  AlertCircle,
  ArrowRight,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  ExternalLink,
  FileCheck2,
  FileText,
  Loader2,
  Plane,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  UploadCloud,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { isChineseLocale } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";
import { uploadApplicationDocumentFromClient } from "@/lib/document-upload-client";
import {
  confirmPassportOcrExtraction,
  loadDocumentCenterData,
  type ApplicationDocument,
  type DocumentApplication,
  type DocumentCenterData,
  type DocumentRequirement,
  type PassportOcrExtraction,
} from "./actions";

interface DocumentCenterClientProps {
  initialData: DocumentCenterData | null;
  initialError: string | null;
  applicationId?: string | null;
  country?: string | null;
  visaType?: string | null;
  embedded?: boolean;
  hideApplicationSelector?: boolean;
  onContinue?: () => void;
  continueLabel?: string;
}

interface DocumentViewState {
  requirement: DocumentRequirement;
  document: ApplicationDocument | null;
  status: DocumentStatusView;
}

interface DocumentStatusView {
  label: string;
  description: string;
  icon: LucideIcon;
  badgeClassName: string;
  ready: boolean;
  needsUpload: boolean;
}

interface TravelSupportCandidate {
  title: string;
  updatedAt: string | null;
  itinerary: unknown[];
  travelState: Record<string, unknown>;
  citySummary: string;
}

type BusyTarget = {
  type: "upload" | "ocr" | "travel" | "refresh";
  key: string;
} | null;

const TRAVEL_CHAT_ARCHIVE_VERSION = 1;
const DEFAULT_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx";
const REQUIREMENT_LABEL_ZH: Record<string, string> = {
  passport_copy: "护照资料页",
  passport_bio_page: "护照资料页",
  passport: "护照资料页",
  photo: "证件照",
  travel_itinerary: "旅行行程",
  bank_statement: "资金证明",
  flight_booking: "机票预订",
  hotel_booking: "住宿预订",
};
const REQUIREMENT_LABEL_EN: Record<string, string> = {
  passport_copy: "Passport bio page",
  passport_bio_page: "Passport bio page",
  passport: "Passport bio page",
  photo: "Passport-size photo",
  travel_itinerary: "Travel itinerary",
  bank_statement: "Proof of funds",
  flight_booking: "Flight booking",
  hotel_booking: "Accommodation booking",
};
const REQUIREMENT_DESCRIPTION_ZH: Record<string, string> = {
  passport_copy: "护照资料页的清晰扫描件或照片。",
  passport_bio_page: "护照资料页的清晰扫描件或照片。",
  passport: "护照资料页的清晰扫描件或照片。",
  photo: "近期证件照，需符合目的地照片规范。",
  travel_itinerary: "按天的行程安排，包含日期、城市与主要活动。",
  bank_statement: "近期银行对账单或等效资金证明。",
  flight_booking: "如有，请提供机票预订或往返信息。",
  hotel_booking: "如有，请提供住宿预订或住宿确认。",
};
const REQUIREMENT_DESCRIPTION_EN: Record<string, string> = {
  passport_copy: "A clear scan or photo of the passport bio page.",
  passport_bio_page: "A clear scan or photo of the passport bio page.",
  passport: "A clear scan or photo of the passport bio page.",
  photo: "A recent passport-style photo that follows the destination rules.",
  travel_itinerary:
    "A day-by-day itinerary with dates, cities, and main activities.",
  bank_statement: "Recent bank statements or equivalent proof of funds.",
  flight_booking:
    "If available, provide flight bookings or round-trip travel details.",
  hotel_booking:
    "If available, provide accommodation bookings or confirmations.",
};
const APPLICATION_STATUS_LABELS_ZH: Record<string, string> = {
  draft: "草稿",
  in_progress: "进行中",
  submitted: "已提交",
  approved: "已通过",
  rejected: "已拒绝",
  pending: "待处理",
  complete: "已完成",
};
const APPLICATION_STATUS_LABELS_EN: Record<string, string> = {
  draft: "Draft",
  in_progress: "In progress",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  pending: "Pending",
  complete: "Complete",
};
const CHECKLIST_SOURCE_LABELS_ZH: Record<string, string> = {
  document_requirements: "材料要求",
  package_metadata: "签证包配置",
  fallback: "默认清单",
};
const CHECKLIST_SOURCE_LABELS_EN: Record<string, string> = {
  document_requirements: "Document requirements",
  package_metadata: "Package configuration",
  fallback: "Default checklist",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(
  record: Record<string, unknown>,
  key: string
): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function formatDate(value: string | null, isZh: boolean): string {
  if (!value) return isZh ? "暂无" : "Not available";
  return new Intl.DateTimeFormat(isZh ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[^\w.-]+/g, "_").replace(/_+/g, "_");
  return cleaned.length > 120 ? cleaned.slice(cleaned.length - 120) : cleaned;
}

function getRequirementAccept(requirement: DocumentRequirement): string {
  if (requirement.accept.length > 0) return requirement.accept.join(",");
  if (requirement.documentType === "photo") return ".jpg,.jpeg,.png";
  return DEFAULT_ACCEPT;
}

function getDocumentKey(requirement: DocumentRequirement): string {
  return `${requirement.key}:${requirement.documentType}`;
}

function isPassportRequirement(requirement: DocumentRequirement): boolean {
  return (
    ["passport_copy", "passport", "passport_bio_page", "passport_scan"].includes(
      requirement.documentType
    ) || ["passport_copy", "passport_scan"].includes(requirement.key)
  );
}

function readOcrErrorMessage(payload: unknown, isZh: boolean): string {
  if (!isRecord(payload)) {
    return isZh
      ? "护照 OCR 未返回可读结果。"
      : "Passport OCR did not return a readable result.";
  }
  const error = payload.error;
  if (isRecord(error) && typeof error.message === "string")
    return error.message;
  if (typeof payload.message === "string") return payload.message;
  return isZh
    ? "护照 OCR 无法处理该文件。"
    : "Passport OCR could not process this file.";
}

function containsCjk(value: string): boolean {
  return /[\u4e00-\u9fff]/.test(value);
}

function getRequirementLabel(
  requirement: DocumentRequirement,
  isZh: boolean
): string {
  if (!isZh)
    return (
      (requirement.labelEn ||
        REQUIREMENT_LABEL_EN[requirement.key || requirement.documentType]) ??
      "Supporting document"
    );
  if (requirement.labelZh && containsCjk(requirement.labelZh))
    return requirement.labelZh;
  const key = requirement.key || requirement.documentType;
  return REQUIREMENT_LABEL_ZH[key] ?? "补充材料";
}

function getRequirementDescription(
  requirement: DocumentRequirement,
  isZh: boolean
): string | null {
  const key = requirement.key || requirement.documentType;
  if (!isZh) {
    if (requirement.description && !containsCjk(requirement.description))
      return requirement.description;
    return REQUIREMENT_DESCRIPTION_EN[key] ?? null;
  }
  if (requirement.description && containsCjk(requirement.description))
    return requirement.description;
  return REQUIREMENT_DESCRIPTION_ZH[key] ?? null;
}

function formatApplicationStatus(status: string, isZh: boolean): string {
  const normalized = status.toLowerCase();
  if (!isZh) return APPLICATION_STATUS_LABELS_EN[normalized] ?? "Updating";
  return APPLICATION_STATUS_LABELS_ZH[normalized] ?? "状态更新中";
}

function formatChecklistSource(
  source: string | null | undefined,
  isZh: boolean
): string {
  const labels = isZh ? CHECKLIST_SOURCE_LABELS_ZH : CHECKLIST_SOURCE_LABELS_EN;
  if (!source) return labels.fallback;
  return labels[source] ?? labels.fallback;
}

function formatUploadError(error: unknown, isZh: boolean): string {
  const message = error instanceof Error ? error.message : "";
  const normalized = message.toLowerCase();

  if (normalized.includes("bucket") && normalized.includes("not found")) {
    return isZh
      ? "上传失败：未找到存储桶 application-documents，请联系管理员确认 Supabase Storage 已创建该存储桶。"
      : "Upload failed: the application-documents storage bucket was not found. Please ask an admin to confirm Supabase Storage is configured.";
  }
  if (
    normalized.includes("permission") ||
    normalized.includes("not authorized") ||
    normalized.includes("rls")
  ) {
    return isZh
      ? "上传失败：存储权限不足。请联系管理员配置 Supabase Storage 写入策略。"
      : "Upload failed: storage permission is missing. Please ask an admin to configure the Supabase Storage write policy.";
  }
  if (
    normalized.includes("signed-in") ||
    normalized.includes("not authenticated")
  ) {
    return isZh
      ? "上传失败：登录状态失效，请重新登录后再试。"
      : "Upload failed: your login session expired. Please sign in and try again.";
  }

  return isZh
    ? "上传失败：请稍后重试，或打开控制台查看详细错误信息。"
    : "Upload failed. Please try again later or check the console for details.";
}

function isRejectedStatus(status: string): boolean {
  return [
    "rejected",
    "needs_replacement",
    "replacement_requested",
    "failed",
  ].includes(status.toLowerCase());
}

function isAcceptedStatus(status: string): boolean {
  return ["validated", "approved", "accepted", "confirmed"].includes(
    status.toLowerCase()
  );
}

function getDocumentStatus(
  requirement: DocumentRequirement,
  document: ApplicationDocument | null,
  isZh: boolean
): DocumentStatusView {
  if (!document) {
    return {
      label: requirement.required
        ? isZh
          ? "缺失"
          : "Missing"
        : isZh
          ? "可选"
          : "Optional",
      description: requirement.required
        ? isZh
          ? "必需材料未齐全，当前签证包无法推进。"
          : "Required documents are incomplete, so this visa package cannot move forward yet."
        : isZh
          ? "如有助于申请，可补充上传。"
          : "Upload this if it helps support your application.",
      icon: requirement.required ? AlertCircle : FileText,
      badgeClassName: requirement.required
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-slate-200 bg-slate-50 text-slate-600",
      ready: !requirement.required,
      needsUpload: true,
    };
  }

  if (isRejectedStatus(document.status)) {
    return {
      label: isZh ? "需要补交" : "Needs replacement",
      description:
        document.rejectionReason ??
        document.reviewNotes ??
        (isZh
          ? "材料不清晰或有误，请重新上传。"
          : "The document is unclear or incorrect. Please upload it again."),
      icon: XCircle,
      badgeClassName: "border-red-200 bg-red-50 text-red-700",
      ready: false,
      needsUpload: true,
    };
  }

  if (document.status.toLowerCase() === "missing") {
    return {
      label: isZh ? "缺失" : "Missing",
      description: isZh
        ? "已要求该材料，但暂无可用文件。"
        : "This document is required, but no file is available yet.",
      icon: AlertCircle,
      badgeClassName: "border-amber-200 bg-amber-50 text-amber-800",
      ready: false,
      needsUpload: true,
    };
  }

  if (isAcceptedStatus(document.status)) {
    return {
      label: isZh ? "已通过" : "Approved",
      description: isZh
        ? "材料已审核通过，可用于本次申请。"
        : "This document has been reviewed and can be used for this application.",
      icon: CheckCircle2,
      badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
      ready: true,
      needsUpload: false,
    };
  }

  return {
    label: isZh ? "已上传" : "Uploaded",
    description: isZh
      ? "已收到，等待审核。"
      : "Received and waiting for review.",
    icon: Clock3,
    badgeClassName: "border-blue-200 bg-blue-50 text-blue-700",
    ready: true,
    needsUpload: false,
  };
}

function findDocumentForRequirement(
  documents: ApplicationDocument[],
  requirement: DocumentRequirement
) {
  return (
    documents.find((document) => document.requirementKey === requirement.key) ??
    documents.find(
      (document) => document.documentType === requirement.documentType
    ) ??
    documents.find((document) => document.documentType === requirement.key) ??
    (isPassportRequirement(requirement)
      ? documents.find((document) => document.documentType === "passport_scan")
      : null) ??
    null
  );
}

function buildDocumentViews(
  data: DocumentCenterData,
  isZh: boolean
): DocumentViewState[] {
  return data.requirements.map((requirement) => {
    const document = findDocumentForRequirement(data.documents, requirement);
    return {
      requirement,
      document,
      status: getDocumentStatus(requirement, document, isZh),
    };
  });
}

function getLatestPassportOcr(
  extractions: PassportOcrExtraction[]
): PassportOcrExtraction | null {
  return extractions[0] ?? null;
}

function getOcrDisplayFields(
  extraction: PassportOcrExtraction | null,
  isZh: boolean
) {
  if (!extraction) return [];
  const labels: Array<[string, string[]]> = [
    [
      isZh ? "姓名" : "Full name",
      ["full_name", "fullName", "name", "passport_full_name", "holder_name"],
    ],
    [
      isZh ? "护照号码" : "Passport number",
      ["passport_number", "passportNumber", "document_number", "passport_no"],
    ],
    [
      isZh ? "出生日期" : "Date of birth",
      ["date_of_birth", "dateOfBirth", "birth_date", "dob"],
    ],
    [isZh ? "国籍" : "Nationality", ["nationality", "citizenship"]],
    [
      isZh ? "签发国家" : "Issuing country",
      [
        "passport_issuing_country",
        "issuingCountry",
        "issuing_country",
        "country_of_issue",
      ],
    ],
    [
      isZh ? "签发日期" : "Issue date",
      ["passport_issue_date", "issueDate", "issue_date", "date_of_issue"],
    ],
    [
      isZh ? "有效期至" : "Expiry date",
      [
        "passport_expiry_date",
        "expiryDate",
        "expiry_date",
        "expiration_date",
        "date_of_expiry",
      ],
    ],
  ];

  return labels
    .map(([label, keys]) => {
      for (const key of keys) {
        const value = extraction.extractedFields[key];
        if (typeof value === "string" && value.trim())
          return { label, value: value.trim() };
        if (isRecord(value)) {
          const nested =
            getString(value, "value") ??
            getString(value, "text") ??
            getString(value, "raw");
          if (nested) return { label, value: nested };
        }
      }
      return null;
    })
    .filter((field): field is { label: string; value: string } =>
      Boolean(field)
    );
}

function getTravelArchiveKey(applicationId: string): string {
  return `viza:travel-chat:${TRAVEL_CHAT_ARCHIVE_VERSION}:${applicationId}`;
}

function getCitiesFromTravelState(
  travelState: Record<string, unknown>,
  isZh: boolean
): string {
  const order = getArray(travelState.travel_order).filter(
    (item): item is string => typeof item === "string"
  );
  const cities = getArray(travelState.cities).filter(
    (item): item is string => typeof item === "string"
  );
  const source = order.length > 0 ? order : cities;
  if (source.length === 0) return isZh ? "旅行 AI 行程" : "Travel AI itinerary";
  return source.slice(0, 4).join(" → ");
}

function findItineraryInMessages(messages: unknown[]): unknown[] {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!isRecord(message)) continue;
    const parts = getArray(message.parts);
    for (const part of parts) {
      if (!isRecord(part)) continue;
      if (
        part.type === "tool-itinerary" &&
        Array.isArray(part.output) &&
        part.output.length > 0
      ) {
        return part.output;
      }
    }
  }
  return [];
}

function readTravelSupportCandidate(
  applicationId: string | null,
  isZh: boolean
): TravelSupportCandidate | null {
  if (!applicationId || typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(getTravelArchiveKey(applicationId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || parsed.version !== TRAVEL_CHAT_ARCHIVE_VERSION)
      return null;

    const sessions = getArray(parsed.sessions).filter(isRecord);
    for (const session of sessions) {
      const versions = getArray(session.versions).filter(isRecord);
      const latestVersion = versions[versions.length - 1];
      if (
        latestVersion &&
        Array.isArray(latestVersion.itinerary) &&
        latestVersion.itinerary.length > 0
      ) {
        const travelState = isRecord(latestVersion.travelState)
          ? latestVersion.travelState
          : {};
        return {
          title:
            getString(latestVersion, "title") ??
            getString(session, "title") ??
            (isZh ? "旅行 AI 行程" : "Travel AI itinerary"),
          updatedAt:
            getString(latestVersion, "createdAt") ??
            getString(session, "updatedAt"),
          itinerary: latestVersion.itinerary,
          travelState,
          citySummary: getCitiesFromTravelState(travelState, isZh),
        };
      }

      const messageItinerary = findItineraryInMessages(
        getArray(session.messages)
      );
      if (messageItinerary.length > 0) {
        const travelState = isRecord(session.travelState)
          ? session.travelState
          : {};
        return {
          title:
            getString(session, "title") ??
            (isZh ? "旅行 AI 行程" : "Travel AI itinerary"),
          updatedAt: getString(session, "updatedAt"),
          itinerary: messageItinerary,
          travelState,
          citySummary: getCitiesFromTravelState(travelState, isZh),
        };
      }
    }
  } catch {
    return null;
  }

  return null;
}

function ApplicationSelector({
  applications,
  selectedApplication,
  isZh,
}: {
  applications: DocumentApplication[];
  selectedApplication: DocumentApplication | null;
  isZh: boolean;
}) {
  if (applications.length <= 1) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {applications.map((application) => {
        const selected = application.id === selectedApplication?.id;
        return (
          <Link
            key={application.id}
            href={`/client/documents?applicationId=${encodeURIComponent(application.id)}`}
            className={cn(
              "flex min-w-[220px] items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left text-sm transition",
              selected
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-border bg-white text-foreground hover:border-brand-200"
            )}
          >
            <span className="min-w-0">
              <span className="block truncate font-semibold">
                {application.countryFlag}{" "}
                {isZh
                  ? application.countryNameZh || application.countryName
                  : application.countryName}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {isZh
                  ? application.visaTypeLabelZh || application.visaTypeLabel
                  : application.visaTypeLabel}
              </span>
            </span>
            {selected ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <ArrowRight className="h-4 w-4 shrink-0" />
            )}
          </Link>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }: { status: DocumentStatusView }) {
  const Icon = status.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        status.badgeClassName
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {status.label}
    </span>
  );
}

function RequirementRow({
  view,
  busy,
  onChooseFile,
  inputRef,
  onFileChange,
  isZh,
}: {
  view: DocumentViewState;
  busy: boolean;
  onChooseFile: () => void;
  inputRef: (element: HTMLInputElement | null) => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  isZh: boolean;
}) {
  const { requirement, document, status } = view;
  const Icon =
    requirement.documentType === "photo"
      ? Camera
      : requirement.documentType === "travel_itinerary"
        ? Plane
        : FileText;
  const label = getRequirementLabel(requirement, isZh);
  const description = getRequirementDescription(requirement, isZh);

  return (
    <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">
                {label}
              </h3>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {requirement.required
                  ? isZh
                    ? "必需"
                    : "Required"
                  : isZh
                    ? "可选"
                    : "Optional"}
              </span>
            </div>
            {description && (
              <p className="max-w-2xl text-sm text-muted-foreground">
                {description}
              </p>
            )}
            {document?.filename && (
              <p className="text-xs text-muted-foreground">
                {isZh ? "已上传文件：" : "Uploaded file: "}
                <span className="font-medium text-foreground">
                  {document.filename}
                </span>
              </p>
            )}
            {document?.reviewNotes && (
              <p className="text-xs text-muted-foreground">
                {isZh ? "审核备注：" : "Review note: "}
                {document.reviewNotes}
              </p>
            )}
            {status.needsUpload && status.description && (
              <p
                className={cn(
                  "text-xs",
                  isRejectedStatus(document?.status ?? "")
                    ? "text-red-700"
                    : "text-amber-800"
                )}
              >
                {status.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
          <StatusBadge status={status} />
          <Button
            type="button"
            variant={document ? "outline" : "default"}
            className={cn(!document && "bg-brand-500 hover:bg-brand-400")}
            onClick={onChooseFile}
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : document ? (
              <RefreshCw className="h-4 w-4" />
            ) : (
              <UploadCloud className="h-4 w-4" />
            )}
            {document
              ? isZh
                ? "重新上传"
                : "Replace"
              : isZh
                ? "上传"
                : "Upload"}
          </Button>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept={getRequirementAccept(requirement)}
            onChange={onFileChange}
          />
        </div>
      </div>
    </div>
  );
}

function PhotoCompliancePanel({
  photoView,
  onReupload,
  isZh,
}: {
  photoView: DocumentViewState | null;
  onReupload: () => void;
  isZh: boolean;
}) {
  const document = photoView?.document ?? null;
  const status = photoView?.status ?? null;
  const failed = Boolean(document && isRejectedStatus(document.status));
  const passed = Boolean(document && isAcceptedStatus(document.status));
  const pending = Boolean(document && !failed && !passed);
  const missing = !document;

  return (
    <section className="rounded-lg border border-border bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-brand-500" />
            <h2 className="text-lg font-semibold">
              {isZh ? "照片合规" : "Photo compliance"}
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {isZh
              ? "VIZA 会将照片状态独立显示，方便在照片不合格时快速修正。"
              : "VIZA shows photo status separately so you can quickly fix issues when the photo does not meet requirements."}
          </p>
          {failed && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {document?.rejectionReason ??
                document?.reviewNotes ??
                (isZh
                  ? "照片未满足目的地要求，请重新上传。"
                  : "The photo does not meet destination requirements. Please upload it again.")}
            </p>
          )}
          {pending && (
            <p className="text-sm text-blue-700">
              {isZh
                ? "照片已收到，正在核验是否符合目的地规则。"
                : "Photo received. VIZA is checking it against destination rules."}
            </p>
          )}
          {passed && (
            <p className="text-sm text-emerald-700">
              {isZh
                ? "照片审核通过，可用于申请材料包。"
                : "Photo approved and ready for the application packet."}
            </p>
          )}
          {missing && (
            <p className="text-sm text-amber-800">
              {isZh
                ? "尚未上传证件照。"
                : "No passport-style photo has been uploaded yet."}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          <StatusBadge
            status={
              status ?? {
                label: isZh ? "缺失" : "Missing",
                description: isZh ? "未上传照片" : "No photo uploaded",
                icon: AlertCircle,
                badgeClassName: "border-amber-200 bg-amber-50 text-amber-800",
                ready: false,
                needsUpload: true,
              }
            }
          />
          <Button type="button" variant="outline" onClick={onReupload}>
            <RefreshCw className="h-4 w-4" />
            {document
              ? isZh
                ? "更换照片"
                : "Replace photo"
              : isZh
                ? "上传照片"
                : "Upload photo"}
          </Button>
        </div>
      </div>
    </section>
  );
}

function OcrPanel({
  passportView,
  extraction,
  busy,
  onRun,
  onConfirm,
  isZh,
}: {
  passportView: DocumentViewState | null;
  extraction: PassportOcrExtraction | null;
  busy: boolean;
  onRun: () => void;
  onConfirm: () => void;
  isZh: boolean;
}) {
  const fields = getOcrDisplayFields(extraction, isZh);
  const hasPassport = Boolean(passportView?.document);
  const confirmed = Boolean(
    extraction?.confirmedAt || extraction?.status.toLowerCase() === "confirmed"
  );
  const failed = Boolean(
    extraction &&
    ["failed", "error", "rejected"].includes(extraction.status.toLowerCase())
  );
  const pending = Boolean(
    extraction &&
    ["pending", "processing", "running"].includes(
      extraction.status.toLowerCase()
    )
  );

  return (
    <section className="rounded-lg border border-border bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-brand-500" />
            <h2 className="text-lg font-semibold">
              {isZh ? "护照 OCR 确认" : "Passport OCR confirmation"}
            </h2>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {isZh
              ? "OCR 识别出的护照信息会以“待确认”状态保留，确认后将更新个人资料与申请表答案。"
              : "Passport details extracted by OCR stay pending until you confirm them. After confirmation, VIZA updates your profile and application answers."}
          </p>
          {!hasPassport && (
            <p className="text-sm text-amber-800">
              {isZh
                ? "请先上传护照资料页，才能使用 OCR 确认。"
                : "Upload the passport bio page before running OCR confirmation."}
            </p>
          )}
          {hasPassport && !extraction && (
            <p className="text-sm text-muted-foreground">
              {isZh
                ? "尚未生成该护照的 OCR 记录。"
                : "No OCR record has been generated for this passport yet."}
            </p>
          )}
          {pending && (
            <p className="text-sm text-blue-700">
              {isZh
                ? "OCR 处理中，请稍后刷新页面。"
                : "OCR is processing. Please refresh shortly."}
            </p>
          )}
          {failed && (
            <p className="text-sm text-red-700">
              {extraction?.errorMessage ??
                (isZh
                  ? "OCR 未能清晰识别护照信息。"
                  : "OCR could not clearly read the passport information.")}
            </p>
          )}
          {confirmed && (
            <p className="text-sm text-emerald-700">
              {isZh ? "护照信息已确认。" : "Passport information confirmed."}
            </p>
          )}
          {hasPassport && (
            <Button
              type="button"
              variant="outline"
              onClick={onRun}
              disabled={busy || pending}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ScanLine className="h-4 w-4" />
              )}
              {isZh ? "运行护照 OCR" : "Run passport OCR"}
            </Button>
          )}
        </div>

        {fields.length > 0 && (
          <div className="w-full rounded-lg border border-border bg-muted/30 p-4 lg:max-w-md">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">
                {isZh ? "待确认字段" : "Fields to confirm"}
              </p>
              {confirmed && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {isZh ? "已确认" : "Confirmed"}
                </span>
              )}
            </div>
            <dl className="space-y-2">
              {fields.map((field) => (
                <div
                  key={field.label}
                  className="grid grid-cols-[120px_1fr] gap-3 text-sm"
                >
                  <dt className="text-muted-foreground">{field.label}</dt>
                  <dd className="font-medium text-foreground">{field.value}</dd>
                </div>
              ))}
            </dl>
            {!confirmed && (
              <Button
                type="button"
                className="mt-4 w-full bg-brand-500 hover:bg-brand-400"
                onClick={onConfirm}
                disabled={busy || pending || failed}
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ClipboardCheck className="h-4 w-4" />
                )}
                {isZh ? "确认护照信息" : "Confirm passport details"}
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function TravelAiPanel({
  candidate,
  requirement,
  existingDocument,
  busy,
  onSave,
  isZh,
}: {
  candidate: TravelSupportCandidate | null;
  requirement: DocumentRequirement | null;
  existingDocument: ApplicationDocument | null;
  busy: boolean;
  onSave: () => void;
  isZh: boolean;
}) {
  if (!requirement) return null;

  return (
    <section className="rounded-lg border border-border bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Plane className="h-5 w-5 text-brand-500" />
            <h2 className="text-lg font-semibold">
              {isZh ? "旅行 AI 支持材料" : "Travel AI supporting document"}
            </h2>
          </div>
          {candidate ? (
            <>
              <p className="text-sm text-muted-foreground">
                {isZh
                  ? "当前浏览器已找到旅行 AI 行程，可保存为行程材料。"
                  : "VIZA found a Travel AI itinerary in this browser. You can save it as itinerary evidence."}
              </p>
              <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                <span className="font-semibold">{candidate.title}</span>
                <span className="block">{candidate.citySummary}</span>
                <span className="block text-xs">
                  {isZh ? "更新于" : "Updated"}{" "}
                  {formatDate(candidate.updatedAt, isZh)}
                </span>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {isZh
                ? "当前浏览器未找到该申请的旅行 AI 行程。需要时可在旅行 AI 生成行程以满足该材料项。"
                : "No Travel AI itinerary was found in this browser for this application. Generate one in Travel AI if this document is needed."}
            </p>
          )}
          {existingDocument && (
            <p className="text-xs text-muted-foreground">
              {isZh ? "已保存行程文件：" : "Saved itinerary file: "}
              <span className="font-medium text-foreground">
                {existingDocument.filename}
              </span>
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          {candidate && (
            <Button
              type="button"
              className="bg-brand-500 hover:bg-brand-400"
              onClick={onSave}
              disabled={busy}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileCheck2 className="h-4 w-4" />
              )}
              {existingDocument
                ? isZh
                  ? "用旅行 AI 替换"
                  : "Replace with Travel AI"
                : isZh
                  ? "保存旅行 AI 行程"
                  : "Save Travel AI itinerary"}
            </Button>
          )}
          <Button asChild type="button" variant="outline">
            <Link href="/client/travel-chat">
              <ExternalLink className="h-4 w-4" />
              {isZh ? "打开旅行 AI" : "Open Travel AI"}
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function EmptyState({
  error,
  isZh,
  embedded = false,
  loading = false,
}: {
  error: string | null;
  isZh: boolean;
  embedded?: boolean;
  loading?: boolean;
}) {
  return (
    <main
      className={cn(
        "mx-auto flex max-w-3xl flex-col items-center justify-center gap-5 text-center",
        embedded ? "py-8" : "py-16"
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
        {loading ? (
          <Loader2 className="h-7 w-7 animate-spin" />
        ) : (
          <FileText className="h-7 w-7" />
        )}
      </div>
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">
          {loading
            ? isZh
              ? "正在加载材料"
              : "Loading documents"
            : isZh
              ? "材料清单中心"
              : "Document Checklist Center"}
        </h1>
        <p className="text-muted-foreground">
          {loading
            ? isZh
              ? "正在读取当前表单对应的材料清单。"
              : "Loading the checklist for the current form."
            : error ??
            (isZh
              ? "请先创建或重新打开一份申请。系统会在申请存在后生成对应的材料清单。"
              : "Create or reopen an application first. VIZA will generate the matching document checklist after an application exists.")}
        </p>
      </div>
      {!embedded && !loading && (
        <Button asChild className="bg-brand-500 hover:bg-brand-400">
          <Link href="/client/application">
            {isZh ? "前往申请" : "Go to application"}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      )}
    </main>
  );
}

export function DocumentCenterClient({
  initialData,
  initialError,
  applicationId,
  country,
  visaType,
  embedded = false,
  hideApplicationSelector = embedded,
  onContinue,
  continueLabel,
}: DocumentCenterClientProps) {
  const locale = useLocale();
  const isZh = isChineseLocale(locale);
  const [data, setData] = useState<DocumentCenterData | null>(initialData);
  const [error, setError] = useState<string | null>(initialError);
  const [busyTarget, setBusyTarget] = useState<BusyTarget>(null);
  const [travelCandidate, setTravelCandidate] =
    useState<TravelSupportCandidate | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const selectedApplication = data?.selectedApplication ?? null;
  const documentViews = useMemo(
    () => (data ? buildDocumentViews(data, isZh) : []),
    [data, isZh]
  );
  const requiredViews = documentViews.filter(
    (view) => view.requirement.required
  );
  const optionalViews = documentViews.filter(
    (view) => !view.requirement.required
  );
  const blockingViews = requiredViews.filter((view) => !view.status.ready);
  const passportView =
    documentViews.find(
      (view) =>
        view.requirement.documentType === "passport_copy" ||
        view.requirement.key === "passport_copy"
    ) ?? null;
  const photoView =
    documentViews.find(
      (view) =>
        view.requirement.documentType === "photo" ||
        view.requirement.key === "photo"
    ) ?? null;
  const travelView =
    documentViews.find(
      (view) =>
        view.requirement.documentType === "travel_itinerary" ||
        view.requirement.key === "travel_itinerary"
    ) ?? null;
  const latestOcr = getLatestPassportOcr(data?.ocrExtractions ?? []);
  const totalRequired = requiredViews.length;
  const readyRequired = requiredViews.filter(
    (view) => view.status.ready
  ).length;
  const completionPercent =
    totalRequired > 0 ? Math.round((readyRequired / totalRequired) * 100) : 0;

  useEffect(() => {
    if (!applicationId) return;
    if (data?.selectedApplication?.id === applicationId) return;

    let cancelled = false;
    setBusyTarget({ type: "refresh", key: applicationId });
    loadDocumentCenterData({ applicationId, country, visaType })
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setData(result.data);
          setError(null);
        } else {
          setData(null);
          setError(result.error);
        }
      })
      .finally(() => {
        if (!cancelled) setBusyTarget(null);
      });

    return () => {
      cancelled = true;
    };
  }, [applicationId, country, data?.selectedApplication?.id, visaType]);

  useEffect(() => {
    setTravelCandidate(
      readTravelSupportCandidate(selectedApplication?.id ?? null, isZh)
    );
  }, [isZh, selectedApplication?.id]);

  async function refreshData() {
    if (!selectedApplication) return;
    setBusyTarget({ type: "refresh", key: selectedApplication.id });
    const result = await loadDocumentCenterData({
      applicationId: selectedApplication.id,
      country,
      visaType,
    });
    if (result.ok) {
      setData(result.data);
      setError(null);
    } else {
      setError(result.error);
    }
    setBusyTarget(null);
  }

  async function uploadFile(
    requirement: DocumentRequirement,
    file: File,
    source: "manual_upload" | "travel_ai" = "manual_upload"
  ) {
    if (!selectedApplication) return;
    const key = getDocumentKey(requirement);
    setBusyTarget({ type: source === "travel_ai" ? "travel" : "upload", key });
    setError(null);

    try {
      const safeName = sanitizeFilename(file.name);
      const uploadForm = new FormData();
      uploadForm.set("applicationId", selectedApplication.id);
      uploadForm.set("documentType", requirement.documentType);
      uploadForm.set("requirementKey", requirement.key);
      uploadForm.set("filename", safeName);
      uploadForm.set("required", String(requirement.required));
      uploadForm.set("source", source);
      uploadForm.set("file", file);
      const result = await uploadApplicationDocumentFromClient(uploadForm);
      if (!result.ok) throw new Error(result.error);

      if (source === "manual_upload" && isPassportRequirement(requirement)) {
        const ocrResult = await runPassportOcr({ storagePath: result.storagePath }, key);
        if (!ocrResult.ok) {
          setError(
            isZh
              ? `护照已上传，但 OCR 未完成：${ocrResult.error}`
              : `Passport uploaded, but OCR did not complete: ${ocrResult.error}`
          );
        }
      }
      await refreshData();
    } catch (uploadError) {
      console.error("Document upload failed", uploadError);
      setError(formatUploadError(uploadError, isZh));
      setBusyTarget(null);
    }
  }

  async function runPassportOcr(
    target: { documentId?: string; storagePath?: string },
    key = passportView ? getDocumentKey(passportView.requirement) : "passport"
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!selectedApplication)
      return {
        ok: false,
        error: isZh ? "未选择申请。" : "No application selected.",
      };
    setBusyTarget({ type: "ocr", key });

    try {
      const response = await fetch("/api/passport-ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: selectedApplication.id,
          ...target,
        }),
      });
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok || !isRecord(payload) || payload.success !== true) {
        return { ok: false, error: readOcrErrorMessage(payload, isZh) };
      }

      return { ok: true };
    } catch (ocrError) {
      return {
        ok: false,
        error:
          ocrError instanceof Error
            ? ocrError.message
            : isZh
              ? "护照 OCR 失败。"
              : "Passport OCR failed.",
      };
    }
  }

  async function handleRunPassportOcr() {
    if (!passportView?.document) {
      setError(
        isZh
          ? "请先上传护照资料页，再运行 OCR。"
          : "Upload the passport bio page before running OCR."
      );
      return;
    }

    setError(null);
    const result = await runPassportOcr({
      documentId: passportView.document.id,
    });
    if (result.ok) {
      await refreshData();
    } else {
      setError(result.error);
      setBusyTarget(null);
    }
  }

  async function handleFileChange(
    requirement: DocumentRequirement,
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await uploadFile(requirement, file);
  }

  async function handleConfirmOcr() {
    if (!selectedApplication || !latestOcr) return;
    setBusyTarget({ type: "ocr", key: latestOcr.id });
    const result = await confirmPassportOcrExtraction({
      applicationId: selectedApplication.id,
      extractionId: latestOcr.id,
    });

    if (result.ok) {
      await refreshData();
    } else {
      setError(
        isZh
          ? "确认失败，请稍后重试。"
          : "Confirmation failed. Please try again later."
      );
      setBusyTarget(null);
    }
  }

  async function handleSaveTravelAi() {
    if (!selectedApplication || !travelCandidate || !travelView) return;
    const exportedAt = new Date().toISOString();
    const blob = new Blob(
      [
        JSON.stringify(
          {
            source: "viza_travel_ai",
            applicationId: selectedApplication.id,
            title: travelCandidate.title,
            exportedAt,
            travelState: travelCandidate.travelState,
            itinerary: travelCandidate.itinerary,
          },
          null,
          2
        ),
      ],
      { type: "application/json" }
    );
    const file = new File(
      [blob],
      `travel-ai-itinerary-${exportedAt.slice(0, 10)}.json`,
      { type: "application/json" }
    );
    await uploadFile(travelView.requirement, file, "travel_ai");
  }

  if (!data || !selectedApplication) {
    return (
      <EmptyState
        error={error}
        isZh={isZh}
        embedded={embedded}
        loading={embedded && busyTarget?.type === "refresh"}
      />
    );
  }

  const refreshing = busyTarget?.type === "refresh";

  return (
    <main
      className={cn(
        "space-y-6",
        embedded ? "pb-2" : "mx-auto max-w-7xl pb-16"
      )}
    >
      <section className="space-y-5">
        {!hideApplicationSelector && (
          <ApplicationSelector
            applications={data.applications}
            selectedApplication={selectedApplication}
            isZh={isZh}
          />
        )}

        <div className="rounded-lg border border-border bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-normal text-brand-500">
                {embedded
                  ? isZh
                    ? "当前表单材料"
                    : "Form documents"
                  : isZh
                    ? "材料清单中心"
                    : "Document checklist center"}
              </p>
              <div className="space-y-1">
                <h1
                  className={cn(
                    "font-semibold text-foreground",
                    embedded ? "text-2xl" : "text-3xl"
                  )}
                >
                  {selectedApplication.countryFlag}{" "}
                  {isZh
                    ? selectedApplication.countryNameZh ||
                      selectedApplication.countryName
                    : selectedApplication.countryName}{" "}
                  {isZh ? "材料" : "Documents"}
                </h1>
                <p className="max-w-3xl text-muted-foreground">
                  {isZh
                    ? "在这个表单内完成必需材料、可选补充材料、护照 OCR 确认与证件照检查。"
                    : "Complete required documents, optional support, passport OCR confirmation, and photo checks inside this form."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-medium">
                <span className="rounded-full bg-brand-50 px-3 py-1 text-brand-700">
                  {isZh
                    ? selectedApplication.visaTypeLabelZh ||
                      selectedApplication.visaTypeLabel
                    : selectedApplication.visaTypeLabel}
                </span>
                <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
                  {isZh ? "申请状态：" : "Application status: "}
                  {formatApplicationStatus(selectedApplication.status, isZh)}
                </span>
                <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
                  {isZh ? "清单来源：" : "Checklist source: "}
                  {formatChecklistSource(
                    data.packageSummary?.source ?? null,
                    isZh
                  )}
                </span>
              </div>
            </div>

            <div
              className={cn(
                "w-full rounded-lg border border-border bg-muted/30 p-4",
                embedded ? "lg:max-w-xs" : "lg:max-w-sm",
              )}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold">
                  {isZh ? "完成度" : "Progress"}
                </span>
                <span className="text-2xl font-semibold text-brand-500">
                  {completionPercent}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-brand-500"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {isZh
                  ? `已完成 ${readyRequired} / ${totalRequired} 项必需材料上传或审核。`
                  : `${readyRequired} / ${totalRequired} required documents uploaded or reviewed.`}
              </p>
              <div className="mt-4 flex gap-2">
                {!embedded && (
                  <Button asChild variant="outline" className="flex-1">
                    <Link href="/client/status">
                      {isZh ? "查看状态" : "View status"}
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  className={embedded ? "w-full" : undefined}
                  onClick={refreshData}
                  disabled={refreshing}
                >
                  {refreshing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      <section
        className={cn(
          "rounded-lg border p-5 shadow-sm",
          blockingViews.length
            ? "border-amber-200 bg-amber-50"
            : "border-emerald-200 bg-emerald-50"
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              {blockingViews.length ? (
                <AlertCircle className="h-5 w-5 text-amber-700" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-emerald-700" />
              )}
              <h2
                className={cn(
                  "text-lg font-semibold",
                  blockingViews.length ? "text-amber-900" : "text-emerald-900"
                )}
              >
                {blockingViews.length
                  ? isZh
                    ? "缺失或需补交的材料"
                    : "Missing or replacement documents"
                  : isZh
                    ? "必需材料已齐备"
                    : "Required documents complete"}
              </h2>
            </div>
            <p
              className={cn(
                "mt-1 text-sm",
                blockingViews.length ? "text-amber-800" : "text-emerald-800"
              )}
            >
              {blockingViews.length
                ? isZh
                  ? "必需材料未齐全，需上传或补交后才能继续处理。"
                  : "Required documents are incomplete. Upload or replace the missing items before processing can continue."
                : isZh
                  ? "必需材料已齐全，VIZA 可继续审核材料包。"
                  : "Required documents are complete. VIZA can continue reviewing the application packet."}
            </p>
          </div>
          {blockingViews.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {blockingViews.map((view) => (
                <span
                  key={getDocumentKey(view.requirement)}
                  className="rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-semibold text-amber-800"
                >
                  {getRequirementLabel(view.requirement, isZh)}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      <div
        className={cn(
          "grid gap-6",
          embedded ? "2xl:grid-cols-[minmax(0,1fr)_320px]" : "xl:grid-cols-[1fr_380px]",
        )}
      >
        <div className="space-y-6">
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">
                {isZh ? "必需材料" : "Required documents"}
              </h2>
              <span className="text-sm text-muted-foreground">
                {requiredViews.length}{" "}
                {isZh ? "项" : requiredViews.length === 1 ? "item" : "items"}
              </span>
            </div>
            <div className="space-y-3">
              {requiredViews.map((view) => {
                const key = getDocumentKey(view.requirement);
                return (
                  <RequirementRow
                    key={key}
                    view={view}
                    busy={
                      busyTarget?.type === "upload" && busyTarget.key === key
                    }
                    inputRef={(element) => {
                      fileInputs.current[key] = element;
                    }}
                    onChooseFile={() => fileInputs.current[key]?.click()}
                    onFileChange={(event) =>
                      handleFileChange(view.requirement, event)
                    }
                    isZh={isZh}
                  />
                );
              })}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">
                {isZh ? "可选补充材料" : "Optional supporting documents"}
              </h2>
              <span className="text-sm text-muted-foreground">
                {optionalViews.length}{" "}
                {isZh ? "项" : optionalViews.length === 1 ? "item" : "items"}
              </span>
            </div>
            {optionalViews.length > 0 ? (
              <div className="space-y-3">
                {optionalViews.map((view) => {
                  const key = getDocumentKey(view.requirement);
                  return (
                    <RequirementRow
                      key={key}
                      view={view}
                      busy={
                        busyTarget?.type === "upload" && busyTarget.key === key
                      }
                      inputRef={(element) => {
                        fileInputs.current[key] = element;
                      }}
                      onChooseFile={() => fileInputs.current[key]?.click()}
                      onFileChange={(event) =>
                        handleFileChange(view.requirement, event)
                      }
                      isZh={isZh}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-white p-4 text-sm text-muted-foreground shadow-sm">
                {isZh
                  ? "该签证包暂未配置可选补充材料。"
                  : "No optional supporting documents are configured for this visa package yet."}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <PhotoCompliancePanel
            photoView={photoView}
            onReupload={() => {
              if (!photoView) return;
              fileInputs.current[
                getDocumentKey(photoView.requirement)
              ]?.click();
            }}
            isZh={isZh}
          />
          <OcrPanel
            passportView={passportView}
            extraction={latestOcr}
            busy={busyTarget?.type === "ocr"}
            onRun={handleRunPassportOcr}
            onConfirm={handleConfirmOcr}
            isZh={isZh}
          />
          <TravelAiPanel
            candidate={travelCandidate}
            requirement={travelView?.requirement ?? null}
            existingDocument={travelView?.document ?? null}
            busy={busyTarget?.type === "travel"}
            onSave={handleSaveTravelAi}
            isZh={isZh}
          />
        </aside>
      </div>

      {embedded && onContinue && (
        <div className="flex justify-end border-t border-border pt-5">
          <Button
            type="button"
            className="bg-brand-500 hover:bg-brand-400"
            onClick={onContinue}
            disabled={busyTarget !== null || blockingViews.length > 0}
          >
            {continueLabel ?? (isZh ? "继续" : "Continue")}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </main>
  );
}
