"use client";

import React from "react";

interface SliderInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
}

export function SliderInput({
  value,
  onChange,
  min = 1,
  max = 10,
  label,
}: SliderInputProps) {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-6">
      {/* Slider track container */}
      <div className="relative w-full">
        {/* Track background */}
        <div className="h-[8px] bg-[#EFEFEF] rounded-[999px] relative w-full">
          {/* Filled progress */}
          <div 
            className="h-[8px] bg-[#E8BFA7] rounded-[999px] absolute top-0 left-0"
            style={{ width: `${percentage}%` }}
          />
        </div>
        
        {/* Thumb/handle */}
        <div 
          className="absolute top-[-8px] w-[24px] h-[24px] -ml-[12px] pointer-events-none"
          style={{ left: `${percentage}%` }}
        >
          <div className="w-[24px] h-[24px] rounded-full bg-[#D09074] shadow-md" />
        </div>

        {/* Invisible input for interaction */}
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="absolute top-0 left-0 w-full h-[8px] opacity-0 cursor-pointer"
        />
      </div>

      {/* Number labels */}
      <div className="flex items-center justify-between w-full font-medium text-[20px] leading-[1.3] tracking-[-0.6px] md:text-[28px] md:tracking-[-1.12px]">
        {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((num) => (
          <button
            key={num}
            onClick={() => onChange(num)}
            className={`transition-colors ${
              value === num ? "text-black" : "text-[#DCDCDC]"
            }`}
          >
            {num}
          </button>
        ))}
      </div>

      {label && <p className="text-center text-sm text-[#666] mt-2">{label}</p>}
    </div>
  );
}
