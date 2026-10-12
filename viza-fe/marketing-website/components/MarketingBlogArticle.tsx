import type { ReactNode } from "react";
import { Link } from "@/navigation";
import type { Locale } from "@/i18n";
import type { MarketingBlogPost, MarketingBlogSummary } from "@/lib/marketing-blog";
import { categorySlug } from "@/lib/blog-taxonomy";
import MarketingBlogFeed from "@/components/MarketingBlogFeed";
import MarketingBlogCta from "@/components/MarketingBlogCta";

interface MarketingBlogArticleProps {
  post: MarketingBlogPost;
  locale: Locale;
  backLabel: string;
  byLabel: string;
  updatedLabel: string;
  readArticleLabel: string;
  relatedTitle: string;
  relatedDescription: string;
  relatedPosts: MarketingBlogSummary[];
  ctaEyebrow: string;
  ctaTitle: string;
  ctaBody: string;
  ctaAction: string;
}

function formatDate(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function safeHref(value: string): string | null {
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return value;
  if (value.startsWith("#")) return value;
  try {
    const url = new URL(value);
    return ["https:", "http:", "mailto:"].includes(url.protocol) ? value : null;
  } catch {
    return null;
  }
}

function safeMediaHref(value: string): string | null {
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

function videoEmbedSrc(value: string): string | null {
  try {
    const url = new URL(value.replace(/^<|>$/g, ""));
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    if (host === "youtu.be" || host === "youtube.com" || host === "www.youtube.com") {
      const id = host === "youtu.be" ? url.pathname.slice(1) : url.searchParams.get("v") ?? url.pathname.match(/^\/(?:shorts|live|embed)\/([\w-]{11})/)?.[1];
      return id && /^[\w-]{11}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (host === "vimeo.com" || host === "www.vimeo.com") {
      const id = url.pathname.match(/\/(?:video\/)?(\d+)\/?$/)?.[1];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
    if (host === "loom.com" || host === "www.loom.com") {
      const id = url.pathname.match(/^\/(?:share|embed)\/([\w-]+)\/?$/)?.[1];
      return id ? `https://www.loom.com/embed/${id}` : null;
    }
    if (host === "twitch.tv" || host === "www.twitch.tv") {
      const id = url.pathname.match(/^\/videos\/(\d+)\/?$/)?.[1];
      const parent = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://viza.it.com").hostname;
      return id ? `https://player.twitch.tv/?video=${id}&parent=${encodeURIComponent(parent)}` : null;
    }
    return null;
  } catch {
    return null;
  }
}

function renderInline(value: string, keyPrefix: string): ReactNode[] {
  const pattern = /(!\[[^\]]*\]\([^\s)]+\)|\[[^\]]+\]\([^\s)]+\)|`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_)/g;
  const parts = value.split(pattern).filter(Boolean);

  return parts.map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    const image = part.match(/^!\[([^\]]*)\]\(([^\s)]+)\)$/);
    if (image) {
      const src = safeMediaHref(image[2]);
      return src ? <img key={key} src={src} alt={image[1]} loading="lazy" className="my-5 max-w-full rounded-2xl" /> : <span key={key}>{image[1]}</span>;
    }
    const link = part.match(/^\[([^\]]+)\]\(([^\s)]+)\)$/);
    if (link) {
      const href = safeHref(link[2]);
      return href ? (
        <a
          key={key}
          href={href}
          rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
          className="font-medium text-brand-500 underline decoration-brand-200 underline-offset-4 hover:text-brand-600"
        >
          {link[1]}
        </a>
      ) : <span key={key}>{link[1]}</span>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={key} className="rounded-lg bg-brand-50 px-1.5 py-0.5 text-sm text-brand-700">{part.slice(1, -1)}</code>;
    }
    if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) {
      return <strong key={key} className="font-semibold text-fg-1">{part.slice(2, -2)}</strong>;
    }
    if ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_"))) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function tableCells(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function MarkdownBody({ markdown }: { markdown: string }) {
  const nodes: ReactNode[] = [];
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let code: string[] | null = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const text = paragraph.join(" ").trim();
    nodes.push(<p key={`p-${nodes.length}`} className="leading-7 text-fg-1">{renderInline(text, `p-${nodes.length}`)}</p>);
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    const ListTag = list.ordered ? "ol" : "ul";
    nodes.push(
      <ListTag
        key={`list-${nodes.length}`}
        className={list.ordered ? "list-decimal space-y-2 pl-6" : "list-disc space-y-2 pl-6"}
      >
        {list.items.map((item, index) => (
          <li key={`${item}-${index}`} className="pl-1 leading-7 text-fg-1">
            {renderInline(item, `li-${nodes.length}-${index}`)}
          </li>
        ))}
      </ListTag>,
    );
    list = null;
  };
  const flushText = () => {
    flushParagraph();
    flushList();
  };

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    if (line.trim().startsWith("```")) {
      if (code) {
        nodes.push(
          <pre key={`code-${nodes.length}`} className="overflow-x-auto rounded-2xl bg-brand-900 p-5 text-sm leading-6 text-fg-on-brand">
            <code>{code.join("\n")}</code>
          </pre>,
        );
        code = null;
      } else {
        flushText();
        code = [];
      }
      continue;
    }
    if (code) {
      code.push(line);
      continue;
    }
    if (!line.trim()) {
      flushText();
      continue;
    }

    const video = videoEmbedSrc(line.trim());
    if (video) {
      flushText();
      nodes.push(
        <div key={`video-${nodes.length}`} className="relative aspect-video overflow-hidden rounded-2xl bg-brand-900">
          <iframe src={video} title="Video" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen className="absolute inset-0 h-full w-full border-0" referrerPolicy="strict-origin-when-cross-origin" />
        </div>,
      );
      continue;
    }

    const image = line.trim().match(/^!\[([^\]]*)\]\(([^\s)]+)\)$/);
    if (image) {
      const src = safeMediaHref(image[2]);
      if (src) {
        flushText();
        nodes.push(<figure key={`image-${nodes.length}`}><img src={src} alt={image[1]} loading="lazy" className="w-full rounded-2xl" />{image[1] ? <figcaption className="mt-2 text-center text-sm text-fg-2">{image[1]}</figcaption> : null}</figure>);
        continue;
      }
    }

    if (line.includes("|") && (lines[lineIndex + 1] ?? "").includes("|")) {
      const headers = tableCells(line);
      const separator = tableCells(lines[lineIndex + 1]);
      if (headers.length > 1 && separator.length === headers.length && separator.every((cell) => /^:?-{3,}:?$/.test(cell))) {
        flushText();
        const rows: string[][] = [];
        lineIndex += 2;
        while (lineIndex < lines.length && lines[lineIndex].trim() && lines[lineIndex].includes("|")) {
          rows.push(tableCells(lines[lineIndex]));
          lineIndex += 1;
        }
        lineIndex -= 1;
        nodes.push(
          <div key={`table-${nodes.length}`} className="overflow-x-auto rounded-2xl border border-border-hairline">
            <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
              <thead className="bg-brand-50"><tr>{headers.map((cell, index) => <th key={index} scope="col" className="border-b border-border-hairline px-4 py-3 font-semibold text-fg-1">{renderInline(cell, `th-${nodes.length}-${index}`)}</th>)}</tr></thead>
              <tbody>{rows.map((row, rowIndex) => <tr key={rowIndex} className="border-b border-border-hairline last:border-b-0">{headers.map((_, cellIndex) => <td key={cellIndex} className="px-4 py-3 align-top text-fg-1">{renderInline(row[cellIndex] ?? "", `td-${nodes.length}-${rowIndex}-${cellIndex}`)}</td>)}</tr>)}</tbody>
            </table>
          </div>,
        );
        continue;
      }
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushText();
      const level = heading[1].length;
      const text = heading[2].trim();
      if (level === 1) nodes.push(<h2 key={`h-${nodes.length}`} className="pt-4 text-3xl">{renderInline(text, `h-${nodes.length}`)}</h2>);
      if (level === 2) nodes.push(<h2 key={`h-${nodes.length}`} className="pt-4 text-2xl">{renderInline(text, `h-${nodes.length}`)}</h2>);
      if (level === 3) nodes.push(<h3 key={`h-${nodes.length}`} className="pt-3 text-xl">{renderInline(text, `h-${nodes.length}`)}</h3>);
      continue;
    }

    if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
      flushText();
      nodes.push(<hr key={`hr-${nodes.length}`} className="border-border-hairline" />);
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flushText();
      nodes.push(
        <blockquote key={`quote-${nodes.length}`} className="border-l-4 border-brand-300 bg-brand-50 px-5 py-4 leading-7 text-fg-1">
          {renderInline(quote[1], `quote-${nodes.length}`)}
        </blockquote>,
      );
      continue;
    }

    const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      flushParagraph();
      const isOrdered = Boolean(ordered);
      if (list && list.ordered !== isOrdered) flushList();
      list ??= { ordered: isOrdered, items: [] };
      list.items.push((ordered?.[1] ?? unordered?.[1] ?? "").trim());
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }

  if (code) {
    nodes.push(
      <pre key={`code-${nodes.length}`} className="overflow-x-auto rounded-2xl bg-brand-900 p-5 text-sm leading-6 text-fg-on-brand">
        <code>{code.join("\n")}</code>
      </pre>,
    );
  }
  flushText();

  return <div className="viza-blog__prose">{nodes}</div>;
}

