"use client";

import React from "react";

interface MultiSelectOptionProps {
  label: string;
  selected: boolean;
  onClick: () => void;
}

export function MultiSelectOption({ label, selected, onClick }: MultiSelectOptionProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full h-[54px] px-[16px] py-[14px] rounded-[12px] border text-[16px] leading-[1.3] tracking-[-0.48px] font-normal text-left transition-colors duration-150 focus:outline-none flex items-center justify-between md:h-[66px] md:px-[24px] md:py-[20px] md:text-[20px] md:tracking-[-0.6px] ${
        selected
          ? "bg-[#FDF5F1] border-[#C1785D] text-black border-2"
          : "bg-white border-[#EFEFEF] text-black hover:border-[#E3E3E3]"
      }`}
    >
      <span>{label}</span>
      {selected && (
        <svg
          className="w-5 h-5"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      )}
    </button>
  );
}
