// Renders a 1200x630 JPEG link preview for every page, in every enabled locale, into public/og/<locale>/<key>.jpg
// and writes lib/seo/og-manifest.json (which cards exist, so lib/seo/metadata.ts can fall back to English).
// Run with: npm run og   (Node 22.18+ strips the TS types in lib/)
// Brand look: navy #03346E ground, white type in Geist, the white VIZA logo, and the destination photo on the right.
// Latin text uses Geist. Chinese, Japanese and Korean use Arial Unicode (macOS). A locale whose script has no font
// here is skipped, and its pages use the English card.
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { COUNTRIES, isPublished } from "../lib/countries.ts";
import { destinationTitle } from "../lib/seo/titles.ts";

const ROOT = new URL("../", import.meta.url);
const NAVY = "#03346E";
const NAVY_DARK = "#022B5C";
const WHITE = "#ffffff";
const SOFT = "#D4E0F0";

// Keep in sync with ENABLED_LOCALES in lib/locales.ts.
const localesSrc = readFileSync(new URL("lib/locales.ts", ROOT), "utf8");
const ENABLED = [...localesSrc.match(/export const ENABLED_LOCALES[^=]*=\s*\[([^\]]*)\]/)[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);

const geist = (name) => readFileSync(new URL(`node_modules/geist/dist/fonts/geist-sans/${name}.ttf`, ROOT));
const latinFonts = [
  { name: "Geist", data: geist("Geist-SemiBold"), weight: 600, style: "normal" },
  { name: "Geist", data: geist("Geist-Medium"), weight: 500, style: "normal" },
  { name: "Geist", data: geist("Geist-Regular"), weight: 400, style: "normal" },
];
const CJK = "/System/Library/Fonts/Supplemental/Arial Unicode.ttf";
const cjkFonts = existsSync(CJK) ? [{ name: "Cjk", data: readFileSync(CJK), weight: 400, style: "normal" }] : null;
const isCjk = (locale) => /^(zh|ja|ko)/.test(locale);

const logo = "data:image/svg+xml;base64," + readFileSync(new URL("public/assets/viza-logo-white.svg", ROOT)).toString("base64");

const readMessages = (locale) => JSON.parse(readFileSync(new URL(`messages/${locale}.json`, ROOT), "utf8"));
const en = readMessages("en");
const merge = (a, b) => {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    out[k] = v && typeof v === "object" && !Array.isArray(v) && out[k] && typeof out[k] === "object" ? merge(out[k], v) : v;
  }
  return out;
};
const messagesFor = (locale) => (locale === "en" ? en : merge(en, readMessages(locale)));

const clip = (text, max) => {
  const chars = [...text];
  if (chars.length <= max) return text;
  const cut = chars.slice(0, max).join("");
  const sp = cut.lastIndexOf(" ");
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.]+$/, "");
};
const stripBrand = (title) => title.replace(/\s*\|\s*VIZA.*$/, "").trim();
const firstSentence = (text) => text.split(/(?<=[.。])\s*/)[0];

const PAGES = ["home", "about", "product", "contact", "careers", "security", "status", "apply", "events", "privacy", "terms"];
// Phase C: the arrival card hub (messages pages.arrivalCards) and one card per guide in lib/arrival-cards/<locale>/.
const GUIDE_SLUGS = ["malaysia-mdac", "singapore-sg-arrival-card", "japan-visit-japan-web", "thailand-tdac", "korea-e-arrival-card", "indonesia-all-indonesia"];
// Phase D: the guides hub (messages pages.guides) and one card per guide in lib/guides/<locale>/.
const EVERGREEN_SLUGS = ["visa-free-countries-singapore-passport", "visas-chinese-passport-holders-singapore", "visas-filipino-indian-residents-singapore", "schengen-visa-checklist-singapore", "us-visa-interview-singapore", "eta-vs-visa", "e-visa-vs-visa-on-arrival-vs-embassy-visa", "visa-refused-reapply", "visa-photo-requirements"];
const BLOG = "blog";

const photoCache = new Map();
async function photo(slug) {
  if (photoCache.has(slug)) return photoCache.get(slug);
  const file = ["jpg", "avif", "png"].map((e) => new URL(`public/assets/heroes/${slug}.${e}`, ROOT)).find((f) => existsSync(f));
  let data = null;
  if (file) {
    const buf = await sharp(file.pathname).resize(430, 534, { fit: "cover" }).jpeg({ quality: 78 }).toBuffer();
    data = "data:image/jpeg;base64," + buf.toString("base64");
  }
  photoCache.set(slug, data);
  return data;
}

const h = (type, style, children) => ({ type, props: { style, children } });

