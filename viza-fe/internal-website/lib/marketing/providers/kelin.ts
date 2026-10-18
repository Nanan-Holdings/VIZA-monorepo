/* Direct posting to VIZA's own accounts through lib/social (vendored from
   Kelin-Studio/kelin-social), in place of Zernio and Upload-Post.

   A platform goes direct whenever its KELIN_* credentials are set:
   Facebook, Instagram (posts and Reels), LinkedIn, Pinterest, TikTok and
   YouTube. Scheduling is VIZA's own (publish.ts holds scheduled platforms for
   the dispatcher), so a scheduled post goes direct too. A direct post is stored
   in `zernio_posts` under a `kelin:` handle, so sync and stop can tell it from
   a vendor id. Every network but TikTok lets us delete what we posted. */
import { adapterFor, fromHandle, isConfigured, toHandle } from "@/lib/social";
import type { MarketingSocialPlatform } from "../contracts";

export const KELIN_DIRECT_PLATFORMS = ["facebook", "instagram", "linkedin", "pinterest", "tiktok", "youtube"] as const;
export type KelinDirectPlatform = (typeof KELIN_DIRECT_PLATFORMS)[number];

/* Plain boolean, not a type guard: false can mean "not configured yet", and a
   guard would make TypeScript drop Facebook and Instagram from the else branch. */
export function kelinDirectReady(platform: MarketingSocialPlatform): boolean {
  return (KELIN_DIRECT_PLATFORMS as readonly string[]).includes(platform) && isConfigured(platform as KelinDirectPlatform);
}

export function isKelinHandle(id: string | null | undefined): boolean {
  return fromHandle(id) !== null;
}

/** Instagram takes JPEG only. Our storage covers go through /social-jpeg. */
function instagramImage(imageUrl: string, publicBase: URL): string {
  if (/\.jpe?g($|\?)/i.test(new URL(imageUrl).pathname)) return imageUrl;
  return new URL(`/social-jpeg?src=${encodeURIComponent(imageUrl)}`, publicBase).toString();
}

export async function publishKelinPost(input: {
  platform: KelinDirectPlatform;
  caption: string;
  /** Headline for LinkedIn's link card. */
  title?: string;
  destinationUrl?: string;
  imageUrl?: string;
  /** A rendered short: a Reel on Instagram, a video on TikTok and YouTube. */
  videoUrl?: string;
  /** Sets TikTok's and YouTube's AI-content disclosure. */
  aiGenerated?: boolean;
  publicBase: URL;
}): Promise<{ handle: string; url: string | null }> {
  if (!input.videoUrl && (input.platform === "instagram" || input.platform === "pinterest") && !input.imageUrl) {
    throw new Error(`A reviewed cover image is required for ${input.platform === "instagram" ? "Instagram" : "Pinterest"}`);
  }
  if (input.platform === "youtube" && !input.videoUrl) throw new Error("YouTube takes shorts only");
  const post = await adapterFor(input.platform).publish({
    text: input.caption,
    link: input.destinationUrl,
    title: input.title,
    imageUrl: input.videoUrl ? undefined : input.platform === "instagram" && input.imageUrl ? instagramImage(input.imageUrl, input.publicBase) : input.imageUrl,
    videoUrl: input.videoUrl,
    aiGenerated: input.aiGenerated,
  });
  return { handle: toHandle(input.platform, post.id), url: post.url };
}

/** Takes the post off the network itself. */
export async function removeKelinPost(handle: string): Promise<void> {
  const parsed = fromHandle(handle);
  if (!parsed) throw new Error("Not a direct post handle");
  await adapterFor(parsed.network).remove(parsed.id);
}
