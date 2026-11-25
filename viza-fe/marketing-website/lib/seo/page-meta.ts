import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { pageMetadata } from "@/lib/seo/metadata";

/**
 * generateMetadata for a static page whose title and description live in the
 * `pages.<key>` message namespace.
 */
export async function staticPageMetadata(
  params: Promise<{ locale: string }>,
  key: string,
  path: string,
  opts: { ogKey?: string; noindex?: boolean } = {},
): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: `pages.${key}` });
  return pageMetadata({
    title: t("title"),
    description: t("description"),
    path,
    locale,
    ogKey: opts.ogKey ?? key,
    noindex: opts.noindex,
  });
}
