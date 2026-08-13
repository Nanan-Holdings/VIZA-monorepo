"use client";

import * as React from "react";
import { Plus } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

interface ApplicationConditionalFieldsPanelProps extends React.ComponentPropsWithoutRef<"div"> {
  addLabel?: React.ReactNode;
  onAdd?: () => void;
  canAdd?: boolean;
}

function ApplicationConditionalFieldsPanel({
  children,
  addLabel,
  onAdd,
  canAdd = false,
  className,
  ...props
}: ApplicationConditionalFieldsPanelProps) {
  return (
    <div
      className={cn(
        "application-conditional-fields-panel flex flex-col gap-2 border bg-white p-4",
        className,
      )}
      {...props}
    >
      {children}
      {canAdd && onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="flex cursor-pointer items-center gap-1.5 self-start px-0.5 py-1 text-[13px] font-medium text-[#03346E] transition-colors hover:text-[#022a5a]"
        >
          <Plus className="h-4 w-4" />
          {addLabel}
        </button>
      )}
    </div>
  );
}

export { ApplicationConditionalFieldsPanel, type ApplicationConditionalFieldsPanelProps };
