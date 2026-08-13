import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SupportingDocumentCardProps {
  title: ReactNode;
  description?: ReactNode;
  /**
   * Secondary line rendered under the description — review notes, staff
   * comments, OCR status. Keep it here rather than in `children` so the card
   * body stays exactly two rows and stays subgrid-aligned with its siblings.
   */
  note?: ReactNode;
  required?: boolean;
  headerAside?: ReactNode;
  children: ReactNode;
  className?: string;
  headerLayout?: "inline" | "stacked";
}

export function SupportingDocumentCard({
  title,
  description,
  note,
  required = false,
  headerAside,
  children,
  className,
  headerLayout = "inline",
}: SupportingDocumentCardProps) {
  const stacked = headerLayout === "stacked";

  const heading = (
    <div>
      {/* Only the title line clears the floated aside — the description below it
          gets the card's full width. */}
      <h3
        className={cn(
          "text-[15px] font-medium tracking-[-0.1px] text-[#3d3d3d]",
          stacked && headerAside && "pr-10"
        )}
      >
        {title}
        {required ? (
          <span className="ml-0.5 text-[#EF4444]" aria-hidden="true">
            *
          </span>
        ) : null}
      </h3>
      {description || stacked ? (
        <div className="mt-[5px] min-h-[40px] text-[13px] leading-[1.55] text-black/55">
          {description}
        </div>
      ) : null}
      {note ? <div className="mt-2">{note}</div> : null}
    </div>
  );

  if (!stacked) {
    return (
      <article
        className={cn(
          "group/document-card relative flex h-full min-h-[280px] flex-col gap-4 rounded-xl border border-border bg-white p-5",
          className
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">{heading}</div>
          {headerAside ? (
            <div className="flex shrink-0 items-center gap-2">{headerAside}</div>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col gap-4">{children}</div>
      </article>
    );
  }

  /*
   * Stacked cards wrap their own content height, so a card with a rejection
   * reason is simply taller than its neighbours instead of padding them out.
   * Every stacked card reserves the two-line description row, including cards
   * without description copy. This keeps neighboring upload fields top-aligned
   * while notes, statuses and rejection reasons can still make each card's
   * total height independent.
   */
  return (
    <article
      className={cn(
        "group/document-card relative flex flex-col gap-4 rounded-xl border border-border bg-white p-5",
        className
      )}
    >
      {headerAside ? (
        <div className="absolute right-5 top-5 z-10 flex items-center gap-2">
          {headerAside}
        </div>
      ) : null}
      {heading}
      {children}
    </article>
  );
}
