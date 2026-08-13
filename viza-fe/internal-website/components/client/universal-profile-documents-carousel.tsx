"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useLocale } from "next-intl";
import { PassportOcrUpload } from "@/components/client/passport-ocr-upload";
import { AiAssistButton, AiAssistIcon } from "@/components/ui/ai-assist-button";
import { DocumentUploadField } from "@/components/ui/document-upload-field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SupportingDocumentCard } from "@/components/ui/supporting-document-card";
import { uploadApplicationDocumentFromClient } from "@/lib/document-upload-client";
import { isChineseLocale } from "@/lib/i18n/locale";
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
  identityCard: ReusableDocumentState;
  photo: ReusableDocumentState;
  signature: ReusableDocumentState;
  onPassportFieldsApplied: (fields: UniversalProfileSnapshot) => void;
  onDocumentUploaded: (type: "passport" | "identityCard" | "photo" | "signature", fileName: string) => void;
}

interface CompactUploadProps {
  applicationId: string | null;
  documentType: "electronic_signature" | "photo";
  initialState: ReusableDocumentState;
  accept: string;
  title: string;
  description: string;
  securityNote: string;
  replaceLabel: string;
  preparingLabel: string;
  uploadingLabel: string;
  uploadedLabel: string;
  uploadFailedLabel: string;
  formatsLabel: string;
  onUploaded: (fileName: string) => void;
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^\w.-]+/g, "_");
}

function ReusableDocumentHelp({
  title,
  children,
  isZh,
}: {
  title: string;
  children: ReactNode;
  isZh: boolean;
}) {
  const buttonLabel = isZh ? `询问 AI：${title}` : `Ask AI about ${title}`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <AiAssistButton
          label={buttonLabel}
          className="opacity-0 focus-visible:opacity-100 group-hover/document-card:opacity-100 group-focus-within/document-card:opacity-100"
        />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(360px,calc(100vw-2rem))] p-4">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-500">
            <AiAssistIcon />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {isZh ? "AI 使用说明" : "AI guidance"}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{children}</p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CompactProfileUpload({
  applicationId,
  documentType,
  initialState,
  accept,
  title,
  description,
  securityNote,
  replaceLabel,
  preparingLabel,
  uploadingLabel,
  uploadedLabel,
  uploadFailedLabel,
  formatsLabel,
  onUploaded,
}: CompactUploadProps) {
  const [state, setState] = useState(initialState);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locale = useLocale();
  const isZh = isChineseLocale(locale);

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
    <SupportingDocumentCard
      title={title}
      description={description}
      headerLayout="stacked"
      headerAside={
        <ReusableDocumentHelp title={title} isZh={isZh}>
          {securityNote}
        </ReusableDocumentHelp>
      }
    >
      <DocumentUploadField
        status={
          uploading
            ? "uploading"
            : error
              ? "rejected"
              : state.uploaded
                ? "attached"
                : "optional"
        }
        statusLabel={
          uploading
            ? uploadingLabel
            : error
              ? uploadFailedLabel
              : state.uploaded
                ? isZh
                  ? "已存入通用资料"
                  : "Saved to your profile"
                : !applicationId
                  ? preparingLabel
                  : isZh
                    ? "未上传"
                    : "Not uploaded"
        }
        file={
          state.uploaded && !uploading
            ? { name: state.fileName ?? uploadedLabel, kind: "image" }
            : null
        }
        reason={error}
        dropLabel={isZh ? "拖放文件到这里，或点击选择" : "Drop file or browse"}
        acceptHint={`${formatsLabel} · ${isZh ? "最大 10 MB" : "Up to 10 MB"}`}
        removeLabel={replaceLabel}
        accept={accept}
        disabled={!applicationId}
        inputAriaLabel={title}
        onFileSelected={(file) => void upload(file)}
      />
    </SupportingDocumentCard>
  );
}

