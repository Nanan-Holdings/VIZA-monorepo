"use client";

import { useEffect, useState } from "react";
import { Check } from "@phosphor-icons/react";
import { useLocale } from "next-intl";
import { confirmPassportOcrExtraction } from "@/app/client/documents/actions";
import { SmoothProgressBar } from "@/components/smooth-progress";
import {
  DocumentUploadField,
  documentUploadStatusLabel,
  type DocumentUploadStatus,
} from "@/components/ui/document-upload-field";
import { SupportingDocumentCard } from "@/components/ui/supporting-document-card";
import { useSmoothProgress } from "@/hooks/use-smooth-progress";
import { normalizeBirthplace } from "@/lib/birthplace-options";
import { uploadApplicationDocumentFromClient } from "@/lib/document-upload-client";
import { isChineseLocale } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";
import type { UniversalProfileSnapshot } from "@/lib/universal-profile-prefill";

type UploadStatus = "idle" | "uploading" | "uploaded" | "ocr" | "verifying" | "done" | "needs_review" | "error";
type ScanStage = "reading" | "extracting" | "verifying";

interface PassportOcrFieldProposal {
  value: string | null;
  confidence: number | null;
}

interface PassportOcrResponse {
  success: boolean;
  extractionId?: string | null;
  documentKind?: "passport" | "national_identity_card";
  proposedFields?: {
    fullName: PassportOcrFieldProposal;
    nativeFullName?: PassportOcrFieldProposal;
    givenNames: PassportOcrFieldProposal;
    surname: PassportOcrFieldProposal;
    passportNumber: PassportOcrFieldProposal;
    identityDocumentNumber?: PassportOcrFieldProposal;
    dateOfBirth: PassportOcrFieldProposal;
    placeOfBirth?: PassportOcrFieldProposal;
    nationality: PassportOcrFieldProposal;
    issuingCountry: PassportOcrFieldProposal;
    issueDate: PassportOcrFieldProposal;
    expiryDate: PassportOcrFieldProposal;
    gender: PassportOcrFieldProposal;
  };
  error?: {
    code?: string;
    message?: string;
  };
}

export interface PassportOcrUploadProps {
  applicationId: string | null;
  className?: string;
  initialFileName?: string | null;
  initialUploaded?: boolean;
  country?: string | null;
  visaType?: string | null;
  documentScope?: "application" | "universal_profile";
  documentType?: string;
  requirementKey?: string;
  title?: string;
  description?: string;
  presentation?: "standard" | "supporting-card";
  onFieldsApplied?: (fields: UniversalProfileSnapshot, appliedFieldNames?: string[]) => void;
  onUploaded?: (fileName: string) => void;
}

function proposalValue(field: PassportOcrFieldProposal | undefined): string | null {
  const value = field?.value?.trim();
  return value ? value : null;
}

function sanitizeFilename(filename: string) {
  return filename.replace(/[^\w.-]+/g, "_");
}

