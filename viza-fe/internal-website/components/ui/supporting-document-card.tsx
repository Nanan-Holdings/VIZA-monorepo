import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SupportingDocumentCardProps {
  icon: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  required?: boolean;
  optionalLabel?: ReactNode;
  headerAside?: ReactNode;
  children: ReactNode;
  className?: string;
  titleClassName?: string;
  bodyClassName?: string;
  headerLayout?: "inline" | "stacked";
}

export function SupportingDocumentCard({
  icon,
  title,
  description,
  required = false,
  optionalLabel,
  headerAside,
  children,
  className,
  titleClassName,
  bodyClassName,
  headerLayout = "inline",
}: SupportingDocumentCardProps) {
  const heading = (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <h3
          className={cn(
            "text-base font-semibold text-foreground",
            titleClassName
          )}
        >
          {title}
          {required ? (
            <span className="ml-1 text-red-500" aria-hidden="true">
              *
            </span>
          ) : null}
        </h3>
        {!required && optionalLabel ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {optionalLabel}
          </span>
        ) : null}
      </div>
      {description ? (
        <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {description}
        </div>
      ) : null}
    </>
  );

  return (
    <article
      className={cn(
        "group/document-card flex h-full min-h-[280px] flex-col rounded-xl border border-border bg-white p-5 shadow-sm",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
            {icon}
          </span>
          {headerLayout === "inline" ? (
            <div className="min-w-0">{heading}</div>
          ) : null}
        </div>
        {headerAside ? (
          <div className="flex shrink-0 items-center gap-2">{headerAside}</div>
        ) : null}
      </div>

      <div className={cn("mt-4 flex flex-1 flex-col", bodyClassName)}>
        {headerLayout === "stacked" ? heading : null}
        {children}
      </div>
    </article>
  );
}
