import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Flat shadcn-style alert: white fill, neutral hairline border, icon inline with
// the title. All variants share the same surface — only the icon and the title
// carry tone. Icon sits in its own 18px grid column so it stays optically
// centred on the title line; alerts without an icon collapse that column.
const alertVariants = cva(
  "relative grid w-full grid-cols-[auto_1fr] items-start rounded-[8px] border !border-[#e5e7eb] !bg-white px-4 py-3.5 [&>*]:col-start-2 [&>svg]:col-start-1 [&>svg]:row-start-1 [&>svg]:ml-px [&>svg]:mr-[13px] [&>svg]:size-[18px]",
  {
    variants: {
      variant: {
        default: "[&>svg]:!text-[#03346E] [&_h5]:!text-[#03346E]",
        info: "[&>svg]:!text-[#03346E] [&_h5]:!text-[#03346E]",
        success: "[&>svg]:!text-[#16a34a] [&_h5]:!text-[#166534]",
        warning: "[&>svg]:!text-[#d97706] [&_h5]:!text-[#92400e]",
        destructive:
          "[&>svg]:!text-[hsl(0_72%_51%)] [&_h5]:!text-[hsl(0_72%_35%)]",
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
      "mb-[2px] text-sm font-semibold leading-[1.3] tracking-[-0.1px]",
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

export { Alert, AlertTitle, AlertDescription, AlertIcon }
