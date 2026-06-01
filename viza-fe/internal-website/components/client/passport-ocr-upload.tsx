"use client";

import { useRef, useState } from "react";
import {
  Ban,
  Camera,
  Check,
  CheckCircle2,
  FileImage,
  FileText,
  Loader2,
  ShieldCheck,
  Sun,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { useLocale } from "next-intl";
import { confirmPassportOcrExtraction } from "@/app/client/documents/actions";
import { uploadApplicationDocumentFromClient } from "@/lib/document-upload-client";
import { isChineseLocale } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";
import type { UniversalProfileSnapshot } from "@/lib/universal-profile-prefill";

type UploadStatus = "idle" | "uploading" | "ocr" | "verifying" | "done" | "error";
type ScanStage = "reading" | "extracting" | "verifying";

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
    code?: string;
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
    notAuthenticated: "请先登录后再上传护照。",
    extracting: "正在识别护照字段...",
    verifying: "正在核验识别结果...",
    ocrFallback: "护照 OCR 暂时无法读取这份文件，请换一张更清晰的护照资料页。",
    done: "已识别并填入护照信息，请核对后继续。",
    failed: "上传或识别失败，请稍后重试。",
    dropLabel: "拖拽文件到这里，或点击上传",
    formats: "PDF、JPG、PNG、WebP，建议四角清晰可见",
    stepEyebrow: "第 1 步 / 共 3 步",
    uploadFile: "上传文件",
    takePhoto: "拍照",
    dropTitle: "将护照照片拖到这里",
    dropSubtitle: "或点击选择文件，文件会加密传输",
    chooseFile: "选择文件",
    formatsLimit: "最大 10 MB",
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
  },
  en: {
    title: "Upload passport bio page",
    description:
      "Drag or click to upload the passport personal-information page. VIZA OCR will extract name, nationality, passport number, and issuing details.",
    noDraft: "Your application draft is still being prepared. Please upload the passport bio page in a moment.",
    uploading: "Uploading passport bio page...",
    notAuthenticated: "Please sign in before uploading your passport.",
    extracting: "Reading passport fields...",
    verifying: "Verifying extracted details...",
    ocrFallback: "Passport OCR could not read this file. Please upload a clearer passport bio page.",
    done: "Passport details were extracted and filled in. Please review them before continuing.",
    failed: "Upload or OCR failed. Please try again later.",
    dropLabel: "Drop file here, or click to upload",
    formats: "PDF, JPG, PNG, or WebP. Make sure all four corners are visible.",
    stepEyebrow: "Step 1 of 3",
    uploadFile: "Upload file",
    takePhoto: "Take a photo",
    dropTitle: "Drop your passport photo here",
    dropSubtitle: "Or click to browse. Your file is encrypted in transit.",
    chooseFile: "Choose file",
    formatsLimit: "Up to 10 MB",
    readingDocument: "Reading document",
    extractingDetails: "Extracting your details",
    verifyingAuthenticity: "Verifying authenticity",
    privacy: "Your scan is encrypted in transit and used only for extraction.",
    tipCornersTitle: "All four corners visible",
    tipCornersBody: "Frame the entire bio page including the bottom MRZ.",
    tipLightTitle: "Bright, even lighting",
    tipLightBody: "Avoid shadows from your hand or phone case.",
    tipGlareTitle: "No glare or reflections",
    tipGlareBody: "Tilt slightly if your seal is reflecting.",
  },
} as const;

function getResponseError(payload: PassportOcrResponse | null, fallbackMessage: string, isZh: boolean) {
  const message = payload?.error?.message?.trim();
  const code = payload?.error?.code;
  if (isZh) {
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
  if (status === "verifying") return "verifying";
  return "extracting";
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
      <span className="absolute left-0 right-0 top-1/2 h-0.5 bg-gradient-to-r from-transparent via-sky-300 to-transparent opacity-90 shadow-[0_0_12px_rgba(125,211,252,0.9)] motion-safe:animate-pulse" />
    </div>
  );
}

