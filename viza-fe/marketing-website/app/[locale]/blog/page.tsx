import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import MarketingBlogFeed from "@/components/MarketingBlogFeed";
import { locales, type Locale } from "@/i18n";
import { getMarketingBlogFeed } from "@/lib/marketing-blog";

export const revalidate = 300;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages.blog" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { canonical: locale === "en" ? "/blog" : `/${locale}/blog` },
  };
}

export default async function BlogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: localeParam } = await params;
  const locale = localeParam as Locale;
  setRequestLocale(locale);
  const [t, result] = await Promise.all([
    getTranslations({ locale, namespace: "pages.blog" }),
    getMarketingBlogFeed(locale),
  ]);

  return (
    <>
      <SiteNav activeTab="blog" />
      <main className="min-h-[60vh] bg-page">
        <header className="border-b border-border-hairline bg-brand-50">
          <div className="container-page py-16 sm:py-20">
            <span className="text-sm font-medium uppercase tracking-wider text-brand-500">{t("eyebrow")}</span>
            <h1 className="mt-4 max-w-3xl text-4xl text-fg-1 sm:text-5xl">{t("title")}</h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-fg-2">{t("lede")}</p>
          </div>
        </header>
        <section className="container-page py-14 sm:py-20">
          {result.status === "unavailable" ? (
            <div className="rounded-2xl border border-border-hairline bg-surface-subtle p-8 text-center">
              <h2 className="text-xl">{t("unavailableTitle")}</h2>
              <p className="mt-3 text-fg-2">{t("unavailableBody")}</p>
            </div>
          ) : result.feed.posts.length === 0 ? (
            <div className="rounded-2xl border border-border-hairline bg-surface-subtle p-8 text-center">
              <h2 className="text-xl">{t("emptyTitle")}</h2>
              <p className="mt-3 text-fg-2">{t("emptyBody")}</p>
            </div>
          ) : (
            <MarketingBlogFeed posts={result.feed.posts} locale={locale} readArticleLabel={t("readArticle")} />
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
