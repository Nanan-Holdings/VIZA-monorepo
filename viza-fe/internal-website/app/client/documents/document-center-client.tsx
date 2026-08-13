"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  FileText,
  Loader2,
} from "lucide-react";
import { BrandActionButton } from "@/components/client/brand-action-button";
import { AiAssistButton } from "@/components/ui/ai-assist-button";
import { Button } from "@/components/ui/button";
import { FieldGuidancePanel } from "@/components/field-guidance-panel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DocumentUploadField,
  documentUploadStatusLabel,
  type DocumentUploadStatus,
} from "@/components/ui/document-upload-field";
import { SupportingDocumentCard } from "@/components/ui/supporting-document-card";
import { isChineseLocale } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";
import { uploadApplicationDocumentFromClient } from "@/lib/document-upload-client";
import { runFaceMatch, type FaceMatchActionResult } from "@/app/actions/face-match";
import type { VisaFormFieldRow } from "@/types/visa-form-fields";
import type { FieldGuidanceChatMessage } from "@/types/field-guidance";
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
  /** Drives the canonical `DocumentUploadField` dot and tone. */
  fieldStatus: DocumentUploadStatus;
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
  type: "upload" | "travel" | "refresh" | "face_match";
  key: string;
} | null;

const TRAVEL_CHAT_ARCHIVE_VERSION = 1;
const DEFAULT_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx";
const PROFILE_PHOTO_DOCUMENT_TYPES = [
  "photo",
  "applicant_photo",
  "profile_photo",
  "formal_photo",
  "formal_photo_upload",
  "passport_photo",
  "portrait_photo",
] as const;
const PROFILE_SIGNATURE_DOCUMENT_TYPES = [
  "customs_signature_file",
  "electronic_signature",
  "signature",
  "signature_image",
] as const;
const UNIVERSAL_UPLOAD_DOCUMENT_TYPES = new Set<string>([
  ...PROFILE_PHOTO_DOCUMENT_TYPES,
  ...PROFILE_SIGNATURE_DOCUMENT_TYPES,
]);
const REQUIREMENT_LABEL_ZH: Record<string, string> = {
  passport_copy: "护照资料页",
  passport_bio_page: "护照资料页",
  passport: "护照资料页",
  photo: "证件照",
  applicant_photo: "个人证件照",
  profile_photo: "个人证件照",
  formal_photo: "证件照",
  formal_photo_upload: "证件照",
  passport_photo: "护照规格证件照",
  portrait_photo: "个人证件照",
  travel_itinerary: "旅行行程",
  return_ticket: "返程或续程机票",
  passport_validity_support: "护照有效期支持材料",
  bank_statement: "资金证明",
  flight_booking: "机票预订",
  hotel_booking: "住宿预订",
};
const REQUIREMENT_LABEL_EN: Record<string, string> = {
  passport_copy: "Passport bio page",
  passport_bio_page: "Passport bio page",
  passport: "Passport bio page",
  photo: "Passport-size photo",
  applicant_photo: "Profile photo",
  profile_photo: "Profile photo",
  formal_photo: "Passport-size photo",
  formal_photo_upload: "Passport-size photo",
  passport_photo: "Passport-size photo",
  portrait_photo: "Profile photo",
  travel_itinerary: "Travel itinerary",
  return_ticket: "Return or onward ticket",
  passport_validity_support: "Passport validity support document",
  bank_statement: "Proof of funds",
  flight_booking: "Flight booking",
  hotel_booking: "Accommodation booking",
};
const REQUIREMENT_DESCRIPTION_ZH: Record<string, string> = {
  passport_copy: "护照资料页的清晰扫描件或照片。",
  passport_bio_page: "护照资料页的清晰扫描件或照片。",
  passport: "护照资料页的清晰扫描件或照片。",
  photo: "近期证件照，需符合目的地照片规范。",
  applicant_photo: "近期个人证件照，需符合目的地照片规范。",
  profile_photo: "近期个人证件照，需符合目的地照片规范。",
  formal_photo: "近期证件照，需符合目的地照片规范。",
  formal_photo_upload: "近期证件照，需符合目的地照片规范。",
  passport_photo: "近期护照规格证件照，需符合目的地照片规范。",
  portrait_photo: "近期个人证件照，需符合目的地照片规范。",
  travel_itinerary: "按天的行程安排，包含日期、城市与主要活动。",
  return_ticket: "官网要求提供返程机票或前往其他国家的续程机票，PDF 格式。",
  passport_validity_support:
    "官网支持材料：护照有效期至少 6 个月。若不是普通护照，旅行证件有效期需至少 12 个月。仅接受 PDF。",
  bank_statement: "近期银行对账单或等效资金证明。具体金额、时限及格式以所选目的地签证包的官方要求为准。",
  flight_booking: "如有，请提供机票预订或往返信息。",
  hotel_booking: "如有，请提供住宿预订或住宿确认。",
};
const REQUIREMENT_DESCRIPTION_EN: Record<string, string> = {
  passport_copy: "A clear scan or photo of the passport bio page.",
  passport_bio_page: "A clear scan or photo of the passport bio page.",
  passport: "A clear scan or photo of the passport bio page.",
  photo: "A recent passport-style photo that follows the destination rules.",
  applicant_photo: "A recent profile photo that follows the destination rules.",
  profile_photo: "A recent profile photo that follows the destination rules.",
  formal_photo: "A recent passport-style photo that follows the destination rules.",
  formal_photo_upload: "A recent passport-style photo that follows the destination rules.",
  passport_photo: "A recent passport-style photo that follows the destination rules.",
  portrait_photo: "A recent profile photo that follows the destination rules.",
  travel_itinerary:
    "A day-by-day itinerary with dates, cities, and main activities.",
  return_ticket:
    "Official requirement: return ticket or onward ticket to continue the journey to another country. PDF format.",
  passport_validity_support:
    "Official support document: passport valid for at least 6 months. Travel documents other than passports must be valid for at least 12 months. PDF format only.",
  bank_statement:
    "Recent bank statements or equivalent proof of funds. The required amount, period, and format depend on the selected destination package.",
  flight_booking:
    "If available, provide flight bookings or round-trip travel details.",
  hotel_booking:
    "If available, provide accommodation bookings or confirmations.",
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
  if (isIndonesiaB1OfficialPdfRequirement(requirement) || isIndonesiaC1OfficialPdfRequirement(requirement)) {
    return ".pdf,application/pdf";
  }
  if (requirement.accept.length > 0) return requirement.accept.join(",");
  if (requirement.documentType === "photo") return ".jpg,.jpeg,.png";
  return DEFAULT_ACCEPT;
}

