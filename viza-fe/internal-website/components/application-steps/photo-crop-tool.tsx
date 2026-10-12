"use client";

import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { CircleNotch as Loader2 } from "@phosphor-icons/react";
import { isChineseLocale } from "@/lib/i18n/locale";
import { getDs160PhotoErrorMessage } from "@/lib/ds160-photo-contract";
import {
  Ds160PhotoProcessingError,
  processDs160Photo,
} from "@/lib/ds160-photo-processing";

interface PhotoCropToolProps {
  imageObjectUrl: string;
  onCropComplete: (croppedBlob: Blob) => void;
  onCancel: () => void;
  /** Enables the strict DS-160 600×600 / ≤240 KiB output contract. */
  ds160Mode?: boolean;
  onCropError?: (error: Error) => void;
}

async function getLegacyCroppedBlob(
  imageSrc: string,
  pixelCrop: Area,
): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Photo could not be decoded"));
    img.src = imageSrc;
  });

  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 600;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Photo canvas is unavailable");

  context.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    600,
    600,
  );

  return new Promise<Blob>((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Photo encoding returned no data"));
        },
        "image/jpeg",
        0.92,
      );
    } catch {
      reject(new Error("Photo encoding failed"));
    }
  });
}

function getProcessingErrorMessage(
  error: Error,
  isZh: boolean,
  fallback: string,
): string {
  if (!(error instanceof Ds160PhotoProcessingError)) return fallback;
  if (error.photoReason) return getDs160PhotoErrorMessage(error.photoReason, isZh);

  switch (error.code) {
    case "image_load_failed":
      return isZh
        ? "无法读取照片，请重新选择有效的 JPEG 文件。"
        : "The photo could not be decoded. Please choose another JPEG file.";
    case "invalid_crop_region":
      return isZh
        ? "裁剪区域必须为至少 600×600 像素的正方形，请调整裁剪范围。"
        : "The crop must be a square containing at least 600×600 source pixels. Adjust the crop and try again.";
    case "jpeg_size_limit_unreachable":
      return isZh
        ? "这张照片无法压缩到 240 KB 以内，请选择细节较少或尺寸更大的原始照片。"
        : "This photo cannot be compressed below 240 KB. Choose another source photo and try again.";
    case "canvas_unavailable":
    case "jpeg_encode_failed":
    case "invalid_output":
      return isZh
        ? "照片处理失败，请调整裁剪范围或重新选择照片。"
        : "Photo processing failed. Adjust the crop or choose another photo.";
  }
}

export function PhotoCropTool({
  imageObjectUrl,
  onCropComplete,
  onCancel,
  ds160Mode = false,
  onCropError,
}: PhotoCropToolProps) {
  const t = useTranslations("applicationSteps.photoUpload");
  const locale = useLocale();
  const isZh = isChineseLocale(locale);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);

  const onCropChanged = useCallback((_croppedArea: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleApply = async () => {
    if (!croppedAreaPixels) return;
    setProcessing(true);
    setProcessingError(null);
    try {
      if (ds160Mode) {
        const result = await processDs160Photo(imageObjectUrl, croppedAreaPixels);
        onCropComplete(result.blob);
      } else {
        onCropComplete(
          await getLegacyCroppedBlob(imageObjectUrl, croppedAreaPixels),
        );
      }
    } catch (error) {
      const processingError =
        error instanceof Error
          ? error
          : new Error(t("uploadError"));
      setProcessingError(
        getProcessingErrorMessage(processingError, isZh, t("uploadError")),
      );
      onCropError?.(processingError);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Crop area */}
      <div className="relative w-full h-[350px] sm:h-[400px] rounded-lg overflow-hidden bg-black/90">
        <Cropper
          image={imageObjectUrl}
          crop={crop}
          zoom={zoom}
          aspect={1}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropChanged}
        />
      </div>

      {processingError ? (
        <p role="alert" className="text-sm text-red-600">
          {processingError}
        </p>
      ) : null}

      {/* Zoom slider */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500 shrink-0">{t("zoom")}</span>
        <input
          type="range"
          min={1}
          max={3}
          step={0.1}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="flex-1 accent-[#03346E]"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={processing}
        >
          {t("cancelCrop")}
        </Button>
        <Button
          type="button"
          className="bg-[#03346E] hover:bg-[#03346E]/90 text-white"
          onClick={handleApply}
          disabled={processing || !croppedAreaPixels}
        >
          {processing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {t("applyCrop")}
            </>
          ) : (
            t("applyCrop")
          )}
        </Button>
      </div>
    </div>
  );
}
