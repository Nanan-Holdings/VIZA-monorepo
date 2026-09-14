"use client";

import { useEffect, useMemo, useState } from "react";
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
  const selectLanguageLabel = t("selectLanguage");

  // Keep the asChild trigger element stable while Popover measures its anchor.
  // Recreating a motion button on every parent render makes Radix compose a new
  // ref chain; its anchor state update can then re-render that chain forever.
  const triggerButton = useMemo(
    () => (
      <button
        className={buttonClass + " transition-transform duration-200 ease-out hover:scale-110"}
        type="button"
        aria-label={selectLanguageLabel}
      >
        <Globe
          className={iconSize}
          style={{ color: "var(--nav-stroke-color)" }}
          weight="regular"
        />
      </button>
    ),
    [buttonClass, iconSize, selectLanguageLabel],
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
