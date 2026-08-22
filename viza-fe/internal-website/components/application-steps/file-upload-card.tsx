"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CircleNotch as Loader2, Scan as ScanLine } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  DocumentUploadField,
  type DocumentUploadStatus,
} from "@/components/ui/document-upload-field";
import { SupportingDocumentCard } from "@/components/ui/supporting-document-card";
import { isChineseLocale } from "@/lib/i18n/locale";
import { uploadApplicationDocumentFromClient } from "@/lib/document-upload-client";

export type DocumentType =
  | "passport_copy"
  | "photo"
  | "flight_booking"
  | "hotel_booking"
  | "travel_itinerary"
  | "bank_statement";

export interface FileUploadCardProps {
  applicationId: string;
  documentType: DocumentType;
  label: string;
  secondaryLabel?: string;
  description?: string;
  required?: boolean;
  onComplete?: (storagePath: string) => void;
}

type OcrStatus = "idle" | "running" | "succeeded" | "failed";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const OCR_ERROR_COPY_ZH: Record<string, string> = {
  provider_unavailable: "护照 OCR 服务暂时不可用，请稍后重试。",
  provider_failed: "护照 OCR 暂时无法处理这份文件，请稍后重试或换一份更清晰的护照资料页。",
  unreadable: "这份护照资料页暂时无法读取，请换一张更清晰的资料页。",
  unsupported_file: "护照 OCR 支持 PDF、JPG、PNG 和 WebP 文件。",
  missing_file: "未找到已上传的护照文件，请重新上传。",
  unauthorized: "请先登录后再上传护照。",
};

function containsCjk(value: string): boolean {
  return /[\u3400-\u9fff]/.test(value);
}

function getOcrErrorMessage(payload: unknown, isZh: boolean): string {
  if (!isRecord(payload)) {
    return isZh
      ? "护照 OCR 没有返回可读取的结果。"
      : "Passport OCR did not return a readable response.";
  }
  const error = payload.error;
  if (isRecord(error)) {
    if (isZh && typeof error.code === "string" && OCR_ERROR_COPY_ZH[error.code]) {
      return OCR_ERROR_COPY_ZH[error.code];
    }
    if (typeof error.message === "string") {
      if (isZh && !containsCjk(error.message)) return "护照 OCR 无法处理这次上传。";
      return error.message;
    }
  }
  if (typeof payload.message === "string") {
    if (isZh && !containsCjk(payload.message)) return "护照 OCR 无法处理这次上传。";
    return payload.message;
  }
  return isZh
    ? "护照 OCR 无法处理这次上传。"
    : "Passport OCR could not process this upload.";
}

function isPassportUpload(documentType: DocumentType): boolean {
  return documentType === "passport_copy";
}

