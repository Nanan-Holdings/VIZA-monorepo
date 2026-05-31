"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Camera,
  CheckCircle2,
  AlertCircle,
  Upload,
  Loader2,
  ImageIcon,
  Crop,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandActionButton } from "@/components/client/brand-action-button";
import { FieldGuidancePanel } from "@/components/field-guidance-panel";
import { uploadApplicationDocument } from "@/app/client/documents/actions";
import { createClient } from "@/lib/supabase/client";
import {
  validatePhoto,
  type PhotoValidationResult,
  type PhotoFailureReason,
} from "@/lib/photo-validation";
import { getPhotoGuidance } from "@/lib/photo-guidance";
import { isChineseLocale } from "@/lib/i18n/locale";
import { type VisaFormFieldRow } from "@/types/visa-form-fields";
import { PhotoCropTool } from "./photo-crop-tool";

type Screen = "upload" | "quality_check" | "confirm";

const PHOTO_COPILOT_FIELD_NAME = "photo_upload";

function normalizePhotoVisaType(visaType?: string): string {
  if (visaType === "B1_B2") return "DS160";
  if (visaType === "tourist_b211a") return "B211A";
  return visaType ?? "photo_upload";
}

export interface PhotoUploadStepProps {
  applicationId: string | null;
  country?: string;
  visaType?: string;
  existingPhotoUrl?: string;
  ensureApplicationId?: () => Promise<string>;
  onComplete: (storagePath: string, applicationId?: string) => void;
  onSkip: () => void;
}

