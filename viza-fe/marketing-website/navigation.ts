import { createNavigation } from "next-intl/navigation";
import { locales, defaultLocale } from "./i18n";

// Locale-aware navigation helpers. router.replace(pathname, { locale }) sets the
// NEXT_LOCALE cookie and rewrites the URL to the right prefix (en unprefixed,
// zh-CN under /zh-CN), keeping cookie + URL consistent for the language switcher.
export const { Link, usePathname, useRouter, redirect } = createNavigation({
  locales: [...locales],
  defaultLocale,
  localePrefix: "as-needed",
});
