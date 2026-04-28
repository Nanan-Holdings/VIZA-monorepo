"use client";

import * as React from "react";
import { Eraser } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandActionButton } from "@/components/client/brand-action-button";

/**
 * Native HTML5 canvas signature pad.
 *
 * Renders at 300×100 CSS pixels with a 2× DPR backing canvas so the exported
 * PNG is 600×200 transparent. No third-party signature vendor — the AU
 * Subclass 600 declaration is signed in-line by the applicant and rendered
 * onto the declaration PDF on the back end.
 *
 * `onChange(blob | null)` fires whenever the signature changes (debounced via
 * pointerup) — null when the pad is cleared. Parents persist the blob.
 */

const CSS_WIDTH = 300;
const CSS_HEIGHT = 100;
const DPR = 2;
const STROKE_PX = 2.5; // in CSS pixels — multiplied by DPR for crisp rendering
const STROKE_COLOR = "#03346E"; // brand-500 — kept literal here so the canvas
// strokes in the actual brand colour (CSS variables can't be read inside a
// raw Canvas2D context without extra plumbing). Anywhere in JSX we still use
// `text-brand-500` / `bg-brand-500`.

export interface SignaturePadProps {
  /** Fires on pointer-up with the latest 600×200 PNG blob, or null after clear(). */
  onChange?: (blob: Blob | null) => void;
  /** Aria label for the canvas. Defaults to a generic English string. */
  ariaLabel?: string;
  /** Disable drawing (e.g. while the parent is submitting). */
  disabled?: boolean;
  className?: string;
  /** Localised label for the Clear button. */
  clearLabel?: string;
}

export function SignaturePad({
  onChange,
  ariaLabel = "Signature pad",
  disabled = false,
  className,
  clearLabel = "Clear",
}: SignaturePadProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const drawingRef = React.useRef(false);
  const lastPointRef = React.useRef<{ x: number; y: number } | null>(null);
  const dirtyRef = React.useRef(false);
  const [hasInk, setHasInk] = React.useState(false);

  // Initialise the backing canvas once on mount. CSS pixels stay at
  // CSS_WIDTH × CSS_HEIGHT; the canvas's internal resolution is DPR× for crispness.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = CSS_WIDTH * DPR;
    canvas.height = CSS_HEIGHT * DPR;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(DPR, DPR);
    ctx.lineWidth = STROKE_PX;
    ctx.strokeStyle = STROKE_COLOR;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const getRelativePoint = (evt: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((evt.clientX - rect.left) / rect.width) * CSS_WIDTH,
      y: ((evt.clientY - rect.top) / rect.height) * CSS_HEIGHT,
    };
  };

  const handlePointerDown = (evt: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    evt.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(evt.pointerId);
    drawingRef.current = true;
    const pt = getRelativePoint(evt);
    if (pt) lastPointRef.current = pt;
  };

  const handlePointerMove = (evt: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || disabled) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const pt = getRelativePoint(evt);
    const last = lastPointRef.current;
    if (!ctx || !pt || !last) return;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    lastPointRef.current = pt;
    dirtyRef.current = true;
    if (!hasInk) setHasInk(true);
  };

  const emitChange = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !onChange) return;
    canvas.toBlob((blob) => onChange(blob), "image/png");
  }, [onChange]);

  const handlePointerUp = (evt: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    canvasRef.current?.releasePointerCapture(evt.pointerId);
    if (dirtyRef.current) {
      dirtyRef.current = false;
      emitChange();
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, CSS_WIDTH, CSS_HEIGHT);
    setHasInk(false);
    onChange?.(null);
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div
        className={cn(
          "rounded-xl border bg-white shadow-sm transition-colors",
          hasInk ? "border-brand-500" : "border-input",
          disabled && "opacity-60",
        )}
      >
        <canvas
          ref={canvasRef}
          aria-label={ariaLabel}
          role="img"
          style={{ width: CSS_WIDTH, height: CSS_HEIGHT, touchAction: "none" }}
          className="block w-full max-w-full cursor-crosshair rounded-xl"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      </div>
      <div className="flex justify-end">
        <BrandActionButton
          variant="secondary"
          onClick={clear}
          disabled={disabled || !hasInk}
          className="h-9 px-4 text-[13px]"
        >
          <Eraser />
          {clearLabel}
        </BrandActionButton>
      </div>
    </div>
  );
}
