"use client";

import { useState, useEffect } from "react";

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  type?: "text" | "number";
}

export function TextInput({
  value,
  onChange,
  placeholder = "Enter your answer...",
  maxLength = 500,
  type = "text",
}: TextInputProps) {
  const [internalValue, setInternalValue] = useState(value || "");

  useEffect(() => {
    setInternalValue(value || "");
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value.slice(0, maxLength);
    setInternalValue(newValue);
    onChange(newValue);
  };

  return (
    <div className="space-y-2">
      <textarea
        value={internalValue}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full px-4 py-3 md:py-4 rounded-md border-2 border-[#EFEFEF] focus:border-[#C1785D] focus:outline-none resize-none font-medium text-[#333] placeholder-[#999] text-base md:text-lg"
        rows={4}
        maxLength={maxLength}
      />
      <p className="text-xs text-[#999] text-right">
        {internalValue.length} / {maxLength}
      </p>
    </div>
  );
}
