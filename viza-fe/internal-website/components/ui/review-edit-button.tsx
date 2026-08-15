import * as React from "react";
import { Pencil } from "@phosphor-icons/react/ssr";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ReviewEditButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  label: string;
}

export const ReviewEditButton = React.forwardRef<
  HTMLButtonElement,
  ReviewEditButtonProps
>(function ReviewEditButton({ label, className, type = "button", ...props }, ref) {
  return (
    <Button
      ref={ref}
      type={type}
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      className={cn(
        "h-8 w-8 shrink-0 justify-end rounded-full border-0 bg-transparent p-0 text-brand-500 shadow-none hover:bg-transparent hover:text-brand-700 focus-visible:ring-brand-500/40",
        className,
      )}
      {...props}
    >
      <Pencil className="h-4 w-4" aria-hidden="true" />
    </Button>
  );
});