export function UniversalProfileDocumentsCarousel({
  applicationId,
  passport,
  identityCard,
  photo,
  signature,
  onPassportFieldsApplied,
  onDocumentUploaded,
}: UniversalProfileDocumentsCarouselProps) {
  const locale = useLocale();
  const isZh = isChineseLocale(locale);

  return (
    <section
      aria-label={isZh ? "支持材料" : "Supporting documents"}
      className="rounded-xl border border-[#efefef] bg-white p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{isZh ? "支持材料" : "Supporting documents"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isZh ? "一次保存，之后可在现有签证表单中直接复用。" : "Save once, then reuse these files in existing visa forms."}
          </p>
        </div>
        <span className="w-fit rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-600">
          {isZh ? "4 项材料" : "4 items"}
        </span>
      </div>

      <div className="mt-5 grid items-start gap-4 md:grid-cols-2">
        <SupportingDocumentCard
          title={isZh ? "护照资料页" : "Passport bio page"}
          description={
            isZh
              ? "上传护照资料页并自动读取可复用的身份和护照信息。"
              : "Upload the bio page and automatically extract reusable identity and passport details."
          }
          headerLayout="stacked"
          headerAside={
            <ReusableDocumentHelp title={isZh ? "护照资料页" : "Passport bio page"} isZh={isZh}>
              {isZh ? "文件会保存在你的私有材料空间，并只用于你选择的申请。" : "The file stays in your private document space and is used only for applications you choose."}
            </ReusableDocumentHelp>
          }
        >
          <PassportOcrUpload
            applicationId={applicationId}
            initialUploaded={passport.uploaded}
            initialFileName={passport.fileName}
            documentScope="universal_profile"
            documentType="passport_bio_page"
            requirementKey="passport_bio_page"
            presentation="supporting-card"
            onFieldsApplied={onPassportFieldsApplied}
            onUploaded={(fileName) => onDocumentUploaded("passport", fileName)}
          />
        </SupportingDocumentCard>

        <SupportingDocumentCard
          title={isZh ? "身份证件" : "National identity card"}
          description={
            isZh
              ? "上传身份证件并自动读取姓名、证件号、出生日期、性别和国籍；证件号不会写入护照号码。"
              : "Upload an identity card to extract name, card number, date of birth, gender, and nationality. The card number is never saved as a passport number."
          }
          headerLayout="stacked"
          headerAside={
            <ReusableDocumentHelp title={isZh ? "身份证件" : "National identity card"} isZh={isZh}>
              {isZh ? "请仅上传本人证件，并在回填后核对所有字段。" : "Upload only your own document and review every extracted field."}
            </ReusableDocumentHelp>
          }
        >
          <PassportOcrUpload
            applicationId={applicationId}
            initialUploaded={identityCard.uploaded}
            initialFileName={identityCard.fileName}
            documentScope="universal_profile"
            documentType="national_identity_card"
            requirementKey="national_identity_card"
            title={isZh ? "上传身份证件" : "Upload identity card"}
            description={isZh ? "支持身份证、国民身份证等有照片的身份文件。" : "Supports photo-bearing national identity documents."}
            presentation="supporting-card"
            onFieldsApplied={onPassportFieldsApplied}
            onUploaded={(fileName) => onDocumentUploaded("identityCard", fileName)}
          />
        </SupportingDocumentCard>

        <CompactProfileUpload
          applicationId={applicationId}
          documentType="electronic_signature"
          initialState={signature}
          accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
          title={isZh ? "电子签名" : "E-signature"}
          description={isZh ? "上传清晰的手写签名图片或 PDF；需要签名材料时可直接选用。" : "Upload a clear handwritten signature image or PDF for forms that require a signature file."}
          securityNote={isZh ? "签名保存在你的私有材料空间，仅在你确认使用时接入具体申请。" : "Your signature stays in private storage and is attached to an application only when you choose to use it."}
          replaceLabel={isZh ? "更换签名" : "Replace signature"}
          preparingLabel={isZh ? "正在准备" : "Preparing"}
          uploadingLabel={isZh ? "上传中" : "Uploading"}
          uploadedLabel={isZh ? "电子签名已保存" : "E-signature saved"}
          uploadFailedLabel={isZh ? "电子签名上传失败，请检查文件格式后重试。" : "E-signature upload failed. Check the file format and try again."}
          formatsLabel={isZh ? "PNG、JPG 或 PDF" : "PNG, JPG or PDF"}
          onUploaded={(fileName) => onDocumentUploaded("signature", fileName)}
        />
        <CompactProfileUpload
          applicationId={applicationId}
          documentType="photo"
          initialState={photo}
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          title={isZh ? "证件照" : "Passport-size photo"}
          description={isZh ? "上传近期正面证件照。具体申请仍会按目的地规则检查尺寸、背景和文件大小。" : "Upload a recent front-facing portrait. Each application will still check destination-specific size, background, and file limits."}
          securityNote={isZh ? "表单会优先提供这张照片；若目的地标准不同，你仍可为该申请单独更换。" : "Forms will offer this photo first; you can still replace it for an application with different requirements."}
          replaceLabel={isZh ? "更换证件照" : "Replace portrait"}
          preparingLabel={isZh ? "正在准备" : "Preparing"}
          uploadingLabel={isZh ? "上传中" : "Uploading"}
          uploadedLabel={isZh ? "证件照已保存" : "Portrait saved"}
          uploadFailedLabel={isZh ? "证件照上传失败，请检查文件格式后重试。" : "Portrait upload failed. Check the file format and try again."}
          formatsLabel={isZh ? "JPG、PNG 或 WEBP" : "JPG, PNG or WEBP"}
          onUploaded={(fileName) => onDocumentUploaded("photo", fileName)}
        />
      </div>
    </section>
  );
}
