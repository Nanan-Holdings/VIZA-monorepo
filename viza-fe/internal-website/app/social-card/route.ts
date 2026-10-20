/* A marketing cover with the VIZA logotype stamped in the top left corner,
   for the social networks (lib/marketing/social-image.ts).

   publishSocialComposition() sends this address instead of the bare cover to
   every network, so each social image carries the logo while the cover on
   the blog stays clean. The output is a JPEG, which also covers Instagram's
   JPEG-only rule (see social-jpeg).

   The logo follows the corner it sits in (cornerLuminance): a dark corner
   gets the light logo over a soft dark gradient, a light corner the dark logo
   over a soft white gradient, so it reads on any photo without the mark ever
   being inverted or recoloured beyond the brand's own colourways.
   The light logo is VIZA's white logotype, its own variant for photos; the
   dark one is the black logotype the site header uses.

   Only public objects in our own storage and the marketing site's /assets are
   accepted (ownCoverUrl), so this is not an open image proxy. */
import sharp from "sharp";
import { VIZA_LOGO_ON_DARK, VIZA_LOGO_ON_LIGHT } from "@/lib/marketing/social-logos";
import { ownCoverUrl } from "@/lib/marketing/social-image";

export const runtime = "nodejs";

const WIDTH = 1440;
const LOGO = { widthPct: 16, marginPct: 5 };

/** How light the corner under the logo is, 0 (black) to 1 (white). */
async function cornerLuminance(image: Buffer, width: number, height: number, margin: number, logoWidth: number): Promise<number> {
  const box = {
    left: 0,
    top: 0,
    width: Math.min(width, margin * 2 + logoWidth),
    height: Math.min(height, margin * 2 + Math.round(logoWidth / 3)),
  };
  const [r, g, b] = (await sharp(image).extract(box).stats()).channels.map((c) => c.mean / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** A vector logo drawn at `width` pixels, sharp at any size. */
async function rasterise(svg: Buffer, width: number): Promise<Buffer> {
  const { width: drawn = width } = await sharp(svg).metadata();
  return sharp(svg, { density: Math.min(2400, Math.max(1, (144 * width) / drawn)) })
    .resize({ width })
    .png()
    .toBuffer();
}

export async function GET(req: Request) {
  const src = ownCoverUrl(new URL(req.url).searchParams.get("src") ?? "");
  if (!src) return new Response("src must be a VIZA cover image", { status: 400 });
  const res = await fetch(src, { signal: AbortSignal.timeout(20000) }).catch(() => null);
  if (!res?.ok || !(res.headers.get("content-type") ?? "").startsWith("image/")) {
    return new Response("Not found", { status: 404 });
  }

  const input = Buffer.from(await res.arrayBuffer());
  const base = await sharp(input)
    .rotate()
    .resize({ width: WIDTH, withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .toBuffer({ resolveWithObject: true });
  const { width, height } = base.info;
  const margin = Math.round((width * LOGO.marginPct) / 100);
  const logoWidth = Math.round((width * LOGO.widthPct) / 100);

  /* The brand's own colourway for the corner the logo sits in: on a dark
     corner the light logo over a soft dark gradient, on a light corner the
     dark logo over a soft white one. Either way the mark is drawn as the
     brand made it, never inverted. */
  const dark = (await cornerLuminance(base.data, width, height, margin, logoWidth)) < 0.6;
  const mark = await rasterise(Buffer.from(dark ? VIZA_LOGO_ON_DARK : VIZA_LOGO_ON_LIGHT), logoWidth);

  // Strongest behind the logo, gone by about half the image's width.
  const tone = dark ? "#0a0a0c" : "#ffffff";
  const [inner, mid] = dark ? [0.62, 0.32] : [0.72, 0.36];
  const r = Math.round(Math.max(width, height) * 0.6);
  const scrim = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs><radialGradient id="g" cx="0" cy="0" r="${r}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${tone}" stop-opacity="${inner}"/>
      <stop offset="0.45" stop-color="${tone}" stop-opacity="${mid}"/>
      <stop offset="1" stop-color="${tone}" stop-opacity="0"/>
    </radialGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
  </svg>`;

  const jpeg = await sharp(base.data)
    .composite([
      { input: Buffer.from(scrim), top: 0, left: 0 },
      { input: mark, top: margin, left: margin },
    ])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
  return new Response(new Uint8Array(jpeg), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff" },
  });
}
