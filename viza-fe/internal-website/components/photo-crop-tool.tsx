"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, ScanFace } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  processApplicantPhoto,
  getPhotoSpecForApplication,
} from "@/app/actions/photo-crop";
import type { PhotoSpec, CropRegion } from "@/lib/photo/crop";

interface PhotoCropToolProps {
  applicationId: string;
  /** Public URL or signed URL of the original photo. Lets us draw it in a canvas. */
  originalImageUrl: string;
  onCropped?: (croppedStoragePath: string) => void;
}

interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function detectFaceBox(image: HTMLImageElement): Promise<FaceBox | null> {
  const w = window as unknown as { FaceDetector?: new (init?: { fastMode?: boolean }) => { detect(img: HTMLImageElement): Promise<Array<{ boundingBox: DOMRectReadOnly }>> } };
  if (!w.FaceDetector) return null;
  try {
    const detector = new w.FaceDetector({ fastMode: true });
    const found = await detector.detect(image);
    if (!found.length) return null;
    const box = found[0].boundingBox;
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  } catch {
    return null;
  }
}

function regionFromFace(face: FaceBox, image: HTMLImageElement, spec: PhotoSpec): CropRegion {
  const aspect = spec.widthMm / spec.heightMm;
  const headHeightPct = spec.headHeightPct ?? 0.65;
  const faceCenterX = face.x + face.width / 2;
  const faceCenterY = face.y + face.height * 0.45;
  const targetCropHeight = face.height / headHeightPct;
  const targetCropWidth = targetCropHeight * aspect;
  return {
    x: Math.max(0, Math.round(faceCenterX - targetCropWidth / 2)),
    y: Math.max(0, Math.round(faceCenterY - targetCropHeight * 0.45)),
    width: Math.min(image.naturalWidth, Math.round(targetCropWidth)),
    height: Math.min(image.naturalHeight, Math.round(targetCropHeight)),
  };
}

export function PhotoCropTool({ applicationId, originalImageUrl, onCropped }: PhotoCropToolProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [spec, setSpec] = useState<PhotoSpec | null>(null);
  const [face, setFace] = useState<FaceBox | null>(null);
  const [region, setRegion] = useState<CropRegion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await getPhotoSpecForApplication(applicationId);
      if (!cancelled && res.spec) setSpec(res.spec);
      if (!cancelled && res.error) setError(res.error);
    })();
    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  useEffect(() => {
    if (!spec) return;
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = async () => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const maxDisplay = 480;
      const scale = Math.min(1, maxDisplay / Math.max(img.naturalWidth, img.naturalHeight));
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const detected = await detectFaceBox(img);
      if (cancelled) return;
      setFace(detected);
      const initialRegion = detected
        ? regionFromFace(detected, img, spec)
        : (() => {
            const targetAspect = spec.widthMm / spec.heightMm;
            const sourceAspect = img.naturalWidth / img.naturalHeight;
            let cropWidth = img.naturalWidth;
            let cropHeight = img.naturalHeight;
            if (sourceAspect > targetAspect) cropWidth = Math.round(img.naturalHeight * targetAspect);
            else cropHeight = Math.round(img.naturalWidth / targetAspect);
            return {
              x: Math.round((img.naturalWidth - cropWidth) / 2),
              y: Math.round((img.naturalHeight - cropHeight) / 2),
              width: cropWidth,
              height: cropHeight,
            };
          })();
      setRegion(initialRegion);

      ctx.strokeStyle = "#03346E";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        initialRegion.x * scale,
        initialRegion.y * scale,
        initialRegion.width * scale,
        initialRegion.height * scale,
      );
      if (detected) {
        ctx.strokeStyle = "rgba(3, 52, 110, 0.4)";
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(detected.x * scale, detected.y * scale, detected.width * scale, detected.height * scale);
        ctx.setLineDash([]);
      }
    };
    img.src = originalImageUrl;
    return () => {
      cancelled = true;
    };
  }, [originalImageUrl, spec]);

  const submit = (): void => {
    if (!region) return;
    setError(null);
    startTransition(async () => {
      const res = await processApplicantPhoto({ applicationId, cropRegion: region });
      if (!res.ok || !res.croppedStoragePath) {
        setError(res.reason || "crop failed");
        return;
      }
      onCropped?.(res.croppedStoragePath);
    });
  };

  return (
    <div className="space-y-3 rounded-xl border border-input bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">Photo crop</h2>
        {spec ? (
          <span className="text-xs text-muted-foreground">
            Target: {spec.widthMm}×{spec.heightMm}mm @ {spec.dpi}dpi
          </span>
        ) : null}
      </div>
      <canvas ref={canvasRef} className="rounded-md border border-input" aria-label="Photo preview with crop overlay" />
      {face ? (
        <p className="inline-flex items-center gap-1 text-xs text-brand-500">
          <ScanFace className="h-3.5 w-3.5" /> face detected
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Face detector unavailable — using centered crop.</p>
      )}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" onClick={submit} disabled={pending || !region} className="bg-brand-500 hover:bg-brand-400">
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Crop &amp; save
        </Button>
      </div>
    </div>
  );
}
