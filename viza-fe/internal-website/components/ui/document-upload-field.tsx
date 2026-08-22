"use client";

import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import { FileText, ImageIcon, CircleNotch as Loader2, Trash as Trash2, CloudArrowUp as UploadCloud } from "@phosphor-icons/react";

import { ActionButton } from "@/components/ui/action-button";
import { cn } from "@/lib/utils";

const DocumentPdfPreview = dynamic(
  () =>
    import("@/components/ui/document-pdf-preview").then(
      (module) => module.DocumentPdfPreview
    ),
  { ssr: false }
);

/**
 * Canonical upload field for every supporting-document surface.
 *
 * Renders the drop field, the uploaded-file preview, the status footer and the
 * rejection reason exactly as specified by the published design system card
 * `preview/components-document-upload.html`. Slot it into
 * `SupportingDocumentCard`, which supplies the card chrome, title and
 * description.
 */

/**
 * The canonical document lifecycle. Every upload surface must map its own
 * internal state onto one of these — do not invent per-surface statuses or
 * colours, or the same document ends up green on one screen and blue on
 * another.
 *
 * | Status      | Tone    | Means                                             |
 * |-------------|---------|---------------------------------------------------|
 * | `missing`   | neutral | Required, nothing uploaded yet                    |
 * | `optional`  | neutral | Not required, nothing uploaded yet                |
 * | `uploading` | neutral | Transfer in flight                                |
 * | `in_review` | brand   | File held, awaiting VIZA review — the normal      |
 * |             |         | resting state right after any successful upload   |
 * | `attached`  | green   | Reused from the applicant's saved profile         |
 * | `approved`  | green   | Reviewed and accepted by VIZA                     |
 * | `rejected`  | red     | Refused, needs replacing — always pass a `reason` |
 *
 * Green is reserved for "someone has signed this off" — a VIZA reviewer, or
 * the applicant's own previously-saved profile document. A file the applicant
 * just uploaded is `in_review`, never `approved`, no matter what client-side
 * processing (OCR, face match) succeeded on it.
 */
export type DocumentUploadStatus =
  | "missing"
  | "optional"
  | "uploading"
  | "in_review"
  | "attached"
  | "approved"
  | "rejected";

/** Visual tone driving the status dot, status text and preview border. */
type StatusTone = "neutral" | "brand" | "success" | "danger";

const STATUS_TONE: Record<DocumentUploadStatus, StatusTone> = {
  missing: "neutral",
  optional: "neutral",
  uploading: "neutral",
  in_review: "brand",
  attached: "success",
  approved: "success",
  rejected: "danger",
};

const STATUS_LABEL: Record<DocumentUploadStatus, { en: string; zh: string }> = {
  missing: { en: "Missing", zh: "缺失" },
  optional: { en: "Not uploaded", zh: "未上传" },
  uploading: { en: "Uploading…", zh: "正在上传…" },
  in_review: { en: "Uploaded", zh: "已上传" },
  attached: { en: "Attached from saved profile", zh: "已从通用资料附加" },
  approved: { en: "Approved", zh: "已通过" },
  rejected: { en: "Rejected", zh: "已拒绝" },
};

/**
 * Canonical copy for a status. Use this instead of hand-writing labels so the
 * same tone always carries the same words.
 */
export function documentUploadStatusLabel(
  status: DocumentUploadStatus,
  isZh: boolean
): string {
  return isZh ? STATUS_LABEL[status].zh : STATUS_LABEL[status].en;
}

const TONE_TEXT: Record<StatusTone, string> = {
  neutral: "text-black/55",
  brand: "text-brand-500",
  success: "text-[#16A34A]",
  danger: "text-[#EF4444]",
};

const TONE_DOT: Record<StatusTone, string> = {
  neutral: "bg-[#989898]",
  brand: "bg-brand-500",
  success: "bg-[#16A34A]",
  danger: "bg-[#EF4444]",
};

