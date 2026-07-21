"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Camera, CheckCircle2, ChevronLeft, ChevronRight, FileSignature, Loader2, UploadCloud } from "lucide-react";
import { useLocale } from "next-intl";
import { PassportOcrUpload } from "@/components/client/passport-ocr-upload";
import { Button } from "@/components/ui/button";
import { uploadApplicationDocumentFromClient } from "@/lib/document-upload-client";
import { isChineseLocale } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";
import type { UniversalProfileSnapshot } from "@/lib/universal-profile-prefill";

export interface ReusableDocumentState {
  uploaded: boolean;
  fileName: string | null;
  status: string | null;
  updatedAt: string | null;
}

interface UniversalProfileDocumentsCarouselProps {
  applicationId: string | null;
  passport: ReusableDocumentState;
  photo: ReusableDocumentState;
  signature: ReusableDocumentState;
  onPassportFieldsApplied: (fields: UniversalProfileSnapshot) => void;
  onDocumentUploaded: (type: "passport" | "photo" | "signature", fileName: string) => void;
}

type PageKey = "passport" | "signature" | "photo";

interface CompactUploadProps {
  applicationId: string | null;
  documentType: "electronic_signature" | "photo";
  initialState: ReusableDocumentState;
  accept: string;
  icon: ReactNode;
  title: string;
  description: string;
  securityNote: string;
  uploadLabel: string;
  replaceLabel: string;
  preparingLabel: string;
  uploadingLabel: string;
  uploadedLabel: string;
  uploadFailedLabel: string;
  onUploaded: (fileName: string) => void;
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^\w.-]+/g, "_");
}

