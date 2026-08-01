"use client";

import { cn } from "@/lib/utils";

function ApplicationYesNoControl({
  name,
  options,
  value,
  disabled = false,
  onValueChange,
}: {
  name: string;
  options: ReadonlyArray<{ value: string; text: string }>;
  value: string;
  disabled?: boolean;
  onValueChange: (value: string) => void;
}) {
  return (
    <div
        className="application-form-control flex h-[var(--application-control-height)] w-full max-w-xs items-stretch gap-1 bg-white p-1"
      role="radiogroup"
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <label
            key={option.value}
            className={cn(
              "flex h-full min-h-0 flex-1 cursor-pointer items-center justify-center rounded-[calc(var(--application-control-radius)-0.25rem)] px-4 py-2 text-center text-[14px] font-medium leading-none focus-within:outline-none",
              selected ? "bg-[#f5f5f5] text-[#3d3d3d]" : "text-[rgba(0,0,0,0.55)] hover:text-[#3d3d3d]",
              disabled && "cursor-not-allowed opacity-50",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={selected}
              disabled={disabled}
              onChange={() => onValueChange(option.value)}
              className="sr-only"
            />
            {option.text}
          </label>
        );
      })}
    </div>
  );
}

export { ApplicationYesNoControl };
