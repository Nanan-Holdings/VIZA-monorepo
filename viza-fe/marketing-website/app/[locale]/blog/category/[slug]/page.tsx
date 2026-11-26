import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import SiteHeader from "@/design-system/sections/SiteHeader";
import SiteFooter from "@/design-system/sections/SiteFooter";
import PageHead from "@/design-system/sections/PageHead";
import FilterTabs from "@/design-system/sections/FilterTabs";
import ArticleCards from "@/design-system/sections/ArticleCards";
import EndCta from "@/design-system/sections/EndCta";
import type { Locale } from "@/i18n";
import { getMarketingBlogFeed } from "@/lib/marketing-blog";
import { blogCategories, categorySlug } from "@/lib/blog-taxonomy";
import { clip, clipTitle, pageMetadata } from "@/lib/seo/metadata";
import { blogUrl, breadcrumbJsonLd, jsonLd } from "@/lib/blog-structured-data";

export const revalidate = false;

/** No pages at build: each post renders once on first request, is cached, and is refreshed only by /api/revalidate. */
export function generateStaticParams() {
  return [];
}
export const dynamicParams = true;

interface CategoryPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { locale: localeParam, slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
  const locale = localeParam as Locale;
  const [t, result] = await Promise.all([
    getTranslations({ locale, namespace: "pages.blog" }),
    getMarketingBlogFeed(locale),
  ]);
  const category = result.status === "ok"
    ? blogCategories(result.feed.posts).find((item) => item.slug === slug)
    : undefined;
  if (!category) return { robots: { index: false, follow: false } };
  return pageMetadata({
    title: clipTitle(t("categoryMetaTitle", { category: category.name }).replace(/ \| VIZA$/, "")),
    description: clip(t("categoryMetaDescription", { category: category.name }), 155),
    path: `/blog/category/${slug}`,
    locale,
    ogKey: "blog",
    hreflang: "none",
  });
}

export default async function BlogCategoryPage({ params }: CategoryPageProps) {
  const { locale: localeParam, slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
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
      <SiteHeader active="news" />
      <main className="ds-main">
        <PageHead title={category?.name ?? t("unavailableTitle")} lede={category ? t("categoryLede", { category: category.name }) : undefined} />
        <section className="ds-container ds-section" style={{ paddingTop: 0 }}>
          <FilterTabs
            label={t("categoriesLabel")}
            tabs={result.status === "ok" ? [
              { label: t("allPosts"), href: "/blog" },
              ...blogCategories(result.feed.posts).map((c) => ({ label: c.name, href: `/blog/category/${c.slug}`, count: c.count, current: c.slug === slug })),
            ] : []}
          />
          <div style={{ height: 48 }} />
          {result.status === "unavailable" ? (
            <div className="ds-empty"><p className="ds-body">{t("unavailableBody")}</p></div>
          ) : posts.length > 0 ? (
            <ArticleCards
              items={posts.map((post) => ({
                href: `/blog/${post.slug}`,
                image: post.coverImageUrl,
                meta: post.category || post.authorName,
                title: post.title,
                body: post.excerpt,
              }))}
            />
          ) : (
            <div className="ds-empty"><p className="ds-body">{t("emptyBody")}</p></div>
          )}
        </section>
        <EndCta title={t("ctaTitle")} body={t("ctaBody")} action={t("ctaAction")} href="/apply" />
      </main>
      <SiteFooter />
    </>
  );
}
