"use client";

import { motion, AnimatePresence } from "motion/react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScrollToBottomFabProps {
  show: boolean;
  onClick: () => void;
  hasNewMessage?: boolean;
  className?: string;
}

/**
 * Floating action button to scroll back to the bottom of the chat
 * Shows when user has scrolled up significantly
 */
export function ScrollToBottomFab({
  show,
  onClick,
  hasNewMessage = false,
  className,
}: ScrollToBottomFabProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.button
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          transition={{ duration: 0.2 }}
          onClick={() => onClick()}
          className={cn(
            "absolute z-20",
            "flex items-center gap-3 px-5 py-3",
            "bg-white border border-gray-200 shadow-lg rounded-full",
            "hover:bg-gray-50 hover:shadow-xl transition-all",
            "focus:outline-none focus:ring-2 focus:ring-[#c1785d] focus:ring-offset-2",
            className
          )}
          aria-label={hasNewMessage ? "New message - scroll to bottom" : "Scroll to bottom"}
        >
          <ChevronDown className="w-5 h-5 text-gray-600" />
          <span className="text-base font-medium text-gray-700">
            {hasNewMessage ? "New message" : "Scroll to bottom"}
          </span>
          {hasNewMessage && (
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#c1785d] rounded-full animate-pulse" />
          )}
        </motion.button>
      )}
    </AnimatePresence>
  );
}
