"use client";

import * as React from "react";

import { InputGroup } from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

type ApplicationFormInputGroupProps = React.ComponentProps<typeof InputGroup> & {
  filled?: boolean;
  forceWhiteBackground?: boolean;
};

function ApplicationFormInputGroup({
  className,
  filled = false,
  forceWhiteBackground = false,
  ...props
}: ApplicationFormInputGroupProps) {
  return (
    <InputGroup
      className={cn("application-form-control application-form-input", className)}
      data-filled={filled ? "true" : "false"}
      data-force-white={forceWhiteBackground ? "true" : "false"}
      {...props}
    />
  );
}

function ApplicationFormControlDisplay({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn(
        "application-form-control flex items-center px-3 text-[14px] leading-5 text-gray-500",
        className,
      )}
      {...props}
    />
  );
}

export {
  ApplicationFormControlDisplay,
  ApplicationFormInputGroup,
  type ApplicationFormInputGroupProps,
};
