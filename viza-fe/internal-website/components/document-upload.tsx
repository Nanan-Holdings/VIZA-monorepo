"use client";

import { useCallback, useId, useRef, useState } from "react";
import { Camera, Loader2, RefreshCcw, Upload, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadApplicationDocument } from "@/app/client/documents/actions";
import { cn } from "@/lib/utils";

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
const DEFAULT_MIN_DIMENSION = 480;

interface DocumentUploadProps {
  applicationId: string;
  /** application_documents.document_type value, e.g. 'passport_scan'. */
  kind: string;
  label: string;
  helperText?: string;
  accept?: string;
  /** Force a min-side pixel sanity check (images only). 0 disables. */
  minDimension?: number;
  /** Max bytes. Default 10MB. */
  maxBytes?: number;
  /** Allow rear-camera capture on mobile. */
  cameraCapture?: boolean;
  onUploaded?: (info: { storagePath: string; filename: string }) => void;
}

interface UploadState {
  status: "idle" | "validating" | "uploading" | "succeeded" | "failed";
  progress: number;
  error?: string;
  uploadedFilename?: string;
}

async function getImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  if (!file.type.startsWith("image/")) return null;
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

export function DocumentUpload({
  applicationId,
  kind,
  label,
  helperText,
  accept = DEFAULT_ACCEPT,
  minDimension = DEFAULT_MIN_DIMENSION,
  maxBytes = DEFAULT_MAX_BYTES,
  cameraCapture = false,
  onUploaded,
}: DocumentUploadProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [state, setState] = useState<UploadState>({ status: "idle", progress: 0 });

  const validateFile = useCallback(
    async (file: File): Promise<string | null> => {
      if (file.size > maxBytes) {
        return `File is ${(file.size / 1024 / 1024).toFixed(1)}MB; max ${(maxBytes / 1024 / 1024).toFixed(0)}MB.`;
      }
      const acceptedTypes = accept.split(",").map((s) => s.trim());
      const typeOk = acceptedTypes.some((m) => file.type === m || (m.endsWith("/*") && file.type.startsWith(m.slice(0, -1))));
      if (!typeOk) return `Unsupported file type "${file.type || "unknown"}".`;
      if (minDimension > 0 && file.type.startsWith("image/")) {
        const dims = await getImageDimensions(file);
        if (dims && (dims.width < minDimension || dims.height < minDimension)) {
          return `Image is ${dims.width}×${dims.height}px; need at least ${minDimension}px on the shorter side.`;
        }
      }
      return null;
    },
    [accept, maxBytes, minDimension],
  );

  const uploadOnce = useCallback(
    async (file: File): Promise<{ ok: true; storagePath: string } | { ok: false; retry: boolean; message: string }> => {
      const uploadForm = new FormData();
      uploadForm.set("applicationId", applicationId);
      uploadForm.set("documentType", kind);
      uploadForm.set("requirementKey", kind);
      uploadForm.set("filename", file.name);
      uploadForm.set("required", "true");
      uploadForm.set("file", file);
      const uploadResult = await uploadApplicationDocument(uploadForm);
      if (!uploadResult.ok) {
        const retry = /network|timeout|fetch|temporar|502|503|504/i.test(uploadResult.error);
        return { ok: false, retry, message: uploadResult.error };
      }

      return { ok: true, storagePath: uploadResult.storagePath };
    },
    [applicationId, kind],
  );

  const handleFile = useCallback(
    async (file: File) => {
      setState({ status: "validating", progress: 5 });
      const validationError = await validateFile(file);
      if (validationError) {
        setState({ status: "failed", progress: 0, error: validationError });
        return;
      }

      setState({ status: "uploading", progress: 30 });
      let attempt = 0;
      let lastMessage = "";
      while (attempt < 3) {
        attempt += 1;
        const res = await uploadOnce(file);
        if (res.ok) {
          setState({ status: "succeeded", progress: 100, uploadedFilename: file.name });
          onUploaded?.({ storagePath: res.storagePath, filename: file.name });
          return;
        }
        lastMessage = res.message;
        if (!res.retry) break;
        await new Promise((r) => setTimeout(r, 600 * attempt));
        setState({ status: "uploading", progress: 30 + attempt * 20 });
      }
      setState({ status: "failed", progress: 0, error: lastMessage || "Upload failed." });
    },
    [onUploaded, uploadOnce, validateFile],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;
    void handleFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const handleRetry = (): void => {
    setState({ status: "idle", progress: 0 });
    inputRef.current?.click();
  };

  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {helperText ? <p className="text-xs text-muted-foreground">{helperText}</p> : null}
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-input bg-white px-6 py-8 text-center text-sm text-muted-foreground transition",
          dragActive ? "border-brand-500 bg-brand-50" : "hover:border-brand-300 hover:bg-brand-50/40",
          state.status === "failed" ? "border-destructive/50" : "",
          state.status === "succeeded" ? "border-brand-500/60 bg-brand-50/60" : "",
        )}
      >
        {state.status === "succeeded" ? (
          <>
            <CheckCircle2 className="h-6 w-6 text-brand-500" />
            <p className="text-foreground">Uploaded {state.uploadedFilename}</p>
          </>
        ) : state.status === "uploading" || state.status === "validating" ? (
          <>
            <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
            <p>Uploading…</p>
            <div className="h-1 w-40 overflow-hidden rounded-full bg-brand-50">
              <div className="h-full bg-brand-500 transition-all" style={{ width: `${state.progress}%` }} />
            </div>
          </>
        ) : state.status === "failed" ? (
          <>
            <X className="h-6 w-6 text-destructive" />
            <p className="text-destructive">{state.error}</p>
            <Button type="button" variant="outline" size="sm" onClick={handleRetry}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </>
        ) : (
          <>
            <Upload className="h-6 w-6 text-brand-500" />
            <p>
              Drag &amp; drop, or <span className="font-medium text-brand-500">click to browse</span>
            </p>
            {cameraCapture ? (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Camera className="h-3.5 w-3.5" /> Camera capture supported on mobile
              </span>
            ) : null}
          </>
        )}
      </div>
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept={accept}
        capture={cameraCapture ? "environment" : undefined}
        onChange={handleInputChange}
        className="sr-only"
      />
    </div>
  );
}
