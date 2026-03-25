"use client";

interface OptionButtonProps {
  label: string;
  selected: boolean;
  onClick: () => void;
}

export function OptionButton({
  label,
  selected,
  onClick,
}: OptionButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full px-4 py-3 md:py-5 rounded-md border-2 transition-all text-left font-medium text-base md:text-lg ${
        selected
          ? "border-[#C1785D] bg-[#FDF5F1] text-[#A8644D]"
          : "border-[#EFEFEF] bg-white text-[#333] hover:border-[#C1785D] hover:bg-[#FDF5F1]"
      }`}
    >
      {label}
    </button>
  );
}
