"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type ApplicationOptionProps = {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
  name?: string;
  value?: string;
  className?: string;
  labelClassName?: string;
};

type ApplicationCheckboxProps = ApplicationOptionProps & {
  /** Renders the mixed (dash) indicator. The underlying input is marked indeterminate. */
  indeterminate?: boolean;
};

/**
 * Shared shell for checkbox and radio. The control pins to the cap-height of the
 * first line — `(1.5em - 18px) / 2` — so a single-line option reads as vertically
 * centred while a wrapped one keeps the text hanging-indented beside it. One
 * layout covers both cases as long as the root stays at line-height 1.5.
 */
function Option({
  control,
  checked,
  onCheckedChange,
  label,
  description,
  required = false,
  disabled = false,
  invalid = false,
  indeterminate = false,
  id,
  name,
  value,
  className,
  labelClassName,
}: ApplicationCheckboxProps & { control: "checkbox" | "radio" }) {
  const isRadio = control === "radio";

  return (
    <label
      className={cn(
        "inline-flex items-start gap-[10px] text-[15px] font-normal leading-[1.5] text-[#3d3d3d]",
        disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer",
        className,
      )}
    >
      <input
        type={control}
        id={id}
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        required={required}
        ref={(node) => {
          if (node && !isRadio) node.indeterminate = indeterminate;
        }}
        onChange={(event) => onCheckedChange?.(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        data-application-checkbox={isRadio ? undefined : ""}
        data-application-radio={isRadio ? "" : undefined}
        className={cn(
          "mt-[calc((1.5em-18px)/2)] box-border flex h-[18px] w-[18px] flex-none items-center justify-center border-[1.5px] bg-white transition-all duration-150",
          isRadio ? "rounded-full" : "rounded",
          invalid ? "border-red-500" : "border-[#d1d5db]",
          (checked || (!isRadio && indeterminate)) && !invalid && "border-[#03346E]",
          checked && !isRadio && "bg-[#03346E]",
          !checked && !isRadio && indeterminate && "bg-[#03346E]",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-[#03346E]/30 peer-focus-visible:ring-offset-1",
        )}
      >
        {isRadio
          ? checked && <span className="h-2 w-2 rounded-full bg-[#03346E]" />
          : checked
            ? (
              <span className="h-[6px] w-[10px] border-b-2 border-l-2 border-white [transform:rotate(-45deg)_translate(1px,-1px)]" />
            )
            : indeterminate
              ? <span className="h-[2px] w-[10px] rounded-[1px] bg-white" />
              : null}
      </span>
      {label || description ? (
        <span className={cn("flex flex-col gap-[3px] text-pretty", labelClassName)}>
          {label ? (
            <span>
              {label}
              {required ? <span className="ml-1 text-red-500">*</span> : null}
            </span>
          ) : null}
          {description ? (
            <span className="whitespace-pre-line text-[13px] leading-[1.5] text-black/45">
              {description}
            </span>
          ) : null}
        </span>
      ) : null}
    </label>
  );
}

function ApplicationCheckbox(props: ApplicationCheckboxProps) {
  return <Option control="checkbox" {...props} />;
}

function ApplicationRadio(props: ApplicationOptionProps) {
  return <Option control="radio" {...props} />;
}

export {
  ApplicationCheckbox,
  ApplicationRadio,
  type ApplicationCheckboxProps,
  type ApplicationOptionProps,
};