function isIndonesiaB1OfficialPdfRequirement(requirement: DocumentRequirement): boolean {
  return [requirement.key, requirement.documentType].some((value) =>
    value === "return_ticket" || value === "passport_validity_support",
  );
}

function isIndonesiaC1OfficialPdfRequirement(requirement: DocumentRequirement): boolean {
  return requirement.key === "bank_statement" || requirement.documentType === "bank_statement";
}

function isPdfFile(file: File): boolean {
  return file.name.toLowerCase().endsWith(".pdf") && (!file.type || file.type === "application/pdf");
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

function isVietnamEVisaApplication(application: DocumentApplication | null): boolean {
  if (!application) return false;
  return (
    application.country.toLowerCase() === "vietnam" &&
    ["evisa_tourism", "vn_e_visa"].includes(application.visaType.toLowerCase())
  );
}

function isVietnamOfficialImageRequirement(requirement: DocumentRequirement): boolean {
  return requirement.documentType === "photo" || isPassportRequirement(requirement);
}

function formatUploadError(error: unknown, isZh: boolean): string {
  const message = error instanceof Error ? error.message : "";
  const normalized = message.toLowerCase();
  const userFixableUploadMessage =
    message.includes("上传的图片需要修改：") ||
    message.includes("证件照环节：") ||
    message.includes("护照资料页环节：") ||
    message.includes("越南 e-Visa 官网");

  if (userFixableUploadMessage) return message.trim();

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

function FormattedErrorText({ error }: { error: string }) {
  const lines = error
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) return <span>{error}</span>;

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

function isImageFilename(filename: string | null): boolean {
  return /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(filename ?? "");
}

function getDocumentStatus(
  requirement: DocumentRequirement,
  document: ApplicationDocument | null,
  isZh: boolean
): DocumentStatusView {
  if (!document) {
    return {
      label: documentUploadStatusLabel(
        requirement.required ? "missing" : "optional",
        isZh
      ),
      description: "",
      fieldStatus: requirement.required ? "missing" : "optional",
      ready: !requirement.required,
      needsUpload: true,
    };
  }

  if (isRejectedStatus(document.status)) {
    return {
      label: documentUploadStatusLabel("rejected", isZh),
      description:
        document.rejectionReason ??
        document.reviewNotes ??
        (isZh
          ? "材料不清晰或有误，请重新上传。"
          : "The document is unclear or incorrect. Please upload it again."),
      fieldStatus: "rejected",
      ready: false,
      needsUpload: true,
    };
  }

  if (document.status.toLowerCase() === "missing") {
    return {
      label: documentUploadStatusLabel("missing", isZh),
      description: isZh
        ? "已要求该材料，但暂无可用文件。"
        : "This document is required, but no file is available yet.",
      fieldStatus: "missing",
      ready: false,
      needsUpload: true,
    };
  }

  if (isAcceptedStatus(document.status)) {
    return {
      label: documentUploadStatusLabel("approved", isZh),
      description: isZh
        ? "材料已审核通过，可用于本次申请。"
        : "This document has been reviewed and can be used for this application.",
      fieldStatus: "approved",
      ready: true,
      needsUpload: false,
    };
  }

  return {
    label: documentUploadStatusLabel("in_review", isZh),
    description: isZh
      ? "已收到，等待审核。"
      : "Received and waiting for review.",
    fieldStatus: "in_review",
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

function RequirementRow({
  view,
  busy,
  onFile,
  isZh,
  locale,
  country,
  visaType,
}: {
  view: DocumentViewState;
  busy: boolean;
  onFile: (file: File) => void;
  isZh: boolean;
  locale: string;
  country: string;
  visaType: string;
}) {
  const { requirement, document, status } = view;
  const label = getRequirementLabel(requirement, isZh);
  const description = getRequirementDescription(requirement, isZh);

  const hasRejectedDocument = isRejectedStatus(document?.status ?? "");
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  const [guidanceConversation, setGuidanceConversation] = useState<
    FieldGuidanceChatMessage[]
  >([]);
  const guidanceField: VisaFormFieldRow = {
    id: `document-${requirement.key}`,
    visaType,
    fieldName: requirement.key,
    label,
    fieldType: "file",
    required: requirement.required,
    stepNumber: 0,
    stepName: isZh ? "支持材料" : "Supporting documents",
    displayOrder: requirement.sortOrder,
    placeholder: null,
    validationRules: description ? { description } : null,
    options: null,
    conditionalLogic: null,
  };
  const guidanceLabel = isZh ? "问 AI" : "Ask AI";

  return (
    <SupportingDocumentCard
      title={label}
      description={description}
      required={requirement.required}
      headerLayout="stacked"
      headerAside={
        <>
          <Popover open={guidanceOpen} onOpenChange={setGuidanceOpen}>
            <PopoverTrigger asChild>
              <AiAssistButton
                label={guidanceLabel}
                variant="field"
                className="opacity-0 focus-visible:opacity-100 group-hover/document-card:opacity-100 group-focus-within/document-card:opacity-100"
                data-copilot-trigger={`document-${requirement.key}`}
              />
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-[min(448px,calc(100vw-2rem))] border-0 bg-transparent p-0 shadow-none"
              sideOffset={10}
            >
              <div data-copilot-panel-frame={`document-${requirement.key}`}>
                <FieldGuidancePanel
                  country={country}
                  visaType={visaType}
                  locale={locale}
                  field={guidanceField}
                  answer={document?.filename ?? ""}
                  allAnswers={{ [requirement.key]: document?.filename ?? "" }}
                  initialConversation={guidanceConversation}
                  onConversationChange={setGuidanceConversation}
                  onClose={() => setGuidanceOpen(false)}
                />
              </div>
            </PopoverContent>
          </Popover>
        </>
      }
    >
      <DocumentUploadField
        status={busy ? "uploading" : status.fieldStatus}
        statusLabel={
          busy ? documentUploadStatusLabel("uploading", isZh) : status.label
        }
        file={
          document?.filename
            ? {
                name: document.filename,
                kind: isImageFilename(document.filename)
                  ? "image"
                  : "document",
              }
            : null
        }
        reason={hasRejectedDocument ? status.description : null}
        dropLabel={
          isZh ? "拖放文件到这里，或点击选择" : "Drop file or browse"
        }
        acceptHint={
          isZh
            ? "支持 PDF、JPG、PNG、WebP、DOC 和 DOCX"
            : "PDF, JPG, PNG, WebP, DOC or DOCX"
        }
        removeLabel={isZh ? "移除文件" : "Remove file"}
        accept={getRequirementAccept(requirement)}
        disabled={busy}
        inputAriaLabel={
          document
            ? isZh
              ? `替换${label}`
              : `Replace ${label}`
            : isZh
              ? `选择${label}`
              : `Choose ${label}`
        }
        onFileSelected={onFile}
      />
    </SupportingDocumentCard>
  );
}

function VietnamPhotoComparisonPanel({
  passportView,
  photoView,
  faceMatch,
  busy,
  onRun,
  isZh,
}: {
  passportView: DocumentViewState | null;
  photoView: DocumentViewState | null;
  faceMatch: FaceMatchActionResult | null;
  busy: boolean;
  onRun: () => void;
  isZh: boolean;
}) {
  const hasPassport = Boolean(passportView?.document);
  const hasPhoto = Boolean(photoView?.document);
  const scorePercent = typeof faceMatch?.score === "number"
    ? Math.round(faceMatch.score * 10000) / 100
    : null;
  const decisionLabel = faceMatch?.decision
    ? faceMatch.decision === "auto_approve"
      ? isZh ? "相似度通过" : "Match passed"
      : faceMatch.decision === "staff_review"
        ? isZh ? "需要人工复核" : "Staff review needed"
        : isZh ? "相似度过低" : "Match too low"
    : isZh ? "待检测" : "Not checked";
  const decisionClass = faceMatch?.decision === "auto_approve"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : faceMatch?.decision === "staff_review"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : faceMatch?.decision === "reject"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-border bg-muted/30 text-muted-foreground";
  const decisionIcon = faceMatch?.decision === "auto_approve"
    ? <CheckCircle2 className="h-4 w-4" />
    : faceMatch?.decision
      ? <AlertCircle className="h-4 w-4" />
      : <FileCheck2 className="h-4 w-4" />;

  return (
    <section aria-labelledby="vietnam-photo-comparison-title">
      <article className="rounded-xl border border-border bg-white p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium text-brand-500">
              {isZh ? "越南电子签证 · 照片要求" : "Vietnam e-Visa · Photo requirements"}
            </p>
            <h3
              id="vietnam-photo-comparison-title"
              className="mt-1 text-[15px] font-medium tracking-[-0.1px] text-[#3d3d3d]"
            >
              {isZh ? "证件照与护照人脸相似度" : "Portrait and passport face match"}
            </h3>
            <p className="mt-[5px] text-[13px] leading-[1.55] text-black/55">
              {isZh
                ? "上传两项材料后进行检测，结果将作为提交前材料证据。"
                : "Compare both uploads and save the result as pre-submission evidence."}
            </p>
          </div>
          <div
            className={cn(
              "inline-flex w-fit shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",
              decisionClass
            )}
          >
            {decisionIcon}
            <span>{decisionLabel}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              {scorePercent === null ? "--" : `${scorePercent}%`}
            </span>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-sm font-medium text-foreground">
            {isZh ? "上传要求" : "Upload requirements"}
          </p>
          <ul className="mt-2 grid gap-2 text-[13px] leading-[1.55] text-muted-foreground lg:grid-cols-3">
            <li>{isZh ? "JPG、JPEG 或 PNG 格式，单个文件小于 2MB。" : "JPG, JPEG or PNG; each file must be under 2MB."}</li>
            <li>{isZh ? "证件照需近期 4×6cm、正脸、白底且无遮挡。" : "Use a recent 4×6cm, front-facing photo on a white background."}</li>
            <li>{isZh ? "护照资料页需完整清晰，并能检测到人脸。" : "The passport bio page must be complete, clear and show a detectable face."}</li>
          </ul>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            {
              label: isZh ? "本人证件照" : "Portrait photo",
              ready: hasPhoto,
              readyText: isZh ? "已上传，可用于检测" : "Uploaded and ready",
              missingText: isZh ? "等待上传" : "Waiting for upload",
            },
            {
              label: isZh ? "护照资料页" : "Passport bio page",
              ready: hasPassport,
              readyText: isZh ? "已上传，可用于检测" : "Uploaded and ready",
              missingText: isZh ? "等待上传" : "Waiting for upload",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-3 rounded-lg border border-border px-4 py-3"
            >
              {item.ready ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {item.ready ? item.readyText : item.missingText}
                </p>
              </div>
            </div>
          ))}
        </div>

        {!faceMatch?.ok && faceMatch?.reason ? (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{faceMatch.reason}</p>
          </div>
        ) : null}

        <div className="mt-5 flex justify-end border-t border-border pt-4">
          <BrandActionButton
            type="button"
            variant="secondary"
            size="sm"
            onClick={onRun}
            disabled={!hasPassport || !hasPhoto}
            loading={busy}
            loadingText={isZh ? "正在检测…" : "Comparing…"}
          >
            <FileCheck2 />
            {isZh ? "生成相似度" : "Generate similarity"}
          </BrandActionButton>
        </div>
      </article>
    </section>
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
  const [faceMatch, setFaceMatch] = useState<FaceMatchActionResult | null>(null);
  const [continueAttempted, setContinueAttempted] = useState(false);

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
  /*
   * Packages with no optional materials render a single unlabelled panel: no
   * empty "0 items" section, and no "Required documents" heading either, since
   * with nothing to contrast against it labels the only thing on screen.
   */
  const hasOptionalSection = optionalViews.length > 0;
  const blockingViews = requiredViews.filter((view) => !view.status.ready);
  const travelView =
    documentViews.find(
      (view) => isTravelItineraryRequirement(view.requirement)
    ) ?? null;
  const isVietnamEVisa = isVietnamEVisaApplication(selectedApplication);
  const passportView =
    documentViews.find((view) => isPassportRequirement(view.requirement)) ?? null;
  const photoView =
    documentViews.find((view) => view.requirement.documentType === "photo") ?? null;

  function handleContinue() {
    if (blockingViews.length > 0) {
      setContinueAttempted(true);
      return;
    }

    onContinue?.();
  }

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
      if (UNIVERSAL_UPLOAD_DOCUMENT_TYPES.has(requirement.documentType)) {
        uploadForm.set("scope", "universal_profile");
      }
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
    file: File
  ) {
    if ((isIndonesiaB1OfficialPdfRequirement(requirement) || isIndonesiaC1OfficialPdfRequirement(requirement)) && !isPdfFile(file)) {
      setError(isZh
        ? "印尼官网要求该材料仅接受 PDF 文件。"
        : "This Indonesia official document must be uploaded as a PDF file.");
      return;
    }
    if (
      isVietnamEVisa &&
      isVietnamOfficialImageRequirement(requirement) &&
      file.size > 2 * 1024 * 1024
    ) {
      setError(isZh
        ? "越南 e-Visa 官网要求本人证件照和护照资料页图片小于 2MB，请压缩后重新上传。"
        : "Vietnam e-Visa requires the portrait and passport image files to be under 2MB. Please compress and upload again.");
      return;
    }
    await uploadFile(requirement, file);
  }

  async function handleRunFaceMatch() {
    if (!selectedApplication) return;
    setBusyTarget({ type: "face_match", key: selectedApplication.id });
    setError(null);
    try {
      const result = await runFaceMatch(selectedApplication.id);
      setFaceMatch(result);
      if (!result.ok) {
        setError(result.reason ?? (isZh ? "相似度检测失败。" : "Face match failed."));
      }
    } catch (faceError) {
      setError(
        faceError instanceof Error
          ? faceError.message
          : isZh
            ? "相似度检测失败。"
            : "Face match failed."
      );
    } finally {
      setBusyTarget(null);
    }
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

  const travelBusyKey = travelView ? getDocumentKey(travelView.requirement) : null;
  const travelBusy = Boolean(
    travelBusyKey &&
      busyTarget?.type === "travel" &&
      busyTarget.key === travelBusyKey
  );
  const documentMutationBusy =
    busyTarget !== null && busyTarget.type !== "refresh";

  return (
    <main
      className={cn(
        "space-y-6",
        embedded ? "pb-2" : "mx-auto max-w-7xl pb-16"
      )}
    >
      {!hideApplicationSelector && (
        <section>
          <ApplicationSelector
            applications={data.applications}
            selectedApplication={selectedApplication}
            isZh={isZh}
          />
        </section>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <FormattedErrorText error={error} />
          </div>
        </div>
      )}

      <div className="space-y-8">
        {isVietnamEVisa && (
          <VietnamPhotoComparisonPanel
            passportView={passportView}
            photoView={photoView}
            faceMatch={faceMatch}
            busy={busyTarget?.type === "face_match"}
            onRun={handleRunFaceMatch}
            isZh={isZh}
          />
        )}

        <section className="space-y-4">
          {/* The "Required documents" heading only earns its space when there is
              an optional section to tell it apart from. */}
          {hasOptionalSection ? (
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-medium text-foreground">
                {isZh ? "必需材料" : "Required documents"}
              </h3>
              <span className="text-xs text-muted-foreground">
                {requiredViews.length}{" "}
                {isZh ? "项" : requiredViews.length === 1 ? "item" : "items"}
              </span>
            </div>
          ) : null}
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
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
                  onFile={(file) => handleFileChange(view.requirement, file)}
                  isZh={isZh}
                  locale={locale}
                  country={selectedApplication.country}
                  visaType={selectedApplication.visaType}
                />
              );
            })}
          </div>
        </section>

        {hasOptionalSection ? (
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-medium text-foreground">
                {isZh ? "可选补充材料" : "Optional supporting documents"}
              </h3>
              <span className="text-xs text-muted-foreground">
                {optionalViews.length}{" "}
                {isZh ? "项" : optionalViews.length === 1 ? "item" : "items"}
              </span>
            </div>
            <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
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
                    onFile={(file) => handleFileChange(view.requirement, file)}
                    isZh={isZh}
                    locale={locale}
                    country={selectedApplication.country}
                    visaType={selectedApplication.visaType}
                  />
                );
              })}
            </div>
          </section>
        ) : null}
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
        <div className="space-y-3 border-t border-border pt-5">
          {continueAttempted && blockingViews.length > 0 ? (
            <div
              id="document-continue-requirements"
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="text-sm font-medium">
                  {isZh
                    ? `请先上传 ${blockingViews.length} 项必需材料，再继续。`
                    : `Upload ${blockingViews.length} required ${blockingViews.length === 1 ? "document" : "documents"} before continuing.`}
                </p>
                <p className="mt-1 text-xs text-amber-800">
                  {blockingViews
                    .map((view) => getRequirementLabel(view.requirement, isZh))
                    .join(isZh ? "、" : ", ")}
                </p>
              </div>
            </div>
          ) : null}
          <div className="flex justify-end">
            <BrandActionButton
              type="button"
              onClick={handleContinue}
              loading={documentMutationBusy}
              loadingText={isZh ? "正在处理材料…" : "Processing documents…"}
              aria-describedby={
                continueAttempted && blockingViews.length > 0
                  ? "document-continue-requirements"
                  : undefined
              }
            >
              {continueLabel ?? (isZh ? "继续" : "Continue")}
              <ArrowRight className="h-4 w-4" />
            </BrandActionButton>
          </div>
        </div>
      )}
    </main>
  );
}