function card({ title, subtitle, band, cjk, img }) {
  const family = cjk ? "Cjk" : "Geist";
  const len = [...title].length;
  const wide = !img;
  const size = cjk ? (len > 16 ? 60 : len > 10 ? 68 : 76) : wide ? (len > 40 ? 58 : len > 28 ? 68 : 80) : len > 22 ? 46 : len > 16 ? 56 : 66;
  return h("div", { width: 1200, height: 630, display: "flex", background: NAVY, fontFamily: family, color: WHITE }, [
    h("div", { display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, minWidth: 0, padding: "56px 56px 52px 64px" }, [
      { type: "img", props: { src: logo, width: 150, height: 44 } },
      h("div", { display: "flex", flexDirection: "column" }, [
        h("div", { fontSize: size, fontWeight: 600, lineHeight: 1.08, letterSpacing: cjk ? 0 : -1.5, display: "flex" }, title),
        h("div", { color: SOFT, fontSize: 28, fontWeight: 400, lineHeight: 1.35, marginTop: 24, display: "flex" }, subtitle),
      ]),
      h("div", { display: "flex", alignSelf: "flex-start", background: NAVY_DARK, borderRadius: 999, padding: "10px 24px", color: SOFT, fontSize: 22, fontWeight: 500 }, band),
    ]),
    ...(img
      ? [h("div", { display: "flex", width: 430, height: 630, background: NAVY_DARK }, [
          { type: "img", props: { src: img, width: 430, height: 630, style: { objectFit: "cover" } } },
        ])]
      : []),
  ]);
}

const manifest = {};
mkdirSync(new URL("public/og/", ROOT), { recursive: true });

for (const locale of ENABLED) {
  const cjk = isCjk(locale);
  const fonts = cjk ? (cjkFonts ? [...cjkFonts, ...latinFonts] : null) : latinFonts;
  if (locale !== "en" && !cjk && !/^(de|fr|es|pt|it|nl|id|ms|vi|tr|pl|sv|ro|cs)$/.test(locale)) {
    console.warn(`Skipped ${locale}: no font for its script, pages use the English card`);
    continue;
  }
  if (!fonts) {
    console.warn(`Skipped ${locale}: no CJK font at ${CJK}`);
    continue;
  }
  const m = messagesFor(locale);
  const band = cjk ? "VIZA 服务免费 · 政府费用另计" : "VIZA is free. Government fees are separate.";
  const items = [];

  for (const key of PAGES) {
    const p = m.pages?.[key];
    if (!p) continue;
    items.push({ key, title: stripBrand(p.title), subtitle: clip(firstSentence(p.description), 110), img: null });
  }
  if (m.pages?.[BLOG]) {
    items.push({ key: BLOG, title: stripBrand(m.pages.blog.metaTitle), subtitle: clip(m.pages.blog.metaDescription, 110), img: null });
  }
  const hub = m.pages?.arrivalCards;
  if (hub) {
    const [head] = stripBrand(hub.title).split(/[:：]/);
    items.push({ key: "arrival-cards", title: head.trim(), subtitle: clip(firstSentence(hub.description), 110), img: null });
  }
  for (const slug of GUIDE_SLUGS) {
    const guide = (await import(`../lib/arrival-cards/${locale}/${slug}.ts`)).default;
    const [head] = stripBrand(guide.title).split(/[:：]/);
    items.push({ key: `arrival-${slug}`, title: head.trim(), subtitle: clip(firstSentence(guide.description), 110), img: null });
  }
  const guidesHub = m.pages?.guides;
  if (guidesHub) {
    const [head] = stripBrand(guidesHub.title).split(/[:：]/);
    items.push({ key: "guides", title: head.trim(), subtitle: clip(firstSentence(guidesHub.description), 110), img: null });
  }
  for (const slug of EVERGREEN_SLUGS) {
    const guide = (await import(`../lib/guides/${locale}/${slug}.ts`)).default;
    const [head] = stripBrand(guide.title).split(/[:：]/);
    items.push({ key: `guide-${slug}`, title: head.trim(), subtitle: clip(firstSentence(guide.description), 110), img: null });
  }
  for (const c of COUNTRIES.filter(isPublished)) {
    const name = m.countries?.[c.slug] ?? c.name;
    const full = stripBrand(destinationTitle(c, name, locale));
    const [head, tail] = full.split(/[:：]/);
    const subtitle = cjk ? "费用、材料与办理流程" : tail?.trim() || "Fees and how to apply";
    items.push({ key: `visa-${c.slug}`, title: cjk ? `新加坡办理${name}签证` : head.trim(), subtitle, img: await photo(c.slug) });
  }

  manifest[locale] = [];
  mkdirSync(new URL(`public/og/${locale}/`, ROOT), { recursive: true });
  for (const item of items) {
    const svg = await satori(card({ ...item, band, cjk }), { width: 1200, height: 630, fonts });
    const png = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render().asPng();
    const jpg = await sharp(png).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    if (jpg.length > 300 * 1024) console.warn(`${locale}/${item.key} is ${Math.round(jpg.length / 1024)} KB`);
    writeFileSync(new URL(`public/og/${locale}/${item.key}.jpg`, ROOT), jpg);
    manifest[locale].push(item.key);
  }
  console.log(`${locale}: ${items.length} cards`);
}

writeFileSync(new URL("lib/seo/og-manifest.json", ROOT), JSON.stringify(manifest, null, 2) + "\n");
