import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import MarketingBlogArticle from "@/components/MarketingBlogArticle";
import type { Locale } from "@/i18n";
import { getMarketingBlogFeed, getMarketingBlogPost } from "@/lib/marketing-blog";
import { blogUrl, articleJsonLd, breadcrumbJsonLd, jsonLd } from "@/lib/blog-structured-data";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 300;

interface BlogPostPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { locale: localeParam, slug } = await params;
  const locale = localeParam as Locale;
  const result = await getMarketingBlogPost(slug, locale);
  if (result.status === "not-found") return { robots: { index: false, follow: false } };
  // An API outage must not cache a noindex page under a live article URL:
  // throw so ISR keeps serving the last good render (or answers 500, which
  // crawlers retry) instead of a 200 "temporarily unavailable" page.
  if (result.status !== "ok") throw new Error(`Marketing blog post unavailable: ${slug}`);

  const { post } = result;
  const title = post.seoTitle || post.title;
  return pageMetadata({
    locale,
    path: `/blog/${post.slug}`,
    title,
    // Long editorial headlines already fill the slot; skip the brand suffix.
    absoluteTitle: title.length > 52,
    description: post.seoDescription || post.excerpt,
    type: "article",
    // Articles are written per locale with their own slugs.
    bilingual: false,
    image: post.coverImageUrl ? { url: post.coverImageUrl, alt: post.title } : undefined,
    article: {
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      authors: [post.authorName],
    },
  });
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { locale: localeParam, slug } = await params;
  const locale = localeParam as Locale;
  setRequestLocale(locale);
  const [t, result, feedResult] = await Promise.all([
    getTranslations({ locale, namespace: "pages.blog" }),
    getMarketingBlogPost(slug, locale),
    getMarketingBlogFeed(locale),
  ]);

  if (result.status === "not-found") notFound();
  if (result.status === "unavailable") throw new Error(`Marketing blog post unavailable: ${slug}`);
  const relatedPosts = feedResult.status === "ok"
    ? feedResult.feed.posts
      .filter((post) => post.id !== result.post.id)
      .sort((a, b) => Number(b.category === result.post.category) - Number(a.category === result.post.category))
      .slice(0, 3)
    : [];

  return (
    <>
      <SiteNav activeTab="blog" />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(articleJsonLd(result.post, locale))} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(breadcrumbJsonLd([
        { name: t("title"), url: blogUrl("/blog", locale) },
        { name: result.post.title, url: blogUrl(`/blog/${result.post.slug}`, locale) },
      ]))} />
      <main className="viza-blog">
        <MarketingBlogArticle
          post={result.post}
          locale={locale}
          backLabel={t("backToBlog")}
          byLabel={t("by")}
          updatedLabel={t("updated")}
          readArticleLabel={t("readArticle")}
          relatedTitle={t("relatedTitle")}
          relatedDescription={t("relatedDescription")}
          relatedPosts={relatedPosts}
          ctaEyebrow={t("ctaEyebrow")}
          ctaTitle={t("ctaTitle")}
          ctaBody={t("ctaBody")}
          ctaAction={t("ctaAction")}
        />
      </main>
      <SiteFooter />
    </>
  );
}
