"use client";

import { useRef, useState } from "react";
import { CheckCircle2, FileText, Loader2, ScanLine, UploadCloud, XCircle } from "lucide-react";
import { useLocale } from "next-intl";
import {
  confirmPassportOcrExtraction,
  uploadApplicationDocument,
} from "@/app/client/documents/actions";
import { isChineseLocale } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";
import type { UniversalProfileSnapshot } from "@/lib/universal-profile-prefill";

type UploadStatus = "idle" | "uploading" | "ocr" | "done" | "error";

interface PassportOcrFieldProposal {
  value: string | null;
  confidence: number | null;
}

interface PassportOcrResponse {
  success: boolean;
  extractionId?: string | null;
  proposedFields?: {
    fullName: PassportOcrFieldProposal;
    passportNumber: PassportOcrFieldProposal;
    dateOfBirth: PassportOcrFieldProposal;
    nationality: PassportOcrFieldProposal;
    issuingCountry: PassportOcrFieldProposal;
    issueDate: PassportOcrFieldProposal;
    expiryDate: PassportOcrFieldProposal;
    gender: PassportOcrFieldProposal;
  };
  error?: {
    message?: string;
  };
}

export interface PassportOcrUploadProps {
  applicationId: string | null;
  className?: string;
  title?: string;
  description?: string;
  onFieldsApplied?: (fields: UniversalProfileSnapshot) => void;
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

  return {
    full_name: proposalValue(fields.fullName),
    date_of_birth: proposalValue(fields.dateOfBirth),
    gender: proposalValue(fields.gender),
    nationality: proposalValue(fields.nationality),
    passport_number: proposalValue(fields.passportNumber),
    passport_issue_date: proposalValue(fields.issueDate),
    passport_expiry_date: proposalValue(fields.expiryDate),
    passport_issuing_country: proposalValue(fields.issuingCountry),
  };
}

const CJK_TEXT_RE = /[\u3400-\u9fff]/;

const PASSPORT_OCR_COPY = {
  zh: {
    title: "上传护照资料页",
    description: "拖拽或点击上传护照个人信息页，VIZA OCR 会自动识别姓名、国籍、护照号码和签发信息。",
    noDraft: "正在准备申请草稿，请稍后再上传护照资料页。",
    uploading: "正在上传护照资料页...",
    notAuthenticated: "请先登录后再上传护照。",
    extracting: "正在识别护照字段...",
    ocrFallback: "护照 OCR 暂时无法读取这份文件，请换一张更清晰的护照资料页。",
    done: "已识别并填入护照信息，请核对后继续。",
    failed: "上传或识别失败，请稍后重试。",
    dropLabel: "拖拽文件到这里，或点击上传",
    formats: "PDF、JPG、PNG、WebP，建议四角清晰可见",
  },
  en: {
    title: "Upload passport bio page",
    description:
      "Drag or click to upload the passport personal-information page. VIZA OCR will extract name, nationality, passport number, and issuing details.",
    noDraft: "Your application draft is still being prepared. Please upload the passport bio page in a moment.",
    uploading: "Uploading passport bio page...",
    notAuthenticated: "Please sign in before uploading your passport.",
    extracting: "Reading passport fields...",
    ocrFallback: "Passport OCR could not read this file. Please upload a clearer passport bio page.",
    done: "Passport details were extracted and filled in. Please review them before continuing.",
    failed: "Upload or OCR failed. Please try again later.",
    dropLabel: "Drop file here, or click to upload",
    formats: "PDF, JPG, PNG, or WebP. Make sure all four corners are visible.",
  },
} as const;

function getResponseError(payload: PassportOcrResponse | null, fallbackMessage: string, isZh: boolean) {
  const message = payload?.error?.message?.trim();
  if (!message) return fallbackMessage;
  if (!isZh && CJK_TEXT_RE.test(message)) return fallbackMessage;
  return message;
}

export function PassportOcrUpload({
  applicationId,
  className,
  title,
  description,
  onFieldsApplied,
}: PassportOcrUploadProps) {
  const locale = useLocale();
  const isZh = isChineseLocale(locale);
  const copy = isZh ? PASSPORT_OCR_COPY.zh : PASSPORT_OCR_COPY.en;
  const resolvedTitle = title ?? copy.title;
  const resolvedDescription = description ?? copy.description;
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const busy = status === "uploading" || status === "ocr";

  const handleFile = async (file: File) => {
    if (!applicationId) {
      setStatus("error");
      setMessage(copy.noDraft);
      return;
    }

    setStatus("uploading");
    setFileName(file.name);
    setMessage(copy.uploading);

    try {
      const ext = extensionFromFile(file);
      const safeName = sanitizeFilename(file.name || `passport.${ext}`);
      const uploadForm = new FormData();
      uploadForm.set("applicationId", applicationId);
      uploadForm.set("documentType", "passport_copy");
      uploadForm.set("requirementKey", "passport_copy");
      uploadForm.set("filename", safeName);
      uploadForm.set("required", "true");
      uploadForm.set("file", file);
      const uploadResult = await uploadApplicationDocument(uploadForm);
      if (!uploadResult.ok) throw new Error(uploadResult.error);

      setStatus("ocr");
      setMessage(copy.extracting);

      const response = await fetch("/api/passport-ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, storagePath: uploadResult.storagePath }),
      });
      const payload = (await response.json().catch(() => null)) as PassportOcrResponse | null;
      if (!response.ok || !payload?.success) throw new Error(getResponseError(payload, copy.ocrFallback, isZh));

      const profileFields = buildProfileFields(payload);
      if (payload.extractionId) {
        const confirmResult = await confirmPassportOcrExtraction({
          applicationId,
          extractionId: payload.extractionId,
        });
        if (!confirmResult.ok) throw new Error(confirmResult.error);
      }

      onFieldsApplied?.(profileFields);
      setStatus("done");
      setMessage(copy.done);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : copy.failed);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  return (
    <section className={cn("rounded-xl border border-brand-100 bg-brand-50/60 p-4 sm:p-5", className)}>
      <div className="grid gap-4 lg:grid-cols-[1fr,280px] lg:items-center">
        <div className="flex items-start gap-3">
          <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-brand-500 shadow-sm">
            {status === "done" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            ) : status === "error" ? (
              <XCircle className="h-5 w-5 text-destructive" />
            ) : busy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <ScanLine className="h-5 w-5" />
            )}
          </span>
          <div className="min-w-0">
            <h3 className="font-heading text-[18px] font-medium text-brand-700">{resolvedTitle}</h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{resolvedDescription}</p>
            {fileName ? (
              <p className="mt-2 inline-flex max-w-full items-center gap-2 truncate text-xs font-medium text-brand-600">
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{fileName}</span>
              </p>
            ) : null}
            {message ? (
              <p
                className={cn(
                  "mt-2 text-sm",
                  status === "error" ? "text-destructive" : status === "done" ? "text-emerald-700" : "text-brand-600",
                )}
              >
                {message}
              </p>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          disabled={busy}
          className={cn(
            "flex min-h-[132px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-white px-4 py-5 text-center transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-70",
            isDragging ? "border-brand-500 bg-brand-50" : "border-brand-200 hover:border-brand-500 hover:bg-brand-50",
          )}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-500">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <UploadCloud className="h-5 w-5" />}
          </span>
          <span className="text-sm font-semibold text-foreground">{copy.dropLabel}</span>
          <span className="text-xs text-muted-foreground">{copy.formats}</span>
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
          event.target.value = "";
        }}
      />
    </section>
  );
}
