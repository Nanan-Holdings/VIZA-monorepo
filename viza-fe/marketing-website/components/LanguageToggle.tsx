"use client";

import { useEffect, useRef, useState } from "react";
import { Globe, Check } from "lucide-react";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/navigation";
import type { Locale } from "@/i18n";

const LANGUAGES: { code: Locale; label: string }[] = [
  { code: "en", label: "English" },
  { code: "zh-CN", label: "中文" },
];

export default function LanguageToggle() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [open]);

  const select = (code: Locale) => {
    setOpen(false);
    if (code !== locale) router.replace(pathname, { locale: code });
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Select language"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-border-hairline bg-white text-fg-1 transition-colors hover:bg-brand-50 hover:text-brand-500"
      >
        <Globe width={18} height={18} strokeWidth={2} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 min-w-[148px] overflow-hidden rounded-xl border border-border-hairline bg-white py-1 shadow-lg"
        >
          {LANGUAGES.map((lang) => {
            const active = lang.code === locale;
            return (
              <button
                key={lang.code}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => select(lang.code)}
                className="flex w-full items-center justify-between gap-3 px-3.5 py-2 text-left text-sm text-fg-1 transition-colors hover:bg-brand-50 hover:text-brand-500"
              >
                <span>{lang.label}</span>
                {active && <Check width={15} height={15} strokeWidth={2.5} className="text-brand-500" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
