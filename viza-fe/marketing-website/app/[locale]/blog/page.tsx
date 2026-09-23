import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import MarketingBlogFeed from "@/components/MarketingBlogFeed";
import { locales, type Locale } from "@/i18n";
import { getMarketingBlogFeed } from "@/lib/marketing-blog";
import { blogCategories } from "@/lib/blog-taxonomy";
import { blogUrl, breadcrumbJsonLd, jsonLd } from "@/lib/blog-structured-data";
import { Link } from "@/navigation";

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
  const categories = result.status === "ok" ? blogCategories(result.feed.posts) : [];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(breadcrumbJsonLd([
        { name: t("title"), url: blogUrl("/blog", locale) },
      ]))} />
      {result.status === "ok" ? <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd({
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: t("title"),
        url: blogUrl("/blog", locale),
        inLanguage: locale,
        mainEntity: {
          "@type": "ItemList",
          itemListElement: result.feed.posts.map((post, index) => ({
            "@type": "ListItem", position: index + 1, url: blogUrl(`/blog/${post.slug}`, locale),
          })),
        },
      })} /> : null}
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
          {categories.length > 0 ? (
            <nav aria-label={t("categoriesLabel")} className="mb-10 flex flex-wrap gap-2">
              {categories.map((category) => (
                <Link key={category.slug} href={`/blog/category/${category.slug}`} locale={locale} className="rounded-pill border border-border-hairline bg-card px-4 py-2 text-sm text-fg-1 hover:border-brand-300 hover:text-brand-500">
                  {category.name} <span className="text-fg-2">({category.count})</span>
                </Link>
              ))}
            </nav>
          ) : null}
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
