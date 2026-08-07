"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Canonical button, implementing `preview/components-buttons.html`.
 *
 * Three sizes carry the whole hierarchy:
 *   lg (48px) — flow CTAs and page-level actions
 *   sm (38px) — alerts, empty/error states, cards, toolbars
 *   xs (28px) — inline actions inside alerts and rows
 *
 * Filled and outline variants are pills; `ghost` is the one exception — it is a
 * 6px-radius rectangle on its own height scale (40/32/28), because it reads as
 * an in-card affordance rather than a button.
 */
const actionButtonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center whitespace-nowrap border border-transparent font-medium leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-brand-500 text-white hover:bg-brand-600",
        secondary:
          "!border-brand-500 bg-transparent text-brand-500 hover:bg-[#f6f6f6]",
        neutral: "bg-[#09090b] text-white hover:bg-[#27272a]",
        outline:
          "!border-[#e5e7eb] bg-transparent text-[#09090b] hover:bg-[#f6f6f6]",
        warning: "bg-[#b45309] text-white hover:bg-[#92400e]",
        destructive:
          "bg-[hsl(0_72%_51%)] text-white hover:bg-[hsl(0_72%_45%)]",
        ghost:
          "bg-transparent text-[#3d3d3d] hover:bg-[#f6f6f6] hover:text-brand-500",
      },
      size: {
        lg: "h-12 rounded-full gap-2 px-6 text-[15px] [&_svg]:size-4",
        sm: "h-[38px] rounded-full gap-1.5 px-4 text-[13px] [&_svg]:size-3.5",
        xs: "h-7 rounded-full gap-1.5 px-3.5 text-xs [&_svg]:size-3.5",
      },
    },
    compoundVariants: [
      // Ghost is a 6px rectangle on its own, shorter height scale. These must be
      // compound variants rather than part of the `ghost` variant string so the
      // radius lands after `rounded-full` and survives the tailwind-merge.
      { variant: "ghost", size: "lg", class: "h-10 rounded-[6px] px-4" },
      { variant: "ghost", size: "sm", class: "h-8 rounded-[6px] px-3" },
      { variant: "ghost", size: "xs", class: "h-7 rounded-[6px] px-2.5" },
    ],
    defaultVariants: {
      variant: "primary",
      size: "lg",
    },
  },
);

/** Ring spinner from the spec — 2px, top-transparent, inherits button text colour. */
function ActionButtonSpinner({
  size = "lg",
  className,
}: {
  size?: "lg" | "sm" | "xs";
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent",
        size === "lg" ? "h-3.5 w-3.5" : "h-3 w-3",
        className,
      )}
    />
  );
}

export interface ActionButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof actionButtonVariants> {
  asChild?: boolean;
  loading?: boolean;
  loadingText?: React.ReactNode;
}

const ActionButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      loadingText,
      disabled,
      type,
      children,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(actionButtonVariants({ variant, size }), className)}
        {...(asChild
          ? {}
          : { type: type ?? "button", disabled: disabled || loading })}
        {...props}
      >
        {loading && !asChild ? (
          <>
            <ActionButtonSpinner size={size ?? "lg"} />
            {loadingText ?? children}
          </>
        ) : (
          children
        )}
      </Comp>
    );
  },
);
ActionButton.displayName = "ActionButton";

export { ActionButton, ActionButtonSpinner, actionButtonVariants };
