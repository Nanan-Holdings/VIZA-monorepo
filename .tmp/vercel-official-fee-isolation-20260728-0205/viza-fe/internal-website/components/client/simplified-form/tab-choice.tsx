"use client";

import { cn } from "@/lib/utils";

export interface TabChoiceOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

interface TabChoiceProps<T extends string> {
  name: string;
  value: T | "";
  options: ReadonlyArray<TabChoiceOption<T>>;
  onChange: (value: T) => void;
  columns?: 2 | 3 | 4 | 5;
  className?: string;
  ariaLabel?: string;
}

export function TabChoice<T extends string>({
  name,
  value,
  options,
  onChange,
  columns = 3,
  className,
  ariaLabel,
}: TabChoiceProps<T>) {
  const gridClass =
    columns === 2
      ? "grid-cols-2"
      : columns === 3
        ? "grid-cols-2 sm:grid-cols-3"
        : columns === 5
          ? "grid-cols-2 sm:grid-cols-5"
        : "grid-cols-2 sm:grid-cols-4";

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel ?? name}
      className={cn("grid gap-2", gridClass, className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex min-h-[44px] flex-col items-start justify-center rounded-lg border px-4 py-3 text-left text-[15px] font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              selected
                ? "border-brand-500 bg-brand-500 text-primary-foreground shadow-sm"
                : "border-input bg-white text-foreground hover:border-brand-200 hover:bg-brand-50",
            )}
          >
            <span className="leading-tight">{option.label}</span>
            {option.description ? (
              <span
                className={cn(
                  "mt-0.5 text-xs leading-tight",
                  selected ? "text-primary-foreground/80" : "text-muted-foreground",
                )}
              >
                {option.description}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
