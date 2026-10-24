import "server-only";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { pageMetadata } from "@/lib/seo";

type StaticSeoKey =
  | "apply"
  | "contact"
  | "careers"
  | "security"
  | "status"
  | "privacy"
  | "terms"
  | "product"
  | "events";

/** Metadata for a static marketing route, from the `seo.<key>` messages. */
export async function staticPageMetadata(
  locale: string,
  key: StaticSeoKey,
  path: string,
  options: { noindex?: boolean } = {},
): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: `seo.${key}` });
  return pageMetadata({
    locale,
    path,
    title: t("title"),
    description: t("description"),
    noindex: options.noindex,
  });
}

/** Shared `generateMetadata` for route-segment layouts of client pages. */
export function staticMetadataFor(key: StaticSeoKey, path: string, options: { noindex?: boolean } = {}) {
  return async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale } = await params;
    return staticPageMetadata(locale, key, path, options);
  };
}