function CompactProfileUpload({
  applicationId,
  documentType,
  initialState,
  accept,
  icon,
  title,
  description,
  securityNote,
  uploadLabel,
  replaceLabel,
  preparingLabel,
  uploadingLabel,
  uploadedLabel,
  uploadFailedLabel,
  onUploaded,
}: CompactUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState(initialState);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setState(initialState), [initialState]);

  async function upload(file: File) {
    if (!applicationId) return;
    setUploading(true);
    setError(null);
    try {
      const filename = sanitizeFilename(file.name || `${documentType}.png`);
      const formData = new FormData();
      formData.set("applicationId", applicationId);
      formData.set("scope", "universal_profile");
      formData.set("documentType", documentType);
      formData.set("requirementKey", documentType);
      formData.set("filename", filename);
      formData.set("required", "false");
      formData.set("file", file);
      const result = await uploadApplicationDocumentFromClient(formData);
      if (!result.ok) throw new Error(result.error);
      const nextState = {
        uploaded: true,
        fileName: result.filename,
        status: "uploaded",
        updatedAt: new Date().toISOString(),
      };
      setState(nextState);
      onUploaded(result.filename);
    } catch (caughtError) {
      console.error(`Failed to upload reusable ${documentType}`, caughtError);
      setError(uploadFailedLabel);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-500">
          {icon}
        </span>
        <div>
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>

      <div
        className={cn(
          "flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between",
          state.uploaded ? "border-emerald-200 bg-emerald-50" : "border-dashed border-input bg-muted/30",
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          {state.uploaded ? (
            <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />
          ) : (
            <UploadCloud className="h-6 w-6 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0">
            <p className={cn("text-sm font-medium", state.uploaded ? "text-emerald-800" : "text-foreground")}>
              {state.uploaded ? uploadedLabel : uploadLabel}
            </p>
            {state.fileName && <p className="truncate text-xs text-muted-foreground">{state.fileName}</p>}
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="shrink-0 bg-white"
          disabled={!applicationId || uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
          {!applicationId ? preparingLabel : uploading ? uploadingLabel : state.uploaded ? replaceLabel : uploadLabel}
        </Button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={accept}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void upload(file);
          }}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <p className="text-xs leading-5 text-muted-foreground">{securityNote}</p>
    </div>
  );
}

export function UniversalProfileDocumentsCarousel({
  applicationId,
  passport,
  photo,
  signature,
  onPassportFieldsApplied,
  onDocumentUploaded,
}: UniversalProfileDocumentsCarouselProps) {
  const locale = useLocale();
  const isZh = isChineseLocale(locale);
  const [activeIndex, setActiveIndex] = useState(0);
  const pages: Array<{ key: PageKey; label: string; complete: boolean }> = [
    { key: "passport", label: isZh ? "护照" : "Passport", complete: passport.uploaded },
    { key: "signature", label: isZh ? "电子签名" : "E-signature", complete: signature.uploaded },
    { key: "photo", label: isZh ? "证件照" : "Portrait", complete: photo.uploaded },
  ];
  const activePage = pages[activeIndex];

  return (
    <section aria-label={isZh ? "通用材料" : "Reusable documents"}>
      <div className="mb-5 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{isZh ? "通用材料" : "Reusable documents"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isZh ? "一次保存，之后可在现有签证表单中直接复用。" : "Save once, then reuse these files in existing visa forms."}
          </p>
        </div>
        <div className="flex items-center gap-2" role="tablist" aria-label={isZh ? "材料页" : "Document pages"}>
          {pages.map((page, index) => (
            <button
              key={page.key}
              type="button"
              role="tab"
              aria-selected={activeIndex === index}
              onClick={() => setActiveIndex(index)}
              className={cn(
                "flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors",
                activeIndex === index
                  ? "border-brand-500 bg-brand-500 text-white"
                  : "border-border bg-white text-muted-foreground hover:border-brand-300 hover:text-brand-500",
              )}
            >
              <span>{index + 1}</span>
              <span className="hidden sm:inline">{page.label}</span>
              {page.complete && <CheckCircle2 className="h-3.5 w-3.5" />}
            </button>
          ))}
        </div>
      </div>

      <div role="tabpanel" aria-label={activePage.label}>
        {activePage.key === "passport" && (
          <PassportOcrUpload
            applicationId={applicationId}
            initialUploaded={passport.uploaded}
            initialFileName={passport.fileName}
            documentScope="universal_profile"
            documentType="passport_bio_page"
            requirementKey="passport_bio_page"
            onFieldsApplied={onPassportFieldsApplied}
            onUploaded={(fileName) => onDocumentUploaded("passport", fileName)}
          />
        )}
        {activePage.key === "signature" && (
          <CompactProfileUpload
            applicationId={applicationId}
            documentType="electronic_signature"
            initialState={signature}
            accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
            icon={<FileSignature className="h-5 w-5" />}
            title={isZh ? "上传电子签名" : "Upload e-signature"}
            description={isZh ? "上传清晰的手写签名图片或 PDF；需要签名材料时可直接选用。" : "Upload a clear handwritten signature image or PDF for forms that require a signature file."}
            securityNote={isZh ? "签名保存在你的私有材料空间，仅在你确认使用时接入具体申请。" : "Your signature stays in private storage and is attached to an application only when you choose to use it."}
            uploadLabel={isZh ? "上传签名" : "Upload signature"}
            replaceLabel={isZh ? "更换签名" : "Replace signature"}
            preparingLabel={isZh ? "正在准备" : "Preparing"}
            uploadingLabel={isZh ? "上传中" : "Uploading"}
            uploadedLabel={isZh ? "电子签名已保存" : "E-signature saved"}
            uploadFailedLabel={isZh ? "电子签名上传失败，请检查文件格式后重试。" : "E-signature upload failed. Check the file format and try again."}
            onUploaded={(fileName) => onDocumentUploaded("signature", fileName)}
          />
        )}
        {activePage.key === "photo" && (
          <CompactProfileUpload
            applicationId={applicationId}
            documentType="photo"
            initialState={photo}
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            icon={<Camera className="h-5 w-5" />}
            title={isZh ? "上传证件照" : "Upload portrait photo"}
            description={isZh ? "上传近期正面证件照。具体申请仍会按目的地规则检查尺寸、背景和文件大小。" : "Upload a recent front-facing portrait. Each application will still check destination-specific size, background, and file limits."}
            securityNote={isZh ? "表单会优先提供这张照片；若目的地标准不同，你仍可为该申请单独更换。" : "Forms will offer this photo first; you can still replace it for an application with different requirements."}
            uploadLabel={isZh ? "上传证件照" : "Upload portrait"}
            replaceLabel={isZh ? "更换证件照" : "Replace portrait"}
            preparingLabel={isZh ? "正在准备" : "Preparing"}
            uploadingLabel={isZh ? "上传中" : "Uploading"}
            uploadedLabel={isZh ? "证件照已保存" : "Portrait saved"}
            uploadFailedLabel={isZh ? "证件照上传失败，请检查文件格式后重试。" : "Portrait upload failed. Check the file format and try again."}
            onUploaded={(fileName) => onDocumentUploaded("photo", fileName)}
          />
        )}
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
        <Button type="button" variant="ghost" size="sm" disabled={activeIndex === 0} onClick={() => setActiveIndex((index) => index - 1)}>
          <ChevronLeft className="h-4 w-4" />
          {isZh ? "上一页" : "Previous"}
        </Button>
        <span className="text-xs font-medium text-muted-foreground">{activeIndex + 1} / {pages.length}</span>
        <Button type="button" variant="ghost" size="sm" disabled={activeIndex === pages.length - 1} onClick={() => setActiveIndex((index) => index + 1)}>
          {isZh ? "下一页" : "Next"}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}
