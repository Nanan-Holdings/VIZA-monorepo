"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Standard brand-styled text input for client forms.
 * Matches the height and border of `DatePicker` and `CountryDropdown`
 * (`h-12 rounded-lg border-[#e8e8e8]`) so fields in the same row align.
 * Use this instead of the raw shadcn `Input` in the client portal.
 */
const BrandInput = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, ...props }, ref) => {
    return (
      <Input
        ref={ref}
        className={cn(
          "h-12 rounded-lg border-[#e8e8e8] text-[15px] shadow-xs focus-visible:ring-1 focus-visible:ring-brand-500 focus-visible:border-brand-500",
          className
        )}
        {...props}
      />
    );
  }
);
BrandInput.displayName = "BrandInput";

interface BrandFieldProps {
  /** Visible label above the control. */
  label: React.ReactNode;
  /** Pass when wrapping an input that has a matching `id`. */
  htmlFor?: string;
  /** Shows a red asterisk next to the label. */
  required?: boolean;
  /** Optional helper text below the control (hidden when `error` is present). */
  hint?: React.ReactNode;
  /** Error message — replaces `hint` and gets `role="alert"`. */
  error?: React.ReactNode;
  /** The control: `<BrandInput>`, `<DatePicker>`, `<CountryDropdown>`, `<Select>`, etc. */
  children: React.ReactNode;
  className?: string;
}

/**
 * Consistent label-above-control field wrapper for client forms.
 * Replaces inline `<div className="flex flex-col gap-2"><Label>…</Label>…</div>`.
 */
function BrandField({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
  className,
}: BrandFieldProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label
        htmlFor={htmlFor}
        className="text-[14px] font-medium text-gray-700 tracking-[-0.2px]"
      >
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </Label>
      {children}
      {error ? (
        <p className="text-[12px] text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[12px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export { BrandInput, BrandField };
