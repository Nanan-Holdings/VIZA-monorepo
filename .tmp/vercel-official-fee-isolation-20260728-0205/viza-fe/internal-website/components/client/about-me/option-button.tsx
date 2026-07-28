"use client";

import React from "react";

interface OptionButtonProps {
  label: string;
  selected: boolean;
  onClick: () => void;
}

export function OptionButton({ label, selected, onClick }: OptionButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full h-[54px] px-[16px] py-[14px] rounded-[12px] border text-[16px] leading-[1.3] tracking-[-0.48px] font-normal text-left transition-colors duration-150 focus:outline-none md:h-[66px] md:px-[24px] md:py-[20px] md:text-[20px] md:tracking-[-0.6px] ${
        selected
          ? "bg-[#FDF5F1] border-[#C1785D] text-black border-2"
          : "bg-white border-[#EFEFEF] text-black hover:border-[#E3E3E3]"
      }`}
    >
      {label}
    </button>
  );
}
