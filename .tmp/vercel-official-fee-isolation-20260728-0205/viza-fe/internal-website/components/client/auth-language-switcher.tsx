"use client";

import { useState, useRef, useEffect } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";

const LOCALE_COOKIE = "NEXT_LOCALE";

const languages = [
  { code: "en", label: "English", short: "EN" },
  { code: "zh", label: "中文", short: "ZH" },
];

export function AuthLanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = languages.find((l) => l.code === locale) ?? languages[0];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleSelect = (code: string) => {
    setOpen(false);
    document.cookie = `${LOCALE_COOKIE}=${code}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    router.refresh();
  };

  return (
    <div ref={ref} className="relative ml-auto">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="whitespace-nowrap hover:opacity-70 transition-opacity font-sans text-[clamp(10px,0.85vw,12px)] font-medium tracking-[-0.21px] leading-[1.5] text-[rgba(0,0,0,0.55)] cursor-pointer"
      >
        {current.label} ({current.short})
      </button>

      {open && (
        <div className="absolute bottom-full right-0 mb-2 min-w-[120px] rounded-[10px] border border-[#efefef] bg-white shadow-[0px_0px_8px_0px_rgba(171,171,171,0.25)] overflow-hidden z-50">
          {languages.map((lang) => {
            const isSelected = locale === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleSelect(lang.code)}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-[12px] font-medium tracking-[-0.21px] text-[#3d3d3d] hover:bg-[#f5f5f5] transition-colors cursor-pointer ${isSelected ? "bg-[#f5f5f5]" : ""}`}
              >
                <span>{lang.label}</span>
                {isSelected && (
                  <svg className="w-3 h-3 text-[#3d3d3d] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
