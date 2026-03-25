"use client";

import React from "react";

interface QuizQuestionProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function QuizQuestion({ title, subtitle, children }: QuizQuestionProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl md:text-[28px] font-bold text-[#333]">{title}</h2>
        {subtitle && <p className="text-sm md:text-base text-[#666]">{subtitle}</p>}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
