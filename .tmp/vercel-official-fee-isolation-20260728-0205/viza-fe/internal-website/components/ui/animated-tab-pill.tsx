"use client";

import { type ReactNode } from "react";
import { motion } from "motion/react";
import clsx from "clsx";
import { cn } from "@/lib/utils";

export interface TabPillItem {
  id: string;
  label: ReactNode;
}

export interface AnimatedTabPillProps {
  tabs: TabPillItem[];
  activeTab: string | null;
  onTabChange: (id: string) => void;
  variant?: "text" | "pill";
  isDark?: boolean;
  className?: string;
  activeColor?: string;
  inactiveColor?: string;
}

export function AnimatedTabPill({
  tabs,
  activeTab,
  onTabChange,
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
              className="px-5 py-1.5 font-switzer font-medium text-lg whitespace-nowrap transition-colors duration-300"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <motion.span
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
            onClick={() => onTabChange(tab.id)}
            className={clsx(
              "px-[16px] py-[6px] rounded-full text-[16px] leading-[1.6] font-medium whitespace-nowrap shrink-0 transition-colors duration-200 border border-solid",
              isActive
                ? "bg-transparent border-transparent text-[#03346E]"
                : isDark
                  ? "bg-transparent border-[rgba(255,255,255,0.3)] text-[rgba(255,255,255,0.6)]"
                  : "bg-white border-[#ececec] text-black",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
