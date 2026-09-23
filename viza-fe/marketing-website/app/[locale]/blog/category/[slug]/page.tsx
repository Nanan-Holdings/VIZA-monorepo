import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import MarketingBlogFeed, { MarketingBlogTopics } from "@/components/MarketingBlogFeed";
import MarketingBlogCta from "@/components/MarketingBlogCta";
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
      <main className="viza-blog">
        <header className="viza-blog__hero">
          <div className="viza-blog__container">
            <span className="viza-blog__overline">
              <Link href="/blog" locale={locale}>{t("eyebrow")}</Link> · {t("topicLabel")}
            </span>
            <h1>{category?.name ?? t("unavailableTitle")}</h1>
            {category ? <p className="viza-blog__hero-description">{t("categoryLede", { category: category.name })}</p> : null}
          </div>
        </header>
        <section className="viza-blog__band">
          <div className="viza-blog__container">
            <MarketingBlogTopics
              categories={result.status === "ok" ? blogCategories(result.feed.posts) : []}
              locale={locale}
              categoriesLabel={t("categoriesLabel")}
              allPostsLabel={t("allPosts")}
              currentSlug={slug}
            />
            {result.status === "unavailable" ? (
              <p className="viza-blog__empty">{t("unavailableBody")}</p>
            ) : posts.length > 0 ? (
              <MarketingBlogFeed posts={posts} locale={locale} readArticleLabel={t("readArticle")} />
            ) : (
              <p className="viza-blog__empty">{t("emptyBody")}</p>
            )}
          </div>
        </section>
        <MarketingBlogCta
          locale={locale}
          eyebrow={t("ctaEyebrow")}
          title={t("ctaTitle")}
          body={t("ctaBody")}
          action={t("ctaAction")}
        />
      </main>
      <SiteFooter />
    </>
  );
}
