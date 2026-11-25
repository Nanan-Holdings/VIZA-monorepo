import type { ReactNode } from "react";
import { Link } from "@/navigation";
import type { Locale } from "@/i18n";
import type { MarketingBlogPost, MarketingBlogSummary } from "@/lib/marketing-blog";
import { categorySlug } from "@/lib/blog-taxonomy";
import ArticleHero from "@/design-system/sections/ArticleHero";
import ArticleShell, { type TocItem } from "@/design-system/sections/ArticleShell";
import ArticleCards from "@/design-system/sections/ArticleCards";
import EndCta from "@/design-system/sections/EndCta";

interface MarketingBlogArticleProps {
  post: MarketingBlogPost;
  locale: Locale;
  backLabel: string;
  byLabel: string;
  updatedLabel: string;
  readArticleLabel: string;
  relatedTitle: string;
  relatedPosts: MarketingBlogSummary[];
  tocTitle: string;
  downLabel: string;
  homeLabel: string;
  ctaTitle: string;
  ctaBody: string;
  ctaAction: string;
  /** Contextual link to the matching /visa/<slug> page, when the post is about one destination. */
  visaLink?: { slug: string; title: string; body: string; action: string };
  /** Evergreen guides that match the post's destination or topic. */
  guideLinks?: { title: string; body: string; items: Array<{ slug: string; label: string }> };
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
      return src ? <img key={key} src={src} alt={image[1]} loading="lazy" /> : <span key={key}>{image[1]}</span>;
    }
    const link = part.match(/^\[([^\]]+)\]\(([^\s)]+)\)$/);
    if (link) {
      const href = safeHref(link[2]);
      return href ? (
        <a
          key={key}
          href={href}
          rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
        >
          {link[1]}
        </a>
      ) : <span key={key}>{link[1]}</span>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={key}>{part.slice(1, -1)}</code>;
    }
    if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
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

