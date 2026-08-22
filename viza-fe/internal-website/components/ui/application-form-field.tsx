import * as React from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function ApplicationFormLabelAction({ children }: { children: React.ReactNode }) {
  return (
    <span className="absolute -right-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center opacity-0 transition-opacity group-hover/field:opacity-100 group-focus-within/field:opacity-100">
      {children}
    </span>
  );
}

function ApplicationFormField({
  label,
  required = false,
  helperText,
  htmlFor,
  labelAction,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  helperText?: string;
  htmlFor?: string;
  labelAction?: React.ReactNode;
  sideLocale?: "zh" | "en";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("application-form-field group/field relative flex flex-col gap-2", className)}>
      <div className="relative flex min-h-5 w-full max-w-full items-center">
        <Label
          htmlFor={htmlFor}
          className={cn(
            "application-form-question-label min-w-0 text-[14px] font-medium tracking-[-0.2px] text-gray-700",
            labelAction && "pr-10"
          )}
        >
          {label}
          {required ? <span className="ml-1 text-red-500">*</span> : null}
        </Label>
        {labelAction ? <ApplicationFormLabelAction>{labelAction}</ApplicationFormLabelAction> : null}
      </div>
      {children}
      {helperText ? <p className="text-[12px] leading-5 text-gray-500">{helperText}</p> : null}
    </div>
  );
}

export { ApplicationFormField, ApplicationFormLabelAction };
