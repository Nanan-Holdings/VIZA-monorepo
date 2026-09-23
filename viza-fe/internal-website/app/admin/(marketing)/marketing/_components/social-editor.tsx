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
  type MarketingBlogAdminRecord,
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
};

const COPY = {
  en: { title: "Composition", help: "Generate channel copy with AI or write it manually, then publish through connected social providers.", name: "Internal title", brief: "Brief", destination: "Destination URL", track: "Use a VIZA short link and record privacy-safe clicks", media: "Media URL", document: "Document URL", schedule: "Schedule (optional)", reason: "Operational reason", content: "Platform content", generate: "Generate & save with AI", save: "Save composition", savePublish: "Save & publish", saving: "Working…", provider: "A selected social account is not connected. Publishing is disabled; drafts can still be saved.", aiProvider: "Content AI is not connected. AI generation is disabled.", success: "Composition saved." },
  zh: { title: "社交内容", help: "可用 AI 为各渠道生成文案或手动撰写，再通过已连接的社交服务发布。", name: "内部标题", brief: "内容要求", destination: "目标 URL", track: "使用 VIZA 短链接并记录隐私安全的点击数据", media: "媒体 URL", document: "文档 URL", schedule: "计划时间（可选）", reason: "运营原因", content: "平台内容", generate: "使用 AI 生成并保存", save: "保存内容", savePublish: "保存并发布", saving: "处理中…", provider: "部分所选社交账号尚未连接。发布已禁用，但仍可保存草稿。", aiProvider: "内容 AI 尚未连接，AI 生成功能已禁用。", success: "内容已保存。" },
} as const;

export function SocialEditor({
  locale,
  connectedPlatforms,
  openrouterConnected,
  canPublish,
  initial,
  sourceBlog,
  sourceBlogUrl,
}: {
  locale: InterfaceLocale;
  connectedPlatforms: MarketingSocialPlatform[];
  openrouterConnected: boolean;
  canPublish: boolean;
  initial?: MarketingSocialCompositionRecord;
  sourceBlog?: MarketingBlogAdminRecord;
  sourceBlogUrl?: string;
}) {
  const copy = COPY[locale];
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [platforms, setPlatforms] = useState<MarketingSocialPlatform[]>(initial?.platforms ?? []);
  const [mediaUrl, setMediaUrl] = useState(initial?.mediaUrl ?? sourceBlog?.coverImageUrl ?? "");
  const [documentUrl, setDocumentUrl] = useState(initial?.documentUrl ?? "");
  const [trackDestination, setTrackDestination] = useState(Boolean(initial?.shortLinkId || sourceBlogUrl));
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const publishAvailable = platforms.length > 0 && platforms.every((platform) => connectedPlatforms.includes(platform));
  const supportsScheduling = !platforms.some((platform) => platform === "instagram" || platform === "pinterest");

  function submit(formData: FormData, publish: boolean) {
    startTransition(async () => {
      const platformContent: Partial<Record<MarketingSocialPlatform, string>> = {};
      for (const platform of platforms) platformContent[platform] = String(formData.get(`content-${platform}`) ?? "");
      const result = await saveMarketingSocialComposition({
        id: initial?.id,
        blogPostId: String(formData.get("blogPostId") ?? "") || undefined,
        title: String(formData.get("title") ?? ""),
        brief: String(formData.get("brief") ?? ""),
        destinationUrl: String(formData.get("destinationUrl") ?? "") || undefined,
        trackDestination,
        mediaUrl: String(formData.get("mediaUrl") ?? "") || undefined,
        documentUrl: String(formData.get("documentUrl") ?? "") || undefined,
        platforms,
        platformContent,
        scheduledFor: String(formData.get("scheduledFor") ?? "") || undefined,
        reason: String(formData.get("reason") ?? ""),
      });
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
          <div className="mkt-caption">{copy.title}</div>
          <p className="mkt-note" style={{ marginTop: 4 }}>{copy.help}</p>
        </div>
      </div>
      <div className="mkt-panel-body">
        <form action={(data) => submit(data, false)} className="mkt-form-grid">
          <input type="hidden" name="blogPostId" value={initial?.blogPostId ?? sourceBlog?.id ?? ""} />

          <Field label={copy.name} wide>
            <input
              className="mkt-input"
              name="title"
              required
              defaultValue={initial?.title ?? (sourceBlog ? `Promote: ${sourceBlog.title}` : "")}
            />
          </Field>
          <Field label={copy.brief} wide>
            <textarea
              className="mkt-textarea"
              name="brief"
              required
              rows={4}
              defaultValue={
                initial?.brief ??
                (sourceBlog
                  ? `Promote this VIZA guide accurately.\n\nTitle: ${sourceBlog.title}\nExcerpt: ${sourceBlog.excerpt}\n\n${sourceBlog.bodyMarkdown.slice(0, 3000)}`
                  : "")
              }
            />
          </Field>

          <Field label={copy.destination}>
            <input className="mkt-input" name="destinationUrl" type="url" defaultValue={initial?.destinationUrl ?? sourceBlogUrl ?? ""} />
            <label className="mkt-check">
              <input
                type="checkbox"
                checked={trackDestination}
                onChange={(event) => setTrackDestination(event.target.checked)}
              />
              {copy.track}
            </label>
          </Field>
          <Field label={copy.media}>
            <input className="mkt-input" name="mediaUrl" type="url" value={mediaUrl} onChange={(event) => setMediaUrl(event.target.value)} />
            <MarketingAssetUpload kind="image" locale={locale} onUploaded={setMediaUrl} />
          </Field>
          <Field label={copy.document}>
            <input className="mkt-input" name="documentUrl" type="url" value={documentUrl} onChange={(event) => setDocumentUrl(event.target.value)} />
            <MarketingAssetUpload kind="document" locale={locale} onUploaded={setDocumentUrl} />
          </Field>
          {supportsScheduling ? (
            <Field label={copy.schedule}>
              <input className="mkt-input" name="scheduledFor" type="datetime-local" defaultValue={initial?.scheduledFor?.slice(0, 16)} />
            </Field>
          ) : (
            <p className="mkt-note" style={{ alignSelf: "center" }}>
              {locale === "zh"
                ? "Instagram 和 Pinterest 内容可在审核后即时发布。"
                : "Instagram and Pinterest posts publish when approved."}
            </p>
          )}

          {/* One tile per platform: tick it to select, and the caption box for
              that channel opens inside the same tile. */}
          <div className="mkt-field-wide" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span className="mkt-label">{copy.content}</span>
            <div className="mkt-tiles" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
              {VIZA_CONTENT_PLATFORMS.map((platform) => {
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
                        {PLATFORM_LABELS[platform]}
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
                        defaultValue={initial?.platformContent[platform] ?? ""}
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

          {platforms.length && !publishAvailable ? (
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
                {copy.savePublish}
              </button>
            ) : null}
          </div>
        </form>
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