export function PhotoUploadStep({
  applicationId,
  country,
  visaType,
  existingPhotoUrl,
  ensureApplicationId,
  onComplete,
  onSkip,
}: PhotoUploadStepProps) {
  const t = useTranslations("applicationSteps.photoUpload");
  const locale = useLocale();
  const isZh = isChineseLocale(locale);
  const guidance = getPhotoGuidance(country, visaType, isZh ? "zh" : "en");
  const inputRef = useRef<HTMLInputElement>(null);

  const [screen, setScreen] = useState<Screen>(
    existingPhotoUrl ? "confirm" : "upload"
  );
  const [rawObjectUrl, setRawObjectUrl] = useState<string | null>(null);
  const [showCropTool, setShowCropTool] = useState(false);
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);
  const [croppedObjectUrl, setCroppedObjectUrl] = useState<string | null>(null);
  const [validationResult, setValidationResult] =
    useState<PhotoValidationResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const [uploadedApplicationId, setUploadedApplicationId] = useState<
    string | null
  >(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(
    existingPhotoUrl ?? null
  );
  const [error, setError] = useState<string | null>(null);
  const [photoCopilotOpen, setPhotoCopilotOpen] = useState(false);

  const fieldGuidanceVisaType = normalizePhotoVisaType(visaType);
  const photoGuidanceField = useMemo<VisaFormFieldRow>(
    () => ({
      id: PHOTO_COPILOT_FIELD_NAME,
      visaType: fieldGuidanceVisaType,
      fieldName: PHOTO_COPILOT_FIELD_NAME,
      label: isZh ? "签证照片 / Visa photo" : "Visa photo",
      fieldType: "file",
      required: true,
      stepNumber: 0,
      stepName: "Upload Photo",
      displayOrder: 0,
      placeholder: guidance.formatSpec,
      validationRules: {
        documentType: "photo",
        format: guidance.formatSpec,
        acceptedFileTypes: ["jpg", "jpeg"],
      },
      options: null,
      conditionalLogic: null,
    }),
    [fieldGuidanceVisaType, guidance.formatSpec, isZh]
  );
  const photoCopilotAnswer =
    uploadedPath ?? (photoPreviewUrl ? "photo.jpg" : "");
  const photoAllAnswers = useMemo<Record<string, string>>(
    () => ({
      photo_upload: photoCopilotAnswer,
      photo_path: uploadedPath ?? "",
      photo_status: photoCopilotAnswer ? "uploaded" : "",
      destination_country: country ?? "",
      visa_type: fieldGuidanceVisaType,
    }),
    [country, fieldGuidanceVisaType, photoCopilotAnswer, uploadedPath]
  );

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (rawObjectUrl) URL.revokeObjectURL(rawObjectUrl);
      if (croppedObjectUrl) URL.revokeObjectURL(croppedObjectUrl);
    };
  }, [rawObjectUrl, croppedObjectUrl]);

  const resetToUpload = () => {
    if (rawObjectUrl) URL.revokeObjectURL(rawObjectUrl);
    if (croppedObjectUrl) URL.revokeObjectURL(croppedObjectUrl);
    setRawObjectUrl(null);
    setShowCropTool(false);
    setCroppedBlob(null);
    setCroppedObjectUrl(null);
    setValidationResult(null);
    setUploadedPath(null);
    setPhotoPreviewUrl(null);
    setError(null);
    setScreen("upload");
  };

  const handleFileSelect = (file: File) => {
    if (rawObjectUrl) URL.revokeObjectURL(rawObjectUrl);
    if (croppedObjectUrl) URL.revokeObjectURL(croppedObjectUrl);

    const url = URL.createObjectURL(file);
    setRawObjectUrl(url);
    setCroppedBlob(null);
    setCroppedObjectUrl(null);
    setValidationResult(null);
    setShowCropTool(true);
    setError(null);
  };

  const handleCropComplete = async (blob: Blob) => {
    setShowCropTool(false);
    if (croppedObjectUrl) URL.revokeObjectURL(croppedObjectUrl);

    const url = URL.createObjectURL(blob);
    setCroppedBlob(blob);
    setCroppedObjectUrl(url);

    // Run validation on cropped image
    const result = await validatePhoto(blob);
    setValidationResult(result);
    setScreen("quality_check");
  };

  const handleCropCancel = () => {
    setShowCropTool(false);
    if (rawObjectUrl) URL.revokeObjectURL(rawObjectUrl);
    setRawObjectUrl(null);
  };

  const handleUploadAndContinue = async () => {
    if (!croppedBlob) return;
    setUploading(true);
    setError(null);

    try {
      const resolvedApplicationId =
        applicationId ??
        (ensureApplicationId ? await ensureApplicationId() : null);
      if (!resolvedApplicationId) throw new Error(t("uploadError"));

      const uploadForm = new FormData();
      uploadForm.set("applicationId", resolvedApplicationId);
      uploadForm.set("documentType", "photo");
      uploadForm.set("requirementKey", "photo");
      uploadForm.set("filename", "photo.jpg");
      uploadForm.set("required", "true");
      uploadForm.set("file", new File([croppedBlob], "photo.jpg", { type: "image/jpeg" }));
      const uploadResult = await uploadApplicationDocument(uploadForm);
      if (!uploadResult.ok) throw new Error(uploadResult.error);

      // Get a signed URL for preview
      const supabase = createClient();
      const { data: signedData } = await supabase.storage
        .from("application-documents")
        .createSignedUrl(uploadResult.storagePath, 3600);

      setUploadedPath(uploadResult.storagePath);
      setUploadedApplicationId(resolvedApplicationId);
      setPhotoPreviewUrl(signedData?.signedUrl ?? croppedObjectUrl);
      setScreen("confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("uploadError"));
    } finally {
      setUploading(false);
    }
  };

  const renderPhotoCopilot = () => {
    const buttonLabel = photoCopilotOpen
      ? isZh
        ? "收起 AI 帮助"
        : "Hide AI help"
      : isZh
        ? "问 AI"
        : "Ask AI";

    return (
      <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-[#dbe7f5] bg-[#f8fbff] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-2">
            <Camera className="mt-0.5 h-5 w-5 shrink-0 text-[#03346E]" />
            <div className="min-w-0">
              <h3 className="text-[16px] font-semibold text-[#3d3d3d]">
                {t("prepareTitle")}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-medium text-[#03346E]">
                  {isZh ? "必填项" : "Required"}
                </span>
                {!photoCopilotAnswer && (
                  <span className="text-[13px] font-medium text-[#03346E]">
                    {isZh ? "照片还未上传" : "Photo not uploaded yet"}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setPhotoCopilotOpen((current) => !current);
            }}
            className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border border-[#b8d3f3] bg-[#eef6ff] px-2.5 text-[12px] font-medium text-[#03346E] transition-colors hover:bg-[#e3f0ff]"
            aria-expanded={photoCopilotOpen}
            aria-label={buttonLabel}
            data-copilot-trigger={PHOTO_COPILOT_FIELD_NAME}
          >
            <Bot className="h-3.5 w-3.5" />
            {buttonLabel}
          </button>
        </div>
        <p className="text-sm leading-relaxed text-gray-600">
          {guidance.instructions}
        </p>
        {photoCopilotOpen && (
          <div
            className="w-full"
            data-copilot-panel-frame={PHOTO_COPILOT_FIELD_NAME}
          >
            <FieldGuidancePanel
              country={country}
              visaType={fieldGuidanceVisaType}
              locale={locale}
              field={photoGuidanceField}
              answer={photoCopilotAnswer}
              allAnswers={photoAllAnswers}
              onClose={() => setPhotoCopilotOpen(false)}
            />
          </div>
        )}
      </div>
    );
  };

  // ── Screen 1: Upload ──────────────────────────────────────────────────

  if (screen === "upload") {
    return (
      <div className="flex flex-col gap-6">
        {renderPhotoCopilot()}

        {/* Crop tool section */}
        {showCropTool && rawObjectUrl ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Crop className="h-5 w-5 text-[#03346E]" />
              <h3 className="text-[16px] font-semibold text-[#3d3d3d]">
                {t("cropToolTitle")}
              </h3>
            </div>
            <p className="text-sm text-gray-500">
              {guidance.cropToolDescription}
            </p>
            <PhotoCropTool
              imageObjectUrl={rawObjectUrl}
              onCropComplete={handleCropComplete}
              onCancel={handleCropCancel}
            />
          </div>
        ) : (
          <>
            {/* Photo cropping tool prompt */}
            <div className="rounded-lg border border-[#e8e8e8] bg-[#fafafa] p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Crop className="h-4 w-4 text-[#03346E]" />
                <span className="text-sm font-medium text-[#3d3d3d]">
                  {t("cropToolTitle")}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                {guidance.cropToolDescription}
              </p>
            </div>

            {/* File picker */}
            <div className="flex flex-col gap-3">
              <h3 className="text-[15px] font-semibold text-[#3d3d3d]">
                {t("selectPhoto")}
              </h3>
              <p className="text-sm text-gray-500">{guidance.formatHint}</p>

              <div
                className="rounded-lg border-2 border-dashed border-gray-300 hover:border-[#03346E]/50 p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors"
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="h-8 w-8 text-gray-400" />
                <div className="text-center">
                  <p className="text-sm font-medium text-[#03346E]">
                    {t("browse")}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {guidance.formatSpec}
                  </p>
                </div>
              </div>

              <input
                ref={inputRef}
                type="file"
                className="hidden"
                accept=".jpg,.jpeg,image/jpeg"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                  // Reset input so same file can be re-selected
                  e.target.value = "";
                }}
              />
            </div>

            {/* Quality standards info */}
            <div className="rounded-lg border border-[#e8e8e8] bg-[#fafafa] p-4 flex flex-col gap-2">
              <h4 className="text-sm font-medium text-[#3d3d3d]">
                {t("qualityTitle")}
              </h4>
              <p className="text-xs text-gray-500 leading-relaxed">
                {guidance.qualityDescription}
              </p>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Screen 2: Quality Check ───────────────────────────────────────────

  if (screen === "quality_check" && validationResult) {
    const passed = validationResult.passed;
    const allIssues: PhotoFailureReason[] = [
      ...validationResult.failures,
      ...validationResult.warnings,
    ];

    return (
      <div className="flex flex-col gap-6">
        {renderPhotoCopilot()}

        <h3 className="text-[16px] font-semibold text-[#3d3d3d]">
          {t("resultTitle")}
        </h3>

        {/* Preview thumbnail */}
        {croppedObjectUrl && (
          <div className="flex justify-center">
            <div className="w-[200px] h-[200px] rounded-lg overflow-hidden border border-[#e8e8e8]">
              <img
                src={croppedObjectUrl}
                alt="Photo preview"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        )}

        {/* Result message */}
        {passed ? (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
            <p className="text-sm text-green-700">{t("passed")}</p>
          </div>
        ) : (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex flex-col gap-2">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 font-medium">{t("failed")}</p>
            </div>
            <div className="ml-8">
              <p className="text-xs text-red-600 font-medium mb-1">
                {t("reasonsTitle")}
              </p>
              <ul className="flex flex-col gap-1">
                {allIssues.map((reason) => (
                  <li key={reason} className="text-xs text-red-600">
                    &bull; {t(`failures.${reason}`)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Warnings (when passed but has soft warnings) */}
        {passed && validationResult.warnings.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <ul className="flex flex-col gap-1">
              {validationResult.warnings.map((reason) => (
                <li key={reason} className="text-xs text-amber-700">
                  &bull; {t(`failures.${reason}`)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && <p className="text-xs text-red-500">{error}</p>}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={resetToUpload}
            disabled={uploading}
            className="flex-1"
          >
            {t("backSelect")}
          </Button>

          {passed ? (
            <Button
              type="button"
              className="bg-[#03346E] hover:bg-[#03346E]/90 text-white flex-1"
              onClick={handleUploadAndContinue}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("uploading")}
                </>
              ) : (
                t("nextWithPhoto")
              )}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onSkip}
              disabled={uploading}
            >
              {t("nextWithoutPhoto")}
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ── Screen 3: Confirm ─────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {renderPhotoCopilot()}

      <h3 className="text-[16px] font-semibold text-[#3d3d3d]">
        {t("confirmTitle")}
      </h3>

      {/* Photo thumbnail */}
      <div className="flex justify-center">
        <div className="w-[200px] h-[200px] rounded-lg overflow-hidden border-2 border-green-400 bg-green-50">
          {photoPreviewUrl ? (
            <img
              src={photoPreviewUrl}
              alt="Uploaded photo"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="h-12 w-12 text-gray-300" />
            </div>
          )}
        </div>
      </div>

      {/* Notice */}
      <p className="text-sm text-gray-600 text-center leading-relaxed">
        {t("confirmNotice")}
      </p>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={resetToUpload}
          className="flex-1"
        >
          {t("uploadNew")}
        </Button>
        <BrandActionButton
          type="button"
          className="flex-1"
          onClick={() => {
            if (uploadedPath) {
              onComplete(
                uploadedPath,
                uploadedApplicationId ?? applicationId ?? undefined
              );
            } else {
              // Existing photo — just continue
              onSkip();
            }
          }}
        >
          {t("continue")}
        </BrandActionButton>
      </div>
    </div>
  );
}
