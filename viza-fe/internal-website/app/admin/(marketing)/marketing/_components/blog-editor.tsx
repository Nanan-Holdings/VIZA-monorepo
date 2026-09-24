"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  archiveMarketingBlogPost,
  generateMarketingBlogDraft,
  publishMarketingBlogPost,
  saveMarketingBlogDraft,
} from "@/app/actions/admin-marketing";
import type { MarketingBlogAdminRecord, MarketingBlogLocale } from "@/lib/marketing/contracts";
import type { InterfaceLocale } from "@/lib/i18n/locale";
import RichTextEditor from "@/lib/marketing/editor/RichTextEditor";
import { MarketingAssetUpload } from "./asset-upload";

const COPY = {
  en: { titlePlaceholder: "Article title", words: "words", title: "Title", body: "Body", publish: "Approval", article: "Article", search: "Search", locale: "Locale", slug: "Slug", excerpt: "Excerpt", cover: "Cover image", coverHint: "Also used as the social media image.", category: "Category", topics: "Topics", topicsHint: "Comma separated.", seoKeyword: "SEO keyword", unmeasured: "Not a measured keyword", measured: "monthly searches, measured", keywordInBody: "used in the body", keywordNotInBody: "not in the body yet", source: "Source article", rank: "Story score", author: "Author", seoTitle: "SEO title", seoTitleHint: "Defaults to the article title.", seoDescription: "Meta description", reason: "Operational reason", reasonHint: "At least 5 characters. Recorded on the audit log.", save: "Save draft", publishAction: "Approve and publish", archive: "Archive", generator: "AI draft generator", generatorHelp: "Content AI creates a reviewable draft. It never publishes automatically.", brief: "Generation brief", generate: "Generate draft", generating: "Generating…", saving: "Saving…", success: "Saved.", generated: "Draft generated. Review it before publishing.", unavailable: "Content AI is not connected. Add a VIZA-owned DeepSeek or OpenRouter key." },
  zh: { titlePlaceholder: "文章标题", words: "字", title: "标题", body: "正文", publish: "审批", article: "文章信息", search: "搜索", locale: "语言", slug: "路径", excerpt: "摘要", cover: "封面图", coverHint: "同时用作社交媒体配图。", category: "分类", topics: "主题", topicsHint: "用逗号分隔。", seoKeyword: "SEO 关键词", unmeasured: "非实测关键词", measured: "次/月（实测）", keywordInBody: "正文中已使用", keywordNotInBody: "正文中尚未出现", source: "来源文章", rank: "新闻评分", author: "作者", seoTitle: "SEO 标题", seoTitleHint: "留空则使用文章标题。", seoDescription: "Meta 描述", reason: "运营原因", reasonHint: "至少 5 个字符，将写入审计日志。", save: "保存草稿", publishAction: "批准并发布", archive: "归档", generator: "AI 草稿生成", generatorHelp: "内容 AI 只生成待审核草稿，绝不会自动发布。", brief: "生成要求", generate: "生成草稿", generating: "生成中…", saving: "保存中…", success: "已保存。", generated: "草稿已生成，请审核后再发布。", unavailable: "内容 AI 尚未连接，请配置 VIZA 自有的 DeepSeek 或 OpenRouter 密钥。" },
} as const;

/* The limits the marketing site and the search engines actually care about. */
const TITLE_MAX = 70;
const SEO_TITLE_MAX = 60;
const DESCRIPTION_MIN = 70;
const DESCRIPTION_MAX = 160;

const PUBLIC_BASE = "viza.it.com";

interface BlogEditorProps {
  post?: MarketingBlogAdminRecord;
  locale: InterfaceLocale;
  openrouterConnected: boolean;
  canPublish: boolean;
}