export interface DocumentUploadFieldFile {
  /** Display name. When omitted, it is detected from `source` or `previewUrl`. */
  name?: string;
  /**
   * The selected local file/blob. The field owns and revokes the object URL it
   * creates for this source.
   */
  source?: Blob | null;
  /** MIME type used for preview detection when `source.type` is unavailable. */
  mimeType?: string | null;
  /** Backward-compatible fallback when neither MIME type nor extension helps. */
  kind?: "image" | "document";
  /** Existing object URL or remote URL rendered inside the preview sheet. */
  previewUrl?: string | null;
  /** Right-aligned meta in the file bar, e.g. "640 KB". */
  meta?: ReactNode;
}

export interface DocumentUploadFieldProps {
  status: DocumentUploadStatus;
  /** Status footer copy. */
  statusLabel: ReactNode;
  /** Right-aligned status meta, e.g. "2 days ago" or a file size. */
  statusMeta?: ReactNode;
  /** Present once a file is attached — switches the field to preview mode. */
  file?: DocumentUploadFieldFile | null;
  /** Rejection reason, rendered in red beneath the status row. */
  reason?: ReactNode;
  /** Primary drop-field label, e.g. "Drop file or browse". */
  dropLabel: ReactNode;
  /** Secondary drop-field hint, e.g. "PDF, JPG or PNG · max 10 MB". */
  acceptHint?: ReactNode;
  /**
   * Optional secondary action rendered as a button inside the drop field,
   * e.g. "Select from Travel AI".
   */
  action?: { label: ReactNode; onClick: () => void };
  /** Accessible label for the destructive remove control in the file bar. */
  removeLabel: string;
  /**
   * Invoked by the remove (bin) control. When omitted the control re-opens the
   * file picker so the attached file can be replaced.
   */
  onRemove?: () => void;
  accept?: string;
  disabled?: boolean;
  inputAriaLabel?: string;
  className?: string;
  onFileSelected: (file: File) => void;
}

type DocumentPreviewKind = "image" | "pdf" | "text" | "document";

const IMAGE_FILE_EXTENSION = /\.(?:avif|bmp|gif|heic|heif|jpe?g|png|svg|tiff?|webp)$/i;
const PDF_FILE_EXTENSION = /\.pdf$/i;
const TEXT_FILE_EXTENSION = /\.(?:csv|json|md|rtf|txt|xml)$/i;

function normalizedFileName(value: string | undefined): string {
  return (value ?? "").trim().split(/[?#]/, 1)[0];
}

function nameFromPreviewUrl(previewUrl: string | null | undefined): string {
  if (!previewUrl || previewUrl.startsWith("blob:")) return "";

  try {
    const pathname = new URL(previewUrl, "http://document-preview.local").pathname;
    return decodeURIComponent(pathname.split("/").filter(Boolean).at(-1) ?? "");
  } catch {
    return "";
  }
}

function nameFromSource(source: Blob | null | undefined): string {
  if (!source || !("name" in source)) return "";
  return typeof source.name === "string" ? source.name.trim() : "";
}

export function detectDocumentPreviewKind({
  name,
  mimeType,
  kind,
}: Pick<DocumentUploadFieldFile, "name" | "mimeType" | "kind">): DocumentPreviewKind {
  const normalizedMime = (mimeType ?? "").toLowerCase().split(";", 1)[0].trim();
  const normalizedName = normalizedFileName(name).toLowerCase();

  if (normalizedMime.startsWith("image/")) return "image";
  if (normalizedMime === "application/pdf") return "pdf";
  if (
    normalizedMime.startsWith("text/") ||
    normalizedMime === "application/json" ||
    normalizedMime === "application/xml"
  ) {
    return "text";
  }

  // Extension inference is useful when browsers provide an empty or generic
  // MIME type, but a specific MIME type wins when the two disagree.
  if (!normalizedMime || normalizedMime === "application/octet-stream") {
    if (IMAGE_FILE_EXTENSION.test(normalizedName)) return "image";
    if (PDF_FILE_EXTENSION.test(normalizedName)) return "pdf";
    if (TEXT_FILE_EXTENSION.test(normalizedName)) return "text";
  }
  return kind === "image" ? "image" : "document";
}

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(size >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

function useObjectUrl(source: Blob | null | undefined): string | null {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!source) {
      setObjectUrl(null);
      return;
    }

    const nextObjectUrl = URL.createObjectURL(source);
    setObjectUrl(nextObjectUrl);
    return () => URL.revokeObjectURL(nextObjectUrl);
  }, [source]);

  return objectUrl;
}

