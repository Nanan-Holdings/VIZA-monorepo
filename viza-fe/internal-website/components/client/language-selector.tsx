"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { AnimatedDropdown } from "@/components/ui/animated-dropdown";
import { normalizeInterfaceLocale, setInterfaceLocalePreference } from "@/lib/i18n/locale";
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
    setInterfaceLocalePreference(code);
    router.refresh();
  };

  const iconSize = size === "mobile" ? "w-[21px] h-[21px]" : "w-[26px] h-[26px]";
  const buttonClass =
    size === "mobile"
      ? "w-9 h-9 flex items-center justify-center cursor-pointer"
      : "p-2.5 cursor-pointer rounded-md";
  const triggerButton = (
    <motion.button
      className={buttonClass}
      type="button"
      aria-label={t("selectLanguage")}
      whileHover={{ scale: 1.1 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <Globe
        className={iconSize}
        style={{ color: "var(--nav-stroke-color)" }}
        weight="regular"
      />
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
