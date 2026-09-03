import { Link } from "@/navigation";
import type { Locale } from "@/i18n";
import type { MarketingBlogSummary } from "@/lib/marketing-blog";

interface MarketingBlogFeedProps {
  posts: MarketingBlogSummary[];
  locale: Locale;
  readArticleLabel: string;
}

function formatDate(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export default function MarketingBlogFeed({
  posts,
  locale,
  readArticleLabel,
}: MarketingBlogFeedProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {posts.map((post) => (
        <article
          key={post.id}
          className="flex min-h-full flex-col overflow-hidden rounded-2xl border border-border-hairline bg-card shadow-marketing-sm"
        >
          {post.coverImageUrl ? (
            // The image URL comes from the validated, published portal feed.
            <img
              src={post.coverImageUrl}
              alt=""
              className="aspect-[16/9] w-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="aspect-[16/9] bg-brand-50" aria-hidden="true" />
          )}
          <div className="flex flex-1 flex-col p-6">
            <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-fg-2">
              {post.category ? (
                <span className="rounded-pill bg-brand-50 px-3 py-1 font-medium text-brand-600">
                  {post.category}
                </span>
              ) : null}
              <time dateTime={post.publishedAt}>{formatDate(post.publishedAt, locale)}</time>
            </div>
            <h2 className="text-xl font-medium text-fg-1">
              <Link href={`/blog/${post.slug}`} locale={locale} className="text-fg-1 hover:text-brand-500">
                {post.title}
              </Link>
            </h2>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-fg-2">{post.excerpt}</p>
            <div className="mt-6 flex items-center justify-between gap-4 border-t border-border-hairline pt-4 text-sm">
              <span className="text-fg-2">{post.authorName}</span>
              <Link
                href={`/blog/${post.slug}`}
                locale={locale}
                className="font-medium text-brand-500 hover:text-brand-600"
                aria-label={`${readArticleLabel}: ${post.title}`}
              >
                {readArticleLabel} <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
