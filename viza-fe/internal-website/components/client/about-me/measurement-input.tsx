"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

interface MeasurementInputProps {
  value: number | string;
  onChange: (value: string) => void;
  unit: string;
  unitOptions?: string[];
  onUnitChange?: (unit: string) => void;
  question: string;
  subtitle?: string;
  placeholder?: string;
}

export function MeasurementInput({
  value,
  onChange,
  unit,
  unitOptions = [],
  onUnitChange,
  question,
  subtitle,
  placeholder = "0",
}: MeasurementInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [isUnitMenuOpen, setIsUnitMenuOpen] = useState(false);
  const unitMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (unitMenuRef.current && !unitMenuRef.current.contains(event.target as Node)) {
        setIsUnitMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    if (/^\d*\.?\d*$/.test(inputValue)) {
      onChange(inputValue);
    }
  };

  const displayValue = typeof value === "number" ? (value === 0 ? "" : value.toString()) : value;
  const hasValue = displayValue !== "";
  const canChangeUnit = unitOptions.length > 1 && typeof onUnitChange === "function";

  return (
    <div className="space-y-8">
      {/* Question header */}
      <div className="space-y-2">
        <h2 className="text-[20px] font-[500] text-black leading-[1.3] tracking-[-0.6px] md:text-[28px] md:tracking-[-1.12px]" style={{ fontFamily: "'Sofia Pro', sans-serif" }}>
          {question}
        </h2>
        {subtitle && (
          <p className="text-[14px] text-[#989898] leading-[1.5] tracking-[-0.24px] md:text-[16px]" style={{ fontFamily: "'Sofia Pro', sans-serif", fontWeight: 500 }}>
            {subtitle}
          </p>
        )}
      </div>

      {/* Input field */}
      <div
        className={`
          border border-[#efefef] rounded-[12px] py-[20px] px-[24px]
          flex items-center justify-between
          transition-all duration-200
          ${isFocused ? "border-[#dcdcdc] shadow-sm" : ""}
        `}
      >
        <input
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className={`
            bg-transparent outline-none
            text-[16px] leading-[1.3] tracking-[-0.48px]
            md:text-[20px] md:tracking-[-0.6px]
            font-['Sofia_Pro:Regular',sans-serif]
            flex-1
            [appearance:textfield]
            [&::-webkit-outer-spin-button]:appearance-none
            [&::-webkit-inner-spin-button]:appearance-none
            placeholder-[#dcdcdc]
            ${hasValue ? "text-black" : "text-[#dcdcdc]"}
          `}
          style={{ fontFamily: "'Sofia Pro', sans-serif" }}
        />

        {/* Unit and chevron */}
        <div className="relative ml-4" ref={unitMenuRef}>
          <button
            type="button"
            disabled={!canChangeUnit}
            onClick={() => setIsUnitMenuOpen((prev) => !prev)}
            className="flex items-center gap-[8px]"
          >
            <span
              className="text-[16px] text-black leading-[1.3] tracking-[-0.48px] font-['Sofia_Pro:Regular',sans-serif] whitespace-nowrap md:text-[20px] md:tracking-[-0.6px]"
              style={{ fontFamily: "'Sofia Pro', sans-serif" }}
            >
              {unit}
            </span>
            <ChevronDown
              className={`w-[24px] h-[24px] flex-shrink-0 text-black transition-transform ${isUnitMenuOpen ? "rotate-180" : ""}`}
              strokeWidth={2}
            />
          </button>

          {isUnitMenuOpen && canChangeUnit && (
            <div className="absolute right-0 top-full z-20 mt-2 min-w-[140px] overflow-hidden rounded-[14px] border border-[#efefef] bg-white shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
              {unitOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    onUnitChange(option);
                    setIsUnitMenuOpen(false);
                  }}
                  className={`w-full px-5 py-3 text-left text-lg transition-colors font-normal ${option === unit ? "bg-[#f7f7f7] text-black" : "text-[#555] hover:bg-[#f7f7f7]"}`}
                >
                  {option}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
