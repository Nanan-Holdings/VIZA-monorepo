/**
 * TipTap schema for VIZA staff blog drafts. Drafts persist as Markdown, so
 * custom image, video, and table nodes provide explicit Markdown serializers.
 * A plain save and reload must preserve all authored content.
 */
import { Node, mergeAttributes, nodePasteRule } from "@tiptap/core"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import StarterKit from "@tiptap/starter-kit"
import Youtube from "@tiptap/extension-youtube"
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table"
import { Markdown } from "tiptap-markdown"
import { parseVideoUrl, videoEmbedSrc, type ParsedVideo } from "@/lib/marketing/editor/videoEmbed"

interface MarkdownState {
  out: string
  closed: unknown
  renderInline: (node: ProseMirrorNode) => void
  write: (value: string) => void
  closeBlock: (node: ProseMirrorNode) => void
  ensureNewLine: () => void
}

/** Matches the image limit in the VIZA marketing asset upload route. */
export const MAX_BODY_IMAGE_BYTES = 8 * 1024 * 1024

// Global paste matchers, one per non-YouTube provider.
const VIMEO_PASTE = /(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(?:video\/)?\d+\S*/gi
const TWITCH_PASTE = /(?:https?:\/\/)?(?:www\.|clips\.)?twitch\.tv\/\S+/gi
const LOOM_PASTE = /(?:https?:\/\/)?(?:www\.)?loom\.com\/(?:share|embed)\/[\w-]+\S*/gi

/** Host allowed to embed players in the editor (Twitch needs it). */
function browserParents(): string[] | undefined {
  if (typeof window !== "undefined" && window.location?.hostname) {
    return [window.location.hostname]
  }
  return undefined
}

/** Keep alt text safe for the `![alt](url)` form (and for the publish
 *  pipeline's lone-image regex, which stops at `]`). */
export function sanitizeAlt(alt: unknown): string {
  return String(alt ?? "")
    .replace(/[[\]\n]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/* ------------------------------------------------------------------ */
/*  Rebuilding video nodes when a draft is loaded                      */
/*                                                                     */
/*  Every video node serialises to a bare URL on its own line, the    */
/*  shape recognised by the public blog renderer. Without restoration */
/*  the link can become an ordinary paragraph on reload.             */
/*  on reload markdown-it's `linkify` turned the line into an ordinary */
/*  paragraph holding a single autolink and the embed was gone. Worse, */
/*  prosemirror-markdown serialises a link whose text equals its href  */
/*  in the autolink form, so the *second* save wrote                   */
/*  `<https://vimeo.com/123>`, which loneVideoUrl() rejects (it       */
/*  requires the line to start with `http`), silently downgrading the  */
/*  published video to a paragraph.                                    */
/*                                                                     */
/*  Rebuilding the node from the parsed DOM closes the loop: node ->   */
/*  bare URL -> node -> the same bare URL, stable for any number of    */
/*  save/load cycles.                                                  */
/*                                                                     */
/*  A lone URL reaches this point in two spellings. With `linkify` off */
/*  (no automatic hyperlinks, see blogEditorExtensions below) a bare  */
/*  URL line stays plain text, which is what every video node now      */
/*  serialises to. Drafts saved before that round trip was fixed hold  */
/*  the `<url>` autolink form instead, and CommonMark's own autolink   */
/*  rule, which `linkify: false` does not touch, still parses those  */
/*  into an anchor. Both are repaired.                                 */
/* ------------------------------------------------------------------ */

/** Blocks a serialised video URL can come back inside (cells carry no `<p>`). */
const VIDEO_URL_BLOCKS = "p, td, th"

/**
 * Mirror of loneVideoUrl() in the publish pipeline, only a bare, whitespace
 * free http(s) URL counts as a video, so `see https://vimeo.com/1 now` stays an
 * ordinary inline link here exactly as it does at publish time.
 */
function loneVideoUrl(text: string): ParsedVideo | null {
  const url = text.trim()
  if (!url || /\s/.test(url) || !/^https?:\/\//i.test(url)) return null
  return parseVideoUrl(url)
}

/**
 * The URL of a block that holds nothing but one URL, in either spelling a saved
 * draft can carry it: bare text (what a video node serialises to) or a `<url>`
 * autolink (older drafts). Anything else, prose around the URL, a link whose
 * text differs from its href, is left alone.
 */
function loneUrlInBlock(block: Element): string | null {
  const text = block.textContent?.trim() ?? ""
  if (!text) return null
  // Plain text: no markup at all inside the block.
  if (block.children.length === 0) return text

  const anchor = block.firstElementChild
  // The anchor has to *be* the block: one child element, no other text.
  if (!anchor || anchor.tagName !== "A" || block.children.length !== 1) return null
  if (anchor.textContent?.trim() !== text) return null
  // An autolink spells out its own href; a real link with custom text does not.
  return text === anchor.getAttribute("href")?.trim() ? text : null
}

/**
 * Replace every block whose entire content is one video URL with the DOM
 * `build` returns, for the providers `accept` claims.
 *
 * The URL is passed through verbatim rather than canonicalised so that a
 * save → load → save cycle is byte-stable.
 */
function restoreVideoNodes(
  element: HTMLElement,
  accept: (video: ParsedVideo) => boolean,
  build: (doc: Document, url: string, video: ParsedVideo) => HTMLElement,
): void {
  const doc = element.ownerDocument
  if (!doc) return

  for (const block of Array.from(element.querySelectorAll(VIDEO_URL_BLOCKS))) {
    const url = loneUrlInBlock(block)
    if (!url) continue

    const video = loneVideoUrl(url)
    if (!video || !accept(video)) continue

    const node = build(doc, url, video)
    // A paragraph is replaced outright; a cell keeps its `<td>` and swaps
    // its content, so the surrounding table grid is left alone.
    if (block.tagName === "P") block.replaceWith(node)
    else block.replaceChildren(node)
  }
}

/* ------------------------------------------------------------------ */
/*  Custom inline video node (Vimeo / Twitch / Loom)                   */
/*  YouTube is handled by the official @tiptap/extension-youtube.      */
/*  All video nodes serialise to a bare canonical URL on its own line, */
/*  which the public blog renderer can recognise.                    */
/* ------------------------------------------------------------------ */
export const VideoEmbed = Node.create({
  name: "videoEmbed",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addOptions() {
    return { HTMLAttributes: {} }
  },

  addAttributes() {
    return {
      src: { default: null as string | null },
      provider: { default: null as string | null },
    }
  },

  parseHTML() {
    return [
      {
        tag: "div[data-video-embed]",
        getAttrs: (el) => ({
          src: (el as HTMLElement).getAttribute("data-src"),
          provider: (el as HTMLElement).getAttribute("data-provider"),
        }),
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    const src: string = node.attrs.src || ""
    const parsed = parseVideoUrl(src)
    const iframeSrc = parsed ? videoEmbedSrc(parsed, { parents: browserParents() }) : ""
    return [
      "div",
      mergeAttributes(
        {
          "data-video-embed": "",
          "data-src": src,
          "data-provider": node.attrs.provider ?? parsed?.provider ?? "",
          class: "blog-video-embed",
        },
        HTMLAttributes,
      ),
      [
        "iframe",
        {
          src: iframeSrc,
          frameborder: "0",
          allowfullscreen: "true",
          allow:
            "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
        },
      ],
    ]
  },

  addCommands() {
    return {
      setVideoEmbed:
        (attrs: { src: string; provider?: string }) =>
                ({ commands }: { commands: { insertContent: (value: unknown) => boolean } }) =>
          commands.insertContent({ type: this.name, attrs }),
    } as never
  },

  addPasteRules() {
    const rule = (find: RegExp) =>
      nodePasteRule({
        find,
        type: this.type,
        getAttributes: (match) => {
          const parsed = parseVideoUrl(match[0])
          return parsed ? { src: parsed.canonicalUrl, provider: parsed.provider } : null
        },
      })
    return [rule(VIMEO_PASTE), rule(TWITCH_PASTE), rule(LOOM_PASTE)]
  },

  addStorage() {
    return {
      markdown: {
                serialize(state: MarkdownState, node: ProseMirrorNode) {
          // Trim: the URL has to stay a bare, whitespace-free line for
          // loneVideoUrl() to recognise it at publish time.
          state.write(String(node.attrs.src ?? "").trim())
          state.closeBlock(node)
        },
        parse: {
          updateDOM(element: HTMLElement) {
            restoreVideoNodes(
              element,
              // YouTube has its own node; see YoutubeWithMarkdown below.
              (video) => video.provider !== "youtube",
              (doc, url, video) => {
                const div = doc.createElement("div")
                div.setAttribute("data-video-embed", "")
                div.setAttribute("data-src", url)
                div.setAttribute("data-provider", video.provider)
                return div
              },
            )
          },
        },
      },
    }
  },
})

/* ------------------------------------------------------------------ */
/*  Body image node                                                    */
/*  Serialises to a lone `![alt](url)` line; the publish pipeline      */
/*  This keeps the image and alt text in the saved Markdown.           */
/* ------------------------------------------------------------------ */
export const BlogImage = Node.create({
  name: "image",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: null as string | null },
      alt: { default: null as string | null },
    }
  },

  parseHTML() {
    return [
      {
        tag: "img[src]",
        getAttrs: (el) => ({
          src: (el as HTMLElement).getAttribute("src"),
          alt: (el as HTMLElement).getAttribute("alt"),
        }),
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ["img", mergeAttributes(HTMLAttributes, { class: "blog-body-image" })]
  },

  addCommands() {
    return {
      setBlogImage:
        (attrs: { src: string; alt?: string }) =>
                ({ commands }: { commands: { insertContent: (value: unknown) => boolean } }) =>
          commands.insertContent({ type: this.name, attrs }),
    } as never
  },

  addStorage() {
    return {
      markdown: {
                serialize(state: MarkdownState, node: ProseMirrorNode) {
          state.write(imageMarkdown(node))
          state.closeBlock(node)
        },
        parse: {},
      },
    }
  },
})

/** `![alt](src)` for an `image` node. */
function imageMarkdown(node: ProseMirrorNode): string {
  return `![${sanitizeAlt(node.attrs?.alt)}](${node.attrs?.src ?? ""})`
}

/** YouTube node + markdown serialisation (bare URL on its own line). */
export const YoutubeWithMarkdown = Youtube.extend({
  addStorage() {
    return {
      ...this.parent?.(),
      markdown: {
                serialize(state: MarkdownState, node: ProseMirrorNode) {
          state.write(String(node.attrs.src ?? "").trim())
          state.closeBlock(node)
        },
        parse: {
          updateDOM(element: HTMLElement) {
            restoreVideoNodes(
              element,
              (video) => video.provider === "youtube",
              (doc, url) => {
                // The shape Youtube.parseHTML matches (`div[data-youtube-video]
                // iframe`); it reads `src` straight off the iframe.
                const wrapper = doc.createElement("div")
                wrapper.setAttribute("data-youtube-video", "")
                const iframe = doc.createElement("iframe")
                iframe.setAttribute("src", url)
                wrapper.appendChild(iframe)
                return wrapper
              },
            )
          },
        },
      },
    }
  },
})

/* ------------------------------------------------------------------ */
/*  Table markdown serialisation                                       */
/*                                                                     */
/*  tiptap-markdown ships a GFM table serialiser, but it bails to the  */
/*  HTML fallback: i.e. the literal `[table]` placeholder, since we   */
/*  run with `html: false`, whenever the table isn't "simple":        */
/*  no header row, a cell holding more than one block, or any merged   */
/*  cell. The portal's own toolbar can produce all three (the Header   */
/*  toggle, pressing Enter in a cell), so a perfectly ordinary table   */
/*  was being destroyed on save. Images inside cells were dropped too, */
/*  because the upstream serialiser only renders each cell's first     */
/*  child and only when it has text content.                           */
/*                                                                     */
/*  This serialiser always emits a GFM table, in the shape             */
/*  GFM expects row 0 as a header, with `|` escaped as `\|`. */
/*  `\|`, and the grid is rectangular. Merged cells are expanded, and  */
/*  a table with no header row gets an empty one (matching Tiptap's    */
/*  own renderTableToMarkdown) so that every authored cell survives.   */
/* ------------------------------------------------------------------ */

/** Multiple blocks can't be represented inside one GFM cell: join them. */
const CELL_BLOCK_JOINER = " "

/**
 * Render `node`'s inline content to markdown and pull it back out of the
 * serializer's output buffer, so it can be escaped for a table cell.
 *
 * This has to leave the serializer exactly as it found it. `renderInline`
 * writes, and `state.write()` starts by calling `flushClose()`, which spends
 * the *previous* sibling block's pending close, the blank line that separates
 * it from whatever comes next, and clears `state.closed`. Cells are rendered
 * up front (buildGrid) before the table writes a single row, so a lost `closed`
 * meant the table's first row was glued onto the end of the preceding block:
 * `## Comparison| Feature | Value |`, which markdown-it then reads as a heading
 * and paragraphs with no table in sight. Restoring `closed` alongside `out`
 * keeps the pending separator alive for the real write.
 */
function captureInline(state: MarkdownState, node: ProseMirrorNode): string {
  const start: number = state.out.length
  const closed = state.closed
  state.renderInline(node)
  const text: string = state.out.slice(start)
  state.out = state.out.slice(0, start)
  state.closed = closed
  return text
}

/** Flatten one cell's block content into a single escaped GFM cell string. */
function cellToMarkdown(state: MarkdownState, cell: ProseMirrorNode, depth = 0): string {
  const parts: string[] = []
    cell.forEach((child: ProseMirrorNode) => {
    const name = child.type.name
    if (name === "image") {
      parts.push(imageMarkdown(child))
    } else if (name === "videoEmbed" || name === "youtube") {
      parts.push(String(child.attrs?.src ?? ""))
    } else if (child.isTextblock) {
      parts.push(captureInline(state, child))
    } else if (child.childCount > 0 && depth < 4) {
      // Lists / blockquotes nested in a cell: flatten them too.
      parts.push(cellToMarkdown(state, child, depth + 1))
    }
  })
  const joined = parts.filter((p) => p.trim() !== "").join(CELL_BLOCK_JOINER)
  return joined
    .replace(/\\\n/g, " ") // hard break serialises as backslash + newline
    .replace(/\s*\n\s*/g, " ")
    .replace(/\|/g, "\\|")
    .replace(/\s+/g, " ")
    .trim()
}

interface GridCell {
  text: string
  header: boolean
}

/** Largest colspan/rowspan we'll expand: well past any real editorial table. */
const MAX_SPAN = 64

function span(value: unknown): number {
  const n = Math.floor(Number(value))
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.min(n, MAX_SPAN)
}

/**
 * Lay the table out as a rectangular grid, expanding colspan/rowspan so the
 * emitted GFM row widths line up.
 */
function buildGrid(state: MarkdownState, table: ProseMirrorNode): GridCell[][] {
  const grid: (GridCell | undefined)[][] = []
  const taken: boolean[][] = []
  const ensure = (r: number) => {
    if (!grid[r]) {
      grid[r] = []
      taken[r] = []
    }
  }

  let r = 0
    table.forEach((row: ProseMirrorNode) => {
    ensure(r)
    let c = 0
        row.forEach((cell: ProseMirrorNode) => {
      while (taken[r][c]) c += 1
      // Clamp: colspan/rowspan come straight off pasted HTML, and a bogus value
      // would otherwise drive the expansion loops below into a huge grid.
      const colspan = span(cell.attrs?.colspan)
      const rowspan = span(cell.attrs?.rowspan)
      const header = cell.type.name === "tableHeader"
      const text = cellToMarkdown(state, cell)
      for (let dr = 0; dr < rowspan; dr += 1) {
        ensure(r + dr)
        for (let dc = 0; dc < colspan; dc += 1) {
          // Only the origin keeps the text; the spanned slots are blanks that
          // hold the grid rectangular.
          grid[r + dr][c + dc] = { text: dr === 0 && dc === 0 ? text : "", header }
          taken[r + dr][c + dc] = true
        }
      }
      c += colspan
    })
    r += 1
  })

  const cols = grid.reduce((max, row) => Math.max(max, row.length), 0)
  return grid.map((row) =>
    Array.from({ length: cols }, (_, i) => row[i] ?? { text: "", header: false }),
  )
}

function serializeTable(state: MarkdownState, node: ProseMirrorNode): void {
  const grid = buildGrid(state, node)
  const cols = grid[0]?.length ?? 0
  if (cols === 0) {
    state.closeBlock(node)
    return
  }

  const writeRow = (cells: GridCell[]) => {
    state.write(`| ${cells.map((c) => c.text).join(" | ")} |`)
    state.ensureNewLine()
  }

  // GFM requires a header row. If the table has none, emit an empty one and
  // keep every authored row in the body rather than dropping the table.
  const hasHeader = grid[0].some((c) => c.header)
  const header = hasHeader
    ? grid[0]
    : Array.from({ length: cols }, () => ({ text: "", header: true }))
  const body = hasHeader ? grid.slice(1) : grid

  writeRow(header)
  state.write(`| ${Array.from({ length: cols }, () => "---").join(" | ")} |`)
  state.ensureNewLine()
  for (const row of body) writeRow(row)
  state.closeBlock(node)
}

export const MarkdownTable = Table.extend({
  addStorage() {
    return {
      ...this.parent?.(),
      markdown: { serialize: serializeTable, parse: {} },
    }
  },
})

/* ------------------------------------------------------------------ */
/*  The extension list the portal editor runs on.                      */
/* ------------------------------------------------------------------ */
export function blogEditorExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4] },
      // Keep the mark/style set aligned with the publish pipeline
      // Keep the editor aligned with the current public article renderer.
      strike: false,
      code: false,
      codeBlock: false,
      horizontalRule: false,
      link: {
        openOnClick: false,
        // No automatic links. Bare domains, a typed URL and a
        // pasted one all stay plain text; a hyperlink is only ever created
        // deliberately, via the toolbar Link button (which calls setLink and
        // is unaffected by these flags) or an explicit `[text](url)`.
        // All three flags are needed: `autolink` covers typing, `linkOnPaste`
        // the paste handler, and `shouldAutoLink` the extension's paste *rule*,
        // which linkifies URLs in any pasted text on its own.
        autolink: false,
        linkOnPaste: false,
        shouldAutoLink: () => false,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      },
    }),
    YoutubeWithMarkdown.configure({
      width: 640,
      height: 360,
      nocookie: false,
      modestBranding: true,
      rel: 0,
    }),
    VideoEmbed,
    BlogImage,
    MarkdownTable.configure({ resizable: true, HTMLAttributes: { class: "blog-tiptap-table" } }),
    TableRow,
    TableHeader,
    TableCell,
    Markdown.configure({
      html: false,
      // markdown-it's linkify would turn bare domains and URLs in a loaded
      // draft into links on parse. Those serialise straight back out as real
      // markdown links, so a draft picked up autolinks it never asked for and
      // published them. Only an explicit `[text](url)` becomes a link.
      linkify: false,
      breaks: false,
      transformPastedText: false,
      transformCopiedText: false,
    }),
  ]
}
