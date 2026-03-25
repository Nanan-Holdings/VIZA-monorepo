"use client";

interface MultiSelectOptionProps {
  label: string;
  selected: boolean;
  onClick: () => void;
}

export function MultiSelectOption({
  label,
  selected,
  onClick,
}: MultiSelectOptionProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full px-4 py-3 md:py-5 rounded-md border-2 transition-all text-left font-medium text-base md:text-lg flex items-center justify-between ${
        selected
          ? "border-[#C1785D] bg-[#FDF5F1] text-[#A8644D]"
          : "border-[#EFEFEF] bg-white text-[#333] hover:border-[#C1785D] hover:bg-[#FDF5F1]"
      }`}
    >
      <span>{label}</span>
      {selected && (
        <svg
          className="w-5 h-5 md:w-6 md:h-6 text-[#C1785D] flex-shrink-0"
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