export function BlogEditor({ post, locale, openrouterConnected, canPublish }: BlogEditorProps) {
  const copy = COPY[locale];
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  /* Controlled where a counter, the slug line or the search preview has to
     react as you type. Everything still carries a name, so the form action
     reads exactly the same FormData it did before. */
  const [blogLocale, setBlogLocale] = useState<MarketingBlogLocale>(post?.locale ?? (locale === "zh" ? "zh-CN" : "en"));
  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
  const [bodyMarkdown, setBodyMarkdown] = useState(post?.bodyMarkdown ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(post?.coverImageUrl ?? "");
  const [seoKeyword, setSeoKeyword] = useState(post?.editorial.seoKeyword ?? "");
  const [seoTitle, setSeoTitle] = useState(post?.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(post?.seoDescription ?? "");
  const [brief, setBrief] = useState(post?.generationBrief ?? "");
  const [reason, setReason] = useState("");
  const [uploadingBodyImage, setUploadingBodyImage] = useState(false);

  const words = bodyMarkdown.trim() ? bodyMarkdown.trim().split(/\s+/).length : 0;
  const keywordInBody = Boolean(seoKeyword.trim()) && bodyMarkdown.toLowerCase().includes(seoKeyword.trim().toLowerCase());
  const serpTitle = `${seoTitle || title || copy.titlePlaceholder} | VIZA`;
  const serpPath = `${PUBLIC_BASE}${blogLocale === "zh-CN" ? "/zh-CN" : ""}/blog/${slug || "…"}`;
  const reasonReady = reason.trim().length >= 5;

  function formInput(formData: FormData) {
    return {
      id: post?.id,
      expectedVersion: post?.version,
      locale: formData.get("locale") as MarketingBlogLocale,
      slug: String(formData.get("slug") ?? ""),
      title: String(formData.get("title") ?? ""),
      excerpt: String(formData.get("excerpt") ?? ""),
      bodyMarkdown: String(formData.get("bodyMarkdown") ?? ""),
      coverImageUrl: String(formData.get("coverImageUrl") ?? ""),
      category: String(formData.get("category") ?? ""),
      topics: String(formData.get("topics") ?? "").split(",").map((value) => value.trim()).filter(Boolean),
      seoKeyword: String(formData.get("seoKeyword") ?? ""),
      authorName: String(formData.get("authorName") ?? ""),
      seoTitle: String(formData.get("seoTitle") ?? ""),
      seoDescription: String(formData.get("seoDescription") ?? ""),
      reason: String(formData.get("reason") ?? ""),
    };
  }

  function showResult(result: { success: boolean; error?: string }, success: string) {
    setMessage(result.success ? { tone: "success", text: success } : { tone: "error", text: result.error ?? "Operation failed." });
  }

  function handleSave(formData: FormData) {
    startTransition(async () => {
      const result = await saveMarketingBlogDraft(formInput(formData));
      showResult(result, copy.success);
      if (result.success && result.data) router.replace(`/admin/marketing/blog/${result.data.id}`);
      router.refresh();
    });
  }

  function generate() {
    if (!openrouterConnected || !reasonReady || !brief.trim()) return;
    startTransition(async () => {
      const result = await generateMarketingBlogDraft({ brief, locale: blogLocale, reason });
      showResult(result, copy.generated);
      if (result.success && result.data) router.replace(`/admin/marketing/blog/${result.data.id}`);
      router.refresh();
    });
  }

  function command(kind: "publish" | "archive") {
    if (!post || !reasonReady) return;
    startTransition(async () => {
      if (kind === "publish" && formRef.current) {
        const saved = await saveMarketingBlogDraft(formInput(new FormData(formRef.current)));
        if (!saved.success) {
          showResult(saved, copy.success);
          return;
        }
      }
      const result =
        kind === "publish"
          ? await publishMarketingBlogPost({ id: post.id, reason })
          : await archiveMarketingBlogPost({ id: post.id, reason });
      showResult(result, copy.success);
      router.refresh();
    });
  }

  return (
    <form ref={formRef} action={handleSave} className="mkt-editor-grid">
      {/* The work itself. */}
      <div className="mkt-editor-main">
        <input
          className="mkt-input mkt-title-input"
          name="title"
          required
          placeholder={copy.titlePlaceholder}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          aria-label={copy.title}
        />
        <div className="mkt-card-head" style={{ marginTop: -16 }}>
          <span className="mkt-form-hint">
            {words} {copy.words}
          </span>
          <span className={`mkt-form-hint${title.length > TITLE_MAX ? " is-bad" : ""}`}>
            {copy.title} {title.length}/{TITLE_MAX}
          </span>
        </div>

        <input type="hidden" name="bodyMarkdown" value={bodyMarkdown} />
        <RichTextEditor
          value={bodyMarkdown}
          onChange={setBodyMarkdown}
          onUploadingChange={setUploadingBodyImage}
          locale={locale}
        />
      </div>

      {/* Everything that describes it. */}
      <div className="mkt-side">
        <div className="mkt-form-card">
          <span className="mkt-caption">{copy.publish}</span>
          <Field label={copy.reason} hint={copy.reasonHint} bad={Boolean(reason) && !reasonReady}>
            <input
              className="mkt-input"
              name="reason"
              required
              minLength={5}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button className="mkt-btn mkt-btn--primary mkt-btn--sm" disabled={pending || uploadingBodyImage || !bodyMarkdown.trim()} type="submit">
              {pending ? copy.saving : copy.save}
            </button>
            {canPublish && post && post.status !== "published" ? (
              <button
                className="mkt-btn mkt-btn--secondary mkt-btn--sm"
                disabled={pending || uploadingBodyImage || !reasonReady}
                type="button"
                onClick={() => command("publish")}
              >
                {copy.publishAction}
              </button>
            ) : null}
            {canPublish && post && post.status !== "archived" ? (
              <button className="mkt-btn mkt-btn--danger mkt-btn--sm" disabled={pending || !reasonReady} type="button" onClick={() => command("archive")}>
                {copy.archive}
              </button>
            ) : null}
          </div>
          {message ? <p className={`mkt-alert ${message.tone === "error" ? "is-error" : "is-success"}`}>{message.text}</p> : null}
        </div>

        <div className="mkt-form-card">
          <span className="mkt-caption">{copy.article}</span>
          <Field label={copy.slug} hint={`/${blogLocale}/blog/${slug || "…"}`}>
            <input
              className="mkt-input mkt-sub-mono"
              name="slug"
              required
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
            />
          </Field>
          <Field label={copy.locale}>
            <div className="mkt-select-wrap">
              <select
                className="mkt-select"
                name="locale"
                value={blogLocale}
                onChange={(event) => setBlogLocale(event.target.value as MarketingBlogLocale)}
              >
                <option value="en">English</option>
                <option value="zh-CN">简体中文</option>
              </select>
              <span className="mkt-select-chevron">▼</span>
            </div>
          </Field>
          <Field label={copy.excerpt} hint={`${excerpt.length}`}>
            <textarea
              className="mkt-textarea"
              name="excerpt"
              required
              rows={3}
              value={excerpt}
              onChange={(event) => setExcerpt(event.target.value)}
            />
          </Field>
          <Field label={copy.cover} hint={copy.coverHint}>
            {/* A plain <img>: the cover can be any URL the editor pastes, and
                next/image would need every one of those hosts configured. */}
            {coverImageUrl ? <img className="mkt-cover" src={coverImageUrl} alt="" /> : <div className="mkt-cover" />}
            <input className="mkt-input" name="coverImageUrl" type="url" value={coverImageUrl} onChange={(event) => setCoverImageUrl(event.target.value)} />
            <MarketingAssetUpload kind="image" locale={locale} onUploaded={setCoverImageUrl} />
          </Field>
          <Field label={copy.category}>
            <input className="mkt-input" name="category" defaultValue={post?.category ?? ""} />
          </Field>
          <Field label={copy.topics} hint={copy.topicsHint}>
            <input className="mkt-input" name="topics" defaultValue={post?.editorial.topics.join(", ") ?? ""} />
          </Field>
          <Field label={copy.author}>
            <input className="mkt-input" name="authorName" required defaultValue={post?.authorName ?? "VIZA Editorial"} />
          </Field>
        </div>

        <div className="mkt-form-card">
          <span className="mkt-caption">{copy.search}</span>
          <Field
            label={copy.seoKeyword}
            bad={Boolean(seoKeyword.trim()) && !keywordInBody}
            hint={
              seoKeyword.trim()
                ? `${
                    post?.editorial.keywordMeasured && post.editorial.monthlySearches !== null
                      ? `${post.editorial.monthlySearches} ${copy.measured}`
                      : copy.unmeasured
                  }, ${keywordInBody ? copy.keywordInBody : copy.keywordNotInBody}`
                : undefined
            }
          >
            <input className="mkt-input" name="seoKeyword" value={seoKeyword} onChange={(event) => setSeoKeyword(event.target.value)} />
          </Field>
          <Field
            label={copy.seoTitle}
            hint={seoTitle ? `${seoTitle.length}/${SEO_TITLE_MAX}` : copy.seoTitleHint}
            bad={seoTitle.length > SEO_TITLE_MAX}
          >
            <input className="mkt-input" name="seoTitle" value={seoTitle} onChange={(event) => setSeoTitle(event.target.value)} />
          </Field>
          <Field
            label={copy.seoDescription}
            hint={`${seoDescription.length}/${DESCRIPTION_MAX}`}
            bad={seoDescription.length > DESCRIPTION_MAX || (seoDescription.length > 0 && seoDescription.length < DESCRIPTION_MIN)}
          >
            <textarea
              className="mkt-textarea"
              name="seoDescription"
              rows={3}
              value={seoDescription}
              onChange={(event) => setSeoDescription(event.target.value)}
            />
          </Field>
          <div className="mkt-serp" aria-label="Search result preview">
            <span className="mkt-serp-url">{serpPath}</span>
            <span className="mkt-serp-title">{serpTitle}</span>
            <span className="mkt-serp-desc">{seoDescription || excerpt}</span>
          </div>
        </div>

        {post?.editorial.sourceUrl ? (
          <div className="mkt-form-card">
            <div className="mkt-card-head">
              <span className="mkt-caption">{copy.source}</span>
              {post.editorial.rankScore !== null ? (
                <span className="mkt-sub mkt-sub-mono">
                  {copy.rank} {post.editorial.rankScore}
                </span>
              ) : null}
            </div>
            <a style={{ fontSize: 13, overflowWrap: "anywhere" }} href={post.editorial.sourceUrl} target="_blank" rel="noopener noreferrer">
              {post.editorial.sourceUrl}
            </a>
          </div>
        ) : null}

        <div className="mkt-form-card">
          <span className="mkt-caption">{copy.generator}</span>
          <Field label={copy.brief} hint={copy.generatorHelp}>
            <textarea
              className="mkt-textarea"
              rows={6}
              value={brief}
              onChange={(event) => setBrief(event.target.value)}
              disabled={!openrouterConnected}
            />
          </Field>
          {!openrouterConnected ? <p className="mkt-note mkt-note-warn">{copy.unavailable}</p> : null}
          <button
            className="mkt-btn mkt-btn--secondary mkt-btn--sm"
            style={{ alignSelf: "flex-start" }}
            type="button"
            onClick={generate}
            disabled={pending || !openrouterConnected || !brief.trim() || !reasonReady}
          >
            {pending ? copy.generating : copy.generate}
          </button>
        </div>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  bad = false,
  children,
}: {
  label: string;
  hint?: string;
  bad?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mkt-form-field">
      <span className="mkt-label">{label}</span>
      {children}
      {hint ? <span className={`mkt-form-hint${bad ? " is-bad" : ""}`}>{hint}</span> : null}
    </div>
  );
}
