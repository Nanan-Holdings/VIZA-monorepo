"use client";

import * as React from "react";

import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const ApplicationFormTextarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentPropsWithoutRef<typeof Textarea> & { forceWhiteBackground?: boolean }
>(({ className, forceWhiteBackground = false, value, defaultValue, ...props }, ref) => (
  <Textarea
    ref={ref}
    className={cn("application-form-control shadow-none", className)}
    value={value}
    defaultValue={defaultValue}
    data-filled={String(Boolean(String(value ?? defaultValue ?? "").trim()))}
    data-force-white={forceWhiteBackground ? "true" : "false"}
    {...props}
  />
));
ApplicationFormTextarea.displayName = "ApplicationFormTextarea";

export { ApplicationFormTextarea };
