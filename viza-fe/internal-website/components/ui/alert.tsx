import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { ActionButton, type ActionButtonProps } from "@/components/ui/action-button"
import { cn } from "@/lib/utils"

// Flat shadcn-style alert: white fill, neutral hairline border, icon inline with
// the title. All variants share the same surface — only the icon and the title
// carry tone. Icon sits in its own 18px grid column so it stays optically
// centred on the title line; alerts without an icon collapse that column.
//
// Tone reaches AlertAction through the --alert-action-bg custom properties
// rather than `[&_button]` overrides, so an action picks up its alert's tone by
// inheritance and needs no variant prop of its own.
const alertVariants = cva(
  "relative grid w-full grid-cols-[auto_1fr] items-start rounded-[8px] border !border-[#e5e7eb] !bg-white px-4 py-3.5 [--alert-action-bg-hover:#022B5C] [--alert-action-bg:#03346E] [--alert-action-soft:#EEF3FA] [&>*]:col-start-2 [&>svg]:col-start-1 [&>svg]:row-start-1 [&>svg]:ml-px [&>svg]:mr-[13px] [&>svg]:size-[18px]",
  {
    variants: {
      variant: {
        default: "[&>svg]:!text-[#03346E] [&_h5]:!text-[#03346E]",
        info: "[&>svg]:!text-[#03346E] [&_h5]:!text-[#03346E]",
        success:
          "[--alert-action-bg-hover:#15803d] [--alert-action-bg:#16a34a] [--alert-action-soft:#f0fdf4] [&>svg]:!text-[#16a34a] [&_h5]:!text-[#166534]",
        warning:
          "[--alert-action-bg-hover:#92400e] [--alert-action-bg:#b45309] [--alert-action-soft:#fffbeb] [&>svg]:!text-[#d97706] [&_h5]:!text-[#92400e]",
        destructive:
          "[--alert-action-bg-hover:hsl(0_72%_43%)] [--alert-action-bg:hsl(0_72%_51%)] [--alert-action-soft:hsl(0_86%_97%)] [&>svg]:!text-[hsl(0_72%_51%)] [&_h5]:!text-[hsl(0_72%_35%)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
))
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn(
      // No bottom margin and minimal leading: the description's own line-height
      // already contributes ~2.25px of space above its first line, so a margin
      // here reads as a gap rather than as tracking.
      "text-sm font-semibold leading-[1.2] tracking-[-0.1px]",
      className
    )}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "text-[13px] leading-[1.5] !text-[#71717a] [&_p]:leading-[1.5] [&_p]:!text-[#71717a]",
      className
    )}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

// Actions live inside AlertDescription, below the body copy. They are
// deliberately small (28px) — an alert is a notice, not a form step, so its
// buttons must not compete with the page's primary CTA.
const AlertActions = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("mt-2.5 flex flex-wrap items-center gap-2", className)}
    {...props}
  />
))
AlertActions.displayName = "AlertActions"

// An alert action is the shared xs button (28px pill) from the button spec.
// Both action styles inherit the surrounding alert tone: blue for default/info,
// green for success, amber for warning, and red for destructive.
export interface AlertActionProps
  extends Omit<ActionButtonProps, "size" | "variant"> {
  variant?: "primary" | "secondary"
}

const AlertAction = React.forwardRef<HTMLButtonElement, AlertActionProps>(
  ({ className, variant = "primary", ...props }, ref) => (
    <ActionButton
      ref={ref}
      size="xs"
      variant={variant === "secondary" ? "outline" : "neutral"}
      className={cn(
        variant === "primary"
          ? "!bg-[var(--alert-action-bg)] hover:!bg-[var(--alert-action-bg-hover)]"
          : "!border-[var(--alert-action-bg)] !text-[var(--alert-action-bg)] hover:!bg-[var(--alert-action-soft)]",
        className
      )}
      {...props}
    />
  )
)
AlertAction.displayName = "AlertAction"

// Filled (not stroked) tone icons — the alert spec pairs a solid glyph with the
// tone-coloured title. Lucide ships stroke-only outlines, so these are drawn here.
const alertIconPaths = {
  default:
    "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z",
  info: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z",
  success:
    "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z",
  warning: "M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z",
  destructive:
    "M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z",
} as const

function AlertIcon({
  variant = "default",
  className,
  ...props
}: React.SVGProps<SVGSVGElement> & {
  variant?: keyof typeof alertIconPaths
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={cn("h-[18px] w-[18px] shrink-0", className)}
      {...props}
    >
      <path d={alertIconPaths[variant]} />
    </svg>
  )
}

export {
  Alert,
  AlertTitle,
  AlertDescription,
  AlertIcon,
  AlertActions,
  AlertAction,
}
