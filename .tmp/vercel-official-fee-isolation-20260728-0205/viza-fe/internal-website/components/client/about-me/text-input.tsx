"use client";

import React from "react";

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
}

export function TextInput({
  value,
  onChange,
  placeholder = "Type your answer here...",
  maxLength = 500,
}: TextInputProps) {
  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={4}
        className="w-full px-4 py-3 border-2 border-[#EFEFEF] rounded-[12px] focus:border-[#C1785D] focus:outline-none text-[#333] placeholder-[#AAA] resize-none transition-colors"
      />
      <p className="text-xs text-[#999] text-right">
        {value.length} / {maxLength}
      </p>
    </div>
  );
}
