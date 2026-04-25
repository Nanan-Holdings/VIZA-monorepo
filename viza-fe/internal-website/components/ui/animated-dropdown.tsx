"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface AnimatedDropdownItem {
  id: string;
  label: ReactNode;
  searchKeywords?: string;
  selected?: boolean;
  disabled?: boolean;
}

export interface AnimatedDropdownProps {
  trigger: ReactNode;
  items: AnimatedDropdownItem[];
  onSelect: (id: string) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  contentClassName?: string;
  width?: number | string;
  filterFn?: (item: AnimatedDropdownItem, search: string) => boolean;
}

const defaultFilter = (item: AnimatedDropdownItem, search: string) => {
  const haystack = `${item.searchKeywords ?? ""} ${
    typeof item.label === "string" ? item.label : ""
  }`.toLowerCase();
  return haystack.includes(search.toLowerCase());
};

export function AnimatedDropdown({
  trigger,
  items,
  onSelect,
  searchable = true,
  searchPlaceholder = "Search…",
  emptyText = "No results",
  align = "end",
  side,
  open: controlledOpen,
  onOpenChange,
  contentClassName,
  width = 224,
  filterFn = defaultFilter,
}: AnimatedDropdownProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && searchable) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
    if (!open) setSearch("");
  }, [open, searchable]);

  const filtered =
    searchable && search ? items.filter((i) => filterFn(i, search)) : items;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align={align}
        side={side}
        className="w-auto p-0 border-0 bg-transparent shadow-none"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          style={{ width: typeof width === "number" ? `${width}px` : width }}
          className={cn(
            "flex flex-col gap-[8px] p-[12px] rounded-[16px] bg-white relative",
            contentClassName,
          )}
        >
          <div
            aria-hidden="true"
            className="absolute border border-[#efefef] border-solid inset-0 pointer-events-none rounded-[16px] shadow-[0px_0px_8px_0px_rgba(171,171,171,0.25)]"
          />

          {searchable && (
            <div className="relative z-10">
              <div className="flex items-center gap-[12px] p-[12px] rounded-[8px] bg-[#f5f5f5]">
                <svg
                  className="w-4 h-4 text-[#999] shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  placeholder={searchPlaceholder}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-transparent text-[16px] leading-[1.5] text-[#3d3d3d] placeholder:text-[#999] outline-none"
                />
              </div>
            </div>
          )}

          {filtered.length > 0 ? (
            filtered.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.1, ease: "easeOut" }}
                whileHover={
                  item.disabled
                    ? undefined
                    : { scale: 1.02, transition: { duration: 0.2 } }
                }
                whileTap={item.disabled ? undefined : { scale: 0.98 }}
                className={cn(
                  "relative rounded-[8px] shrink-0 w-full z-10",
                  item.selected ? "bg-[#efefef]" : "bg-white",
                  item.disabled
                    ? "opacity-50 cursor-not-allowed"
                    : "cursor-pointer",
                )}
                onClick={() => {
                  if (item.disabled) return;
                  onSelect(item.id);
                  setOpen(false);
                }}
              >
                <div className="flex items-center justify-between p-[12px]">
                  <p className="font-medium leading-[1.5] text-[#3d3d3d] text-[16px] tracking-[-0.24px]">
                    {item.label}
                  </p>
                  {item.selected && (
                    <svg
                      className="w-4 h-4 text-[#3d3d3d]"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
              </motion.div>
            ))
          ) : (
            <div className="relative z-10 px-3 py-2 text-[14px] text-[#999]">
              {emptyText}
            </div>
          )}
        </motion.div>
      </PopoverContent>
    </Popover>
  );
}
