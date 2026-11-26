import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import SiteHeader from "@/design-system/sections/SiteHeader";
import SiteFooter from "@/design-system/sections/SiteFooter";
import PageHead from "@/design-system/sections/PageHead";
import FilterTabs from "@/design-system/sections/FilterTabs";
import ArticleCards from "@/design-system/sections/ArticleCards";
import EndCta from "@/design-system/sections/EndCta";
import { locales, type Locale } from "@/i18n";
import { getMarketingBlogFeed } from "@/lib/marketing-blog";
import { blogCategories } from "@/lib/blog-taxonomy";
import { pageMetadata } from "@/lib/seo/metadata";
import { blogUrl, breadcrumbJsonLd, jsonLd } from "@/lib/blog-structured-data";

export const revalidate = false;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const [t, result] = await Promise.all([
    getTranslations({ locale, namespace: "pages.blog" }),
    getMarketingBlogFeed(locale as Locale),
  ]);
  // A locale with no published posts stays out of the index until it has some. A failed feed
  // fetch is not "empty": it must not noindex the page for the length of the cache.
  const empty = result.status === "ok" && result.feed.posts.length === 0;
  return pageMetadata({
    title: t("metaTitle"),
    description: t("metaDescription"),
    path: "/blog",
    locale,
    ogKey: "blog",
    hreflang: "none",
    noindex: empty,
  });
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
  const posts = result.status === "ok" ? result.feed.posts : [];

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
      <SiteHeader active="news" />
      <main className="ds-main">
        <PageHead title={t("title")} lede={t("lede")} />
        <section className="ds-container ds-section" style={{ paddingTop: 0 }}>
          <FilterTabs
            label={t("categoriesLabel")}
            tabs={categories.length ? [
              { label: t("allPosts"), href: "/blog", current: true },
              ...categories.map((c) => ({ label: c.name, href: `/blog/category/${c.slug}`, count: c.count })),
            ] : []}
          />
          <div style={{ height: 48 }} />
          {result.status === "unavailable" ? (
            <div className="ds-empty">
              <h2 className="ds-statement">{t("unavailableTitle")}</h2>
              <p className="ds-body">{t("unavailableBody")}</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="ds-empty">
              <h2 className="ds-statement">{t("emptyTitle")}</h2>
              <p className="ds-body">{t("emptyBody")}</p>
            </div>
          ) : (
            <ArticleCards
              items={posts.map((post) => ({
                href: `/blog/${post.slug}`,
                image: post.coverImageUrl,
                meta: post.category || post.authorName,
                title: post.title,
                body: post.excerpt,
              }))}
            />
          )}
        </section>
        <EndCta title={t("ctaTitle")} body={t("ctaBody")} action={t("ctaAction")} href="/apply" />
      </main>
      <SiteFooter />
    </>
  );
}
