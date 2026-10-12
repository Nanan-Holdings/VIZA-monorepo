"use client";

import { cn } from "@/lib/utils";

interface ConversationSeparatorProps {
  timestamp?: Date | number;
  locale?: string;
  className?: string;
}

/**
 * Format timestamp for conversation separator
 */
function formatSeparatorTime(timestamp: Date | number, locale = "en"): string {
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffDays = Math.floor((today.getTime() - targetDay.getTime()) / (1000 * 60 * 60 * 24));

  const isZh = locale.toLowerCase().startsWith("zh");
  const timeStr = date.toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  if (diffDays === 0) return isZh ? `今天 ${timeStr}` : `Today at ${timeStr}`;
  if (diffDays === 1) return isZh ? `昨天 ${timeStr}` : `Yesterday at ${timeStr}`;

  const dateStr = date.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });

  return isZh ? `${dateStr} ${timeStr}` : `${dateStr} at ${timeStr}`;
}

/**
 * Visual separator for new conversations in the continuous stream
 * Shows "New conversation" with timestamp
 */
export function ConversationSeparator({ timestamp, locale = "en", className }: ConversationSeparatorProps) {
  return (
    <div className={cn("flex items-center justify-center py-6", className)}>
      <div className="flex items-center gap-3 w-full">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-gray-300" />
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-xs font-medium text-gray-500">
            {locale.toLowerCase().startsWith("zh") ? "新对话" : "New conversation"}
          </span>
          {timestamp && (
            <span className="text-[10px] text-gray-400">
              {formatSeparatorTime(timestamp, locale)}
            </span>
          )}
        </div>
        <div className="flex-1 h-px bg-gradient-to-l from-transparent via-gray-300 to-gray-300" />
      </div>
    </div>
  );
}
