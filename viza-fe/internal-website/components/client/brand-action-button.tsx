"use client";

/**
 * Historical name for the canonical 48px flow CTA. It is now a thin alias over
 * ActionButton — `<BrandActionButton variant="primary|secondary">` still renders
 * the same 48px pill, but the full size and variant scale is available through
 * ActionButton directly. Prefer importing ActionButton in new code.
 */
export {
  ActionButton as BrandActionButton,
  actionButtonVariants as brandActionButtonVariants,
} from "@/components/ui/action-button";
export type { ActionButtonProps as BrandActionButtonProps } from "@/components/ui/action-button";
