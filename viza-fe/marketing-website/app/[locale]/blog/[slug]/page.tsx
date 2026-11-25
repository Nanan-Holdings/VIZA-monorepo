import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import SiteHeader from "@/design-system/sections/SiteHeader";
import SiteFooter from "@/design-system/sections/SiteFooter";
import MarketingBlogArticle from "@/components/MarketingBlogArticle";
import type { Locale } from "@/i18n";
import { getMarketingBlogFeed, getMarketingBlogPost } from "@/lib/marketing-blog";
import { clip, clipTitle, pageMetadata } from "@/lib/seo/metadata";
import { SITE_URL } from "@/lib/seo/site";
import { destinationForPost } from "@/lib/blog-destination";
import { guidesForPost } from "@/lib/guides";
import { blogUrl, articleJsonLd, breadcrumbJsonLd, jsonLd } from "@/lib/blog-structured-data";

export const revalidate = 300;

interface BlogPostPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { locale: localeParam, slug } = await params;
  const locale = localeParam as Locale;
  const result = await getMarketingBlogPost(slug, locale);
  if (result.status !== "ok") return { robots: { index: false, follow: false } };

  const { post } = result;
  const cover = post.coverImageUrl ? new URL(post.coverImageUrl, SITE_URL).toString() : null;
  return pageMetadata({
    title: clipTitle(post.seoTitle || post.title),
    description: clip(post.seoDescription || post.excerpt, 155),
    path: `/blog/${post.slug}`,
    locale,
    ogKey: "blog",
    hreflang: "none",
    ogType: "article",
    article: { publishedTime: post.publishedAt, modifiedTime: post.updatedAt, authors: [post.authorName] },
    image: cover ? { url: cover, alt: post.title } : undefined,
  });
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { locale: localeParam, slug } = await params;
  const locale = localeParam as Locale;
  setRequestLocale(locale);
  const [t, ta, tg, result, feedResult] = await Promise.all([
    getTranslations({ locale, namespace: "pages.blog" }),
    getTranslations({ locale, namespace: "ds.article" }),
    getTranslations({ locale, namespace: "guides" }),
    getMarketingBlogPost(slug, locale),
    getMarketingBlogFeed(locale),
  ]);

  if (result.status === "not-found") notFound();
  const relatedPosts = result.status === "ok" && feedResult.status === "ok"
    ? feedResult.feed.posts
      .filter((post) => post.id !== result.post.id)
      .sort((a, b) => Number(b.category === result.post.category) - Number(a.category === result.post.category))
      .slice(0, 3)
    : [];

  const destination = result.status === "ok" ? destinationForPost(result.post) : null;
  const tc = await getTranslations({ locale, namespace: "countries" });
  const destinationName = destination ? (tc.has(destination.slug) ? tc(destination.slug) : destination.name) : "";

  const guides = result.status === "ok" ? guidesForPost(result.post, destination?.slug ?? null) : [];

  return (
    <>
      <SiteHeader active="news" />
      {result.status === "ok" ? (
        <>
          <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(articleJsonLd(result.post, locale))} />
          <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(breadcrumbJsonLd([
            { name: t("title"), url: blogUrl("/blog", locale) },
            { name: result.post.title, url: blogUrl(`/blog/${result.post.slug}`, locale) },
          ]))} />
        </>
      ) : null}
      <main className="ds-main">
        {result.status === "unavailable" ? (
          <section className="ds-container ds-section">
            <h1 className="ds-h2">{t("unavailableTitle")}</h1>
            <p className="ds-body" style={{ marginTop: 16 }}>{t("unavailableBody")}</p>
          </section>
        ) : (
          <MarketingBlogArticle
            post={result.post}
            locale={locale}
            backLabel={t("backToBlog")}
            byLabel={t("by")}
            updatedLabel={t("updated")}
            readArticleLabel={t("readArticle")}
            relatedTitle={t("relatedTitle")}
            relatedPosts={relatedPosts}
            tocTitle={ta("toc")}
            downLabel={ta("down")}
            homeLabel={tg("breadcrumbHome")}
            ctaTitle={t("ctaTitle")}
            ctaBody={t("ctaBody")}
            ctaAction={t("ctaAction")}
            visaLink={destination ? {
              slug: destination.slug,
              title: t("visaLinkTitle", { country: destinationName }),
              body: t("visaLinkBody"),
              action: t("visaLinkAction", { country: destinationName }),
            } : undefined}
            guideLinks={guides.length ? {
              title: t("guidesTitle"),
              body: t("guidesBody"),
              items: guides.map((g) => ({ slug: g.slug, label: locale === "zh-CN" ? g.name.zh : g.name.en })),
            } : undefined}
          />
        )}
      </main>
      <SiteFooter />
    </>
  );
}
