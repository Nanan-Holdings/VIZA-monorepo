"use client";

import React from "react";
import { SmoothProgressBar } from "@/components/smooth-progress";
import { ABOUT_ME_SECTIONS } from "@/lib/forms/about-me-questions";

interface QuizProgressProps {
  sections: typeof ABOUT_ME_SECTIONS;
  currentSectionIndex: number;
  activeProgress?: number; // 0..1 progress within the active section
}

export function QuizProgress({ sections, currentSectionIndex, activeProgress = 0 }: QuizProgressProps) {
  // Overall progress for mobile: (completed sections + partial current) / total
  const overallProgress = Math.max(
    0,
    Math.min(100, Math.round(((currentSectionIndex + activeProgress) / sections.length) * 100))
  );

  return (
    <div className="flex-1 flex items-center justify-start">
      {/* Mobile: single continuous progress bar, no labels */}
      <div className="w-full md:hidden">
        <SmoothProgressBar
          displayedProgress={overallProgress}
          showValue={false}
          trackClassName="bg-[#EFEFEF]"
          barClassName="bg-gradient-to-r from-[#e8bfa7] to-[#a8644d]"
        />
      </div>

      {/* Desktop: per-section progress bars with labels */}
      <div className="hidden md:flex items-center gap-4 w-full">
        {sections.map((section, index) => {
          const isActive = index === currentSectionIndex;
          const isComplete = index < currentSectionIndex;
          const fillPercent = isComplete ? 100 : isActive ? Math.max(0, Math.min(100, Math.round(activeProgress * 100))) : 0;

          return (
            <div key={section.id} className="flex flex-col items-center gap-2 h-[35px] flex-1">
              <div className="w-full">
                {(isActive || isComplete) && (
                  <SmoothProgressBar
                    displayedProgress={fillPercent}
                    showValue={false}
                    trackClassName="bg-[#EFEFEF]"
                    barClassName="bg-gradient-to-r from-[#e8bfa7] to-[#a8644d]"
                  />
                )}
                {!isActive && !isComplete ? (
                  <SmoothProgressBar
                    displayedProgress={0}
                    showValue={false}
                    trackClassName="bg-[#EFEFEF]"
                    barClassName="bg-gradient-to-r from-[#e8bfa7] to-[#a8644d]"
                  />
                ) : null}
              </div>
              <span
                className={`text-[12px] leading-[1.6] font-medium transition-colors whitespace-nowrap text-center ${
                  isActive ? "text-[#A8644D]" : "text-[#DCDCDC]"
                }`}
              >
                {section.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
