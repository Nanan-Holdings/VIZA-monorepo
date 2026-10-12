"use client";

import { Clock } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface HistoryBoundaryMessageProps {
  locale?: string;
  className?: string;
}

/**
 * Message shown when user has scrolled to the 30-day history boundary
 */
export function HistoryBoundaryMessage({ locale = "en", className }: HistoryBoundaryMessageProps) {
  return (
    <div className={cn("flex items-center justify-center py-6", className)}>
      <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 text-gray-500">
        <Clock className="w-4 h-4" />
        <span className="text-sm">
          {locale.toLowerCase().startsWith("zh")
            ? "已到达 30 天聊天记录范围"
            : "You've reached 30 days of history"}
        </span>
      </div>
    </div>
  );
}
