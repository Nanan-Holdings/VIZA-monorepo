"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { AnimatedDropdown } from "@/components/ui/animated-dropdown";
import { LOCALE_COOKIE, normalizeInterfaceLocale } from "@/lib/i18n/locale";

const languages = [
  { code: "en", label: "English" },
  { code: "zh", label: "中文" },
];

function GlobeIcon({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
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

  const iconSize = size === "mobile" ? "w-[21px] h-[21px]" : "w-[26px] h-[26px]";
  const buttonClass =
    size === "mobile"
      ? "w-9 h-9 flex items-center justify-center cursor-pointer"
      : "p-2.5 cursor-pointer rounded-md";

  const triggerButton = (
    <motion.button
      className={buttonClass}
      type="button"
      aria-label="Select language"
      whileHover={{ scale: 1.1 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <GlobeIcon
        className={iconSize}
        style={{ stroke: "var(--nav-stroke-color)" }}
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
        selected: locale === lang.code,
      }))}
      onSelect={handleSelect}
      searchPlaceholder={t("searchLanguage")}
      emptyText={t("noLanguagesFound")}
      align="end"
    />
  );
}
