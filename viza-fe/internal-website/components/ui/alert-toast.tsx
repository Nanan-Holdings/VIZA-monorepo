"use client";

import * as React from "react";
import { X } from "@phosphor-icons/react";
import { toast as sonner } from "sonner";

import { ActionButton, type ActionButtonProps } from "@/components/ui/action-button";
import { AlertIcon } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

type AlertToastVariant = "default" | "info" | "success" | "warning" | "destructive";

// Same tone scale as Alert — a toast is the floating form of the same notice, so
// the two must never disagree about what "warning" looks like.
const toneClasses: Record<AlertToastVariant, string> = {
  default: "[&>svg]:!text-[#03346E] [&_h5]:!text-[#03346E]",
  info: "[&>svg]:!text-[#03346E] [&_h5]:!text-[#03346E]",
  success: "[&>svg]:!text-[#16a34a] [&_h5]:!text-[#166534]",
  warning: "[&>svg]:!text-[#d97706] [&_h5]:!text-[#92400e]",
  destructive: "[&>svg]:!text-[hsl(0_72%_51%)] [&_h5]:!text-[hsl(0_72%_35%)]",
};

export interface AlertToastProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  variant?: AlertToastVariant;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Optional single action, vertically centred against the toast body. */
  action?: React.ReactNode;
  onDismiss?: () => void;
  dismissLabel?: string;
}

const AlertToast = React.forwardRef<HTMLDivElement, AlertToastProps>(
  (
    {
      className,
      variant = "default",
      title,
      description,
      action,
      onDismiss,
      dismissLabel = "Dismiss",
      ...props
    },
    ref,
  ) => (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      className={cn(
        "pointer-events-auto relative grid w-full max-w-[460px] grid-cols-[20px_1fr_auto] items-start gap-3 rounded-[8px] border border-[#e5e7eb] bg-white py-3.5 pl-4 pr-10 shadow-[0_8px_24px_rgba(0,0,0,0.08),0_2px_4px_rgba(0,0,0,0.04)]",
        toneClasses[variant],
        className,
      )}
      {...props}
    >
      <AlertIcon variant={variant} className="mt-px" />
      <div className="min-w-0">
        <h5 className="text-sm font-semibold leading-[1.2] tracking-[-0.1px] text-[#09090b]">
          {title}
        </h5>
        {description ? (
          <p className="text-[13px] leading-[1.5] text-[#71717a]">{description}</p>
        ) : null}
      </div>
      {action ? <div className="self-center">{action}</div> : null}
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={dismissLabel}
          className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-[6px] text-[#a1a1aa] transition-colors hover:bg-[#f6f6f6] hover:text-[#3d3d3d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  ),
);
AlertToast.displayName = "AlertToast";

/**
 * A toast action is the shared xs button (28px outline pill). Toasts always use
 * the outline variant — a toast is transient, so its action must not read as the
 * page's primary CTA no matter which tone the toast carries.
 */
const AlertToastAction = React.forwardRef<
  HTMLButtonElement,
  Omit<ActionButtonProps, "size" | "variant">
>(({ className, ...props }, ref) => (
  <ActionButton ref={ref} size="xs" variant="outline" className={className} {...props} />
));
AlertToastAction.displayName = "AlertToastAction";

export interface AlertToastOptions {
  variant?: AlertToastVariant;
  description?: React.ReactNode;
  /** Label + handler for the inline action button. */
  action?: { label: React.ReactNode; onClick: () => void };
  duration?: number;
  dismissLabel?: string;
}

/**
 * Floating variant of Alert, rendered top-right through the app's existing
 * sonner runtime. `unstyled` is per-call so sonner's own toasts elsewhere keep
 * their default chrome.
 */
function alertToast(title: React.ReactNode, options: AlertToastOptions = {}) {
  const { variant = "default", description, action, duration, dismissLabel } = options;

  return sonner.custom(
    (id) => (
      <AlertToast
        variant={variant}
        title={title}
        description={description}
        dismissLabel={dismissLabel}
        onDismiss={() => sonner.dismiss(id)}
        action={
          action ? (
            <AlertToastAction
              onClick={() => {
                action.onClick();
                sonner.dismiss(id);
              }}
            >
              {action.label}
            </AlertToastAction>
          ) : undefined
        }
      />
    ),
    { duration, unstyled: true, classNames: { toast: "w-full" } },
  );
}

export { AlertToast, AlertToastAction, alertToast };
export type { AlertToastVariant };
