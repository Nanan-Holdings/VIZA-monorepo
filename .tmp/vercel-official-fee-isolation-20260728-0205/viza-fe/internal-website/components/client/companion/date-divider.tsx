"use client";

import { cn } from "@/lib/utils";

interface DateDividerProps {
  date: Date;
  className?: string;
}

/**
 * Format date for display in divider
 * - Today: "Today"
 * - Yesterday: "Yesterday"
 * - This week: Day name (e.g., "Monday")
 * - This year: "Jan 15"
 * - Other: "Jan 15, 2024"
 */
function formatDividerDate(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffDays = Math.floor((today.getTime() - targetDay.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) {
    return date.toLocaleDateString("en-US", { weekday: "long" });
  }
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Subtle date divider between messages from different days
 */
export function DateDivider({ date, className }: DateDividerProps) {
  return (
    <div className={cn("flex items-center justify-center py-4", className)}>
      <div className="flex items-center gap-3 w-full max-w-[200px]">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400 font-medium whitespace-nowrap">
          {formatDividerDate(date)}
        </span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>
    </div>
  );
}

/**
 * Check if two dates are on different days
 */
export function isDifferentDay(date1: Date | number, date2: Date | number): boolean {
  const d1 = new Date(date1);
  const d2 = new Date(date2);

  return (
    d1.getFullYear() !== d2.getFullYear() ||
    d1.getMonth() !== d2.getMonth() ||
    d1.getDate() !== d2.getDate()
  );
}
