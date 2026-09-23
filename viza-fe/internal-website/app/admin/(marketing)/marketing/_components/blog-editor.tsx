"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { archiveMarketingBlogPost, generateMarketingBlogDraft, publishMarketingBlogPost, saveMarketingBlogDraft } from "@/app/actions/admin-marketing";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { MarketingBlogAdminRecord, MarketingBlogLocale } from "@/lib/marketing/contracts";
import type { InterfaceLocale } from "@/lib/i18n/locale";
import RichTextEditor from "@/lib/marketing/editor/RichTextEditor";
import { MarketingAssetUpload } from "./asset-upload";

const COPY = {
  en: { details: "Article details", detailsHelp: "The marketing site reads published snapshots only.", locale: "Locale", slug: "Slug", title: "Title", excerpt: "Excerpt", body: "Body (Markdown)", cover: "Cover image URL", category: "Category", topics: "Topics (comma separated)", seoKeyword: "SEO keyword", unmeasured: "No measured search volume", source: "Source article", rank: "Story score", author: "Author", seoTitle: "SEO title", seoDescription: "SEO description", reason: "Operational reason", save: "Save draft", publish: "Approve and publish", archive: "Archive", generator: "AI draft generator", generatorHelp: "Content AI creates a reviewable draft. It never publishes automatically.", brief: "Generation brief", generate: "Generate draft", generating: "Generating…", saving: "Saving…", requiredReason: "Record why this change is being made (at least 5 characters).", success: "Saved.", generated: "Draft generated. Review it before publishing.", unavailable: "Content AI is not connected. Add a VIZA-owned DeepSeek or OpenRouter credential to enable generation." },
  zh: { details: "文章详情", detailsHelp: "营销网站只读取已发布的内容快照。", locale: "语言", slug: "网址标识", title: "标题", excerpt: "摘要", body: "正文（Markdown）", cover: "封面图片 URL", category: "分类", topics: "主题（逗号分隔）", seoKeyword: "SEO 关键词", unmeasured: "暂无实测搜索量", source: "来源文章", rank: "新闻评分", author: "作者", seoTitle: "SEO 标题", seoDescription: "SEO 描述", reason: "运营原因", save: "保存草稿", publish: "审核并发布", archive: "归档", generator: "AI 草稿生成", generatorHelp: "内容 AI 只生成待审核草稿，绝不会自动发布。", brief: "生成要求", generate: "生成草稿", generating: "生成中…", saving: "保存中…", requiredReason: "请记录本次修改原因（至少 5 个字符）。", success: "已保存。", generated: "草稿已生成，请审核后再发布。", unavailable: "内容 AI 尚未连接。请添加 VIZA 自有的 DeepSeek 或 OpenRouter 凭据后启用生成。" },
} as const;

