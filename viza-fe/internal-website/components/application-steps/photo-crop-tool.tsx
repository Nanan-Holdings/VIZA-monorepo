"use client";

import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface PhotoCropToolProps {
  imageObjectUrl: string;
  onCropComplete: (croppedBlob: Blob) => void;
  onCancel: () => void;
}

const OUTPUT_SIZE = 600;

/**
 * Draw the cropped region onto a canvas at 600x600 and export as JPEG blob.
 */
async function getCroppedBlob(
  imageSrc: string,
  pixelCrop: Area,
): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image for crop"));
    img.src = imageSrc;
  });

  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE,
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas toBlob returned null"));
      },
      "image/jpeg",
      0.92,
    );
  });
}

export function PhotoCropTool({
  imageObjectUrl,
  onCropComplete,
  onCancel,
}: PhotoCropToolProps) {
  const t = useTranslations("applicationSteps.photoUpload");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);

  const onCropChanged = useCallback((_croppedArea: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleApply = async () => {
    if (!croppedAreaPixels) return;
    setProcessing(true);
    try {
      const blob = await getCroppedBlob(imageObjectUrl, croppedAreaPixels);
      onCropComplete(blob);
    } catch {
      // Fall back to using the original image if crop fails
      const res = await fetch(imageObjectUrl);
      const blob = await res.blob();
      onCropComplete(blob);
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
