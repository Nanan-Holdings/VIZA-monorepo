"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateMarketingSocialComposition, publishMarketingSocialComposition, saveMarketingSocialComposition } from "@/app/actions/admin-marketing";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MARKETING_SOCIAL_PLATFORMS, type MarketingBlogAdminRecord, type MarketingSocialCompositionRecord, type MarketingSocialPlatform } from "@/lib/marketing/contracts";
import type { InterfaceLocale } from "@/lib/i18n/locale";
import { MarketingAssetUpload } from "./asset-upload";

const PLATFORM_LABELS: Record<MarketingSocialPlatform, string> = { x: "X", "google-business-sg": "Google Business SG", instagram: "Instagram", linkedin: "LinkedIn", pinterest: "Pinterest", reddit: "Reddit" };
const COPY = {
  en: { title: "Composition", help: "Generate channel copy with AI or write it manually, then publish through connected Zernio channels.", name: "Internal title", brief: "Brief", destination: "Destination URL", track: "Use a VIZA short link and record privacy-safe clicks", media: "Media URL", document: "Document URL", schedule: "Schedule (optional)", reason: "Operational reason", content: "Platform content", generate: "Generate & save with AI", save: "Save composition", savePublish: "Save & publish", saving: "Working…", provider: "Zernio is not connected for every selected platform. Publishing is disabled; drafts can still be saved.", aiProvider: "OpenRouter is not connected. AI generation is disabled.", success: "Composition saved." },
  zh: { title: "社交内容", help: "可用 AI 为各渠道生成文案或手动撰写，再通过已连接的 Zernio 渠道发布。", name: "内部标题", brief: "内容要求", destination: "目标 URL", track: "使用 VIZA 短链接并记录隐私安全的点击数据", media: "媒体 URL", document: "文档 URL", schedule: "计划时间（可选）", reason: "运营原因", content: "平台内容", generate: "使用 AI 生成并保存", save: "保存内容", savePublish: "保存并发布", saving: "处理中…", provider: "并非所有所选平台均已连接 Zernio。发布已禁用，但仍可保存草稿。", aiProvider: "OpenRouter 尚未连接，AI 生成功能已禁用。", success: "内容已保存。" },
} as const;

