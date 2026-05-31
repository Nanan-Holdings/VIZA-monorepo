"use client";

import { useState, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  UploadCloud,
  CheckCircle2,
  Loader2,
  ScanLine,
  XCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

function getOcrErrorMessage(payload: unknown, isZh: boolean): string {
  if (!isRecord(payload)) {
    return isZh
      ? "护照 OCR 没有返回可读取的结果。"
      : "Passport OCR did not return a readable response.";
  }
  const error = payload.error;
  if (isRecord(error) && typeof error.message === "string")
    return error.message;
  if (typeof payload.message === "string") return payload.message;
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
  const inputRef = useRef<HTMLInputElement>(null);
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

  return (
    <Card
      className={`border-2 transition-colors ${
        status === "done"
          ? "border-green-400 bg-green-50"
          : status === "error"
            ? "border-red-300 bg-red-50"
            : "border-dashed border-border hover:border-brand-400"
      }`}
    >
      <CardContent className="p-4 flex items-center gap-4">
        <div className="shrink-0">
          {status === "uploading" && (
            <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
          )}
          {status === "done" && (
            <CheckCircle2 className="h-6 w-6 text-green-500" />
          )}
          {status === "error" && <XCircle className="h-6 w-6 text-red-500" />}
          {status === "idle" && (
            <UploadCloud className="h-6 w-6 text-muted-foreground" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {label}
          </p>
          {secondaryLabel && (
            <p className="text-xs font-medium text-[#03346E] truncate">
              {secondaryLabel}
            </p>
          )}
          {description && (
            <p className="text-xs text-muted-foreground truncate">
              {description}
            </p>
          )}
          {fileName && (
            <p className="text-xs text-muted-foreground truncate">{fileName}</p>
          )}
          {errorMsg && <p className="text-xs text-red-600">{errorMsg}</p>}
          {supportsPassportOcr && ocrMessage && (
            <p
              className={
                ocrStatus === "failed"
                  ? "text-xs text-amber-700"
                  : "text-xs text-brand-600"
              }
            >
              {ocrMessage}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          {supportsPassportOcr && storagePath && (
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
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={status === "uploading"}
            className="shrink-0"
          >
            {status === "done" ? t("replace") : t("upload")}
          </Button>
        </div>

        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </CardContent>
    </Card>
  );
}