function PagePlaceholder({ kind }: { kind: "image" | "document" }) {
  if (kind === "image") {
    return (
      <div className="flex h-28 w-[86px] items-center justify-center rounded-[3px] border border-[#e5e7eb] bg-white">
        <ImageIcon className="h-10 w-10 text-[#d4d6da]" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="flex h-28 w-[86px] flex-col gap-[5px] rounded-[3px] border border-[#e5e7eb] bg-white px-[9px] py-[10px]">
      <span className="block h-[9px] w-[70%] rounded-[2px] bg-[#dfe1e4]" />
      <span className="block h-1 rounded-[2px] bg-[#e9eaec]" />
      <span className="block h-1 rounded-[2px] bg-[#e9eaec]" />
      <span className="block h-1 w-[60%] rounded-[2px] bg-[#e9eaec]" />
      <span className="block h-1 rounded-[2px] bg-[#e9eaec]" />
      <span className="block h-1 w-[60%] rounded-[2px] bg-[#e9eaec]" />
      <span className="block h-1 rounded-[2px] bg-[#e9eaec]" />
    </div>
  );
}

function FilePreview({
  name,
  kind,
  previewUrl,
}: {
  name: string;
  kind: DocumentPreviewKind;
  previewUrl: string | null;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const failed = Boolean(previewUrl && failedUrl === previewUrl);

  if (!previewUrl || failed) {
    return <PagePlaceholder kind={kind === "image" ? "image" : "document"} />;
  }

  if (kind === "image") {
    return (
      <img
        src={previewUrl}
        alt={`Preview of ${name}`}
        className="h-full max-h-[124px] w-full rounded-[3px] object-contain"
        onError={() => setFailedUrl(previewUrl)}
      />
    );
  }

  if (kind === "pdf") {
    return (
      <DocumentPdfPreview
        name={name}
        previewUrl={previewUrl}
        onError={() => setFailedUrl(previewUrl)}
      />
    );
  }

  if (kind === "text") {
    return (
      <iframe
        src={previewUrl}
        title={`Preview of ${name}`}
        sandbox=""
        className="h-[124px] w-full rounded-[3px] border border-[#e5e7eb] bg-white"
        onError={() => setFailedUrl(previewUrl)}
      />
    );
  }

  return <PagePlaceholder kind="document" />;
}

export function DocumentUploadField({
  status,
  statusLabel,
  statusMeta,
  file,
  reason,
  dropLabel,
  acceptHint,
  action,
  removeLabel,
  onRemove,
  accept,
  disabled = false,
  inputAriaLabel,
  className,
  onFileSelected,
}: DocumentUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const tone = STATUS_TONE[status];
  const busy = status === "uploading";
  const interactive = !disabled && !busy;
  // Keep the most recently selected browser File so existing consumers that
  // only persist `{ name }` after upload still receive a real local preview.
  const previewSource = file?.source ?? (file ? selectedFile : null);
  const sourceObjectUrl = useObjectUrl(previewSource);
  const previewUrl = file?.previewUrl ?? sourceObjectUrl;
  const detectedName =
    file?.name?.trim() || nameFromSource(previewSource) || nameFromPreviewUrl(previewUrl);
  const displayName = detectedName || "Uploaded document";
  const mimeType = file?.mimeType?.trim() || previewSource?.type || "";
  const previewKind = detectDocumentPreviewKind({
    name: displayName,
    mimeType,
    kind: file?.kind,
  });
  const iconKind = previewKind === "image" ? "image" : "document";
  const fileMeta = file?.meta ?? (previewSource ? formatFileSize(previewSource.size) : null);

  const selectFile = (selected: File) => {
    setSelectedFile(selected);
    onFileSelected(selected);
  };

  const openPicker = () => {
    if (!interactive) return;
    inputRef.current?.click();
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (!interactive) return;
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) selectFile(dropped);
  };

  const dragHandlers = {
    onDragEnter: (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      if (interactive) setIsDragging(true);
    },
    onDragOver: (event: DragEvent<HTMLElement>) => event.preventDefault(),
    onDragLeave: () => setIsDragging(false),
    onDrop: handleDrop,
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPicker();
    }
  };

  return (
    <div className={cn("flex flex-col gap-3.5", className)}>
      {file ? (
        <div
          className={cn(
            "flex h-[190px] flex-col overflow-hidden rounded-[10px] border",
            tone === "danger" ? "border-[#EF4444]" : "border-[#e5e7eb]"
          )}
          {...dragHandlers}
        >
          <div
            role="button"
            tabIndex={interactive ? 0 : -1}
            aria-label={inputAriaLabel}
            onClick={openPicker}
            onKeyDown={handleKeyDown}
            className={cn(
              "flex flex-1 items-center justify-center bg-[#f6f6f6] p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-100",
              interactive ? "cursor-pointer hover:bg-[#f0f0f0]" : "cursor-default"
            )}
          >
            <FilePreview
              name={displayName}
              kind={previewKind}
              previewUrl={previewUrl}
            />
          </div>
          <div className="flex items-center gap-2 border-t border-[#e5e7eb] bg-white px-3 py-2.5">
            {iconKind === "image" ? (
              <ImageIcon
                className="h-[15px] w-[15px] shrink-0 text-[#71717a]"
                aria-hidden="true"
              />
            ) : (
              <FileText
                className="h-[15px] w-[15px] shrink-0 text-[#71717a]"
                aria-hidden="true"
              />
            )}
            <span className="min-w-0 flex-1 truncate text-[12.5px] text-[#3d3d3d]">
              {displayName}
            </span>
            {fileMeta ? (
              <span className="shrink-0 text-xs text-black/40">{fileMeta}</span>
            ) : null}
            <button
              type="button"
              onClick={
                onRemove
                  ? () => {
                      setSelectedFile(null);
                      onRemove();
                    }
                  : openPicker
              }
              disabled={!interactive}
              aria-label={removeLabel}
              title={removeLabel}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#EF4444] transition-colors hover:text-[#DC2626] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={interactive ? 0 : -1}
          aria-label={inputAriaLabel}
          aria-disabled={!interactive}
          onClick={openPicker}
          onKeyDown={handleKeyDown}
          {...dragHandlers}
          className={cn(
            "flex h-[190px] flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed bg-white p-5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-100",
            interactive ? "cursor-pointer" : "cursor-not-allowed opacity-60",
            isDragging
              ? "border-brand-500 bg-brand-50"
              : "border-[#d9dde3] hover:border-[#c3c9d2] hover:bg-[#fbfbfb]"
          )}
        >
          {busy ? (
            <Loader2
              className="h-[26px] w-[26px] animate-spin text-brand-500"
              aria-hidden="true"
            />
          ) : (
            <UploadCloud
              className="h-[26px] w-[26px] text-[#989898]"
              aria-hidden="true"
            />
          )}
          <span className="text-[13.5px] font-medium text-[#3d3d3d]">
            {dropLabel}
          </span>
          {acceptHint ? (
            <span className="text-xs text-black/45">{acceptHint}</span>
          ) : null}
          {action ? (
            <ActionButton
              size="sm"
              variant="secondary"
              disabled={!interactive}
              onClick={(event) => {
                event.stopPropagation();
                action.onClick();
              }}
              className="mt-1.5 bg-white"
            >
              {action.label}
            </ActionButton>
          ) : null}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <div
          className={cn(
            "flex items-center gap-2 text-[12.5px] font-medium",
            TONE_TEXT[tone]
          )}
        >
          <span
            className={cn("h-1.5 w-1.5 shrink-0 rounded-full", TONE_DOT[tone])}
            aria-hidden="true"
          />
          {statusLabel}
          {statusMeta ? (
            <span className="ml-auto shrink-0 font-normal text-black/40">
              {statusMeta}
            </span>
          ) : null}
        </div>

        {reason ? (
          <p className="text-[12.5px] leading-[1.5] text-[#EF4444]">{reason}</p>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept}
        disabled={!interactive}
        aria-label={inputAriaLabel}
        onChange={(event) => {
          const selected = event.target.files?.[0];
          event.target.value = "";
          if (selected) selectFile(selected);
        }}
      />
    </div>
  );
}
