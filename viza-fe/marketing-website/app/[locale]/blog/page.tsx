import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import MarketingBlogFeed, { MarketingBlogFeature, MarketingBlogTopics } from "@/components/MarketingBlogFeed";
import MarketingBlogCta from "@/components/MarketingBlogCta";
import { locales, type Locale } from "@/i18n";
import { getMarketingBlogFeed } from "@/lib/marketing-blog";
import { blogCategories } from "@/lib/blog-taxonomy";
import { blogUrl, breadcrumbJsonLd, jsonLd } from "@/lib/blog-structured-data";

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
  const [featuredPost, ...otherPosts] = result.status === "ok" ? result.feed.posts : [];

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
      <main className="viza-blog">
        <header className="viza-blog__hero">
          <div className="viza-blog__container">
            <span className="viza-blog__overline">{t("eyebrow")}</span>
            <h1>{t("title")}</h1>
            <p className="viza-blog__hero-description">{t("lede")}</p>
          </div>
        </header>

        {featuredPost ? (
          <section className="viza-blog__band viza-blog__band--feature" aria-label={t("featuredLabel")}>
            <div className="viza-blog__container">
              <MarketingBlogFeature
                post={featuredPost}
                locale={locale}
                featuredLabel={t("featuredLabel")}
                readArticleLabel={t("readArticle")}
              />
            </div>
          </section>
        ) : null}

        <section className="viza-blog__band">
          <div className="viza-blog__container">
            <div className="viza-blog__section-head">
              <h2>{t("articlesTitle")}</h2>
              <p>{t("articlesDescription")}</p>
            </div>
            <MarketingBlogTopics
              categories={categories}
              locale={locale}
              categoriesLabel={t("categoriesLabel")}
              allPostsLabel={t("allPosts")}
            />
            {result.status === "unavailable" ? (
              <div className="viza-blog__empty">
                <h2>{t("unavailableTitle")}</h2>
                <p>{t("unavailableBody")}</p>
              </div>
            ) : result.feed.posts.length === 0 ? (
              <div className="viza-blog__empty">
                <h2>{t("emptyTitle")}</h2>
                <p>{t("emptyBody")}</p>
              </div>
            ) : otherPosts.length === 0 ? (
              <p className="viza-blog__empty">{t("noMorePosts")}</p>
            ) : (
              <MarketingBlogFeed posts={otherPosts} locale={locale} readArticleLabel={t("readArticle")} />
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
