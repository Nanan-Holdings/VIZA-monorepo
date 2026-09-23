import type { Locale } from "@/i18n";
import type { MarketingBlogPost } from "./marketing-blog";

export function blogUrl(path: string, locale: Locale): string {
  const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://viza.it.com").replace(/\/$/, "");
  return `${origin}${locale === "en" ? "" : `/${locale}`}${path}`;
}

export function jsonLd(value: Record<string, unknown>) {
  return { __html: JSON.stringify(value).replace(/</g, "\\u003c") };
}

export function articleJsonLd(post: MarketingBlogPost, locale: Locale): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.seoDescription || post.excerpt,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    inLanguage: locale,
    mainEntityOfPage: blogUrl(`/blog/${post.slug}`, locale),
    author: { "@type": "Person", name: post.authorName },
    publisher: { "@type": "Organization", name: "VIZA", url: blogUrl("/", locale) },
    ...(post.coverImageUrl ? { image: new URL(post.coverImageUrl, blogUrl("/", locale)).toString() } : {}),
    ...(post.category ? { articleSection: post.category } : {}),
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; url: string }>): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem", position: index + 1, name: item.name, item: item.url,
    })),
  };
}
