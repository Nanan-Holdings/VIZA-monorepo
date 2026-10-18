/* Vendored from Kelin-Studio/kelin-social@9cf1e11 (src/types.ts). Edit there and re-sync. */
/* The one shape every network adapter speaks.

   A pipeline hands over a caption, an optional link and an optional picture,
   and gets back the network's own post id and, where the network gives one,
   a public address. Nothing here knows about drafts, brands or databases:
   that stays in each pipeline. */

export type Network = "facebook" | "instagram" | "threads" | "x" | "linkedin" | "pinterest" | "reddit" | "tiktok" | "youtube";

export type PostInput = {
  /** The caption exactly as it should appear. Adapters never append the link
      themselves: the pipeline decides whether the text already carries it. */
  text: string;
  /** Sent as a link attachment where the network has one (Facebook link post,
      Threads link card). X and Instagram ignore it: put it in `text` if wanted. */
  link?: string;
  /** Headline for a link card where the network wants one (LinkedIn's
      article title). Falls back to the first line of `text`. */
  title?: string;
  /** Where on the network it goes, where that is a choice: a subreddit name
      for Reddit. Falls back to the account's configured default. */
  community?: string;
  /** Public HTTPS address of an image. Instagram requires one of image or video. */
  imageUrl?: string;
  /** Public HTTPS address of an mp4. Instagram posts it as a Reel; TikTok and
      YouTube need one for a video post. */
  videoUrl?: string;
  /** True when the media is AI-generated or AI-voiced. Sets the network's own
      disclosure where it has one (TikTok is_aigc, YouTube containsSyntheticMedia). */
  aiGenerated?: boolean;
};

export type Published = {
  /** The network's id for the post, as its delete call wants it. */
  id: string;
  url: string | null;
};

export type PostState = "live" | "processing" | "gone" | "failed";

export type PostStatus = { state: PostState; url: string | null; detail?: string };

export interface Adapter {
  readonly network: Network;
  publish(input: PostInput): Promise<Published>;
  status(id: string): Promise<PostStatus>;
  /** Takes the post off the network itself, not just out of our records. */
  remove(id: string): Promise<void>;
}

/** Raised for anything a network refuses. `retryable` is true only when the
    same request may succeed later unchanged (rate limits, 5xx, timeouts). */
export class SocialError extends Error {
  constructor(
    readonly network: Network,
    message: string,
    readonly status: number | null = null,
    readonly retryable = false,
    readonly code: string | null = null,
  ) {
    super(`${network}: ${message}`);
    this.name = "SocialError";
  }
}