function ScanProgressPanel({
  stage,
  copy,
}: {
  stage: ScanStage;
  copy: typeof PASSPORT_OCR_COPY.en | typeof PASSPORT_OCR_COPY.zh;
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
                  <Check className="h-5 w-5" strokeWidth={3} />
                ) : active ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                ) : (
                  <Check className="h-5 w-5" strokeWidth={3} />
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
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const busy = status === "uploading" || status === "ocr" || status === "verifying";

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
      const uploadResult = await uploadApplicationDocumentFromClient(uploadForm);
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
      setStatus("verifying");
      setMessage(copy.verifying);
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
    <section className={cn("rounded-xl border bg-white p-5 shadow-sm sm:p-8", className)}>
      <header className="mb-7">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-brand-500">
          {copy.stepEyebrow}
        </div>
        <h3 className="font-heading text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
          {resolvedTitle}
        </h3>
        <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">{resolvedDescription}</p>
        {fileName ? (
          <p className="mt-3 inline-flex max-w-full items-center gap-2 truncate text-xs font-medium text-brand-600">
            <FileText className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{fileName}</span>
          </p>
        ) : null}
        {message ? (
          <p
            className={cn(
              "mt-3 inline-flex items-center gap-2 text-sm",
              status === "error" ? "text-destructive" : status === "done" ? "text-emerald-700" : "text-brand-600",
            )}
          >
            {status === "done" ? <CheckCircle2 className="h-4 w-4" /> : null}
            {status === "error" ? <XCircle className="h-4 w-4" /> : null}
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            <span>{message}</span>
          </p>
        ) : null}
      </header>

      {busy ? (
        <ScanProgressPanel stage={stageFromStatus(status)} copy={copy} />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="inline-flex w-fit rounded-full bg-muted p-1">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex h-9 items-center gap-2 rounded-full bg-white px-4 text-sm font-medium text-brand-500 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <UploadCloud className="h-4 w-4" />
              {copy.uploadFile}
            </button>
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-brand-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <Camera className="h-4 w-4" />
              {copy.takePhoto}
            </button>
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
            className={cn(
              "flex min-h-[240px] flex-col items-center justify-center rounded-xl border-2 border-dashed bg-gradient-to-b from-slate-50 to-slate-100 px-6 py-10 text-center transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              isDragging ? "border-brand-500 from-brand-50 to-brand-100" : "border-slate-300 hover:border-brand-500 hover:from-brand-50 hover:to-brand-100",
            )}
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full border border-border bg-white text-brand-500 shadow-sm">
              <FileImage className="h-7 w-7" />
            </span>
            <span className="mt-5 text-lg font-medium text-foreground">{copy.dropTitle}</span>
            <span className="mt-2 text-sm text-muted-foreground">{copy.dropSubtitle}</span>
            <span className="mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-brand-500 px-5 text-sm font-medium text-white">
              <UploadCloud className="h-4 w-4" />
              {copy.chooseFile}
            </span>
            <span className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
              <span className="rounded border bg-white px-2 py-1 font-medium">JPG</span>
              <span className="rounded border bg-white px-2 py-1 font-medium">PNG</span>
              <span className="rounded border bg-white px-2 py-1 font-medium">WebP</span>
              <span className="rounded border bg-white px-2 py-1 font-medium">PDF</span>
              <span>{copy.formatsLimit}</span>
            </span>
          </button>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="flex items-start gap-3 rounded-xl border bg-white p-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
                <CheckCircle2 className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">{copy.tipCornersTitle}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{copy.tipCornersBody}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border bg-white p-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <Sun className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">{copy.tipLightTitle}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{copy.tipLightBody}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border bg-white p-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
                <Ban className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">{copy.tipGlareTitle}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{copy.tipGlareBody}</p>
              </div>
            </div>
          </div>

          <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-brand-500" />
            {copy.privacy}
          </p>
        </div>
      )}

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
      <input
        ref={cameraInputRef}
        type="file"
        className="hidden"
        accept="image/*"
        capture="environment"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
          event.target.value = "";
        }}
      />
    </section>
  );
}
