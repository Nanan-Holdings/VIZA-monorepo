"use client";

import { cn } from "@/lib/utils";

interface ThinkingIndicatorProps {
  className?: string;
}

export function ThinkingIndicator({ className }: ThinkingIndicatorProps) {
  return (
    <div className={cn("flex gap-3", className)}>
      {/* Labs AI avatar */}
      <div className="w-8 h-8 rounded-full bg-[#c1785d]/10 flex items-center justify-center flex-shrink-0">
        <span className="text-[#c1785d] text-sm">✻</span>
      </div>

      {/* Typing indicator */}
      <div className="bg-white rounded-xl rounded-tl-md border border-gray-100 px-4 py-3 shadow-sm">
        <div className="flex gap-1" aria-label="Loading">
          <span
            className="w-2 h-2 bg-[#c1785d] rounded-full animate-bounce"
            style={{ animationDelay: "0ms" }}
          />
          <span
            className="w-2 h-2 bg-[#c1785d] rounded-full animate-bounce"
            style={{ animationDelay: "150ms" }}
          />
          <span
            className="w-2 h-2 bg-[#c1785d] rounded-full animate-bounce"
            style={{ animationDelay: "300ms" }}
          />
        </div>
      </div>
    </div>
  );
}
