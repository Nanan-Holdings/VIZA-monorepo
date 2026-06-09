"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { useLocale } from "next-intl";
import {
  AlertCircle,
  ArrowRight,
  Camera,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileCheck2,
  FileText,
  Loader2,
  Plane,
  RefreshCw,
  UploadCloud,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SmoothProgressMeter } from "@/components/smooth-progress";
import { isChineseLocale } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";
import { uploadApplicationDocumentFromClient } from "@/lib/document-upload-client";
import {
  loadDocumentCenterData,
  type ApplicationDocument,
  type DocumentApplication,
  type DocumentCenterData,
  type DocumentRequirement,
} from "./actions";

interface DocumentCenterClientProps {
  initialData: DocumentCenterData | null;
  initialError: string | null;
  applicationId?: string | null;
  country?: string | null;
  visaType?: string | null;
  embedded?: boolean;
  hideApplicationSelector?: boolean;
  onDataChange?: (data: DocumentCenterData | null) => void;
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
  id: string;
  title: string;
  updatedAt: string | null;
  itinerary: unknown[];
  travelState: Record<string, unknown>;
  itineryRows: unknown[];
  citySummary: string;
  sourceLabel: string;
}

type BusyTarget = {
  type: "upload" | "travel" | "refresh";
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

function isTravelItineraryRequirement(requirement: DocumentRequirement): boolean {
  return (
    requirement.documentType === "travel_itinerary" ||
    requirement.key === "travel_itinerary"
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

function readTravelSupportCandidates(
  applicationId: string | null,
  isZh: boolean
): TravelSupportCandidate[] {
  if (!applicationId || typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(getTravelArchiveKey(applicationId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || parsed.version !== TRAVEL_CHAT_ARCHIVE_VERSION)
      return [];

    const sessions = getArray(parsed.sessions).filter(isRecord);
    const candidates: TravelSupportCandidate[] = [];
    sessions.forEach((session, sessionIndex) => {
      const sessionTitle =
        getString(session, "title") ??
        (isZh ? "旅行 AI 行程" : "Travel AI itinerary");
      const sessionId = getString(session, "id") ?? String(sessionIndex);
      const versions = getArray(session.versions).filter(isRecord);
      versions.forEach((version, versionIndex) => {
        if (
          !Array.isArray(version.itinerary) ||
          version.itinerary.length === 0
        ) {
          return;
        }
        const travelState = isRecord(version.travelState)
          ? version.travelState
          : {};
        candidates.push({
          id: `${sessionId}:version:${versionIndex}`,
          title:
            getString(version, "title") ??
            `${sessionTitle} ${isZh ? `版本 ${versionIndex + 1}` : `version ${versionIndex + 1}`}`,
          updatedAt:
            getString(version, "createdAt") ?? getString(session, "updatedAt"),
          itinerary: version.itinerary,
          travelState,
          itineryRows:
            getArray(version.itineryRows).length > 0
              ? getArray(version.itineryRows)
              : getArray(version.itinery_rows),
          citySummary: getCitiesFromTravelState(travelState, isZh),
          sourceLabel: isZh ? "旅行 AI 版本" : "Travel AI version",
        });
      });

      const messageItinerary = findItineraryInMessages(
        getArray(session.messages)
      );
      if (messageItinerary.length > 0) {
        const travelState = isRecord(session.travelState)
          ? session.travelState
          : {};
        candidates.push({
          id: `${sessionId}:messages`,
          title: sessionTitle,
          updatedAt: getString(session, "updatedAt"),
          itinerary: messageItinerary,
          travelState,
          itineryRows: [],
          citySummary: getCitiesFromTravelState(travelState, isZh),
          sourceLabel: isZh ? "聊天行程" : "Chat itinerary",
        });
      }
    });

    return candidates.sort((a, b) => {
      const left = a.updatedAt ? Date.parse(a.updatedAt) : 0;
      const right = b.updatedAt ? Date.parse(b.updatedAt) : 0;
      return right - left;
    });
  } catch {
    return [];
  }
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
  extraAction,
}: {
  view: DocumentViewState;
  busy: boolean;
  onChooseFile: () => void;
  inputRef: (element: HTMLInputElement | null) => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  isZh: boolean;
  extraAction?: ReactNode;
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
          {extraAction}
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

function TravelAiPickerDialog({
  open,
  onOpenChange,
  candidates,
  busy,
  onSelect,
  isZh,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidates: TravelSupportCandidate[];
  busy: boolean;
  onSelect: (candidate: TravelSupportCandidate) => void;
  isZh: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isZh ? "选择旅行 AI 行程" : "Choose a Travel AI itinerary"}
          </DialogTitle>
          <DialogDescription>
            {isZh
              ? "请选择已生成的 itinerary，VIZA 会生成英语 PDF 并上传到旅行行程材料。"
              : "Choose an existing itinerary. VIZA will generate an English PDF and upload it as the travel itinerary document."}
          </DialogDescription>
        </DialogHeader>

        {candidates.length > 0 ? (
          <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
            {candidates.map((candidate) => (
              <div
                key={candidate.id}
                className="rounded-lg border border-border bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="font-semibold text-foreground">
                      {candidate.title}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {candidate.citySummary}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {candidate.sourceLabel} · {isZh ? "更新于" : "Updated"}{" "}
                      {formatDate(candidate.updatedAt, isZh)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    className="shrink-0 bg-brand-500 hover:bg-brand-400"
                    onClick={() => onSelect(candidate)}
                    disabled={busy}
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileCheck2 className="h-4 w-4" />
                    )}
                    {isZh ? "上载英语 PDF" : "Upload English PDF"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-5 text-sm text-muted-foreground">
            <p>
              {isZh
                ? "当前浏览器还没有找到该申请的旅行 AI itinerary。"
                : "No Travel AI itinerary was found in this browser for this application."}
            </p>
            <Button asChild type="button" variant="outline" className="mt-4">
              <Link href="/client/travel-chat">
                <ExternalLink className="h-4 w-4" />
                {isZh ? "打开旅行 AI" : "Open Travel AI"}
              </Link>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
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
  onDataChange,
  onContinue,
  continueLabel,
}: DocumentCenterClientProps) {
  const locale = useLocale();
  const isZh = isChineseLocale(locale);
  const [data, setData] = useState<DocumentCenterData | null>(initialData);
  const [error, setError] = useState<string | null>(initialError);
  const [busyTarget, setBusyTarget] = useState<BusyTarget>(null);
  const [travelCandidates, setTravelCandidates] = useState<
    TravelSupportCandidate[]
  >([]);
  const [travelPickerOpen, setTravelPickerOpen] = useState(false);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    setData(initialData);
    setError(initialError);
  }, [initialData, initialError]);

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
  const travelView =
    documentViews.find(
      (view) => isTravelItineraryRequirement(view.requirement)
    ) ?? null;
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
          onDataChange?.(result.data);
          setError(null);
        } else {
          setData(null);
          onDataChange?.(null);
          setError(result.error);
        }
      })
      .finally(() => {
        if (!cancelled) setBusyTarget(null);
      });

    return () => {
      cancelled = true;
    };
  }, [applicationId, country, data?.selectedApplication?.id, onDataChange, visaType]);

  useEffect(() => {
    setTravelCandidates(
      readTravelSupportCandidates(selectedApplication?.id ?? null, isZh)
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
      onDataChange?.(result.data);
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

      await refreshData();
    } catch (uploadError) {
      console.error("Document upload failed", uploadError);
      setError(formatUploadError(uploadError, isZh));
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

  async function buildTravelAiPdf(candidate: TravelSupportCandidate): Promise<File> {
    const travelState = candidate.travelState;
    const cities = getArray(travelState.cities).filter(
      (item): item is string => typeof item === "string"
    );
    const travelOrder = getArray(travelState.travel_order).filter(
      (item): item is string => typeof item === "string"
    );
    const payload = {
      country: getString(travelState, "country") ?? cities[0] ?? "",
      countries: getArray(travelState.countries).filter(
        (item): item is string => typeof item === "string"
      ),
      cities: cities.length > 0 ? cities : travelOrder,
      city_days: isRecord(travelState.city_days) ? travelState.city_days : {},
      departure_date: getString(travelState, "departure_date") ?? undefined,
      date_flexibility: getString(travelState, "date_flexibility") ?? undefined,
      travel_days:
        typeof travelState.travel_days === "number"
          ? travelState.travel_days
          : Math.max(1, candidate.itinerary.length),
      travelers:
        typeof travelState.travelers === "number" ? travelState.travelers : 1,
      budget: typeof travelState.budget === "number" ? travelState.budget : 1,
      travel_order: travelOrder.length > 0 ? travelOrder : cities,
      origin_country: getString(travelState, "origin_country") ?? undefined,
      origin_city: getString(travelState, "origin_city") ?? undefined,
      return_country: getString(travelState, "return_country") ?? undefined,
      return_city: getString(travelState, "return_city") ?? undefined,
      selected_flights: getArray(travelState.selected_flights),
      selected_hotels: getArray(travelState.selected_hotels),
      final_note: getString(travelState, "final_note") ?? "",
      attached_files: getArray(travelState.attached_files).filter(
        (item): item is string => typeof item === "string"
      ),
      itinerary: candidate.itinerary,
      itinery_rows: candidate.itineryRows,
      export_language: "en",
    };

    const response = await fetch("/api/travel/download-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || "Failed to generate Travel AI PDF.");
    }

    const blob = await response.blob();
    return new File([blob], "travel_plan_en.pdf", {
      type: response.headers.get("content-type") ?? "application/pdf",
    });
  }

  async function handleSaveTravelAi(candidate: TravelSupportCandidate) {
    if (!selectedApplication || !travelView) return;
    const key = getDocumentKey(travelView.requirement);
    setBusyTarget({ type: "travel", key });
    setError(null);
    try {
      const file = await buildTravelAiPdf(candidate);
      await uploadFile(travelView.requirement, file, "travel_ai");
      setTravelPickerOpen(false);
    } catch (travelError) {
      console.error("Travel AI PDF upload failed", travelError);
      setError(
        travelError instanceof Error
          ? travelError.message
          : isZh
            ? "旅行 AI PDF 生成或上传失败。"
            : "Travel AI PDF generation or upload failed."
      );
      setBusyTarget(null);
    }
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
  const travelBusyKey = travelView ? getDocumentKey(travelView.requirement) : null;
  const travelBusy = Boolean(
    travelBusyKey &&
      busyTarget?.type === "travel" &&
      busyTarget.key === travelBusyKey
  );

  function renderTravelAiAction(view: DocumentViewState) {
    if (!isTravelItineraryRequirement(view.requirement)) return undefined;
    const key = getDocumentKey(view.requirement);
    const busy = busyTarget?.type === "travel" && busyTarget.key === key;
    return (
      <Button
        type="button"
        variant="outline"
        onClick={() => setTravelPickerOpen(true)}
        disabled={busyTarget !== null && !busy}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileCheck2 className="h-4 w-4" />
        )}
        {isZh ? "从旅行 AI 上载" : "Upload from Travel AI"}
      </Button>
    );
  }

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
                    ? "在这个表单内完成必需材料和可选补充材料。旅行行程可手动上传，也可从旅行 AI 选择已生成的英语 PDF。"
                    : "Complete required and optional supporting documents inside this form. Travel itinerary evidence can be uploaded manually or selected from an existing Travel AI English PDF."}
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
              <SmoothProgressMeter
                serverProgress={completionPercent}
                status={completionPercent >= 100 ? "completed" : "running"}
                intervalMs={140}
                label={isZh ? "完成度" : "Progress"}
                labelClassName="mb-1 text-sm font-semibold text-foreground"
                valueClassName="text-2xl font-semibold text-brand-500"
                trackClassName="bg-muted"
              />
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
                      busyTarget?.key === key &&
                      (busyTarget.type === "upload" ||
                        busyTarget.type === "travel")
                    }
                    inputRef={(element) => {
                      fileInputs.current[key] = element;
                    }}
                    onChooseFile={() => fileInputs.current[key]?.click()}
                    onFileChange={(event) =>
                      handleFileChange(view.requirement, event)
                    }
                    isZh={isZh}
                    extraAction={renderTravelAiAction(view)}
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
                        busyTarget?.key === key &&
                        (busyTarget.type === "upload" ||
                          busyTarget.type === "travel")
                      }
                      inputRef={(element) => {
                        fileInputs.current[key] = element;
                      }}
                      onChooseFile={() => fileInputs.current[key]?.click()}
                      onFileChange={(event) =>
                        handleFileChange(view.requirement, event)
                      }
                      isZh={isZh}
                      extraAction={renderTravelAiAction(view)}
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

      {travelView && (
        <TravelAiPickerDialog
          open={travelPickerOpen}
          onOpenChange={setTravelPickerOpen}
          candidates={travelCandidates}
          busy={travelBusy}
          onSelect={handleSaveTravelAi}
          isZh={isZh}
        />
      )}

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
