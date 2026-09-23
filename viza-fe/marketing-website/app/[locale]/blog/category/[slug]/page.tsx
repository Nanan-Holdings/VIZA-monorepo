import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import MarketingBlogFeed from "@/components/MarketingBlogFeed";
import type { Locale } from "@/i18n";
import { getMarketingBlogFeed } from "@/lib/marketing-blog";
import { blogCategories, categorySlug } from "@/lib/blog-taxonomy";
import { blogUrl, breadcrumbJsonLd, jsonLd } from "@/lib/blog-structured-data";
import { Link } from "@/navigation";

export const revalidate = 300;
export const dynamicParams = true;

interface CategoryPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { locale: localeParam, slug } = await params;
  const locale = localeParam as Locale;
  const [t, result] = await Promise.all([
    getTranslations({ locale, namespace: "pages.blog" }),
    getMarketingBlogFeed(locale),
  ]);
  const category = result.status === "ok"
    ? blogCategories(result.feed.posts).find((item) => item.slug === slug)
    : undefined;
  if (!category) return { robots: { index: false, follow: false } };
  return {
    title: t("categoryMetaTitle", { category: category.name }),
    description: t("categoryMetaDescription", { category: category.name }),
    alternates: { canonical: locale === "en" ? `/blog/category/${slug}` : `/${locale}/blog/category/${slug}` },
  };
}

export default async function BlogCategoryPage({ params }: CategoryPageProps) {
  const { locale: localeParam, slug } = await params;
  const locale = localeParam as Locale;
  setRequestLocale(locale);
  const [t, result] = await Promise.all([
    getTranslations({ locale, namespace: "pages.blog" }),
    getMarketingBlogFeed(locale),
  ]);
  const category = result.status === "ok"
    ? blogCategories(result.feed.posts).find((item) => item.slug === slug)
    : undefined;
  if (result.status === "ok" && !category) notFound();
  const posts = result.status === "ok" ? result.feed.posts.filter((post) => post.category && categorySlug(post.category) === slug) : [];

  return (
    <>
      {category ? (
        <>
          <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(breadcrumbJsonLd([
            { name: t("title"), url: blogUrl("/blog", locale) },
            { name: category.name, url: blogUrl(`/blog/category/${slug}`, locale) },
          ]))} />
          <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: category.name,
            url: blogUrl(`/blog/category/${slug}`, locale),
            inLanguage: locale,
            mainEntity: {
              "@type": "ItemList",
              itemListElement: posts.map((post, index) => ({
                "@type": "ListItem", position: index + 1, url: blogUrl(`/blog/${post.slug}`, locale),
              })),
            },
          })} />
        </>
      ) : null}
      <SiteNav activeTab="blog" />
      <main className="min-h-[60vh] bg-page">
        <header className="border-b border-border-hairline bg-brand-50">
          <div className="container-page py-16 sm:py-20">
            <Link href="/blog" locale={locale} className="text-sm font-medium text-brand-500 hover:text-brand-600">← {t("backToBlog")}</Link>
            <h1 className="mt-5 max-w-3xl text-4xl text-fg-1 sm:text-5xl">{category?.name ?? t("unavailableTitle")}</h1>
            {category ? <p className="mt-5 max-w-2xl text-lg text-fg-2">{t("categoryLede", { category: category.name })}</p> : null}
          </div>
        </header>
        <section className="container-page py-14 sm:py-20">
          {result.status === "unavailable" ? (
            <p className="text-fg-2">{t("unavailableBody")}</p>
          ) : posts.length > 0 ? (
            <MarketingBlogFeed posts={posts} locale={locale} readArticleLabel={t("readArticle")} />
          ) : (
            <p className="text-fg-2">{t("emptyBody")}</p>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
