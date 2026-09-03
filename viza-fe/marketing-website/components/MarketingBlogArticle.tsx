import type { ReactNode } from "react";
import { Link } from "@/navigation";
import type { Locale } from "@/i18n";
import type { MarketingBlogPost } from "@/lib/marketing-blog";

interface MarketingBlogArticleProps {
  post: MarketingBlogPost;
  locale: Locale;
  backLabel: string;
  byLabel: string;
  updatedLabel: string;
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
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  if (value.startsWith("#")) return value;
  try {
    const url = new URL(value);
    return ["https:", "http:", "mailto:"].includes(url.protocol) ? value : null;
  } catch {
    return null;
  }
}

function renderInline(value: string, keyPrefix: string): ReactNode[] {
  const pattern = /(\[[^\]]+\]\([^\s)]+\)|`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_)/g;
  const parts = value.split(pattern).filter(Boolean);

  return parts.map((part, index) => {
    const key = `${keyPrefix}-${index}`;
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

  for (const line of lines) {
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

  return <div className="space-y-6">{nodes}</div>;
}

export default function MarketingBlogArticle({
  post,
  locale,
  backLabel,
  byLabel,
  updatedLabel,
}: MarketingBlogArticleProps) {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
      <Link href="/blog" locale={locale} className="text-sm font-medium text-brand-500 hover:text-brand-600">
        <span aria-hidden="true">←</span> {backLabel}
      </Link>
      <header className="mt-10 border-b border-border-hairline pb-10">
        {post.category ? (
          <span className="inline-flex rounded-pill bg-brand-50 px-3 py-1 text-sm font-medium text-brand-600">
            {post.category}
          </span>
        ) : null}
        <h1 className="mt-5 text-4xl leading-tight text-fg-1 sm:text-5xl">{post.title}</h1>
        <p className="mt-5 text-lg leading-relaxed text-fg-2">{post.excerpt}</p>
        <div className="mt-6 flex flex-wrap gap-x-3 gap-y-1 text-sm text-fg-2">
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
      </header>
      {post.coverImageUrl ? (
        <img
          src={post.coverImageUrl}
          alt=""
          className="mt-10 aspect-[16/9] w-full rounded-2xl object-cover"
          referrerPolicy="no-referrer"
        />
      ) : null}
      <div className="mt-12">
        <MarkdownBody markdown={post.bodyMarkdown} />
      </div>
    </article>
  );
}
