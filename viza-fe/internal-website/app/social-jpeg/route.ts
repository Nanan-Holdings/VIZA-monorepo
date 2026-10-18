/* A JPEG copy of a marketing cover, for Instagram.

   Instagram's publishing API takes JPEG only and fetches the file itself, so
   a PNG or WebP cover has to be served converted at a public address.
   Upload-Post used to do this on its side. Only public objects in our own
   Supabase storage are accepted, so this is not an open image proxy. */
import sharp from "sharp";

export const runtime = "nodejs";

function allowed(src: string): URL | null {
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!supabase) return null;
  try {
    const url = new URL(src);
    const own = new URL(supabase);
    return url.protocol === "https:" && url.host === own.host && url.pathname.startsWith("/storage/v1/object/public/") ? url : null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const src = allowed(new URL(req.url).searchParams.get("src") ?? "");
  if (!src) return new Response("src must be a public object in this project's storage", { status: 400 });
  const res = await fetch(src, { signal: AbortSignal.timeout(20000) }).catch(() => null);
  if (!res?.ok || !(res.headers.get("content-type") ?? "").startsWith("image/")) {
    return new Response("Not found", { status: 404 });
  }
  const jpeg = await sharp(Buffer.from(await res.arrayBuffer()))
    .rotate()
    .resize({ width: 1440, withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
  return new Response(new Uint8Array(jpeg), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff" },
  });
}
