"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  generateMarketingSocialComposition,
  publishMarketingSocialComposition,
  saveMarketingSocialComposition,
} from "@/app/actions/admin-marketing";
import {
  VIZA_CONTENT_PLATFORMS,
  VIZA_VIDEO_PLATFORMS,
  type MarketingBlogAdminRecord,
  type MarketingBlogLocale,
  type MarketingSocialCompositionInput,
  type MarketingSocialCompositionRecord,
  type MarketingSocialPlatform,
} from "@/lib/marketing/contracts";
import type { InterfaceLocale } from "@/lib/i18n/locale";
import { MarketingAssetUpload } from "./asset-upload";

const PLATFORM_LABELS: Record<MarketingSocialPlatform, string> = {
  x: "X",
  "google-business-sg": "Google Business SG",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  pinterest: "Pinterest",
  reddit: "Reddit",
  tiktok: "TikTok",
  youtube: "YouTube",
};

/* In a short, Instagram is a Reel and YouTube is a Short. */
const VIDEO_LABELS: Partial<Record<MarketingSocialPlatform, string>> = {
  tiktok: "TikTok",
  instagram: "Instagram Reels",
  youtube: "YouTube Shorts",
};

const COPY = {
  en: { title: "Composition", videoTitle: "Short video", help: "Generate channel copy with AI or write it manually, then publish through connected social providers.", videoHelp: "Attach a short rendered by viza-fe/social-video, write a caption per channel, then post it now or schedule it.", name: "Internal title", brief: "Brief", destination: "Destination URL", track: "Use a VIZA short link and record privacy-safe clicks", media: "Media URL", document: "Document URL", video: "Video (MP4, 9:16)", videoLocale: "Spoken language", youtubeTitle: "YouTube title", schedule: "Schedule (optional)", reason: "Operational reason", content: "Platform content", generate: "Generate & save with AI", save: "Save composition", savePublish: "Save & publish", saveSchedule: "Save & schedule", saving: "Working…", provider: "A selected social account is not connected. Publishing is disabled; drafts can still be saved.", aiProvider: "Content AI is not connected. AI generation is disabled.", success: "Composition saved.", aiLabel: "Every short is labelled as AI-generated on TikTok, Instagram and YouTube.", privateMode: "Shorts post privately until the VIZA accounts are confirmed: TikTok as \"only me\" and YouTube as private. Instagram has no private Reel, so Reels are refused until then.", publicMode: "Shorts post publicly.", xiaohongshu: "Xiaohongshu is posted by hand: download the MP4 and tick the AI-content label there.", noVideo: "Upload the rendered MP4 first." },
  zh: { title: "社交内容", videoTitle: "短视频", help: "可用 AI 为各渠道生成文案或手动撰写，再通过已连接的社交服务发布。", videoHelp: "上传 viza-fe/social-video 渲染的短视频，为各渠道撰写文案，然后立即发布或定时发布。", name: "内部标题", brief: "内容要求", destination: "目标 URL", track: "使用 VIZA 短链接并记录隐私安全的点击数据", media: "媒体 URL", document: "文档 URL", video: "视频（MP4，9:16）", videoLocale: "配音语言", youtubeTitle: "YouTube 标题", schedule: "计划时间（可选）", reason: "运营原因", content: "平台内容", generate: "使用 AI 生成并保存", save: "保存内容", savePublish: "保存并发布", saveSchedule: "保存并定时发布", saving: "处理中…", provider: "部分所选社交账号尚未连接。发布已禁用，但仍可保存草稿。", aiProvider: "内容 AI 尚未连接，AI 生成功能已禁用。", success: "内容已保存。", aiLabel: "所有短视频都会在 TikTok、Instagram 和 YouTube 上标注为 AI 生成内容。", privateMode: "在确认 VIZA 账号之前，短视频以私密方式发布：TikTok 仅自己可见，YouTube 为私享。Instagram 没有私密 Reels，届时会拒绝发布。", publicMode: "短视频将公开发布。", xiaohongshu: "小红书需手动发布：下载 MP4，并在小红书勾选 AI 生成内容标识。", noVideo: "请先上传渲染好的 MP4。" },
} as const;

