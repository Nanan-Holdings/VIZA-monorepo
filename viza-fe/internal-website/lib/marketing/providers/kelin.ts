/* Direct posting to VIZA's own Facebook Page, Instagram account and LinkedIn page, through
   lib/social (vendored from Kelin-Studio/kelin-social), in place of Zernio
   and Upload-Post for those networks.

   A platform goes direct only when its KELIN_* credentials are set and the
   composition is sent now: Meta's API here has no scheduling, so a scheduled
   Facebook post still goes through Zernio. A direct post is stored in
   `zernio_posts` like a Zernio one, under a `kelin:` handle, so the sync and
   stop actions can tell the two apart. Unlike Upload-Post, both networks let
   us delete what we posted. */
import { adapterFor, fromHandle, isConfigured, toHandle } from "@/lib/social";
import type { MarketingSocialPlatform } from "../contracts";

export const KELIN_DIRECT_PLATFORMS = ["facebook", "instagram", "linkedin"] as const;
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
  publicBase: URL;
}): Promise<{ handle: string; url: string | null }> {
  if (input.platform === "instagram" && !input.imageUrl) throw new Error("A reviewed cover image is required for Instagram");
  const post = await adapterFor(input.platform).publish({
    text: input.caption,
    link: input.destinationUrl,
    title: input.title,
    imageUrl: input.platform === "instagram" && input.imageUrl ? instagramImage(input.imageUrl, input.publicBase) : input.imageUrl,
  });
  return { handle: toHandle(input.platform, post.id), url: post.url };
}

/** Takes the post off the network itself. */
export async function removeKelinPost(handle: string): Promise<void> {
  const parsed = fromHandle(handle);
  if (!parsed) throw new Error("Not a direct post handle");
  await adapterFor(parsed.network).remove(parsed.id);
}
