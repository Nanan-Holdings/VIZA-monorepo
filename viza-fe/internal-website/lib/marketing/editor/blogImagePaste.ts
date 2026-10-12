/** Helpers for pasted and dropped images in the VIZA staff blog editor. */

const IMAGE_URL_HINT = /\.(?:png|jpe?g|gif|webp)(?:[?#]|$)/i
/** VIZA public asset URLs can be extension-free. */
const IMAGE_HOST_HINT = /\/storage\/v1\/object\/public\/marketing-public-assets\//i

/** One image waiting to be uploaded: either local bytes or a remote URL. */
export interface PendingImage {
  file?: File
  url?: string
  alt: string
}

/** "my-screen_shot.png" → "my screen shot", a usable first draft of the alt. */
export function altFromFilename(name: string): string {
  return name
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[-_]+/g, " ")
    .trim()
}

export function looksLikeImageUrl(raw: string): boolean {
  if (!/^https?:\/\/\S+$/i.test(raw)) return false
  return IMAGE_URL_HINT.test(raw) || IMAGE_HOST_HINT.test(raw)
}

/** Every image file on a clipboard or drag payload (screenshots, Finder drags). */
export function imageFilesFrom(dt: DataTransfer): PendingImage[] {
  return Array.from(dt.files ?? [])
    .filter((f) => f.type.startsWith("image/"))
    .map((f) => ({ file: f, alt: altFromFilename(f.name) }))
}

/**
 * A payload that is *only* a reference to one image, a lone `<img>`, a
 * uri-list, or a bare image URL. Mixed rich text (an excerpt with pictures in
 * it) returns null so the normal paste keeps the words.
 *
 * The HTML flavour is checked first so an image copy is not mistaken for a
 * link to the page that displayed it.
 */
export function loneImageRefFrom(dt: DataTransfer): PendingImage | null {
  const html = dt.getData("text/html")
  if (html) {
    const doc = new DOMParser().parseFromString(html, "text/html")
    const imgs = doc.querySelectorAll("img[src]")
    if (imgs.length !== 1 || doc.body.textContent?.trim()) return null
    const src = imgs[0].getAttribute("src") ?? ""
    if (!/^https?:\/\//i.test(src)) return null
    return { url: src, alt: (imgs[0].getAttribute("alt") ?? "").trim() }
  }
  const text = (dt.getData("text/uri-list") || dt.getData("text/plain") || "").trim()
  // uri-list can hold several lines; the first non-comment one is the target.
  const first = text.split(/\r?\n/).find((l) => l && !l.startsWith("#"))?.trim() ?? ""
  return looksLikeImageUrl(first) ? { url: first, alt: "" } : null
}

/** What a paste or drop carries, if it carries an image at all. */
export function imagesFrom(dt: DataTransfer | null): PendingImage[] {
  if (!dt) return []
  const files = imageFilesFrom(dt)
  if (files.length > 0) return files
  const ref = loneImageRefFrom(dt)
  return ref ? [ref] : []
}

/**
 * True while a drag carries something we would ingest, used only to light up
 * the editor border, so a false positive costs nothing.
 */
export function dragHasImage(dt: DataTransfer | null): boolean {
  if (!dt) return false
  return Array.from(dt.types).some((t) => t === "Files" || t === "text/uri-list")
}