interface BlogEditorProps { post?: MarketingBlogAdminRecord; locale: InterfaceLocale; openrouterConnected: boolean; canPublish: boolean }

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
      id: post?.id, expectedVersion: post?.version,
      locale: formData.get("locale") as MarketingBlogLocale,
      slug: String(formData.get("slug") ?? ""), title: String(formData.get("title") ?? ""),
      excerpt: String(formData.get("excerpt") ?? ""), bodyMarkdown: String(formData.get("bodyMarkdown") ?? ""),
      coverImageUrl: String(formData.get("coverImageUrl") ?? ""), category: String(formData.get("category") ?? ""),
      topics: String(formData.get("topics") ?? "").split(",").map((value) => value.trim()).filter(Boolean),
      seoKeyword: String(formData.get("seoKeyword") ?? ""),
      authorName: String(formData.get("authorName") ?? ""), seoTitle: String(formData.get("seoTitle") ?? ""),
      seoDescription: String(formData.get("seoDescription") ?? ""), reason: String(formData.get("reason") ?? ""),
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
        if (!saved.success) { showResult(saved, copy.success); return; }
      }
      const result = kind === "publish" ? await publishMarketingBlogPost({ id: post.id, reason }) : await archiveMarketingBlogPost({ id: post.id, reason });
      showResult(result, copy.success); router.refresh();
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <CardHeader><CardTitle>{copy.details}</CardTitle><CardDescription>{copy.detailsHelp}</CardDescription></CardHeader>
        <CardContent>
          <form ref={formRef} action={handleSave} className="grid gap-4 md:grid-cols-2">
            <Field label={copy.locale}><select name="locale" value={blogLocale} onChange={(event) => setBlogLocale(event.target.value as MarketingBlogLocale)} className="h-9 rounded-md border bg-transparent px-3 text-sm"><option value="en">English</option><option value="zh-CN">简体中文</option></select></Field>
            <Field label={copy.slug}><Input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" defaultValue={post?.slug} /></Field>
            <Field label={copy.title} wide><Input name="title" required defaultValue={post?.title} /></Field>
            <Field label={copy.excerpt} wide><Textarea name="excerpt" required rows={3} defaultValue={post?.excerpt} /></Field>
            <Field label={copy.body} wide><input type="hidden" name="bodyMarkdown" value={bodyMarkdown} /><RichTextEditor value={bodyMarkdown} onChange={setBodyMarkdown} onUploadingChange={setUploadingBodyImage} locale={locale} /></Field>
            <Field label={copy.cover}><Input name="coverImageUrl" type="url" value={coverImageUrl} onChange={(event) => setCoverImageUrl(event.target.value)} /><MarketingAssetUpload kind="image" locale={locale} onUploaded={setCoverImageUrl} /></Field>
            <Field label={copy.category}><Input name="category" defaultValue={post?.category ?? ""} /></Field>
            <Field label={copy.topics}><Input name="topics" defaultValue={post?.editorial.topics.join(", ") ?? ""} /></Field>
            <Field label={copy.seoKeyword}><Input name="seoKeyword" defaultValue={post?.editorial.seoKeyword ?? ""} /><p className="text-xs text-muted-foreground">{post?.editorial.keywordMeasured ? `${post.editorial.monthlySearches ?? "—"} ${locale === "zh" ? "次/月（实测）" : "monthly searches (measured)"}` : copy.unmeasured}</p></Field>
            <Field label={copy.author}><Input name="authorName" required defaultValue={post?.authorName ?? "VIZA Editorial"} /></Field>
            <Field label={copy.seoTitle}><Input name="seoTitle" defaultValue={post?.seoTitle ?? ""} /></Field>
            <Field label={copy.seoDescription} wide><Textarea name="seoDescription" rows={3} defaultValue={post?.seoDescription ?? ""} /></Field>
            <Field label={copy.reason} wide><Input name="reason" required minLength={5} value={reason} onChange={(event) => setReason(event.target.value)} placeholder={copy.requiredReason} /></Field>
            <div className="flex flex-wrap gap-2 md:col-span-2"><Button disabled={pending || uploadingBodyImage || !bodyMarkdown.trim()} type="submit">{pending ? copy.saving : copy.save}</Button>{canPublish && post && post.status !== "published" ? <Button disabled={pending || uploadingBodyImage || reason.trim().length < 5} type="button" variant="outline" onClick={() => command("publish")}>{copy.publish}</Button> : null}{canPublish && post && post.status !== "archived" ? <Button disabled={pending || reason.trim().length < 5} type="button" variant="destructive" onClick={() => command("archive")}>{copy.archive}</Button> : null}</div>
          </form>
        </CardContent>
      </Card>
      <div className="space-y-4">
        {post?.editorial.sourceUrl ? <Card><CardHeader><CardTitle>{copy.source}</CardTitle><CardDescription>{post.editorial.rankScore !== null ? `${copy.rank}: ${post.editorial.rankScore}/100` : null}</CardDescription></CardHeader><CardContent><a className="break-all text-sm text-primary underline" href={post.editorial.sourceUrl} target="_blank" rel="noopener noreferrer">{post.editorial.sourceUrl}</a></CardContent></Card> : null}
        <Card><CardHeader><CardTitle>{copy.generator}</CardTitle><CardDescription>{copy.generatorHelp}</CardDescription></CardHeader><CardContent className="space-y-3"><Field label={copy.brief}><Textarea rows={8} value={brief} onChange={(event) => setBrief(event.target.value)} disabled={!openrouterConnected} /></Field>{!openrouterConnected ? <p className="text-sm text-amber-700">{copy.unavailable}</p> : null}<Button className="w-full" type="button" onClick={generate} disabled={pending || !openrouterConnected || !brief.trim() || reason.trim().length < 5}>{pending ? copy.generating : copy.generate}</Button></CardContent></Card>
        {message ? <Alert variant={message.tone === "error" ? "destructive" : "default"}><AlertDescription>{message.text}</AlertDescription></Alert> : null}
      </div>
    </div>
  );
}

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <div className={wide ? "space-y-1.5 md:col-span-2" : "space-y-1.5"}><Label>{label}</Label>{children}</div>;
}
