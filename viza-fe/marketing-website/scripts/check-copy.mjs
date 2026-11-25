// Fails the build on copy that breaks the SEO and house rules.
//   - em or en dashes in new or changed copy
//   - claims of guaranteed approval, or of being an official agent or partner
//   - page titles over 60 characters, descriptions over 160
//   - duplicate titles or descriptions within a language
// Run with: node --experimental-strip-types scripts/check-copy.mjs   (npm run check:copy, and before every build)
//
// Dash scope. The older visa prose in lib/visa-content and the long legal text carry many dashes that Phase B
// rewrites, so the dash rule covers: every page title and description, the messages `pages` and `visa`
// namespaces, all TS and TSX source outside lib/visa-content, the scripts, and any line added or changed against
// origin/main (when git history is available). New copy is therefore always checked, and the build passes once
// the files touched here are clean.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { execSync } from "node:child_process";
import { COUNTRIES, isPublished } from "../lib/countries.ts";
import { ENABLED_LOCALES } from "../lib/locales.ts";
import { destinationDescription, destinationTitle, TITLE_MAX, DESCRIPTION_MAX } from "../lib/seo/titles.ts";

const ROOT = new URL("../", import.meta.url).pathname;
const hits = [];
const DASH = /[–—]/;

// ---- Claims -----------------------------------------------------------------------------------------------
const CLAIMS = [
  { re: /guaranteed?\s+(visa\s+)?(approval|acceptance|success)/i, why: "claims guaranteed approval" },
  { re: /\b(approval|visa)\s+guarantee/i, why: "claims an approval guarantee" },
  { re: /100%\s+(approval|success|approved)/i, why: "claims 100% approval" },
  { re: /\bofficial\s+(partner|agent|agency|representative|reseller|visa\s+(centre|center|agent|service|processor))\b/i, why: "claims to be an official agent or partner" },
  { re: /\b(government|embassy)[- ](approved|authori[sz]ed)\s+(agent|agency|partner)\b/i, why: "claims government approval as an agent" },
];