export function FileUploadCard({
  applicationId,
  documentType,
  label,
  secondaryLabel,
  description,
  required = true,
  onComplete,
}: FileUploadCardProps) {
  const t = useTranslations("applicationSteps");
  const locale = useLocale();
  const isZh = isChineseLocale(locale);
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">(
    "idle"
  );
  const [fileName, setFileName] = useState<string | null>(null);
  const [storagePath, setStoragePath] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [ocrStatus, setOcrStatus] = useState<OcrStatus>("idle");
  const [ocrMessage, setOcrMessage] = useState<string | null>(null);
  const supportsPassportOcr = isPassportUpload(documentType);

  const runPassportOcr = async (path: string) => {
    if (!supportsPassportOcr) return;

    setOcrStatus("running");
    setOcrMessage(isZh ? "正在读取护照字段..." : "Reading passport fields...");

    try {
      const response = await fetch("/api/passport-ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, storagePath: path }),
      });
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok || !isRecord(payload) || payload.success !== true) {
        throw new Error(getOcrErrorMessage(payload, isZh));
      }

      setOcrStatus("succeeded");
      setOcrMessage(
        isZh
          ? "护照 OCR 已完成。请在表单的材料步骤确认建议字段。"
          : "Passport OCR completed. Confirm the proposed fields in the form documents step."
      );
    } catch (ocrError) {
      setOcrStatus("failed");
      setOcrMessage(
        ocrError instanceof Error
          ? isZh
            ? `已上传。OCR 未完成：${ocrError.message}`
            : `Uploaded. OCR did not complete: ${ocrError.message}`
          : isZh
            ? "已上传。OCR 未完成。"
            : "Uploaded. OCR did not complete."
      );
    }
  };

  const handleFile = async (file: File) => {
    setStatus("uploading");
    setErrorMsg(null);
    setOcrStatus("idle");
    setOcrMessage(null);
    try {
      const uploadForm = new FormData();
      uploadForm.set("applicationId", applicationId);
      uploadForm.set("documentType", documentType);
      uploadForm.set("requirementKey", documentType);
      uploadForm.set("filename", file.name);
      uploadForm.set("required", String(required));
      uploadForm.set("file", file);
      const uploadResult = await uploadApplicationDocumentFromClient(uploadForm);
      if (!uploadResult.ok) throw new Error(uploadResult.error);

      setFileName(uploadResult.filename);
      setStoragePath(uploadResult.storagePath);
      setStatus("done");
      onComplete?.(uploadResult.storagePath);

      if (supportsPassportOcr) {
        await runPassportOcr(uploadResult.storagePath);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t("uploadFailed"));
      setStatus("error");
    }
  };

  const fieldStatus: DocumentUploadStatus =
    status === "uploading"
      ? "uploading"
      : status === "error"
        ? "rejected"
        : status === "done"
          ? "approved"
          : required
            ? "missing"
            : "optional";

  const statusLabel =
    status === "uploading"
      ? isZh
        ? "正在上传…"
        : "Uploading…"
      : status === "error"
        ? isZh
          ? "上传失败"
          : "Upload failed"
        : status === "done"
          ? isZh
            ? "已上传"
            : "Uploaded"
          : required
            ? isZh
              ? "缺失"
              : "Missing"
            : isZh
              ? "未上传"
              : "Not uploaded";

  return (
    <SupportingDocumentCard
      title={label}
      description={description}
      required={required}
      headerLayout="stacked"
      headerAside={
        supportsPassportOcr && storagePath ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => runPassportOcr(storagePath)}
            disabled={ocrStatus === "running" || status === "uploading"}
            className="shrink-0"
          >
            {ocrStatus === "running" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ScanLine className="h-4 w-4" />
            )}
            OCR
          </Button>
        ) : undefined
      }
      note={
        secondaryLabel || (supportsPassportOcr && ocrMessage && ocrStatus !== "failed") ? (
          <>
            {secondaryLabel ? (
              <p className="truncate text-xs font-medium text-brand-500">
                {secondaryLabel}
              </p>
            ) : null}
            {supportsPassportOcr && ocrMessage && ocrStatus !== "failed" ? (
              <p className="text-xs text-brand-600">{ocrMessage}</p>
            ) : null}
          </>
        ) : null
      }
    >
      <DocumentUploadField
        status={fieldStatus}
        statusLabel={statusLabel}
        file={fileName ? { name: fileName, kind: "document" } : null}
        reason={
          errorMsg ??
          (supportsPassportOcr && ocrMessage && ocrStatus === "failed"
            ? ocrMessage
            : null)
        }
        dropLabel={isZh ? "拖放文件到这里，或点击选择" : "Drop file or browse"}
        acceptHint={
          isZh ? "PDF、JPG、PNG 或 WebP" : "PDF, JPG, PNG or WebP"
        }
        removeLabel={isZh ? "移除文件" : "Remove file"}
        accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
        disabled={status === "uploading"}
        inputAriaLabel={label}
        onFileSelected={(file) => void handleFile(file)}
      />
    </SupportingDocumentCard>
  );
}
