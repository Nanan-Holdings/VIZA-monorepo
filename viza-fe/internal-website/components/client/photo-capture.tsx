"use client";

import { useState, useRef } from "react";
import { validatePhotoAction } from "@/app/actions/photo";

/**
 * Photo capture + validation component (DOC-001).
 *
 * Web + mobile-web: file input handles both desktop selection and the
 * mobile camera (`accept="image/jpeg"` + `capture="user"`). Renders
 * an aspect-ratio crop guide matching the active package's spec, then
 * sends the bytes through the server action for deterministic
 * validation.
 *
 * Visual ICAO checks (background, head height, expression) live on
 * the consuming side; this component handles file format / size /
 * dimensions only.
 */

interface Props {
  country: string;
  visaType: string;
  /** Aspect ratio guide hint (width / height). */
  widthPx: number;
  heightPx: number;
  /** Callback when validation passes. Receives the bytes as base64. */
  onAccepted: (base64: string) => void;
}

export function PhotoCapture({
  country,
  visaType,
  widthPx,
  heightPx,
  onAccepted,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const aspect = (heightPx / widthPx) * 100; // padding-bottom %

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      let base64 = "";
      const chunk = 0x8000;
      for (let i = 0; i < buf.length; i += chunk) {
        base64 += String.fromCharCode.apply(
          null,
          Array.from(buf.subarray(i, i + chunk)),
        );
      }
      base64 = btoa(base64);
      const result = await validatePhotoAction({ base64, country, visaType });
      if (!result.ok) {
        setError(result.reason);
        return;
      }
      onAccepted(base64);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="w-full max-w-xs aspect-[413/531] border-2 border-dashed border-[#9ca3af] rounded flex flex-col items-center justify-center text-sm text-[#6b6b6b] hover:bg-[#fafafa] disabled:opacity-50"
        style={{ aspectRatio: `${widthPx} / ${heightPx}` }}
      >
        <span className="text-xs uppercase tracking-wider">
          {widthPx} × {heightPx}px
        </span>
        <span className="mt-1">{busy ? "Validating…" : "Upload photo"}</span>
        <span className="text-[11px] mt-1 text-[#9ca3af]">
          {country}/{visaType}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg"
        capture="user"
        onChange={handleChange}
        className="hidden"
      />
      {error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : (
        <p className="text-xs text-[#6b6b6b]">
          JPEG · plain background · face fully visible · head centred ·
          ratio {(widthPx / heightPx).toFixed(2)} ({aspect.toFixed(0)}% pad).
        </p>
      )}
    </div>
  );
}
