"use client";

import { type ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export interface TabPillItem {
  id: string;
  label: ReactNode;
}

export interface AnimatedTabPillProps {
  tabs: TabPillItem[];
  activeTab: string | null;
  onTabChange: (id: string) => void;
  /**
   * Called when a tab is hovered or focused — i.e. the moment intent shows,
   * before the click. Used to start loading the destination.
   */
  onTabIntent?: (id: string) => void;
  variant?: "text" | "pill";
  isDark?: boolean;
  className?: string;
  activeColor?: string;
  inactiveColor?: string;
}

export function getTabPillStateClasses(isActive: boolean, isDark: boolean) {
  if (isActive) {
    return isDark
      ? "bg-white border-white text-brand-500"
      : "bg-transparent border-transparent text-brand-500";
  }

  return isDark
    ? "bg-transparent border-[rgba(255,255,255,0.3)] text-[rgba(255,255,255,0.6)]"
    : "bg-white border-[#ececec] text-black";
}

export function AnimatedTabPill({
  tabs,
  activeTab,
  onTabChange,
  onTabIntent,
  variant = "text",
  isDark = false,
  className,
  activeColor,
  inactiveColor,
}: AnimatedTabPillProps) {
  const resolvedActive = activeColor ?? (isDark ? "#FFFFFF" : "#03346E");
  const resolvedInactive =
    inactiveColor ?? (isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)");

  if (variant === "text") {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <motion.button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              onFocus={() => onTabIntent?.(tab.id)}
              onMouseEnter={() => onTabIntent?.(tab.id)}
              className="px-5 py-1.5 font-switzer font-medium text-lg whitespace-nowrap transition-colors duration-300"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <motion.span
                data-nav-anchor={tab.id}
                className="relative transition-colors duration-600"
                style={{ color: isActive ? resolvedActive : resolvedInactive }}
              >
                {tab.label}
              </motion.span>
            </motion.button>
          );
        })}
      </div>
    );
  }

  // pill variant
  return (
    <div className={cn("flex gap-[8px]", className)}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            data-nav-anchor={tab.id}
            aria-current={isActive ? "page" : undefined}
            onClick={() => onTabChange(tab.id)}
            onFocus={() => onTabIntent?.(tab.id)}
            onMouseEnter={() => onTabIntent?.(tab.id)}
            onTouchStart={() => onTabIntent?.(tab.id)}
            className={cn(
              "px-[16px] py-[6px] rounded-full text-[16px] leading-[1.6] font-medium whitespace-nowrap shrink-0 transition-colors duration-200 border border-solid",
              getTabPillStateClasses(isActive, isDark),
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
