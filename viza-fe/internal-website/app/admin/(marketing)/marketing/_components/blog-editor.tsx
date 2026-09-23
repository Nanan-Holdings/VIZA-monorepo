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
  en: { details: "Article details", detailsHelp: "The marketing site reads published snapshots only.", locale: "Locale", slug: "Slug", title: "Title", excerpt: "Excerpt", body: "Body", cover: "Cover image URL", category: "Category", topics: "Topics (comma separated)", seoKeyword: "SEO keyword", unmeasured: "No measured search volume", source: "Source article", rank: "Story score", author: "Author", seoTitle: "SEO title", seoDescription: "SEO description", reason: "Operational reason", save: "Save draft", publish: "Approve and publish", archive: "Archive", generator: "AI draft generator", generatorHelp: "Content AI creates a reviewable draft. It never publishes automatically.", brief: "Generation brief", generate: "Generate draft", generating: "Generating…", saving: "Saving…", requiredReason: "Record why this change is being made (at least 5 characters).", success: "Saved.", generated: "Draft generated. Review it before publishing.", unavailable: "Content AI is not connected. Add a VIZA-owned DeepSeek or OpenRouter key." },
  zh: { details: "文章内容", detailsHelp: "营销站点只读取已发布的快照。", locale: "语言", slug: "路径", title: "标题", excerpt: "摘要", body: "正文", cover: "封面图 URL", category: "分类", topics: "主题（逗号分隔）", seoKeyword: "SEO 关键词", unmeasured: "暂无实测搜索量", source: "来源文章", rank: "新闻评分", author: "作者", seoTitle: "SEO 标题", seoDescription: "SEO 描述", reason: "运营原因", save: "保存草稿", publish: "批准并发布", archive: "归档", generator: "AI 草稿生成", generatorHelp: "内容 AI 只生成待审核草稿，绝不会自动发布。", brief: "生成要求", generate: "生成草稿", generating: "生成中…", saving: "保存中…", requiredReason: "请填写本次修改的原因（至少 5 个字符）。", success: "已保存。", generated: "草稿已生成，请审核后再发布。", unavailable: "内容 AI 尚未连接，请配置 VIZA 自有的 DeepSeek 或 OpenRouter 密钥。" },
} as const;

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
  const [brief, setBrief] = useState(post?.generationBrief ?? "");
  const [reason, setReason] = useState("");
  const [blogLocale, setBlogLocale] = useState<MarketingBlogLocale>(post?.locale ?? (locale === "zh" ? "zh-CN" : "en"));
  const [coverImageUrl, setCoverImageUrl] = useState(post?.coverImageUrl ?? "");
  const [bodyMarkdown, setBodyMarkdown] = useState(post?.bodyMarkdown ?? "");
  const [uploadingBodyImage, setUploadingBodyImage] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

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
    if (!openrouterConnected || reason.trim().length < 5 || !brief.trim()) return;
    startTransition(async () => {
      const result = await generateMarketingBlogDraft({ brief, locale: blogLocale, reason });
      showResult(result, copy.generated);
      if (result.success && result.data) router.replace(`/admin/marketing/blog/${result.data.id}`);
      router.refresh();
    });
  }

  function command(kind: "publish" | "archive") {
    if (!post || reason.trim().length < 5) return;
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
    <div className="mkt-editor-grid">
      <div className="mkt-panel">
        <div className="mkt-panel-head">
          <div>
            <div className="mkt-caption">{copy.details}</div>
            <p className="mkt-note" style={{ marginTop: 4 }}>{copy.detailsHelp}</p>
          </div>
        </div>
        <div className="mkt-panel-body">
          <form ref={formRef} action={handleSave} className="mkt-form-grid">
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
            <Field label={copy.slug}>
              <input className="mkt-input" name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" defaultValue={post?.slug} />
            </Field>
            <Field label={copy.title} wide>
              <input className="mkt-input" name="title" required defaultValue={post?.title} />
            </Field>
            <Field label={copy.excerpt} wide>
              <textarea className="mkt-textarea" name="excerpt" required rows={3} defaultValue={post?.excerpt} />
            </Field>
            <Field label={copy.body} wide>
              <input type="hidden" name="bodyMarkdown" value={bodyMarkdown} />
              <RichTextEditor value={bodyMarkdown} onChange={setBodyMarkdown} onUploadingChange={setUploadingBodyImage} locale={locale} />
            </Field>
            <Field label={copy.cover}>
              <input className="mkt-input" name="coverImageUrl" type="url" value={coverImageUrl} onChange={(event) => setCoverImageUrl(event.target.value)} />
              <MarketingAssetUpload kind="image" locale={locale} onUploaded={setCoverImageUrl} />
            </Field>
            <Field label={copy.category}>
              <input className="mkt-input" name="category" defaultValue={post?.category ?? ""} />
            </Field>
            <Field label={copy.topics}>
              <input className="mkt-input" name="topics" defaultValue={post?.editorial.topics.join(", ") ?? ""} />
            </Field>
            <Field label={copy.seoKeyword}>
              <input className="mkt-input" name="seoKeyword" defaultValue={post?.editorial.seoKeyword ?? ""} />
              <p className="mkt-hint">
                {post?.editorial.keywordMeasured
                  ? `${post.editorial.monthlySearches ?? "—"} ${locale === "zh" ? "次/月（实测）" : "monthly searches (measured)"}`
                  : copy.unmeasured}
              </p>
            </Field>
            <Field label={copy.author}>
              <input className="mkt-input" name="authorName" required defaultValue={post?.authorName ?? "VIZA Editorial"} />
            </Field>
            <Field label={copy.seoTitle}>
              <input className="mkt-input" name="seoTitle" defaultValue={post?.seoTitle ?? ""} />
            </Field>
            <Field label={copy.seoDescription} wide>
              <textarea className="mkt-textarea" name="seoDescription" rows={3} defaultValue={post?.seoDescription ?? ""} />
            </Field>
            <Field label={copy.reason} wide>
              <input
                className="mkt-input"
                name="reason"
                required
                minLength={5}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={copy.requiredReason}
              />
            </Field>
            <div className="mkt-actions-row">
              <button className="mkt-btn mkt-btn--primary" disabled={pending || uploadingBodyImage || !bodyMarkdown.trim()} type="submit">
                {pending ? copy.saving : copy.save}
              </button>
              {canPublish && post && post.status !== "published" ? (
                <button
                  className="mkt-btn mkt-btn--secondary"
                  disabled={pending || uploadingBodyImage || reason.trim().length < 5}
                  type="button"
                  onClick={() => command("publish")}
                >
                  {copy.publish}
                </button>
              ) : null}
              {canPublish && post && post.status !== "archived" ? (
                <button
                  className="mkt-btn mkt-btn--danger"
                  disabled={pending || reason.trim().length < 5}
                  type="button"
                  onClick={() => command("archive")}
                >
                  {copy.archive}
                </button>
              ) : null}
            </div>
          </form>
        </div>
      </div>

      <div className="mkt-side">
        {post?.editorial.sourceUrl ? (
          <div className="mkt-panel">
            <div className="mkt-panel-head">
              <div className="mkt-caption">{copy.source}</div>
              {post.editorial.rankScore !== null ? (
                <span className="mkt-sub mkt-sub-mono">
                  {copy.rank} {post.editorial.rankScore}
                </span>
              ) : null}
            </div>
            <div className="mkt-panel-body">
              <a style={{ fontSize: 13, overflowWrap: "anywhere" }} href={post.editorial.sourceUrl} target="_blank" rel="noopener noreferrer">
                {post.editorial.sourceUrl}
              </a>
            </div>
          </div>
        ) : null}

        <div className="mkt-panel">
          <div className="mkt-panel-head">
            <div>
              <div className="mkt-caption">{copy.generator}</div>
              <p className="mkt-note" style={{ marginTop: 4 }}>{copy.generatorHelp}</p>
            </div>
          </div>
          <div className="mkt-panel-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Field label={copy.brief}>
              <textarea
                className="mkt-textarea"
                rows={8}
                value={brief}
                onChange={(event) => setBrief(event.target.value)}
                disabled={!openrouterConnected}
              />
            </Field>
            {!openrouterConnected ? <p className="mkt-note mkt-note-warn">{copy.unavailable}</p> : null}
            <button
              className="mkt-btn mkt-btn--primary"
              type="button"
              onClick={generate}
              disabled={pending || !openrouterConnected || !brief.trim() || reason.trim().length < 5}
            >
              {pending ? copy.generating : copy.generate}
            </button>
          </div>
        </div>

        {message ? <p className={`mkt-alert ${message.tone === "error" ? "is-error" : "is-success"}`}>{message.text}</p> : null}
      </div>
    </div>
  );
}

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`mkt-field${wide ? " mkt-field-wide" : ""}`}>
      <span className="mkt-label">{label}</span>
      {children}
    </div>
  );
}