export default function MarketingBlogArticle({
  post,
  locale,
  backLabel,
  byLabel,
  updatedLabel,
  readArticleLabel,
  relatedTitle,
  relatedDescription,
  relatedPosts,
  ctaEyebrow,
  ctaTitle,
  ctaBody,
  ctaAction,
}: MarketingBlogArticleProps) {
  return (
    <>
      <header className="viza-blog__hero viza-blog__hero--article">
        <div className="viza-blog__container">
          <span className="viza-blog__overline">
            <Link href="/blog" locale={locale}>{backLabel}</Link>
            {post.category && categorySlug(post.category) ? (
              <> · <Link href={`/blog/category/${categorySlug(post.category)}`} locale={locale}>{post.category}</Link></>
            ) : null}
          </span>
          <h1>{post.title}</h1>
          <p className="viza-blog__hero-description">{post.excerpt}</p>
          <div className="viza-blog__byline">
            <span>{byLabel} {post.authorName}</span>
            <span aria-hidden="true">·</span>
            <time dateTime={post.publishedAt}>{formatDate(post.publishedAt, locale)}</time>
            {post.updatedAt !== post.publishedAt ? (
              <>
                <span aria-hidden="true">·</span>
                <span>{updatedLabel} {formatDate(post.updatedAt, locale)}</span>
              </>
            ) : null}
          </div>
        </div>
      </header>
      <section className="viza-blog__band">
        <div className="viza-blog__container">
          <article className="viza-blog__article">
            {post.coverImageUrl ? (
              <div className="viza-blog__article-cover">
                <img src={post.coverImageUrl} alt="" referrerPolicy="no-referrer" />
              </div>
            ) : null}
            <MarkdownBody markdown={post.bodyMarkdown} />
          </article>
        </div>
      </section>
      {relatedPosts.length > 0 ? (
        <section className="viza-blog__band viza-blog__band--soft" aria-label={relatedTitle}>
          <div className="viza-blog__container">
            <div className="viza-blog__section-head">
              <h2>{relatedTitle}</h2>
              <p>{relatedDescription}</p>
            </div>
            <MarketingBlogFeed posts={relatedPosts} locale={locale} readArticleLabel={readArticleLabel} />
          </div>
        </section>
      ) : null}
      <MarketingBlogCta
        locale={locale}
        eyebrow={ctaEyebrow}
        title={ctaTitle}
        body={ctaBody}
        action={ctaAction}
      />
    </>
  );
}
