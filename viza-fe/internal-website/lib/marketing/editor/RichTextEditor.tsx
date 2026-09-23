"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useEditor, useEditorState, EditorContent, type Editor } from "@tiptap/react"
import { TextSelection } from "@tiptap/pm/state"
import type { EditorView } from "@tiptap/pm/view"
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  Heading4,
  ImagePlus,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Video,
  Table as TableIcon,
  Type,
  Undo2,
  Redo2,
} from "lucide-react"
import { parseVideoUrl, providerLabel } from "@/lib/marketing/editor/videoEmbed"
import { blogEditorExtensions, MAX_BODY_IMAGE_BYTES } from "@/lib/marketing/editor/blogEditorExtensions"
import {
  altFromFilename,
  dragHasImage,
  imagesFrom,
  type PendingImage,
} from "@/lib/marketing/editor/blogImagePaste"

const COPY = {
  en: { body: "Post body", bold: "Bold", italic: "Italic", heading2: "Heading 2", heading3: "Heading 3", heading4: "Heading 4", bullet: "Bullet list", numbered: "Numbered list", quote: "Quote", link: "Link", linkUrl: "Link URL", image: "Insert image", uploadingImage: "Uploading image…", imageAlt: "Image alt text", video: "Embed video", videoUrl: "Video URL (YouTube, Vimeo, Twitch, or Loom)", videoInvalid: "Unsupported video URL.", table: "Insert table", addColumn: "+ Column", addRow: "+ Row", removeColumn: "− Column", removeRow: "− Row", header: "Header", deleteTable: "Delete table", undo: "Undo", redo: "Redo", uploadFailed: "Image upload failed.", uploadProgress: "Uploading images…", drop: "Drop to add the image here.", imageType: "Choose a JPEG, PNG, WebP, or GIF image.", imageSize: "Image must be 8 MB or smaller." },
  zh: { body: "文章正文", bold: "粗体", italic: "斜体", heading2: "二级标题", heading3: "三级标题", heading4: "四级标题", bullet: "项目符号列表", numbered: "编号列表", quote: "引用", link: "链接", linkUrl: "链接网址", image: "插入图片", uploadingImage: "正在上传图片…", imageAlt: "图片替代文字", video: "嵌入视频", videoUrl: "视频网址（YouTube、Vimeo、Twitch 或 Loom）", videoInvalid: "不支持该视频网址。", table: "插入表格", addColumn: "+ 列", addRow: "+ 行", removeColumn: "− 列", removeRow: "− 行", header: "表头", deleteTable: "删除表格", undo: "撤销", redo: "重做", uploadFailed: "图片上传失败。", uploadProgress: "正在上传图片…", drop: "将图片拖放到此处。", imageType: "请选择 JPEG、PNG、WebP 或 GIF 图片。", imageSize: "图片不得超过 8 MB。" },
} as const

type EditorLocale = keyof typeof COPY

async function uploadImageFile(file: File, locale: EditorLocale): Promise<string> {
  const copy = COPY[locale]
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) throw new Error(copy.imageType)
  if (file.size > MAX_BODY_IMAGE_BYTES) throw new Error(copy.imageSize)
  const form = new FormData()
  form.set("kind", "image")
  form.set("file", file)
  const response = await fetch("/api/admin/marketing/assets", { method: "POST", body: form })
  const data = await response.json().catch(() => null) as { url?: unknown; error?: unknown } | null
  if (!response.ok || typeof data?.url !== "string") throw new Error(typeof data?.error === "string" ? data.error : copy.uploadFailed)
  return data.url
}