const plainText = (value: string) => value.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[`*_]/g, "").trim();

function headingId(text: string, used: Set<string>): string {
  const base = plainText(text).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "section";
  let id = base;
  for (let n = 2; used.has(id); n += 1) id = `${base}-${n}`;
  used.add(id);
  return id;
}

function renderMarkdown(markdown: string): { nodes: ReactNode[]; toc: TocItem[] } {
  const nodes: ReactNode[] = [];
  const toc: TocItem[] = [];
  const usedIds = new Set<string>();
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let code: string[] | null = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const text = paragraph.join(" ").trim();
    nodes.push(<p key={`p-${nodes.length}`}>{renderInline(text, `p-${nodes.length}`)}</p>);
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    const ListTag = list.ordered ? "ol" : "ul";
    nodes.push(
      <ListTag key={`list-${nodes.length}`}>
        {list.items.map((item, index) => (
          <li key={`${item}-${index}`}>
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
          <pre key={`code-${nodes.length}`}>
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
        <div key={`video-${nodes.length}`} className="ds-video">
          <iframe src={video} title="Video" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
        </div>,
      );
      continue;
    }

    const image = line.trim().match(/^!\[([^\]]*)\]\(([^\s)]+)\)$/);
    if (image) {
      const src = safeMediaHref(image[2]);
      if (src) {
        flushText();
        nodes.push(<figure key={`image-${nodes.length}`}><img src={src} alt={image[1]} loading="lazy" />{image[1] ? <figcaption>{image[1]}</figcaption> : null}</figure>);
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
          <div key={`table-${nodes.length}`} className="ds-table-wrap">
            <table>
              <thead><tr>{headers.map((cell, index) => <th key={index} scope="col">{renderInline(cell, `th-${nodes.length}-${index}`)}</th>)}</tr></thead>
              <tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{headers.map((_, cellIndex) => <td key={cellIndex}>{renderInline(row[cellIndex] ?? "", `td-${nodes.length}-${rowIndex}-${cellIndex}`)}</td>)}</tr>)}</tbody>
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
      const id = headingId(text, usedIds);
      if (level <= 2) toc.push({ id, label: plainText(text) });
      if (level <= 2) nodes.push(<h2 key={`h-${nodes.length}`} id={id}>{renderInline(text, `h-${nodes.length}`)}</h2>);
      else nodes.push(<h3 key={`h-${nodes.length}`} id={id}>{renderInline(text, `h-${nodes.length}`)}</h3>);
      continue;
    }

    if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
      flushText();
      nodes.push(<hr key={`hr-${nodes.length}`} />);
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flushText();
      nodes.push(
        <blockquote key={`quote-${nodes.length}`}>
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
      <pre key={`code-${nodes.length}`}>
        <code>{code.join("\n")}</code>
      </pre>,
    );
  }
  flushText();

  return { nodes, toc };
}

export default function MarketingBlogArticle({
  post,
  locale,
  backLabel,
  byLabel,
  updatedLabel,
  readArticleLabel,
  relatedTitle,
  relatedPosts,
  ctaTitle,
  ctaBody,
  ctaAction,
  tocTitle,
  downLabel,
  homeLabel,
  visaLink,
  guideLinks,
}: MarketingBlogArticleProps) {
  const { nodes, toc } = renderMarkdown(post.bodyMarkdown);
  const slug = post.category ? categorySlug(post.category) : "";
  return (
    <>
      <ArticleHero
        title={post.title}
        image={post.coverImageUrl}
        downLabel={downLabel}
        crumbs={[
          { label: homeLabel, href: "/" },
          { label: backLabel, href: "/blog" },
          ...(post.category && slug ? [{ label: post.category, href: `/blog/category/${slug}` }] : []),
          { label: post.title },
        ]}
      />
      <div className="ds-container">
        <div className="ds-artmeta">
          <span>{byLabel}<b>{post.authorName}</b></span>
          <time dateTime={post.publishedAt}>{formatDate(post.publishedAt, locale)}</time>
          {post.updatedAt !== post.publishedAt ? <span>{updatedLabel}<b>{formatDate(post.updatedAt, locale)}</b></span> : null}
          {post.excerpt ? <p className="ds-artmeta-lead">{post.excerpt}</p> : null}
        </div>
      </div>
      <ArticleShell toc={toc} tocTitle={tocTitle}>
        <article className="ds-prose">{nodes}</article>
        {visaLink ? (
          <aside className="ds-callout ds-art-aside">
            <h2>{visaLink.title}</h2>
            <p>{visaLink.body}</p>
            <p><Link href={`/visa/${visaLink.slug}`} locale={locale}>{visaLink.action} <span aria-hidden="true">→</span></Link></p>
          </aside>
        ) : null}
        {guideLinks && guideLinks.items.length > 0 ? (
          <aside className="ds-callout ds-art-aside">
            <h2>{guideLinks.title}</h2>
            <p>{guideLinks.body}</p>
            <ul className="ds-callout-links">
              {guideLinks.items.map((g) => (
                <li key={g.slug}><Link href={`/guides/${g.slug}`} locale={locale}>{g.label} <span aria-hidden="true">→</span></Link></li>
              ))}
            </ul>
          </aside>
        ) : null}
      </ArticleShell>
      {relatedPosts.length > 0 ? (
        <section className="ds-container ds-section ds-section--ruled" aria-label={relatedTitle}>
          <h2 className="ds-h2" style={{ marginBottom: 48 }}>{relatedTitle}</h2>
          <ArticleCards
            items={relatedPosts.map((r) => ({
              href: `/blog/${r.slug}`,
              image: r.coverImageUrl,
              meta: r.category || r.authorName,
              title: r.title,
              body: r.excerpt,
              more: readArticleLabel,
            }))}
          />
        </section>
      ) : null}
      <EndCta title={ctaTitle} body={ctaBody} action={ctaAction} href="/apply" />
    </>
  );
}
