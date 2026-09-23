"use client";

import { useRef, useState } from "react";
import type { MarketingAssetKind } from "@/lib/marketing/assets";

const COPY = {
  en: { image: "Upload image", document: "Upload document", uploading: "Uploading…", failed: "Upload failed." },
  zh: { image: "上传图片", document: "上传文档", uploading: "上传中…", failed: "上传失败。" },
} as const;

export function MarketingAssetUpload({
  kind,
  locale,
  onUploaded,
}: {
  kind: MarketingAssetKind;
  locale: "en" | "zh";
  onUploaded: (url: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = COPY[locale];

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("kind", kind);
      form.set("file", file);
      const response = await fetch("/api/admin/marketing/assets", { method: "POST", body: form });
      const body = (await response.json().catch(() => null)) as { url?: unknown; error?: unknown } | null;
      if (!response.ok || typeof body?.url !== "string") {
        throw new Error(typeof body?.error === "string" ? body.error : copy.failed);
      }
      onUploaded(body.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : copy.failed);
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
      <input
        ref={input}
        style={{ display: "none" }}
        type="file"
        accept={kind === "image" ? "image/jpeg,image/png,image/webp,image/gif" : ".pdf,.doc,.docx,.ppt,.pptx"}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      <button
        type="button"
        className="mkt-btn mkt-btn--secondary mkt-btn--sm"
        disabled={uploading}
        onClick={() => input.current?.click()}
      >
        {uploading ? copy.uploading : copy[kind]}
      </button>
      {error ? <p className="mkt-note mkt-note-down">{error}</p> : null}
    </div>
  );
}
