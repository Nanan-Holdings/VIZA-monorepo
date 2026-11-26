"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/navigation";
import { ENABLED_LOCALES, LOCALE_LABELS, rememberLocaleChoice, type Locale } from "@/lib/locales";
import { Check, ChevronDown, Globe } from "../ui/Icons";

const SHORT: Partial<Record<Locale, string>> = { en: "EN", "zh-CN": "中文" };

/**
 * Language menu in the header. Only ENABLED_LOCALES appear. An explicit choice is remembered in the
 * viza_locale cookie so the next visit to / lands in the same language (proxy.ts).
 * `inline` renders the choices as a row of chips, for the phone menu.
 */
export default function LanguageSwitcher({ inline = false }: { inline?: boolean }) {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("ds.header");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("click", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const select = (code: Locale) => {
    setOpen(false);
    rememberLocaleChoice(code);
    if (code !== locale) router.replace(pathname, { locale: code });
  };

  if (inline) {
    return (
      <div className="ds-lang-row" role="group" aria-label={t("language")}>
        {ENABLED_LOCALES.map((code) => (
          <button
            key={code}
            type="button"
            className="ds-chip ds-chip--muted ds-lang-chip"
            aria-pressed={code === locale}
            onClick={() => select(code)}
          >
            {LOCALE_LABELS[code]}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="ds-lang" ref={rootRef}>
      <button
        type="button"
        className="ds-lang-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("language")}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <Globe size={16} />
        <span>{SHORT[locale] ?? locale.toUpperCase()}</span>
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="ds-lang-menu" role="menu">
          {ENABLED_LOCALES.map((code) => (
            <button
              key={code}
              type="button"
              role="menuitemradio"
              aria-checked={code === locale}
              className="ds-lang-item"
              onClick={() => select(code)}
            >
              <span>{LOCALE_LABELS[code]}</span>
              {code === locale && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
