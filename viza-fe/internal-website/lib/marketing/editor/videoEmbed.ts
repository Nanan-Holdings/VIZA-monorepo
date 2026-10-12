// Parse video URLs for the staff editor. A video is stored as a bare URL on
// its own Markdown line so it survives save and reload.

export type VideoProvider = "youtube" | "vimeo" | "twitch" | "loom"

export type TwitchKind = "video" | "clip" | "channel"

export interface ParsedVideo {
  provider: VideoProvider
  /** Provider-native identifier (video id, clip slug, or channel name). */
  id: string
  /** Canonical, shareable URL persisted in Markdown. */
  canonicalUrl: string
  /** Only set for Twitch, whose embed URL differs by resource kind. */
  twitchKind?: TwitchKind
}

// Ordered matchers. Twitch clips must be tested before bare channels so that
// `twitch.tv/foo/clip/Bar` doesn't get mistaken for the `foo` channel.
const YT_RE =
  /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/|live\/)|youtu\.be\/)([\w-]{11})/i
const VIMEO_RE = /vimeo\.com\/(?:video\/|channels\/[\w]+\/|groups\/[\w]+\/videos\/)?(\d+)/i
const TWITCH_VIDEO_RE = /twitch\.tv\/videos\/(\d+)/i
const TWITCH_CLIP_RE = /(?:clips\.twitch\.tv\/|twitch\.tv\/\w+\/clip\/)([\w-]+)/i
const TWITCH_CHANNEL_RE = /twitch\.tv\/([a-zA-Z0-9_]{2,25})(?:$|[/?#])/i
const LOOM_RE = /loom\.com\/(?:share|embed)\/([\w-]+)/i

/**
 * Parse any supported video URL into a normalised descriptor, or null when the
 * string isn't a recognised single video link.
 */
export function parseVideoUrl(raw: string): ParsedVideo | null {
  const url = raw.trim()
  if (!url) return null

  let m: RegExpMatchArray | null

  if ((m = url.match(YT_RE))) {
    return { provider: "youtube", id: m[1], canonicalUrl: `https://www.youtube.com/watch?v=${m[1]}` }
  }
  if ((m = url.match(VIMEO_RE))) {
    return { provider: "vimeo", id: m[1], canonicalUrl: `https://vimeo.com/${m[1]}` }
  }
  if ((m = url.match(TWITCH_VIDEO_RE))) {
    return {
      provider: "twitch",
      id: m[1],
      twitchKind: "video",
      canonicalUrl: `https://www.twitch.tv/videos/${m[1]}`,
    }
  }
  if ((m = url.match(TWITCH_CLIP_RE))) {
    return {
      provider: "twitch",
      id: m[1],
      twitchKind: "clip",
      canonicalUrl: `https://clips.twitch.tv/${m[1]}`,
    }
  }
  if ((m = url.match(LOOM_RE))) {
    return { provider: "loom", id: m[1], canonicalUrl: `https://www.loom.com/share/${m[1]}` }
  }
  // Bare channel is the loosest Twitch match, so it goes last.
  if ((m = url.match(TWITCH_CHANNEL_RE))) {
    return {
      provider: "twitch",
      id: m[1],
      twitchKind: "channel",
      canonicalUrl: `https://www.twitch.tv/${m[1]}`,
    }
  }
  return null
}

export interface EmbedSrcOptions {
  /**
   * Host names allowed to embed the player. Required by Twitch (it rejects any
   * `parent` it isn't told about). Defaults cover local dev + production.
   */
  parents?: string[]
  autoplay?: boolean
}

const DEFAULT_PARENTS = ["localhost"]

/** Build the iframe `src` for a parsed video. */
export function videoEmbedSrc(video: ParsedVideo, opts: EmbedSrcOptions = {}): string {
  const autoplay = opts.autoplay ? 1 : 0
  switch (video.provider) {
    case "youtube":
      return `https://www.youtube.com/embed/${video.id}?rel=0&modestbranding=1${
        autoplay ? "&autoplay=1" : ""
      }`
    case "vimeo":
      return `https://player.vimeo.com/video/${video.id}${autoplay ? "?autoplay=1" : ""}`
    case "loom":
      return `https://www.loom.com/embed/${video.id}`
    case "twitch": {
      const parents = (opts.parents?.length ? opts.parents : DEFAULT_PARENTS)
        .map((p) => `parent=${encodeURIComponent(p)}`)
        .join("&")
      if (video.twitchKind === "clip") {
        return `https://clips.twitch.tv/embed?clip=${encodeURIComponent(video.id)}&${parents}`
      }
      if (video.twitchKind === "channel") {
        return `https://player.twitch.tv/?channel=${encodeURIComponent(video.id)}&${parents}`
      }
      return `https://player.twitch.tv/?video=${encodeURIComponent(video.id)}&${parents}`
    }
  }
}

/** Convenience: parse then build an embed src in one step, or null. */
export function embedSrcFromUrl(url: string, opts?: EmbedSrcOptions): string | null {
  const parsed = parseVideoUrl(url)
  return parsed ? videoEmbedSrc(parsed, opts) : null
}

/** Human label for a provider, used in editor placeholders / captions. */
export function providerLabel(provider: VideoProvider): string {
  return { youtube: "YouTube", vimeo: "Vimeo", twitch: "Twitch", loom: "Loom" }[provider]
}
