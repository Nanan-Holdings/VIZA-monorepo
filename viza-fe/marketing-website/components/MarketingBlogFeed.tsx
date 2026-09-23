import { Link } from "@/navigation";
import type { Locale } from "@/i18n";
import type { MarketingBlogSummary } from "@/lib/marketing-blog";
import type { BlogCategory } from "@/lib/blog-taxonomy";

interface MarketingBlogFeedProps {
  posts: MarketingBlogSummary[];
  locale: Locale;
  readArticleLabel: string;
}

interface MarketingBlogFeatureProps {
  post: MarketingBlogSummary;
  locale: Locale;
  featuredLabel: string;
  readArticleLabel: string;
}

interface MarketingBlogTopicsProps {
  categories: BlogCategory[];
  locale: Locale;
  categoriesLabel: string;
  allPostsLabel: string;
  currentSlug?: string;
}

function BlogMedia({ post, eager = false }: { post: MarketingBlogSummary; eager?: boolean }) {
  return (
    <span className="viza-blog__media" aria-hidden="true">
      {post.coverImageUrl ? (
        // The image URL comes from the validated, published portal feed.
        <img
          src={post.coverImageUrl}
          alt=""
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="viza-blog__media-fallback"><span>VIZA</span></span>
      )}
    </span>
  );
}

export function MarketingBlogFeature({ post, locale, featuredLabel, readArticleLabel }: MarketingBlogFeatureProps) {
  return (
    <Link href={`/blog/${post.slug}`} locale={locale} className="viza-blog__feature">
      <div className="viza-blog__feature-copy">
        <span className="viza-blog__meta">{featuredLabel}</span>
        <h2 className="viza-blog__feature-title">{post.title}</h2>
        <p className="viza-blog__feature-description">{post.excerpt}</p>
        <span className="viza-blog__feature-action">{readArticleLabel} <span aria-hidden="true">→</span></span>
      </div>
      <BlogMedia post={post} eager />
    </Link>
  );
}

export function MarketingBlogTopics({ categories, locale, categoriesLabel, allPostsLabel, currentSlug }: MarketingBlogTopicsProps) {
  if (categories.length === 0) return null;

  return (
    <nav aria-label={categoriesLabel}>
      <ul className="viza-blog__topics">
        <li>
          <Link href="/blog" locale={locale} aria-current={currentSlug ? undefined : "page"}>{allPostsLabel}</Link>
        </li>
        {categories.map((category) => (
          <li key={category.slug}>
            <Link
              href={`/blog/category/${category.slug}`}
              locale={locale}
              aria-current={currentSlug === category.slug ? "page" : undefined}
            >
              {category.name} <span className="viza-blog__topic-count">{category.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default function MarketingBlogFeed({ posts, locale, readArticleLabel }: MarketingBlogFeedProps) {
  return (
    <div className="viza-blog__grid">
      {posts.map((post) => (
        <article key={post.id} className="viza-blog__card">
          <Link href={`/blog/${post.slug}`} locale={locale} aria-label={`${readArticleLabel}: ${post.title}`}>
            <BlogMedia post={post} />
            <span className="viza-blog__card-body">
              <span className="viza-blog__meta">{post.category || post.authorName}</span>
              <span className="viza-blog__card-title">{post.title}</span>
              <span className="viza-blog__card-description">{post.excerpt}</span>
            </span>
          </Link>
        </article>
      ))}
    </div>
  );
}