function extensionFromFile(file: File) {
  const nameExtension = file.name.split(".").pop()?.toLowerCase();
  if (nameExtension) return nameExtension;
  if (file.type === "application/pdf") return "pdf";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

function buildProfileFields(payload: PassportOcrResponse): UniversalProfileSnapshot {
  const fields = payload.proposedFields;
  if (!fields) return {};
  const givenNames = proposalValue(fields.givenNames);
  const surname = proposalValue(fields.surname);
  const fullName = [givenNames, surname].filter(Boolean).join(" ") || proposalValue(fields.fullName);
  const nativeFullName = proposalValue(fields.nativeFullName);
  const compactNativeFullName = nativeFullName?.replace(/\s+/g, "") ?? "";
  const nativeSurname = /^[\u3400-\u9fff]{2,}$/.test(compactNativeFullName) ? compactNativeFullName.slice(0, 1) : null;
  const nativeGivenNames = /^[\u3400-\u9fff]{2,}$/.test(compactNativeFullName) ? compactNativeFullName.slice(1) : null;
  const placeOfBirthValue = proposalValue(fields.placeOfBirth);
  const normalizedBirthplace = normalizeBirthplace({
    placeOfBirth: placeOfBirthValue,
    country: placeOfBirthValue ? proposalValue(fields.nationality) : null,
    nationality: placeOfBirthValue ? proposalValue(fields.nationality) : null,
  });

  const isIdentityCard = payload.documentKind === "national_identity_card";
  return {
    full_name: fullName ?? nativeFullName,
    full_name_zh: nativeFullName,
    full_name_en: fullName,
    surname: surname ?? nativeSurname,
    surname_zh: nativeSurname,
    surname_en: surname,
    given_names: givenNames ?? nativeGivenNames,
    given_names_zh: nativeGivenNames,
    given_names_en: givenNames,
    date_of_birth: proposalValue(fields.dateOfBirth),
    place_of_birth: placeOfBirthValue ? normalizedBirthplace.placeOfBirthEn || placeOfBirthValue : null,
    place_of_birth_zh: normalizedBirthplace.placeOfBirthZh,
    place_of_birth_en: normalizedBirthplace.placeOfBirthEn,
    birth_country: normalizedBirthplace.country?.en ?? null,
    birth_province_or_state: normalizedBirthplace.province.en || normalizedBirthplace.province.zh,
    birth_province_or_state_zh: normalizedBirthplace.province.zh,
    birth_province_or_state_en: normalizedBirthplace.province.en,
    birth_city: normalizedBirthplace.city.en || normalizedBirthplace.city.zh,
    birth_city_zh: normalizedBirthplace.city.zh,
    birth_city_en: normalizedBirthplace.city.en,
    gender: proposalValue(fields.gender),
    nationality: proposalValue(fields.nationality),
    passport_number: isIdentityCard ? null : proposalValue(fields.passportNumber),
    passport_issue_date: isIdentityCard ? null : proposalValue(fields.issueDate),
    passport_expiry_date: isIdentityCard ? null : proposalValue(fields.expiryDate),
    passport_issuing_country: isIdentityCard ? null : proposalValue(fields.issuingCountry),
    national_identity_number: isIdentityCard ? proposalValue(fields.identityDocumentNumber) : null,
  };
}

const CJK_TEXT_RE = /[\u3400-\u9fff]/;

const OCR_ERROR_COPY = {
  zh: {
    provider_unavailable: "护照 OCR 服务暂时不可用，请稍后重试。",
    provider_failed: "护照 OCR 暂时无法处理这份文件，请稍后重试或换一份更清晰的护照资料页。",
    unreadable: "这份护照资料页暂时无法读取，请换一张更清晰的资料页。",
    unsupported_file: "护照 OCR 支持 PDF、JPG、PNG 和 WebP 文件。",
    missing_file: "未找到已上传的护照文件，请重新上传。",
    unauthorized: "请先登录后再上传护照。",
  },
} as const;

const PASSPORT_OCR_COPY = {
  zh: {
    title: "上传护照资料页",
    description: "拖拽或点击上传护照个人信息页，VIZA OCR 会自动识别姓名、国籍、护照号码和签发信息。",
    noDraft: "正在准备申请草稿，请稍后再上传护照资料页。",
    uploading: "正在上传护照资料页...",
    uploaded: "护照资料页已上传并保存，正在准备 OCR 识别。",
    notAuthenticated: "请先登录后再上传护照。",
    extracting: "正在识别护照字段...",
    verifying: "正在核验识别结果...",
    ocrFallback: "护照 OCR 暂时无法读取这份文件，请换一张更清晰的护照资料页。",
    ocrNeedsReview: "护照资料页已保存，但 OCR 暂时无法读取。你可以稍后重试 OCR，或直接手动填写资料。",
    done: "护照页已上传成功，已识别并填入护照信息，请核对后继续。",
    failed: "上传或识别失败，请稍后重试。",
    dropLabel: "拖拽文件到这里，或点击上传",
    formats: "PDF、JPG、PNG、WebP，建议四角清晰可见",
    uploadFile: "上传文件",
    takePhoto: "拍照",
    dropTitle: "将护照照片拖到这里",
    dropSubtitle: "拖拽或点击上传",
    chooseFile: "选择文件",
    formatsLimit: "最大 10 MB",
    replaceFile: "重新上传",
    replacePhoto: "重新拍照",
    uploadedFromProfile: "已从通用资料读取护照信息，请核对后继续。",
    readingDocument: "正在读取文件",
    extractingDetails: "正在提取您的信息",
    verifyingAuthenticity: "正在验证真实性",
    privacy: "扫描件经加密传输，仅用于识别。",
    tipCornersTitle: "四个角都清晰可见",
    tipCornersBody: "请完整拍入资料页，包括底部机读区。",
    tipLightTitle: "光线明亮均匀",
    tipLightBody: "避免手或手机壳造成阴影。",
    tipGlareTitle: "避免反光",
    tipGlareBody: "如果防伪膜反光，请稍微调整拍摄角度。",
    statusFailed: "上传失败",
    replace: "替换",
  },
  en: {
    title: "Upload passport bio page",
    description:
      "Drag or click to upload the passport personal-information page. VIZA OCR will extract name, nationality, passport number, and issuing details.",
    noDraft: "Your application draft is still being prepared. Please upload the passport bio page in a moment.",
    uploading: "Uploading passport bio page...",
    uploaded: "Passport bio page uploaded and saved. Preparing OCR extraction.",
    notAuthenticated: "Please sign in before uploading your passport.",
    extracting: "Reading passport fields...",
    verifying: "Verifying extracted details...",
    ocrFallback: "Passport OCR could not read this file. Please upload a clearer passport bio page.",
    ocrNeedsReview: "Passport bio page is saved, but OCR could not read it yet. You can retry OCR later or fill the details manually.",
    done: "Passport details filled. Review the fields below.",
    failed: "Upload or OCR failed. Please try again later.",
    dropLabel: "Drop file here, or click to upload",
    formats: "PDF, JPG, PNG, or WebP. Make sure all four corners are visible.",
    uploadFile: "Upload file",
    takePhoto: "Take a photo",
    dropTitle: "Passport bio page",
    dropSubtitle: "Drop or click to upload",
    chooseFile: "Choose file",
    formatsLimit: "Up to 10 MB",
    replaceFile: "Replace file",
    replacePhoto: "Retake photo",
    uploadedFromProfile: "Passport information was loaded from your universal profile. Please review it before continuing.",
    readingDocument: "Reading document",
    extractingDetails: "Extracting your details",
    verifyingAuthenticity: "Verifying authenticity",
    privacy: "Your scan is encrypted in transit and used only for extraction.",
    statusFailed: "Upload failed",
    replace: "Replace",
  },
} as const;

const GENERIC_UPLOAD_BADGES = ["JPG", "PNG", "WebP", "PDF"] as const;
const VIETNAM_OFFICIAL_IMAGE_BADGES = ["JPG/JPEG", "PNG", "WebP"] as const;
const GENERIC_UPLOAD_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp";
const VIETNAM_OFFICIAL_IMAGE_ACCEPT = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";

function isVietnamOfficialImageContext(country?: string | null, visaType?: string | null): boolean {
  const normalizedCountry = (country ?? "").trim().toLowerCase();
  const normalizedVisaType = (visaType ?? "").trim().toLowerCase();
  return (
    normalizedCountry === "vietnam" ||
    normalizedCountry === "vn" ||
    normalizedVisaType === "vn_e_visa" ||
    normalizedVisaType === "evisa_tourism"
  );
}

function getResponseError(
  payload: PassportOcrResponse | null,
  fallbackMessage: string,
  isZh: boolean,
  documentKind: "passport" | "national_identity_card",
) {
  const message = payload?.error?.message?.trim();
  const code = payload?.error?.code;
  if (isZh) {
    if (documentKind === "national_identity_card") {
      const identityCopy: Record<string, string> = {
        provider_unavailable: "身份证件 OCR 服务暂时不可用，请稍后重试。",
        provider_failed: "身份证件 OCR 暂时无法处理这份文件，请稍后重试或换一张更清晰的身份证件图片。",
        unreadable: "这份身份证件暂时无法读取，请换一张更清晰的图片。",
        unsupported_file: "身份证件 OCR 支持 PDF、JPG、PNG 和 WebP 文件。",
        missing_file: "未找到已上传的身份证件文件，请重新上传。",
        unauthorized: "请先登录后再上传身份证件。",
      };
      if (code && identityCopy[code]) return identityCopy[code];
    }
    if (code && code in OCR_ERROR_COPY.zh) {
      return OCR_ERROR_COPY.zh[code as keyof typeof OCR_ERROR_COPY.zh];
    }
    if (message && CJK_TEXT_RE.test(message)) return message;
    return fallbackMessage;
  }
  if (!message) return fallbackMessage;
  if (CJK_TEXT_RE.test(message)) return fallbackMessage;
  return message;
}

const SCAN_STAGES: ScanStage[] = ["reading", "extracting", "verifying"];

function stageFromStatus(status: UploadStatus): ScanStage {
  if (status === "uploading") return "reading";
  if (status === "verifying" || status === "done") return "verifying";
  return "extracting";
}

function progressFromStatus(status: UploadStatus): number {
  if (status === "uploading") return 24;
  if (status === "uploaded") return 36;
  if (status === "ocr") return 72;
  if (status === "verifying") return 92;
  if (status === "done") return 100;
  return 0;
}

function ScanDocumentPreview() {
  return (
    <div className="relative h-[116px] w-[180px] shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-[#1a2849] to-[#0d1729] shadow-[0_4px_8px_rgba(3,52,110,0.10),0_18px_28px_-14px_rgba(3,52,110,0.32)]">
      <div className="absolute inset-[10px] rounded-lg bg-gradient-to-br from-[#4172b8] to-[#1e3a6b] p-3">
        <span className="mb-1 block h-1 w-4/5 rounded-full bg-white/40" />
        <span className="mb-1 block h-1 w-3/5 rounded-full bg-white/40" />
        <span className="mb-3 block h-1 w-[70%] rounded-full bg-white/40" />
        <span className="mb-1 block h-1 w-[45%] rounded-full bg-white/40" />
        <span className="block h-1 w-3/4 rounded-full bg-white/40" />
        <span className="absolute right-5 top-5 h-[30px] w-6 rounded bg-white/20" />
      </div>
      <span className="absolute left-0 right-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-sky-300 to-transparent opacity-90 shadow-[0_0_12px_rgba(125,211,252,0.9)] motion-safe:animate-passport-scan motion-reduce:top-1/2" />
    </div>
  );
}

function ScanProgressPanel({
  stage,
  copy,
  displayedProgress,
}: {
  stage: ScanStage;
  copy: typeof PASSPORT_OCR_COPY.en | typeof PASSPORT_OCR_COPY.zh;
  displayedProgress: number;
}) {
  const activeIndex = SCAN_STAGES.indexOf(stage);
  const labels: Record<ScanStage, string> = {
    reading: copy.readingDocument,
    extracting: copy.extractingDetails,
    verifying: copy.verifyingAuthenticity,
  };

  return (
    <div className="grid gap-8 rounded-xl border border-brand-100 bg-gradient-to-br from-brand-50/60 to-brand-100/70 p-6 sm:grid-cols-[180px,1fr] sm:items-center">
      <ScanDocumentPreview />
      <div className="flex min-w-0 flex-col gap-3">
        <SmoothProgressBar
          displayedProgress={displayedProgress}
          label={labels[stage]}
          ariaLabel={labels[stage]}
          size="md"
          transitionMs={760}
          trackClassName="bg-white/70"
        />
        {SCAN_STAGES.map((item, index) => {
          const done = activeIndex > index;
          const active = activeIndex === index;

          return (
            <div key={item} className="flex items-center gap-4">
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors",
                  done && "bg-brand-500 text-white",
                  active && "bg-brand-100 text-brand-500",
                  !done && !active && "bg-slate-200 text-transparent",
                )}
              >
                {done ? (
                  <Check className="size-5" weight="bold" />
                ) : active ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                ) : (
                  <Check className="size-5" weight="bold" />
                )}
              </span>
              <span
                className={cn(
                  "text-base font-medium sm:text-lg",
                  active || done ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {labels[item]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PassportOcrUpload({
  applicationId,
  className,
  initialFileName,
  initialUploaded = false,
  country = null,
  visaType = null,
  documentScope = "application",
  documentType = "passport_copy",
  requirementKey = documentType,
  title,
  description,
  presentation = "standard",
  onFieldsApplied,
  onUploaded,
}: PassportOcrUploadProps) {
  const locale = useLocale();
  const isZh = isChineseLocale(locale);
  const copy = isZh ? PASSPORT_OCR_COPY.zh : PASSPORT_OCR_COPY.en;
  const requestedDocumentKind = ["national_identity_card", "identity_card", "id_card"].includes(documentType)
    ? "national_identity_card"
    : "passport";
  const resolvedTitle = title ?? copy.title;
  const useVietnamOfficialImageRules = isVietnamOfficialImageContext(country, visaType);
  const uploadBadges = useVietnamOfficialImageRules ? VIETNAM_OFFICIAL_IMAGE_BADGES : GENERIC_UPLOAD_BADGES;
  const uploadLimitLabel = useVietnamOfficialImageRules
    ? isZh
      ? "最大 2 MB"
      : "Up to 2 MB"
    : copy.formatsLimit;
  const uploadAccept = useVietnamOfficialImageRules ? VIETNAM_OFFICIAL_IMAGE_ACCEPT : GENERIC_UPLOAD_ACCEPT;
  const [status, setStatus] = useState<UploadStatus>(initialUploaded ? "uploaded" : "idle");
  const [fileName, setFileName] = useState<string | null>(initialUploaded ? initialFileName ?? null : null);
  const [message, setMessage] = useState<string | null>(
    null,
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewKind, setPreviewKind] = useState<"image" | "document" | null>(initialUploaded ? "document" : null);

  const busy = status === "uploading" || status === "ocr" || status === "verifying";
  const supportingCardPresentation = presentation === "supporting-card";
  const {
    displayedProgress,
    isVisuallyComplete,
  } = useSmoothProgress({
    serverProgress: progressFromStatus(status),
    status:
      status === "done"
        ? "completed"
        : status === "error"
          ? "failed"
          : status === "needs_review"
            ? "needs_user_action"
            : busy || status === "uploaded"
              ? "running"
              : "waiting_for_user",
    intervalMs: 100,
  });

  useEffect(() => {
    if (!initialUploaded) return;
    setStatus((current) => (
      current === "idle" || current === "error" ? "uploaded" : current
    ));
    setFileName(initialFileName ?? null);
    setPreviewKind("document");
  }, [initialFileName, initialUploaded]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFile = async (file: File) => {
    if (!applicationId) {
      setStatus("error");
      setMessage(copy.noDraft);
      return;
    }

    setStatus("uploading");
    setFileName(file.name);
    setMessage(copy.uploading);
    setPreviewKind(file.type.startsWith("image/") ? "image" : "document");
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
    });
    let uploadCompleted = false;

    try {
      const ext = extensionFromFile(file);
      const safeName = sanitizeFilename(file.name || `passport.${ext}`);
      const uploadForm = new FormData();
      uploadForm.set("applicationId", applicationId);
      uploadForm.set("scope", documentScope);
      uploadForm.set("documentType", documentType);
      uploadForm.set("requirementKey", requirementKey);
      uploadForm.set("filename", safeName);
      uploadForm.set("required", "true");
      uploadForm.set("file", file);
      const uploadResult = await uploadApplicationDocumentFromClient(uploadForm);
      if (!uploadResult.ok) throw new Error(uploadResult.error);

      uploadCompleted = true;
      onUploaded?.(file.name);
      setStatus("uploaded");
      setMessage(copy.uploaded);

      setStatus("ocr");
      setMessage(copy.extracting);

      const response = await fetch("/api/passport-ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, storagePath: uploadResult.storagePath }),
      });
      const payload = (await response.json().catch(() => null)) as PassportOcrResponse | null;
      if (!response.ok || !payload?.success) {
        throw new Error(getResponseError(payload, copy.ocrFallback, isZh, requestedDocumentKind));
      }

      const profileFields = buildProfileFields(payload);
      setStatus("verifying");
      setMessage(copy.verifying);
      let appliedFieldNames: string[] | undefined;
      if (payload.extractionId) {
        const confirmResult = await confirmPassportOcrExtraction({
          applicationId,
          extractionId: payload.extractionId,
          saveToUniversalProfile: documentScope === "universal_profile",
        });
        if (!confirmResult.ok) throw new Error(confirmResult.error);
        appliedFieldNames = confirmResult.appliedFieldNames;
      }

      onFieldsApplied?.(profileFields, appliedFieldNames);
      setStatus("done");
      setMessage(copy.done);
    } catch (error) {
      if (uploadCompleted) {
        setStatus("needs_review");
        const detail = error instanceof Error ? error.message : copy.ocrFallback;
        const needsReviewCopy = requestedDocumentKind === "national_identity_card"
          ? isZh
            ? "身份证件已保存，但 OCR 暂时无法读取。你可以稍后重试，或直接手动填写资料。"
            : "Identity card saved, but OCR could not read it yet. Retry later or fill the details manually."
          : copy.ocrNeedsReview;
        setMessage(detail && detail !== copy.ocrFallback ? `${needsReviewCopy} ${detail}` : needsReviewCopy);
        return;
      }
      setStatus("error");
      setMessage(error instanceof Error ? error.message : copy.failed);
    }
  };

  const hasFile = status === "done" || status === "uploaded" || status === "needs_review";
  /*
   * A passport the applicant just uploaded is `in_review` regardless of whether
   * OCR succeeded — client-side extraction is not a VIZA sign-off, so it must
   * not turn the status green. See `DocumentUploadStatus` for the lifecycle.
   */
  const fieldStatus: DocumentUploadStatus = hasFile
    ? "in_review"
    : status === "error"
      ? "rejected"
      : "missing";
  const statusLabel = hasFile
    ? documentUploadStatusLabel("in_review", isZh)
    : status === "error"
      ? copy.statusFailed
      : documentUploadStatusLabel("missing", isZh);

  const field = (
    <DocumentUploadField
      status={fieldStatus}
      statusLabel={statusLabel}
      file={
        hasFile
          ? {
              name: fileName ?? resolvedTitle,
              kind: previewKind === "image" ? "image" : "document",
              previewUrl: previewKind === "image" ? previewUrl : null,
            }
          : null
      }
      reason={
        message && (status === "needs_review" || status === "error") ? message : null
      }
      dropLabel={copy.dropLabel}
      acceptHint={`${uploadBadges.join(", ")} · ${uploadLimitLabel}`}
      removeLabel={copy.replace}
      accept={uploadAccept}
      disabled={!applicationId}
      inputAriaLabel={resolvedTitle}
      onFileSelected={(file) => void handleFile(file)}
    />
  );

  const scanning = busy || (status === "done" && !isVisuallyComplete);

  if (supportingCardPresentation) {
    return (
      <section className={cn("flex flex-1 flex-col bg-white", className)}>
        {scanning ? (
          <ScanProgressPanel
            stage={stageFromStatus(status)}
            copy={copy}
            displayedProgress={displayedProgress}
          />
        ) : (
          field
        )}
      </section>
    );
  }

  return (
    <SupportingDocumentCard
      title={resolvedTitle}
      description={description ?? copy.description}
      required
      headerLayout="stacked"
      className={className}
    >
      {scanning ? (
        <ScanProgressPanel
          stage={stageFromStatus(status)}
          copy={copy}
          displayedProgress={displayedProgress}
        />
      ) : (
        field
      )}
    </SupportingDocumentCard>
  );
}
