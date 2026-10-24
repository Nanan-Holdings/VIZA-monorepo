"use client";

import { useTranslations } from "next-intl";

/**
 * Shown when the portal's blog API is down. The article and category routes
 * throw instead of rendering a 200 "unavailable" page, so crawlers get a
 * retryable 5xx (not a cached noindex) while readers still get this message.
 */
export default function BlogError() {
  const t = useTranslations("pages.blog");
  return (
    <main className="viza-blog">
      <section className="container-narrow py-20 text-center">
        <h1 className="text-3xl">{t("unavailableTitle")}</h1>
        <p className="mt-4 text-fg-2">{t("unavailableBody")}</p>
      </section>
    </main>
  );
}
