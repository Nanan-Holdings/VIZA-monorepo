/* The logo stamp on VIZA's social images (app/social-card).

   Every image a social network receives is the cover with the VIZA logotype
   in the top left; the cover on the blog stays clean. The stamped picture is
   served by this app (app.viza.it.com), not by the marketing site that
   VIZA_MARKETING_PUBLIC_BASE_URL names, which answers 404 for app routes. */

const MARKETING_HOSTS = ["viza.it.com", "www.viza.it.com"];

/** This app's own public address, where /social-card is served. */
export function socialAppBase(): URL {
  return new URL(process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://app.viza.it.com");
}

/** A cover the stamp may fetch: a public object in this project's Supabase
    storage, or a photo under the marketing site's /assets (the destination
    hero fallback in cover.ts). Null for anything else, so /social-card is not
    an open image proxy. */
export function ownCoverUrl(src: string): URL | null {
  try {
    const url = new URL(src);
    if (url.protocol !== "https:") return null;
    const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    if (supabase && url.host === new URL(supabase).host) {
      return url.pathname.startsWith("/storage/v1/object/public/") ? url : null;
    }
    const marketing = process.env.VIZA_MARKETING_PUBLIC_BASE_URL?.trim();
    const hosts = marketing ? [...MARKETING_HOSTS, new URL(marketing).host] : MARKETING_HOSTS;
    return hosts.includes(url.host) && url.pathname.startsWith("/assets/") ? url : null;
  } catch {
    return null;
  }
}

/** The cover with the logo stamped on it, or null when the image is not ours. */
export function brandedImage(imageUrl: string): string | null {
  if (!ownCoverUrl(imageUrl)) return null;
  return new URL(`/social-card?src=${encodeURIComponent(imageUrl)}`, socialAppBase()).toString();
}