/** A negation ("does not guarantee approval") is the honest wording, so it is not a claim. */
const NEGATED = /\b(not|never|no|n't|cannot)\b[^.]{0,40}guarantee/i;
const claimHit = (c, text) => c.re.test(text) && !NEGATED.test(text);

const textFiles = [];
const walk = (dir, accept) => {
  for (const name of readdirSync(dir)) {
    if (["node_modules", ".next", ".git", "public"].includes(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, accept);
    else if (accept(p)) textFiles.push(p);
  }
};
for (const d of ["app", "components", "lib", "scripts"]) walk(join(ROOT, d), (p) => /\.(tsx?|mjs)$/.test(p));

for (const file of textFiles) {
  const rel = relative(ROOT, file);
  const strictDash = !rel.startsWith("lib/visa-content") && rel !== "scripts/check-copy.mjs";
  readFileSync(file, "utf8").split("\n").forEach((line, i) => {
    if (strictDash && DASH.test(line)) hits.push(`${rel}:${i + 1} em or en dash: ${line.trim().slice(0, 90)}`);
    if (rel === "scripts/check-copy.mjs") return;
    for (const c of CLAIMS) if (claimHit(c, line)) hits.push(`${rel}:${i + 1} ${c.why}: ${line.trim().slice(0, 90)}`);
  });
}

// ---- Messages ---------------------------------------------------------------------------------------------
const flatten = (obj, prefix = "") =>
  Object.entries(obj).flatMap(([k, v]) =>
    typeof v === "string" ? [[`${prefix}${k}`, v]] : v && typeof v === "object" ? flatten(v, `${prefix}${k}.`) : [],
  );

const messages = {};
for (const locale of ENABLED_LOCALES) {
  const file = join(ROOT, "messages", `${locale}.json`);
  if (!existsSync(file)) {
    hits.push(`messages/${locale}.json is enabled in lib/locales.ts but missing`);
    continue;
  }
  messages[locale] = JSON.parse(readFileSync(file, "utf8"));
  for (const [key, value] of flatten(messages[locale])) {
    for (const c of CLAIMS) if (claimHit(c, value)) hits.push(`messages/${locale}.json ${key} ${c.why}`);
    if ((key.startsWith("pages.") || key.startsWith("visa.")) && DASH.test(value)) {
      hits.push(`messages/${locale}.json ${key} em or en dash: ${value.slice(0, 70)}`);
    }
  }
}

// ---- Added or changed lines (needs git history; skipped quietly without it) -------------------------------
try {
  const base = execSync("git merge-base HEAD origin/main", { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  const diff = execSync(`git diff -U0 ${base} -- messages lib/visa-content public/llms.txt public/index.md`, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }).toString();
  let file = "";
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ b/")) file = line.slice(6);
    else if (line.startsWith("+") && !line.startsWith("+++") && DASH.test(line)) hits.push(`${file} added line has an em or en dash: ${line.slice(1).trim().slice(0, 80)}`);
  }
} catch {
  /* no git history, or no origin/main: the static scope above still ran */
}

// ---- Titles and descriptions ------------------------------------------------------------------------------
const chars = (s) => [...s].length;
const PAGE_KEYS = ["guides", "home", "apply", "contact", "careers", "security", "status", "privacy", "terms", "product", "events"];

for (const locale of ENABLED_LOCALES) {
  const m = messages[locale];
  if (!m) continue;
  const rows = PAGE_KEYS.filter((k) => m.pages?.[k]).map((k) => ({ id: `${locale} pages.${k}`, title: m.pages[k].title, description: m.pages[k].description }));
  if (m.pages?.blog) rows.push({ id: `${locale} pages.blog`, title: m.pages.blog.metaTitle, description: m.pages.blog.metaDescription });
  for (const c of COUNTRIES.filter(isPublished)) {
    const name = m.countries?.[c.slug] ?? c.name;
    rows.push({ id: `${locale} /visa/${c.slug}`, title: destinationTitle(c, name, locale), description: destinationDescription(c, name, locale) });
  }
  const titles = new Map();
  const descriptions = new Map();
  for (const r of rows) {
    if (!r.title) hits.push(`${r.id} has no title`);
    if (!r.description) hits.push(`${r.id} has no description`);
    if (r.title && chars(r.title) > TITLE_MAX) hits.push(`${r.id} title is ${chars(r.title)} characters (max ${TITLE_MAX}): ${r.title}`);
    if (r.description && chars(r.description) > DESCRIPTION_MAX) hits.push(`${r.id} description is ${chars(r.description)} characters (max ${DESCRIPTION_MAX})`);
    if (r.title && titles.has(r.title)) hits.push(`${r.id} duplicates the title of ${titles.get(r.title)}: ${r.title}`);
    if (r.description && descriptions.has(r.description)) hits.push(`${r.id} duplicates the description of ${descriptions.get(r.description)}`);
    titles.set(r.title, r.id);
    descriptions.set(r.description, r.id);
    for (const c of CLAIMS) {
      if (claimHit(c, r.title || "") || claimHit(c, r.description || "")) hits.push(`${r.id} ${c.why}`);
    }
  }
}

// ---- Evergreen guides (lib/guides/<locale>/*.ts) --------------------------------------------------------
for (const locale of ENABLED_LOCALES) {
  const dir = join(ROOT, "lib/guides", locale);
  if (!existsSync(dir)) continue;
  const seen = new Set();
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".ts"))) {
    const guide = (await import(join(dir, file))).default;
    const id = `${locale} guide ${file.replace(/\.ts$/, "")}`;
    if (chars(guide.title) > TITLE_MAX) hits.push(`${id} title is ${chars(guide.title)} characters (max ${TITLE_MAX})`);
    if (chars(guide.description) > DESCRIPTION_MAX) hits.push(`${id} description is ${chars(guide.description)} characters (max ${DESCRIPTION_MAX})`);
    if (seen.has(guide.title)) hits.push(`${id} duplicates a guide title`);
    seen.add(guide.title);
    const text = JSON.stringify(guide);
    for (const c of CLAIMS) if (claimHit(c, text)) hits.push(`${id} ${c.why}`);
    for (const m of text.matchAll(/\]\((\/[^)\s]*)\)/g)) {
      const href = m[1];
      const ok = /^\/(visa\/[a-z-]+|arrival-cards\/[a-z-]+|guides\/[a-z-]+|contact|blog)$/.test(href);
      if (!ok) hits.push(`${id} links to an unknown path ${href}`);
    }
  }
}

if (hits.length) {
  console.error(`Copy check failed (${hits.length}):\n${hits.join("\n")}`);
  process.exit(1);
}
console.log(`Copy check passed (${ENABLED_LOCALES.length} locales, ${COUNTRIES.filter(isPublished).length} destinations)`);