export function SocialEditor({
  locale,
  connectedPlatforms,
  openrouterConnected,
  canPublish,
  initial,
  template,
  sourceBlog,
  sourceBlogUrl,
  format,
  videoVisibility = "private",
}: {
  locale: InterfaceLocale;
  connectedPlatforms: MarketingSocialPlatform[];
  openrouterConnected: boolean;
  canPublish: boolean;
  initial?: MarketingSocialCompositionRecord;
  /** Defaults for a new composition, such as a short made from an article's captions. */
  template?: Partial<MarketingSocialCompositionRecord>;
  sourceBlog?: MarketingBlogAdminRecord;
  sourceBlogUrl?: string;
  format?: "image" | "video";
  videoVisibility?: "private" | "public";
}) {
  const copy = COPY[locale];
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const seed = initial ?? template;
  const isVideo = (format ?? (seed?.videoUrl ? "video" : "image")) === "video";
  const channelList: readonly MarketingSocialPlatform[] = isVideo ? VIZA_VIDEO_PLATFORMS : VIZA_CONTENT_PLATFORMS;
  const [platforms, setPlatforms] = useState<MarketingSocialPlatform[]>(
    (seed?.platforms ?? []).filter((platform) => channelList.includes(platform)),
  );
  const [mediaUrl, setMediaUrl] = useState(initial?.mediaUrl ?? sourceBlog?.coverImageUrl ?? "");
  const [documentUrl, setDocumentUrl] = useState(initial?.documentUrl ?? "");
  const [videoUrl, setVideoUrl] = useState(seed?.videoUrl ?? "");
  const [videoLocale, setVideoLocale] = useState<MarketingBlogLocale>(seed?.videoLocale ?? sourceBlog?.locale ?? "en");
  const [scheduledFor, setScheduledFor] = useState(seed?.scheduledFor ? toLocalInput(seed.scheduledFor) : "");
  const [trackDestination, setTrackDestination] = useState(Boolean(seed?.shortLinkId || sourceBlogUrl));
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const publishAvailable =
    platforms.length > 0 && platforms.every((platform) => connectedPlatforms.includes(platform)) && (!isVideo || Boolean(videoUrl));
  const supportsScheduling = isVideo || !platforms.some((platform) => platform === "instagram" || platform === "pinterest");
  const label = (platform: MarketingSocialPlatform) => (isVideo ? VIDEO_LABELS[platform] : undefined) ?? PLATFORM_LABELS[platform];

  function collect(formData: FormData, platformContent: Partial<Record<MarketingSocialPlatform, string>>): MarketingSocialCompositionInput {
    return {
      id: initial?.id,
      blogPostId: String(formData.get("blogPostId") ?? "") || undefined,
      title: String(formData.get("title") ?? ""),
      brief: String(formData.get("brief") ?? ""),
      destinationUrl: String(formData.get("destinationUrl") ?? "") || undefined,
      trackDestination,
      mediaUrl: isVideo ? undefined : String(formData.get("mediaUrl") ?? "") || undefined,
      documentUrl: isVideo ? undefined : String(formData.get("documentUrl") ?? "") || undefined,
      videoUrl: isVideo ? videoUrl || undefined : undefined,
      videoLocale: isVideo ? videoLocale : undefined,
      videoTitle: isVideo ? String(formData.get("videoTitle") ?? "") || undefined : undefined,
      platforms,
      platformContent,
      // datetime-local has no zone; convert in the browser, where the editor's zone is known.
      scheduledFor: supportsScheduling && scheduledFor ? new Date(scheduledFor).toISOString() : undefined,
      reason: String(formData.get("reason") ?? ""),
    };
  }

  function submit(formData: FormData, publish: boolean) {
    startTransition(async () => {
      const platformContent: Partial<Record<MarketingSocialPlatform, string>> = {};
      for (const platform of platforms) platformContent[platform] = String(formData.get(`content-${platform}`) ?? "");
      const result = await saveMarketingSocialComposition(collect(formData, platformContent));
      if (!result.success || !result.data) {
        setMessage({ error: true, text: result.error ?? "Operation failed." });
        return;
      }
      if (publish) {
        const publishResult = await publishMarketingSocialComposition({
          id: result.data.id,
          reason: String(formData.get("reason") ?? ""),
        });
        if (!publishResult.success) {
          setMessage({ error: true, text: publishResult.error ?? "Publish failed." });
          // The draft is saved; keep editing it rather than a second copy.
          if (!initial?.id) router.replace(`/admin/marketing/social/${result.data.id}`);
          return;
        }
      }
      setMessage({ error: false, text: copy.success });
      router.push("/admin/marketing/social");
      router.refresh();
    });
  }

  function generate(formData: FormData) {
    startTransition(async () => {
      const result = await generateMarketingSocialComposition(collect(formData, {}));
      if (!result.success) {
        setMessage({ error: true, text: result.error ?? "Generation failed." });
        return;
      }
      setMessage({ error: false, text: copy.success });
      router.push("/admin/marketing/social");
      router.refresh();
    });
  }

  return (
    <div className="mkt-panel">
      <div className="mkt-panel-head">
        <div>
          <div className="mkt-caption">{isVideo ? copy.videoTitle : copy.title}</div>
          <p className="mkt-note" style={{ marginTop: 4 }}>{isVideo ? copy.videoHelp : copy.help}</p>
        </div>
      </div>
      <div className="mkt-panel-body">
        <form action={(data) => submit(data, false)} className="mkt-form-grid">
          <input type="hidden" name="blogPostId" value={seed?.blogPostId ?? sourceBlog?.id ?? ""} />

          <Field label={copy.name} wide>
            <input
              className="mkt-input"
              name="title"
              required
              defaultValue={seed?.title ?? (sourceBlog ? `${isVideo ? "Short" : "Promote"}: ${sourceBlog.title}` : "")}
            />
          </Field>
          <Field label={copy.brief} wide>
            <textarea
              className="mkt-textarea"
              name="brief"
              required
              rows={4}
              defaultValue={
                seed?.brief ??
                (sourceBlog
                  ? `Promote this VIZA guide accurately.\n\nTitle: ${sourceBlog.title}\nExcerpt: ${sourceBlog.excerpt}\n\n${sourceBlog.bodyMarkdown.slice(0, 3000)}`
                  : "")
              }
            />
          </Field>

          <Field label={copy.destination}>
            <input className="mkt-input" name="destinationUrl" type="url" defaultValue={seed?.destinationUrl ?? sourceBlogUrl ?? ""} />
            <label className="mkt-check">
              <input
                type="checkbox"
                checked={trackDestination}
                onChange={(event) => setTrackDestination(event.target.checked)}
              />
              {copy.track}
            </label>
          </Field>

          {isVideo ? (
            <>
              <Field label={copy.video}>
                <input className="mkt-input" name="videoUrl" type="url" value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} />
                <MarketingAssetUpload kind="video" locale={locale} onUploaded={setVideoUrl} />
                {videoUrl ? (
                  <video src={videoUrl} controls preload="metadata" style={{ width: 180, height: 320, objectFit: "contain", borderRadius: 8, background: "#000" }} />
                ) : null}
              </Field>
              <Field label={copy.videoLocale}>
                <div className="mkt-select-wrap">
                  <select
                    className="mkt-select"
                    name="videoLocale"
                    value={videoLocale}
                    onChange={(event) => setVideoLocale(event.target.value as MarketingBlogLocale)}
                  >
                    <option value="en">English</option>
                    <option value="zh-CN">简体中文</option>
                  </select>
                  <span className="mkt-select-chevron">▼</span>
                </div>
              </Field>
              {platforms.includes("youtube") ? (
                <Field label={copy.youtubeTitle}>
                  <input
                    className="mkt-input"
                    name="videoTitle"
                    required
                    maxLength={100}
                    pattern="[^<>]*"
                    defaultValue={seed?.videoTitle ?? sourceBlog?.title.slice(0, 100) ?? ""}
                  />
                </Field>
              ) : null}
            </>
          ) : (
            <>
              <Field label={copy.media}>
                <input className="mkt-input" name="mediaUrl" type="url" value={mediaUrl} onChange={(event) => setMediaUrl(event.target.value)} />
                <MarketingAssetUpload kind="image" locale={locale} onUploaded={setMediaUrl} />
              </Field>
              <Field label={copy.document}>
                <input className="mkt-input" name="documentUrl" type="url" value={documentUrl} onChange={(event) => setDocumentUrl(event.target.value)} />
                <MarketingAssetUpload kind="document" locale={locale} onUploaded={setDocumentUrl} />
              </Field>
            </>
          )}
          {supportsScheduling ? (
            <Field label={copy.schedule}>
              <input
                className="mkt-input"
                name="scheduledFor"
                type="datetime-local"
                value={scheduledFor}
                onChange={(event) => setScheduledFor(event.target.value)}
              />
            </Field>
          ) : (
            <p className="mkt-note" style={{ alignSelf: "center" }}>
              {locale === "zh"
                ? "Instagram 和 Pinterest 内容可在审核后即时发布。"
                : "Instagram and Pinterest posts publish when approved."}
            </p>
          )}

          {isVideo ? (
            <div className="mkt-field-wide" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <p className={`mkt-note${videoVisibility === "private" ? " mkt-note-warn" : ""}`}>
                {videoVisibility === "private" ? copy.privateMode : copy.publicMode}
              </p>
              <p className="mkt-note">{copy.aiLabel}</p>
              <p className="mkt-note">{copy.xiaohongshu}</p>
            </div>
          ) : null}

          {/* One tile per platform: tick it to select, and the caption box for
              that channel opens inside the same tile. */}
          <div className="mkt-field-wide" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span className="mkt-label">{copy.content}</span>
            <div className="mkt-tiles" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
              {channelList.map((platform) => {
                const selected = platforms.includes(platform);
                const connected = connectedPlatforms.includes(platform);
                return (
                  <div key={platform} className="mkt-tile">
                    <label className="mkt-tile-head" style={{ cursor: "pointer" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={(event) =>
                            setPlatforms((current) =>
                              event.target.checked ? [...current, platform] : current.filter((item) => item !== platform),
                            )
                          }
                        />
                        {label(platform)}
                      </span>
                      <span className={`mkt-badge ${connected ? "is-up" : "is-off"}`}>
                        <span className="mkt-dot" />
                      </span>
                    </label>
                    {selected ? (
                      <textarea
                        className="mkt-textarea"
                        style={{ marginTop: 10 }}
                        name={`content-${platform}`}
                        rows={5}
                        required
                        defaultValue={seed?.platformContent?.[platform] ?? ""}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <Field label={copy.reason} wide>
            <input className="mkt-input" name="reason" required minLength={5} />
          </Field>

          {isVideo && !videoUrl ? <p className="mkt-note mkt-field-wide">{copy.noVideo}</p> : null}
          {platforms.length && !platforms.every((platform) => connectedPlatforms.includes(platform)) ? (
            <p className="mkt-note mkt-note-warn mkt-field-wide">{copy.provider}</p>
          ) : null}
          {!openrouterConnected ? <p className="mkt-note mkt-field-wide">{copy.aiProvider}</p> : null}
          {message ? (
            <p className={`mkt-alert mkt-field-wide ${message.error ? "is-error" : "is-success"}`}>{message.text}</p>
          ) : null}

          <div className="mkt-actions-row">
            <button className="mkt-btn mkt-btn--primary" disabled={pending || !platforms.length} type="submit">
              {pending ? copy.saving : copy.save}
            </button>
            <button
              className="mkt-btn mkt-btn--secondary"
              disabled={pending || !platforms.length || !openrouterConnected}
              type="button"
              onClick={(event) => {
                const form = event.currentTarget.form;
                if (form?.reportValidity()) generate(new FormData(form));
              }}
            >
              {copy.generate}
            </button>
            {canPublish ? (
              <button
                className="mkt-btn mkt-btn--secondary"
                disabled={pending || !platforms.length || !publishAvailable}
                type="button"
                onClick={(event) => {
                  const form = event.currentTarget.form;
                  if (form?.reportValidity()) submit(new FormData(form), true);
                }}
              >
                {isVideo && scheduledFor ? copy.saveSchedule : copy.savePublish}
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}

/** An ISO time as the value a datetime-local input shows in this browser's zone. */
function toLocalInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`mkt-field${wide ? " mkt-field-wide" : ""}`}>
      <span className="mkt-label">{label}</span>
      {children}
    </div>
  );
}
