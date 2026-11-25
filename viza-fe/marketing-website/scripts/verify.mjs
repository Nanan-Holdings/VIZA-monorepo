// Usage: node scripts/verify.mjs <base-url> [--only /path,/path]
// Fetches every URL in <base-url>/sitemap.xml twice, with a Googlebot user agent and with "WhatsApp/2.23", and checks:
// 200 with no redirect, exactly one H1, title, description, canonical equal to the page, hreflang (with x-default)
// for pages that exist in more than one language, Open Graph and Twitter tags, JSON-LD, and that og:image
// returns image/jpeg under 300 KB (a blog cover on another host only has to be an image).
// Also checks that the English URL answers in English for a crawler, and an unknown /visa slug is a real 404.
const args = process.argv.slice(2);
if (!args[0]) {
  console.error("Usage: node scripts/verify.mjs <base-url> [--only /path,/path]");
  process.exit(2);
}
const base = args[0].replace(/\/$/, "");
const only = args.includes("--only") ? args[args.indexOf("--only") + 1].split(",") : null;
const UAS = {
  Googlebot: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  WhatsApp: "WhatsApp/2.23.20.0",
};

let fails = 0;
const fail = (where, msg) => {
  fails++;
  console.log(`FAIL ${where}: ${msg}`);
};

// Next.js escapes quotes and ampersands in HTML (for example &#x27;), so lengths are measured on the decoded text.
const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0" };
const decode = (text) =>
  text?.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return NAMED[e.toLowerCase()] ?? m;
  });

const meta = (html, attr, name) => {
  const tag = html.match(new RegExp(`<meta[^>]+${attr}="${name}"[^>]*>`, "i"))?.[0];
  return decode(tag?.match(/content="([^"]*)"/i)?.[1]);
};
const links = (html, rel) => [...html.matchAll(new RegExp(`<link[^>]+rel="${rel}"[^>]*>`, "gi"))].map((m) => m[0]);
const attr = (tag, name) => tag.match(new RegExp(`${name}="([^"]*)"`, "i"))?.[1];

async function urlsFromSitemap() {
  const res = await fetch(`${base}/sitemap.xml`, { headers: { "User-Agent": UAS.Googlebot } });
  if (res.status !== 200) {
    fail("/sitemap.xml", `status ${res.status}`);
    return [];
  }
  const xml = await res.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1].replace(/&amp;/g, "&")).pathname);
}

const imageCache = new Map();
async function checkImage(path, src, ua) {
  const u = new URL(src);
  const own = u.hostname === new URL(base).hostname || /viza\.it\.com$/.test(u.hostname);
  if (!src.startsWith("https://")) fail(path, `og:image is not https: ${src}`);
  const url = own ? base + u.pathname : src;
  if (!imageCache.has(url)) {
    const r = await fetch(url, { headers: { "User-Agent": ua } });
    imageCache.set(url, { status: r.status, type: r.headers.get("content-type") || "", size: (await r.arrayBuffer()).byteLength });
  }
  const { status, type, size } = imageCache.get(url);
  if (status !== 200) fail(path, `og:image ${status}`);
  else if (own) {
    if (!type.startsWith("image/jpeg")) fail(path, `og:image is ${type}, not image/jpeg`);
    if (size > 300 * 1024) fail(path, `og:image is ${size} bytes`);
  } else if (!type.startsWith("image/")) fail(path, `og:image is ${type}`);
}

async function check(path, uaName) {
  const ua = UAS[uaName];
  const where = `${path} [${uaName}]`;
  const res = await fetch(base + path, { headers: { "User-Agent": ua }, redirect: "manual" });
  if (res.status !== 200) return fail(where, `status ${res.status}${res.headers.get("location") ? ` to ${res.headers.get("location")}` : ""}`);
  const html = await res.text();

  const h1 = (html.match(/<h1[\s>]/g) || []).length;
  if (h1 !== 1) fail(where, `${h1} h1 tags`);
  const title = decode(html.match(/<title>([^<]*)<\/title>/)?.[1]);
  if (!title) fail(where, "no title");
  else if ([...title].length > 60) fail(where, `title is ${[...title].length} characters`);
  const description = meta(html, "name", "description");
  if (!description) fail(where, "no meta description");
  else if ([...description].length > 160) fail(where, `description is ${[...description].length} characters`);

  const canonical = links(html, "canonical").map((t) => attr(t, "href"))[0];
  if (!canonical) fail(where, "no canonical");
  else if (new URL(canonical).pathname.replace(/\/$/, "") !== path.replace(/\/$/, "")) fail(where, `canonical is ${canonical}`);

  const hreflangs = links(html, "alternate").filter((t) => attr(t, "hreflang"));
  const isBlog = path.includes("/blog");
  if (!isBlog) {
    const langs = hreflangs.map((t) => attr(t, "hreflang"));
    if (!langs.includes("x-default")) fail(where, "no x-default hreflang");
    if (langs.length < 3) fail(where, `hreflang has ${langs.length} entries`);
  }

  for (const k of ["og:title", "og:description", "og:url", "og:type", "og:site_name", "og:image", "og:image:width", "og:image:height", "og:image:alt"]) {
    if (!meta(html, "property", k)) fail(where, `missing ${k}`);
  }
  for (const k of ["twitter:card", "twitter:title", "twitter:description", "twitter:image"]) {
    if (!meta(html, "name", k)) fail(where, `missing ${k}`);
  }
  if (meta(html, "name", "twitter:card") !== "summary_large_image") fail(where, "twitter:card is not summary_large_image");
  if (!/application\/ld\+json/.test(html)) fail(where, "no JSON-LD");
  const noindex = /<meta[^>]+name="robots"[^>]+noindex/i.test(html);
  if (noindex) fail(where, "page is in the sitemap but has noindex");

  const img = meta(html, "property", "og:image");
  if (img) await checkImage(where, img, ua);
  return html;
}

const paths = only ?? (await urlsFromSitemap());
if (!paths.length) fail("sitemap", "no URLs");
const queue = [...paths];
async function worker() {
  while (queue.length) {
    const path = queue.shift();
    for (const ua of Object.keys(UAS)) await check(path, ua);
  }
}
await Promise.all(Array.from({ length: 6 }, worker));

// Language and status spot checks for a crawler with no cookie.
const bot = { "User-Agent": UAS.Googlebot };
const en = await fetch(`${base}/visa/japan`, { headers: bot, redirect: "manual" });
if (en.status !== 200) fail("/visa/japan", `status ${en.status}`);
else if (!/<html[^>]+lang="en"/.test(await en.text())) fail("/visa/japan", "not served in English to a crawler");
const missing = await fetch(`${base}/visa/not-a-real-country`, { headers: bot, redirect: "manual" });
if (missing.status !== 404) fail("/visa/not-a-real-country", `status ${missing.status}, expected 404`);
for (const extra of ["/robots.txt", "/sitemap.xml"]) {
  const r = await fetch(base + extra, { headers: bot });
  if (r.status !== 200) fail(extra, `status ${r.status}`);
}

console.log(fails ? `${fails} failure(s)` : `All ${paths.length} sitemap URLs OK with Googlebot and WhatsApp on ${base}`);
process.exit(fails ? 1 : 0);
