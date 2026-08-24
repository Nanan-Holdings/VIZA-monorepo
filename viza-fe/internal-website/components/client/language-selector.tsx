"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { AnimatedDropdown } from "@/components/ui/animated-dropdown";
import { LOCALE_COOKIE, normalizeInterfaceLocale } from "@/lib/i18n/locale";
import { Globe } from "@phosphor-icons/react";

const languages = [
  { code: "en", label: "English" },
  { code: "zh", label: "中文" },
];

interface LanguageSelectorProps {
  size?: "desktop" | "mobile";
}

export function LanguageSelector({ size = "desktop" }: LanguageSelectorProps) {
  const locale = useLocale();
  const t = useTranslations("common");
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleSelect = (code: string) => {
    const nextLocale = normalizeInterfaceLocale(code);
    document.cookie = `${LOCALE_COOKIE}=${nextLocale}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    window.localStorage.setItem(LOCALE_COOKIE, nextLocale);
    window.dispatchEvent(new CustomEvent("viza:locale-change", { detail: nextLocale }));
    router.refresh();
  };

  const iconSize = size === "mobile" ? "w-[19px] h-[19px]" : "w-[24px] h-[24px]";
  const buttonClass =
    size === "mobile"
      ? "h-9 max-w-[104px] px-2 flex items-center justify-center gap-1 cursor-pointer"
      : "p-2.5 cursor-pointer rounded-md inline-flex items-center gap-2";

  const triggerButton = (
    <motion.button
      className={buttonClass}
      type="button"
      aria-label="Select language"
      whileHover={{ scale: 1.1 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <Globe
        className={iconSize}
        style={{ color: "var(--nav-stroke-color)" }}
        weight="regular"
      />
      <span
        className="min-w-0 truncate whitespace-nowrap text-[11px] font-medium sm:text-[12px]"
        style={{ color: "var(--nav-text-color)" }}
      >
        Language/语言
      </span>
    </motion.button>
  );

  if (!isMounted) {
    return triggerButton;
  }

  return (
    <AnimatedDropdown
      trigger={triggerButton}
      items={languages.map((lang) => ({
        id: lang.code,
        label: lang.label,
        selected: normalizeInterfaceLocale(locale) === lang.code,
      }))}
      onSelect={handleSelect}
      searchPlaceholder={t("searchLanguage")}
      emptyText={t("noLanguagesFound")}
      align="end"
    />
  );
}
