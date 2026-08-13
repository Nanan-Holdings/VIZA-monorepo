"use client";

import type { ReactNode } from "react";
import { type Icon as PhosphorIcon } from "@phosphor-icons/react";
import { motion } from "motion/react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface NavDropdownItem {
  id: string;
  label: ReactNode;
  icon?: PhosphorIcon;
  selected?: boolean;
  disabled?: boolean;
  tone?: "default" | "brand" | "danger";
}

export interface NavDropdownProps {
  trigger: ReactNode;
  items: NavDropdownItem[];
  onSelect: (id: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  align?: "start" | "center" | "end";
  sideOffset?: number;
  widthClassName?: string;
  contentClassName?: string;
}

const itemToneClassNames = {
  default: {
    icon: "text-black",
    text: "text-black",
    selected: "bg-[#efefef]",
    hover: "hover:bg-[#f5f5f5]",
  },
  brand: {
    icon: "bg-brand-50 text-brand-500",
    text: "text-brand-500",
    selected: "bg-brand-50",
    hover: "hover:bg-brand-50",
  },
  danger: {
    icon: "bg-red-50 text-red-500",
    text: "text-red-500",
    selected: "bg-red-50",
    hover: "hover:bg-red-50",
  },
} satisfies Record<NonNullable<NavDropdownItem["tone"]>, Record<string, string>>;

export function NavDropdown({
  trigger,
  items,
  onSelect,
  open,
  onOpenChange,
  align = "center",
  sideOffset = 10,
  widthClassName = "w-64 max-w-[calc(100vw-2rem)]",
  contentClassName,
}: NavDropdownProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align={align}
        className="w-auto border-0 bg-transparent p-0 shadow-none"
        sideOffset={sideOffset}
      >
        <motion.div
          animate={{ opacity: 1, scale: 1 }}
          className={cn(
            "relative flex flex-col items-start gap-[8px] rounded-[16px] bg-white p-[12px]",
            widthClassName,
            contentClassName,
          )}
          initial={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 rounded-[16px] border border-[#efefef] border-solid shadow-[0px_0px_8px_0px_rgba(171,171,171,0.25)]"
          />

          {items.map((item, index) => {
            const Icon = item.icon;
            const tone = itemToneClassNames[item.tone ?? "default"];
            return (
              <motion.button
                animate={{ opacity: 1, x: 0 }}
                className={cn(
                  "relative z-10 w-full shrink-0 rounded-[8px] text-left transition-colors",
                  item.selected ? tone.selected : "bg-white",
                  item.disabled
                    ? "cursor-not-allowed opacity-50"
                    : cn("cursor-pointer", tone.hover),
                )}
                disabled={item.disabled}
                initial={{ opacity: 0, x: -20 }}
                key={item.id}
                onClick={() => onSelect(item.id)}
                transition={{
                  duration: 0.3,
                  delay: index * 0.1,
                  ease: "easeOut",
                }}
                type="button"
                whileHover={
                  item.disabled
                    ? undefined
                    : { scale: 1.02, transition: { duration: 0.2 } }
                }
                whileTap={item.disabled ? undefined : { scale: 0.98 }}
              >
                <div className="flex w-full items-center gap-[12px] p-[12px]">
                  {Icon && (
                    <span
                      className={cn(
                        "flex shrink-0 items-center justify-center",
                        item.tone === "brand" || item.tone === "danger"
                          ? "size-8 rounded-full"
                          : "size-4",
                        tone.icon,
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                  )}
                  <span className={cn("min-w-0 truncate font-medium leading-[1.5] text-[16px] tracking-[-0.24px]", tone.text)}>
                    {item.label}
                  </span>
                </div>
              </motion.button>
            );
          })}
        </motion.div>
      </PopoverContent>
    </Popover>
  );
}
