"use client";

import { SmoothProgressBar } from "@/components/smooth-progress";

interface QuizProgressProps {
  sections: Array<{ id: string; name: string }>;
  currentSectionIndex: number;
}

export function QuizProgress({
  sections,
  currentSectionIndex,
}: QuizProgressProps) {
  const progressPercentage = ((currentSectionIndex + 1) / sections.length) * 100;

  return (
    <div className="w-full space-y-4">
      {/* Progress bar */}
      <SmoothProgressBar
        displayedProgress={progressPercentage}
        showValue={false}
        trackClassName="bg-[#EFEFEF]"
        barClassName="bg-gradient-to-r from-[#E8BFA7] to-[#A8644D]"
      />

      {/* Section indicators - hidden on mobile */}
      <div className="hidden md:flex justify-between gap-2">
        {sections.map((section, index) => (
          <div
            key={section.id}
            className="flex flex-col items-center gap-2 flex-1"
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                index <= currentSectionIndex
                  ? "bg-[#A8644D] text-white"
                  : "bg-[#EFEFEF] text-[#999]"
              }`}
            >
              {index + 1}
            </div>
            <span
              className={`text-xs text-center transition-colors ${
                index <= currentSectionIndex ? "text-[#A8644D]" : "text-[#DCDCDC]"
              }`}
            >
              {section.name}
            </span>
          </div>
        ))}
      </div>

      {/* Simple progress on mobile */}
      <div className="md:hidden flex items-center justify-between">
        <span className="text-sm font-medium text-[#666]">
          {currentSectionIndex + 1} of {sections.length}
        </span>
        <span className="text-sm text-[#999]">{sections[currentSectionIndex]?.name}</span>
      </div>
    </div>
  );
}
