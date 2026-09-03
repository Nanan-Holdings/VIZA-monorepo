import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import MarketingBlogArticle from "@/components/MarketingBlogArticle";
import type { Locale } from "@/i18n";
import { getMarketingBlogPost } from "@/lib/marketing-blog";

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
  return {
    title: post.seoTitle || post.title,
    description: post.seoDescription || post.excerpt,
    alternates: {
      canonical: locale === "en" ? `/blog/${post.slug}` : `/${locale}/blog/${post.slug}`,
    },
    openGraph: {
      type: "article",
      title: post.seoTitle || post.title,
      description: post.seoDescription || post.excerpt,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      authors: [post.authorName],
      images: post.coverImageUrl ? [{ url: post.coverImageUrl }] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { locale: localeParam, slug } = await params;
  const locale = localeParam as Locale;
  setRequestLocale(locale);
  const [t, result] = await Promise.all([
    getTranslations({ locale, namespace: "pages.blog" }),
    getMarketingBlogPost(slug, locale),
  ]);

  if (result.status === "not-found") notFound();

  return (
    <>
      <SiteNav activeTab="blog" />
      <main className="min-h-[60vh] bg-page">
        {result.status === "unavailable" ? (
          <section className="container-narrow py-20 text-center">
            <h1 className="text-3xl">{t("unavailableTitle")}</h1>
            <p className="mt-4 text-fg-2">{t("unavailableBody")}</p>
          </section>
        ) : (
          <MarketingBlogArticle
            post={result.post}
            locale={locale}
            backLabel={t("backToBlog")}
            byLabel={t("by")}
            updatedLabel={t("updated")}
          />
        )}
      </main>
      <SiteFooter />
    </>
  );
}
