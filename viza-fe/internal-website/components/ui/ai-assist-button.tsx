import * as React from "react";
import { Robot as Bot } from "@phosphor-icons/react/ssr";

import { cn } from "@/lib/utils";

export interface AiAssistButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  visibleLabel?: React.ReactNode;
  iconClassName?: string;
  variant?: "contained" | "field";
}

export function AiAssistIcon({ className }: { className?: string }) {
  return <Bot className={cn("h-4 w-4", className)} aria-hidden="true" />;
}

export const AiAssistButton = React.forwardRef<
  HTMLButtonElement,
  AiAssistButtonProps
>(function AiAssistButton(
  {
    label,
    visibleLabel,
    className,
    iconClassName,
    type = "button",
    variant = "contained",
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={visibleLabel ? undefined : label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
        variant === "field"
          ? "border-0 bg-transparent text-brand-500 shadow-none hover:text-brand-700"
          : "border border-brand-200 bg-brand-50 text-brand-500 hover:border-brand-300 hover:bg-brand-100",
        visibleLabel
          ? "h-8 gap-1.5 rounded-full px-3 text-xs font-medium"
          : "h-8 w-8 rounded-full",
        className
      )}
      {...props}
    >
      <AiAssistIcon className={iconClassName} />
      {visibleLabel}
    </button>
  );
});
