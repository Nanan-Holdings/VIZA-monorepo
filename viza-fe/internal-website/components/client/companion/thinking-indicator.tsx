"use client";

import { cn } from "@/lib/utils";

interface ThinkingIndicatorProps {
  locale?: string;
  className?: string;
}

export function ThinkingIndicator({ locale = "en", className }: ThinkingIndicatorProps) {
  return (
    <div
      className={cn("flex gap-1", className)}
      aria-label={locale.toLowerCase().startsWith("zh") ? "加载中" : "Loading"}
    >
      <span
        className="w-2 h-2 bg-brand-500 rounded-full animate-bounce"
        style={{ animationDelay: "0ms" }}
      />
      <span
        className="w-2 h-2 bg-brand-500 rounded-full animate-bounce"
        style={{ animationDelay: "150ms" }}
      />
      <span
        className="w-2 h-2 bg-brand-500 rounded-full animate-bounce"
        style={{ animationDelay: "300ms" }}
      />
    </div>
  );
}
