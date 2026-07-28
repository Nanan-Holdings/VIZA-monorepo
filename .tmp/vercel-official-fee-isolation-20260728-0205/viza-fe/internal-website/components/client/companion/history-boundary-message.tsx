"use client";

import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface HistoryBoundaryMessageProps {
  className?: string;
}

/**
 * Message shown when user has scrolled to the 30-day history boundary
 */
export function HistoryBoundaryMessage({ className }: HistoryBoundaryMessageProps) {
  return (
    <div className={cn("flex items-center justify-center py-6", className)}>
      <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 text-gray-500">
        <Clock className="w-4 h-4" />
        <span className="text-sm">You&apos;ve reached 30 days of history</span>
      </div>
    </div>
  );
}
