"use client";

import { useState, useEffect } from "react";

interface SliderInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

export function SliderInput({
  value,
  onChange,
  min = 1,
  max = 10,
}: SliderInputProps) {
  const [internalValue, setInternalValue] = useState(value || min);

  useEffect(() => {
    setInternalValue(value || min);
  }, [value, min]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value, 10);
    setInternalValue(newValue);
    onChange(newValue);
  };

  return (
    <div className="space-y-4">
      {/* Range slider */}
      <input
        type="range"
        min={min}
        max={max}
        value={internalValue}
        onChange={handleChange}
        className="w-full h-2 bg-[#EFEFEF] rounded-md appearance-none cursor-pointer accent-[#C1785D]"
      />

      {/* Number buttons */}
      <div className="flex gap-1 md:gap-2 justify-between">
        {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((num) => (
          <button
            key={num}
            onClick={() => {
              setInternalValue(num);
              onChange(num);
            }}
            className={`flex-1 text-xs sm:text-sm md:text-base py-2 md:py-3 rounded border-2 transition-all font-semibold ${
              internalValue === num
                ? "border-[#C1785D] bg-[#FDF5F1] text-[#C1785D]"
                : "border-[#EFEFEF] bg-white text-[#DCDCDC] hover:border-[#C1785D] hover:bg-[#FDF5F1] hover:text-[#C1785D]"
            }`}
          >
            {num}
          </button>
        ))}
      </div>
    </div>
  );
}
