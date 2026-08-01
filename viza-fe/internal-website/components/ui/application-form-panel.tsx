import * as React from "react";

import { cn } from "@/lib/utils";

function ApplicationFormPanel({ className, ...props }: React.ComponentProps<"section">) {
  return <section className={cn("application-form-panel border bg-white shadow-none", className)} {...props} />;
}

export { ApplicationFormPanel };
