"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const brandActionButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap h-12 rounded-full px-6 text-[15px] font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-brand-500 text-white hover:bg-brand-600",
        secondary: "border border-brand-500 bg-transparent text-brand-500 hover:bg-brand-500/5",
      },
    },
    defaultVariants: {
      variant: "primary",
    },
  }
);

export interface BrandActionButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof brandActionButtonVariants> {
  loading?: boolean;
  loadingText?: React.ReactNode;
}

const BrandActionButton = React.forwardRef<HTMLButtonElement, BrandActionButtonProps>(
  ({ className, variant, loading = false, loadingText, disabled, type, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type ?? "button"}
        className={cn(brandActionButtonVariants({ variant, className }))}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="animate-spin" />
            {loadingText ?? children}
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);
BrandActionButton.displayName = "BrandActionButton";

export { BrandActionButton, brandActionButtonVariants };