export function SocialEditor({ locale, connectedPlatforms, openrouterConnected, initial, sourceBlog, sourceBlogUrl }: { locale: InterfaceLocale; connectedPlatforms: MarketingSocialPlatform[]; openrouterConnected: boolean; initial?: MarketingSocialCompositionRecord; sourceBlog?: MarketingBlogAdminRecord; sourceBlogUrl?: string }) {
  const copy = COPY[locale]; const router = useRouter(); const [pending, startTransition] = useTransition();
  const [platforms, setPlatforms] = useState<MarketingSocialPlatform[]>(initial?.platforms ?? []);
  const [mediaUrl, setMediaUrl] = useState(initial?.mediaUrl ?? sourceBlog?.coverImageUrl ?? "");
  const [documentUrl, setDocumentUrl] = useState(initial?.documentUrl ?? "");
  const [trackDestination, setTrackDestination] = useState(Boolean(initial?.shortLinkId || sourceBlogUrl));
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const publishAvailable = platforms.length > 0 && platforms.every((platform) => connectedPlatforms.includes(platform));

  function submit(formData: FormData, publish: boolean) {
    startTransition(async () => {
      const platformContent: Partial<Record<MarketingSocialPlatform, string>> = {};
      for (const platform of platforms) platformContent[platform] = String(formData.get(`content-${platform}`) ?? "");
      const result = await saveMarketingSocialComposition({ id: initial?.id, blogPostId: String(formData.get("blogPostId") ?? "") || undefined, title: String(formData.get("title") ?? ""), brief: String(formData.get("brief") ?? ""), destinationUrl: String(formData.get("destinationUrl") ?? "") || undefined, trackDestination, mediaUrl: String(formData.get("mediaUrl") ?? "") || undefined, documentUrl: String(formData.get("documentUrl") ?? "") || undefined, platforms, platformContent, scheduledFor: String(formData.get("scheduledFor") ?? "") || undefined, reason: String(formData.get("reason") ?? "") });
      if (!result.success || !result.data) { setMessage({ error: true, text: result.error ?? "Operation failed." }); return; }
      if (publish) {
        const publishResult = await publishMarketingSocialComposition({ id: result.data.id, reason: String(formData.get("reason") ?? "") });
        if (!publishResult.success) { setMessage({ error: true, text: publishResult.error ?? "Publish failed." }); return; }
      }
      setMessage({ error: false, text: copy.success }); router.push("/admin/marketing/social"); router.refresh();
    });
  }

  function generate(formData: FormData) {
    startTransition(async () => {
      const result = await generateMarketingSocialComposition({
        id: initial?.id,
        blogPostId: String(formData.get("blogPostId") ?? "") || undefined,
        title: String(formData.get("title") ?? ""),
        brief: String(formData.get("brief") ?? ""),
        destinationUrl: String(formData.get("destinationUrl") ?? "") || undefined,
        trackDestination,
        mediaUrl: String(formData.get("mediaUrl") ?? "") || undefined,
        documentUrl: String(formData.get("documentUrl") ?? "") || undefined,
        platforms,
        platformContent: {},
        scheduledFor: String(formData.get("scheduledFor") ?? "") || undefined,
        reason: String(formData.get("reason") ?? ""),
      });
      if (!result.success) { setMessage({ error: true, text: result.error ?? "Generation failed." }); return; }
      setMessage({ error: false, text: copy.success }); router.push("/admin/marketing/social"); router.refresh();
    });
  }

  return (
    <Card><CardHeader><CardTitle>{copy.title}</CardTitle><CardDescription>{copy.help}</CardDescription></CardHeader><CardContent><form action={(data) => submit(data, false)} className="grid gap-4 md:grid-cols-2">
      <input type="hidden" name="blogPostId" value={initial?.blogPostId ?? sourceBlog?.id ?? ""} />
      <Field label={copy.name} wide><Input name="title" required defaultValue={initial?.title ?? (sourceBlog ? `Promote: ${sourceBlog.title}` : "")} /></Field><Field label={copy.brief} wide><Textarea name="brief" required rows={4} defaultValue={initial?.brief ?? (sourceBlog ? `Promote this VIZA guide accurately.\n\nTitle: ${sourceBlog.title}\nExcerpt: ${sourceBlog.excerpt}\n\n${sourceBlog.bodyMarkdown.slice(0, 3000)}` : "")} /></Field>
      <Field label={copy.destination}><Input name="destinationUrl" type="url" defaultValue={initial?.destinationUrl ?? sourceBlogUrl ?? ""} /><label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><Checkbox checked={trackDestination} onCheckedChange={(checked) => setTrackDestination(checked === true)} />{copy.track}</label></Field><Field label={copy.media}><Input name="mediaUrl" type="url" value={mediaUrl} onChange={(event) => setMediaUrl(event.target.value)} /><MarketingAssetUpload kind="image" locale={locale} onUploaded={setMediaUrl} /></Field><Field label={copy.document}><Input name="documentUrl" type="url" value={documentUrl} onChange={(event) => setDocumentUrl(event.target.value)} /><MarketingAssetUpload kind="document" locale={locale} onUploaded={setDocumentUrl} /></Field><Field label={copy.schedule}><Input name="scheduledFor" type="datetime-local" defaultValue={initial?.scheduledFor?.slice(0, 16)} /></Field>
      <div className="space-y-3 md:col-span-2"><Label>{copy.content}</Label><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{MARKETING_SOCIAL_PLATFORMS.map((platform) => { const selected = platforms.includes(platform); const connected = connectedPlatforms.includes(platform); return <div key={platform} className="rounded-lg border p-3"><label className="flex items-center gap-2 text-sm font-medium"><Checkbox checked={selected} onCheckedChange={(checked) => setPlatforms((current) => checked ? [...current, platform] : current.filter((item) => item !== platform))} />{PLATFORM_LABELS[platform]}<span className={connected ? "ml-auto text-xs text-emerald-700" : "ml-auto text-xs text-muted-foreground"}>{connected ? "●" : "○"}</span></label>{selected ? <Textarea className="mt-3" name={`content-${platform}`} rows={5} required defaultValue={initial?.platformContent[platform] ?? ""} /> : null}</div>; })}</div></div>
      <Field label={copy.reason} wide><Input name="reason" required minLength={5} /></Field>{platforms.length && !publishAvailable ? <p className="text-sm text-amber-700 md:col-span-2">{copy.provider}</p> : null}{message ? <Alert variant={message.error ? "destructive" : "default"} className="md:col-span-2"><AlertDescription>{message.text}</AlertDescription></Alert> : null}
      {!openrouterConnected ? <p className="text-sm text-muted-foreground md:col-span-2">{copy.aiProvider}</p> : null}
      <div className="flex flex-wrap gap-2 md:col-span-2"><Button disabled={pending || !platforms.length} type="submit">{pending ? copy.saving : copy.save}</Button><Button disabled={pending || !platforms.length || !openrouterConnected} type="button" variant="secondary" onClick={(event) => { const form = event.currentTarget.form; if (form?.reportValidity()) generate(new FormData(form)); }}>{copy.generate}</Button><Button disabled={pending || !platforms.length || !publishAvailable} type="button" variant="outline" onClick={(event) => { const form = event.currentTarget.form; if (form?.reportValidity()) submit(new FormData(form), true); }}>{copy.savePublish}</Button></div>
    </form></CardContent></Card>
  );
}
function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) { return <div className={wide ? "space-y-1.5 md:col-span-2" : "space-y-1.5"}><Label>{label}</Label>{children}</div>; }