async function uploadImageUrl(url: string, locale: EditorLocale): Promise<string> {
  const response = await fetch("/api/admin/marketing/assets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) })
  const data = await response.json().catch(() => null) as { url?: unknown; error?: unknown } | null
  if (!response.ok || typeof data?.url !== "string") throw new Error(typeof data?.error === "string" ? data.error : COPY[locale].uploadFailed)
  return data.url
}

/**
 * Drop the image into the document at `pos`, splitting the block if the
 * cursor sits mid-paragraph. Returns the position just after it so a
 * multi-image paste stacks in order.
 */
function insertImageAt(view: EditorView, pos: number, src: string, alt: string): number {
  const type = view.state.schema.nodes.image
  if (!type) return pos
  const at = Math.min(Math.max(pos, 0), view.state.doc.content.size)
  const tr = view.state.tr
  tr.setSelection(TextSelection.near(tr.doc.resolve(at)))
  tr.replaceSelectionWith(type.create({ src, alt: alt || null }))
  view.dispatch(tr.scrollIntoView())
  return view.state.selection.to
}

/* ------------------------------------------------------------------ */
/*  Load-time normalisation                                            */
/*  A saved draft is markdown, so a video lives as a bare URL line.    */
/*  tiptap-markdown parses that into a paragraph (or autolink), not a  */
/*  player. Convert those paragraphs back into video nodes on load.    */
/* ------------------------------------------------------------------ */
function normalizeVideoNodes(editor: Editor) {
  const { state } = editor
  const { doc, schema } = state
  const hits: { from: number; to: number; provider: string; src: string; embed: string }[] = []

  doc.descendants((node, pos) => {
    if (node.type.name !== "paragraph") return
    const text = node.textContent.trim()
    // Mirror the backend's "URL alone on a line" rule.
    if (!text || /\s/.test(text)) return
    const parsed = parseVideoUrl(text)
    if (!parsed) return
    hits.push({
      from: pos,
      to: pos + node.nodeSize,
      provider: parsed.provider,
      src: parsed.canonicalUrl,
      embed: parsed.canonicalUrl,
    })
  })

  if (hits.length === 0) return

  let tr = state.tr
  // Apply back-to-front so earlier positions stay valid.
  for (const hit of hits.reverse()) {
    const vnode =
      hit.provider === "youtube" && schema.nodes.youtube
        ? schema.nodes.youtube.create({ src: hit.src })
        : schema.nodes.videoEmbed?.create({ src: hit.src, provider: hit.provider })
    if (vnode) tr = tr.replaceWith(hit.from, hit.to, vnode)
  }
  if (tr.docChanged) editor.view.dispatch(tr.setMeta("addToHistory", false))
}

/* ------------------------------------------------------------------ */
/*  Toolbar                                                            */
/* ------------------------------------------------------------------ */
function ToolbarButton({
  onClick,
  active,
  disabled,
  label,
  children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className="rte-btn"
      style={{
        borderColor: active ? "hsl(var(--primary))" : "hsl(var(--border))",
        backgroundColor: active ? "hsl(var(--accent))" : "transparent",
        color: active ? "hsl(var(--primary))" : "hsl(var(--foreground))",
      }}
    >
      {children}
    </button>
  )
}

function TableTextButton({
  onClick,
  children,
}: {
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="rte-mini"
    >
      {children}
    </button>
  )
}

function Toolbar({
  editor,
  onImageFile,
  uploading,
  locale,
}: {
  editor: Editor
  locale: EditorLocale
  onImageFile: (file: File) => void | Promise<void>
  uploading: boolean
}) {
  const imageInputRef = useRef<HTMLInputElement>(null)
  const copy = COPY[locale]

  // Tiptap v3 doesn't re-render React on selection changes by default, so
  // reading editor.isActive() during render goes stale: the table strip (and
  // active highlights) lingered until the next content edit, e.g. clicking
  // Bold, made them vanish mid-action. useEditorState subscribes to every
  // transaction, keeping the toolbar in sync with the actual cursor position.
  const ui = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      h4: e.isActive("heading", { level: 4 }),
      bulletList: e.isActive("bulletList"),
      orderedList: e.isActive("orderedList"),
      blockquote: e.isActive("blockquote"),
      link: e.isActive("link"),
      table: e.isActive("table"),
      image: e.isActive("image"),
      imageAlt: (e.getAttributes("image").alt as string | null) ?? "",
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  })

  // Pasted and dropped images land with a guessed alt (filename, or whatever
  // the source `<img>` carried), so the selected image needs a way to fix it.
  function editAlt() {
    const next = window.prompt(copy.imageAlt, ui.imageAlt)
    if (next === null) return
    editor.chain().focus().updateAttributes("image", { alt: next.trim() || null }).run()
  }

  function addLink() {
    const prev = editor.getAttributes("link").href as string | undefined
    const url = window.prompt(copy.linkUrl, prev ?? "https://")
    if (url === null) return
    if (url.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run()
  }

  function addVideo() {
    const url = window.prompt(copy.videoUrl)
    if (!url) return
    const parsed = parseVideoUrl(url)
    if (!parsed) {
      window.alert(copy.videoInvalid)
      return
    }
    if (parsed.provider === "youtube") {
      ;(editor.chain().focus() as ReturnType<Editor["chain"]> & { setYoutubeVideo: (options: { src: string }) => ReturnType<Editor["chain"]> }).setYoutubeVideo({ src: parsed.canonicalUrl }).run()
    } else {
      ;(editor.chain().focus() as ReturnType<Editor["chain"]> & { setVideoEmbed: (options: { src: string; provider: string }) => ReturnType<Editor["chain"]> })
        .setVideoEmbed({ src: parsed.canonicalUrl, provider: parsed.provider })
        .run()
    }
  }

  return (
    <div
      className="rte-toolbar"
      style={{ borderColor: "hsl(var(--border))" }}
    >
      <ToolbarButton
        label={copy.bold}
        active={ui.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold size={16} />
      </ToolbarButton>
      <ToolbarButton
        label={copy.italic}
        active={ui.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic size={16} />
      </ToolbarButton>
      <span className="rte-sep" />
      <ToolbarButton
        label={copy.heading2}
        active={ui.h2}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 size={16} />
      </ToolbarButton>
      <ToolbarButton
        label={copy.heading3}
        active={ui.h3}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 size={16} />
      </ToolbarButton>
      <ToolbarButton
        label={copy.heading4}
        active={ui.h4}
        onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
      >
        <Heading4 size={16} />
      </ToolbarButton>
      <span className="rte-sep" />
      <ToolbarButton
        label={copy.bullet}
        active={ui.bulletList}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List size={16} />
      </ToolbarButton>
      <ToolbarButton
        label={copy.numbered}
        active={ui.orderedList}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered size={16} />
      </ToolbarButton>
      <ToolbarButton
        label={copy.quote}
        active={ui.blockquote}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote size={16} />
      </ToolbarButton>
      <span className="rte-sep" />
      <ToolbarButton label={copy.link} active={ui.link} onClick={addLink}>
        <LinkIcon size={16} />
      </ToolbarButton>
      <ToolbarButton
        label={uploading ? copy.uploadingImage : copy.image}
        disabled={uploading}
        onClick={() => imageInputRef.current?.click()}
      >
        <ImagePlus size={16} />
      </ToolbarButton>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          // Reset so choosing the same file twice re-fires onChange.
          e.target.value = ""
          if (file) void onImageFile(file)
        }}
      />
      <ToolbarButton label={copy.video} onClick={addVideo}>
        <Video size={16} />
      </ToolbarButton>
      <ToolbarButton
        label={copy.table}
        active={ui.table}
        onClick={() =>
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        }
      >
        <TableIcon size={16} />
      </ToolbarButton>

      {ui.image && (
        <span
          className="rte-group"
          style={{ borderColor: "hsl(var(--primary))" }}
        >
          <Type size={14} style={{ color: "hsl(var(--primary))" }} aria-hidden />
          <TableTextButton onClick={editAlt}>
            {ui.imageAlt ? `Alt: ${ui.imageAlt.slice(0, 24)}` : copy.imageAlt}
          </TableTextButton>
        </span>
      )}

      {ui.table && (
        <span
          className="rte-group"
          style={{ borderColor: "hsl(var(--primary))" }}
        >
          <TableTextButton onClick={() => editor.chain().focus().addColumnAfter().run()}>
            +Col
          </TableTextButton>
          <TableTextButton onClick={() => editor.chain().focus().addRowAfter().run()}>
            +Row
          </TableTextButton>
          <TableTextButton onClick={() => editor.chain().focus().deleteColumn().run()}>
            −Col
          </TableTextButton>
          <TableTextButton onClick={() => editor.chain().focus().deleteRow().run()}>
            −Row
          </TableTextButton>
          <TableTextButton onClick={() => editor.chain().focus().toggleHeaderRow().run()}>
            Header
          </TableTextButton>
          <TableTextButton onClick={() => editor.chain().focus().deleteTable().run()}>
            Delete
          </TableTextButton>
        </span>
      )}

      <span className="rte-sep" />
      <ToolbarButton
        label={copy.undo}
        disabled={!ui.canUndo}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo2 size={16} />
      </ToolbarButton>
      <ToolbarButton
        label={copy.redo}
        disabled={!ui.canRedo}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2 size={16} />
      </ToolbarButton>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Editor                                                             */
/* ------------------------------------------------------------------ */
export default function RichTextEditor({
  value,
  onChange,
  placeholder,
  locale,
  onUploadingChange,
}: {
  /** Markdown string. */
  value: string
  /** Called with the serialised markdown on every change. */
  onChange: (markdown: string) => void
  placeholder?: string
  locale: EditorLocale
  onUploadingChange?: (uploading: boolean) => void
}) {
  // Last markdown this editor emitted, so the controlled-`value` effect can
  // tell an external replacement (load a draft) from its own round-trip and
  // avoid needless setContent() calls that would jump the cursor.
  const copy = COPY[locale]
  const lastEmitted = useRef(value)
  // Uploads in flight, so several pasted images share one "Uploading…" state.
  const [uploads, setUploads] = useState(0)
  const [imageError, setImageError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)

  useEffect(() => { onUploadingChange?.(uploads > 0) }, [onUploadingChange, uploads])

  /**
   * Upload each image and insert it at `pos`, in order. One failure reports
   * itself and the rest of the batch carries on.
   */
  const ingestImages = useCallback(
    async (view: EditorView, pos: number, items: PendingImage[]) => {
      setImageError(null)
      setUploads((n) => n + items.length)
      let at = pos
      for (const item of items) {
        try {
          const url = item.file
            ? await uploadImageFile(item.file, locale)
            : item.url ? await uploadImageUrl(item.url, locale) : ""
          if (!url) throw new Error(copy.uploadFailed)
          at = insertImageAt(view, at, url, item.alt)
        } catch (err) {
          setImageError(err instanceof Error ? err.message : copy.uploadFailed)
        } finally {
          setUploads((n) => n - 1)
        }
      }
    },
    [copy.uploadFailed, locale],
  )

  const editor = useEditor({
    immediatelyRender: false,
    extensions: blogEditorExtensions(),
    content: value || "",
    editorProps: {
      attributes: {
        class: "blog-tiptap focus:outline-none",
        "aria-label": copy.body,
      },
      // Paste an image: a screenshot, a copied picture, or a copied image
      // address. Anything else (text, a link, mixed rich text) falls through
      // to the normal paste.
      handlePaste(view, event) {
        const items = imagesFrom(event.clipboardData)
        if (items.length === 0) return false
        event.preventDefault()
        void ingestImages(view, view.state.selection.from, items)
        return true
      },
      // Drag a file off the desktop, or an image out of another tab, and drop
      // it where the cursor is. `moved` means an image already in the document
      // is being re-ordered, that is ProseMirror's job, not ours.
      handleDrop(view, event, _slice, moved) {
        if (moved) return false
        const items = imagesFrom(event.dataTransfer)
        if (items.length === 0) return false
        event.preventDefault()
        setDragActive(false)
        const at =
          view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ??
          view.state.selection.from
        void ingestImages(view, at, items)
        return true
      },
    },
    onCreate({ editor }) {
      normalizeVideoNodes(editor as Editor)
    },
    onUpdate({ editor }) {
      const md = (editor.storage as typeof editor.storage & { markdown: { getMarkdown: () => string } }).markdown.getMarkdown()
      lastEmitted.current = md
      onChange(md)
    },
  })

  // Sync only when the parent replaces `value` from the outside (e.g. loading a
  // different draft into an already-mounted editor). Our own edits set
  // `lastEmitted` first, so those never re-enter setContent.
  useEffect(() => {
    if (!editor) return
    if (value !== lastEmitted.current) {
      lastEmitted.current = value
      editor.commands.setContent(value || "")
      normalizeVideoNodes(editor)
    }
  }, [value, editor])

  /** Toolbar button: same pipeline as a paste, but alt text is asked for up front. */
  async function insertImageFromToolbar(file: File) {
    if (!editor) return
    const alt = window.prompt(copy.imageAlt, altFromFilename(file.name))
    if (alt === null) return
    await ingestImages(editor.view, editor.state.selection.from, [{ file, alt: alt.trim() }])
  }

  return (
    <div
      className="viza-rte rte overflow-hidden rounded-md border bg-background"
      style={{ borderColor: dragActive ? "hsl(var(--primary))" : undefined }}
      onDragOver={(e) => {
        if (dragHasImage(e.dataTransfer)) setDragActive(true)
      }}
      onDragLeave={(e) => {
        // Ignore the dragleave fired when crossing between child elements.
        const next = e.relatedTarget
        if (!(next instanceof HTMLElement) || !e.currentTarget.contains(next)) setDragActive(false)
      }}
      onDrop={() => setDragActive(false)}
    >
      {editor && (
        <Toolbar editor={editor} onImageFile={insertImageFromToolbar} uploading={uploads > 0} locale={locale} />
      )}
      <EditorContent
        editor={editor}
        data-placeholder={placeholder}
        className="rte-content"
      />
      <style jsx global>{`
        .viza-rte .rte-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: .3rem; padding: .5rem; border-bottom: 1px solid hsl(var(--border)); }
        .viza-rte .rte-btn, .viza-rte .rte-mini { display: inline-flex; align-items: center; justify-content: center; min-height: 2rem; min-width: 2rem; padding: .3rem; border: 1px solid hsl(var(--border)); border-radius: .35rem; font-size: .75rem; }
        .viza-rte .rte-btn:hover, .viza-rte .rte-mini:hover { background: hsl(var(--muted)); }
        .viza-rte .rte-btn:disabled { opacity: .45; }
        .viza-rte .rte-sep { height: 1.5rem; width: 1px; background: hsl(var(--border)); margin: 0 .25rem; }
        .viza-rte .rte-group { display: inline-flex; flex-wrap: wrap; gap: .2rem; padding: .2rem; border: 1px solid hsl(var(--border)); border-radius: .35rem; }
        .viza-rte .blog-tiptap { min-height: 24rem; padding: 1.25rem; outline: none; line-height: 1.65; }
        .viza-rte .blog-tiptap > * + * { margin-top: .9rem; }
        .viza-rte .blog-tiptap h1 { font-size: 1.8rem; font-weight: 700; }
        .viza-rte .blog-tiptap h2 { font-size: 1.5rem; font-weight: 700; }
        .viza-rte .blog-tiptap h3 { font-size: 1.25rem; font-weight: 650; }
        .viza-rte .blog-tiptap h4 { font-size: 1.1rem; font-weight: 650; }
        .viza-rte .blog-tiptap ul { list-style: disc; padding-left: 1.5rem; }
        .viza-rte .blog-tiptap ol { list-style: decimal; padding-left: 1.5rem; }
        .viza-rte .blog-tiptap blockquote { border-left: 3px solid hsl(var(--border)); padding-left: 1rem; color: hsl(var(--muted-foreground)); }
        .viza-rte .blog-tiptap a { color: hsl(var(--primary)); text-decoration: underline; }
        .viza-rte .blog-tiptap img { max-width: 100%; height: auto; border-radius: .4rem; }
        .viza-rte .blog-tiptap table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
        .viza-rte .blog-tiptap th, .viza-rte .blog-tiptap td { border: 1px solid hsl(var(--border)); padding: .5rem; vertical-align: top; }
        .viza-rte .blog-tiptap th { background: hsl(var(--muted)); }
        .viza-rte .blog-tiptap div[data-youtube-video] iframe, .viza-rte .blog-tiptap .blog-video-embed iframe { max-width: 100%; }
        .viza-rte .rte-foot { border-top: 1px solid hsl(var(--border)); padding: .5rem .75rem; font-size: .8rem; }
      `}</style>
      {(uploads > 0 || imageError || dragActive) && (
        <p
          className="rte-foot"
          style={{
            borderColor: "hsl(var(--border))",
            color: imageError ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))",
          }}
          role="status"
        >
          {uploads > 0
            ? copy.uploadProgress
            : imageError
              ? imageError
              : copy.drop}
        </p>
      )}
    </div>
  )
}

export { providerLabel }
