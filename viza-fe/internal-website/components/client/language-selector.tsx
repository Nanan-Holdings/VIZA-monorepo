"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const LOCALE_COOKIE = "NEXT_LOCALE";

const languages = [
  { code: "en", label: "English" },
  { code: "zh", label: "中文" },
];

function GlobeIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

interface LanguageSelectorProps {
  size?: "desktop" | "mobile";
}

export function LanguageSelector({ size = "desktop" }: LanguageSelectorProps) {
  const locale = useLocale();
  const t = useTranslations("common");
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(locale);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = languages.filter((lang) =>
    lang.label.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    if (open) {
      const timeout = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timeout);
    } else {
      setSearch("");
    }
  }, [open]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleSelect = (code: string) => {
    setSelected(code);
    setOpen(false);
    document.cookie = `${LOCALE_COOKIE}=${code}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    router.refresh();
  };

  const iconSize = size === "mobile" ? "w-[21px] h-[21px]" : "w-[26px] h-[26px]";
  const buttonClass =
    size === "mobile"
      ? "w-9 h-9 flex items-center justify-center cursor-pointer"
      : "p-2.5 cursor-pointer rounded-md";

  if (!isMounted) {
    return (
      <motion.button
        className={buttonClass}
        type="button"
        aria-label="Select language"
        whileHover={{ scale: 1.1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <GlobeIcon className={`${iconSize}`} style={{ stroke: "var(--nav-stroke-color)" }} />
      </motion.button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <motion.button
          className={buttonClass}
          type="button"
          whileHover={{ scale: 1.1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <GlobeIcon className={`${iconSize}`} style={{ stroke: "var(--nav-stroke-color)" }} />
        </motion.button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-auto p-0 border-0 bg-transparent shadow-none"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="flex flex-col gap-[8px] p-[12px] rounded-[16px] w-56 bg-white relative"
        >
          <div
            aria-hidden="true"
            className="absolute border border-[#efefef] border-solid inset-0 pointer-events-none rounded-[16px] shadow-[0px_0px_8px_0px_rgba(171,171,171,0.25)]"
          />

          {/* Search input */}
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
                placeholder={t("searchLanguage")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent text-[16px] leading-[1.5] text-[#3d3d3d] placeholder:text-[#999] outline-none"
              />
            </div>
          </div>

          {/* Language options */}
          {filtered.length > 0 ? (
            filtered.map((lang, i) => {
              const isSelected = selected === lang.code;
              return (
                <motion.div
                  key={lang.code}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: 0.3,
                    delay: i * 0.1,
                    ease: "easeOut",
                  }}
                  whileHover={{
                    scale: 1.02,
                    transition: { duration: 0.2 },
                  }}
                  whileTap={{ scale: 0.98 }}
                  className={`${isSelected ? "bg-[#efefef]" : "bg-white"} relative rounded-[8px] shrink-0 w-full cursor-pointer z-10`}
                  onClick={() => handleSelect(lang.code)}
                >
                  <div className="flex items-center justify-between p-[12px]">
                    <p className="font-medium leading-[1.5] text-[#3d3d3d] text-[16px] tracking-[-0.24px]">
                      {lang.label}
                    </p>
                    {isSelected && (
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
              );
            })
          ) : (
            <div className="relative z-10 px-3 py-2 text-[14px] text-[#999]">
              {t("noLanguagesFound")}
            </div>
          )}
        </motion.div>
      </PopoverContent>
    </Popover>
  );
}
