// Shared pieces of the translation pipeline: string extraction, hashing and validation. No network access.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { TYPE, parse } from "@formatjs/icu-messageformat-parser";
import { IntlMessageFormat } from "intl-messageformat";
import { CJK, LANGS } from "./langs.mjs";

export const ROOT = fileURLToPath(new URL("../../", import.meta.url));
/** Translators read work/i18n/<locale>/source/<group>.json and write work/i18n/<locale>/<group>.json. Not committed. */
export const WORK = join(ROOT, "work/i18n");
export const TRANSLATIONS = join(ROOT, "translations");
export const SEP = "/";
export const DASH = /[\u2013\u2014]/;

export const hash = (text) => createHash("sha1").update(text).digest("hex").slice(0, 10);
export const readJson = (p, fallback = null) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : fallback);

// ---------------------------------------------------------------------------------------------------------
// What is translatable
// ---------------------------------------------------------------------------------------------------------

/** Never translated: names of things the code or a URL depends on. Matched against the last path segment. */
const SKIP_KEYS = new Set(["slug", "framing", "heroImage", "id", "t", "icon", "href", "url", "display", "destinations", "initials", "image", "officialUrl", "officialHost", "visaSlug"]);
/** Brand and platform names that stay as written. */
export const BRANDS = ["VIZA", "Kelin Studio", "Kelin", "Trustpilot", "Google", "Facebook", "Instagram", "LinkedIn", "Pinterest", "Reddit", "WhatsApp", "Singpass", "GCash", "Maya", "GrabPay", "Stripe", "Apple", "Telegram", "WeChat"];
/** Product and scheme names the translation must keep exactly (visa products, arrival cards, official portals). */
export const PROTECTED = ["K-ETA", "MDAC", "TDAC", "ESTA", "ETIAS", "JESTA", "eTA", "ETA", "EES", "SGAC", "SG Arrival Card", "Visit Japan Web", "All Indonesia", "e-Arrival Card", "e-VOA", "DS-160", "MyICA", "JAPAN eVISA", "VFS", "BLS", "VIZA", "Kelin Studio", "GCash", "Maya", "GrabPay", "WhatsApp", "Singpass", "Trustpilot", "MyInfo"];
const PROTECTED_SORTED = [...PROTECTED].sort((a, b) => b.length - a.length);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const PROTECTED_RE = new RegExp(`(?<![A-Za-z0-9-])(?:${PROTECTED_SORTED.map(escapeRe).join("|")})(?![A-Za-z0-9])`, "g");

export function isTranslatable(path, text, skipExact = new Set()) {
  if (typeof text !== "string") return false;
  const last = path.split(SEP).pop();
  if (SKIP_KEYS.has(last)) return false;
  if (/(^|\/)reviews\/items\/\d+\/(name|source)$/.test(path)) return false;
  const t = text.trim();
  if (!t || skipExact.has(t)) return false;
  if (!/\p{L}/u.test(t)) return false;
  if (/^https?:\/\/\S+$/.test(t) || /^\S+@\S+$/.test(t) || /^\/[\w/#?=&.-]*$/.test(t)) return false;
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/.test(t)) return false;
  if (/^[^\s@]+@[^\s@]+(\s*\|\s*[+\d\s()-]+)?$/.test(t)) return false; // "email | phone"
  let rest = t;
  for (const b of BRANDS) rest = rest.split(b).join(" ");
  if (!/\p{L}/u.test(rest.replace(/[A-Z]{2,}[A-Za-z0-9-]*/g, " "))) {
    // Only brands and acronyms left (for example "K-ETA", "VIZA", "Trustpilot"): nothing to translate.
    if (!/\s/.test(t) || t.split(/\s+/).length <= 2) return false;
  }
  return true;
}

/** [{ path, text }] for every translatable string in a nested object or array. */
export function extract(node, skipExact, path = "", out = []) {
  if (typeof node === "string") {
    if (isTranslatable(path, node, skipExact)) out.push({ path, text: node });
  } else if (Array.isArray(node)) {
    node.forEach((v, i) => extract(v, skipExact, path === "" ? String(i) : `${path}${SEP}${i}`, out));
  } else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) extract(v, skipExact, path === "" ? k : `${path}${SEP}${k}`, out);
  }
  return out;
}

/** Rebuild a nested object from `template`, taking each string leaf from `flat[path]` when present. */
export function unflattenInto(template, flat, path = "") {
  if (typeof template === "string") return Object.prototype.hasOwnProperty.call(flat, path) ? flat[path] : undefined;
  if (Array.isArray(template)) {
    const arr = template.map((v, i) => unflattenInto(v, flat, path === "" ? String(i) : `${path}${SEP}${i}`));
    return arr.some((v) => v !== undefined) ? arr : undefined;
  }
  if (template && typeof template === "object") {
    const out = {};
    for (const [k, v] of Object.entries(template)) {
      const r = unflattenInto(v, flat, path === "" ? k : `${path}${SEP}${k}`);
      if (r !== undefined) out[k] = r;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return undefined;
}

// ---------------------------------------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------------------------------------

const CLDR = new Set(["zero", "one", "two", "few", "many", "other"]);

function icuFull(ast) {
  const out = [];
  (function walk(a) {
    for (const el of a) {
      if (el.type === TYPE.tag) { out.push(`tag:${el.value}`); walk(el.children); }
      else if (el.type === TYPE.argument) out.push(`arg:${el.value}`);
      else if (el.type === TYPE.number) out.push(`number:${el.value}`);
      else if (el.type === TYPE.date) out.push(`date:${el.value}`);
      else if (el.type === TYPE.time) out.push(`time:${el.value}`);
      else if (el.type === TYPE.pound) out.push("#");
      else if (el.type === TYPE.select || el.type === TYPE.plural) {
        out.push(`${el.type === TYPE.select ? "select" : "plural" + (el.pluralType || "") + (el.offset ? "+" + el.offset : "")}:${el.value}`);
        if (el.options.other) walk(el.options.other.value);
      }
    }
  })(ast);
  return out.sort();
}
function icuBlocks(ast, acc = []) {
  for (const el of ast) {
    if (el.type === TYPE.tag) icuBlocks(el.children, acc);
    if (el.type === TYPE.select || el.type === TYPE.plural) {
      acc.push([el.type === TYPE.select ? "select" : "plural", el.value, Object.keys(el.options)]);
      for (const k in el.options) icuBlocks(el.options[k].value, acc);
    }
  }
  return acc;
}

/** ICU message problems: parse errors, argument, tag and select/plural structure differences from the English. */
export function icuProblems(en, tr, locale) {
  const probs = [];
  let ea = null;
  try { ea = parse(en, { requiresOtherClause: false }); } catch { /* English is not strict ICU (for example a bare <br>) */ }
  let ta;
  try { ta = parse(tr, {}); new IntlMessageFormat(tr, locale); } catch (e) {
    if (ea) return [`parse: ${String(e.message).slice(0, 100)}`];
    ta = null;
  }
  if (!ea || !ta) {
    const sig = (s) => [...s.matchAll(/<\/?\w+>|\{[^{}]*\}/g)].map((m) => m[0]).sort().join("|");
    if (sig(en) !== sig(tr)) probs.push("tags or placeholders differ from the English");
    return probs;
  }
  const a = icuFull(ea), b = icuFull(ta);
  if (JSON.stringify(a) !== JSON.stringify(b)) probs.push(`skeleton en=${JSON.stringify(a)} tr=${JSON.stringify(b)}`);
  const emap = new Map(icuBlocks(ea).map((x) => [`${x[0]}:${x[1]}`, x[2]]));
  for (const x of icuBlocks(ta)) {
    const ek = emap.get(`${x[0]}:${x[1]}`);
    if (!ek) continue;
    if (x[0] === "select") {
      if (JSON.stringify([...ek].sort()) !== JSON.stringify([...x[2]].sort())) probs.push(`select keys differ in ${x[1]}`);
    } else {
      for (const k of ek) if (!x[2].includes(k)) probs.push(`plural ${x[1]} lost branch ${k}`);
      for (const k of x[2]) if (!ek.includes(k) && !CLDR.has(k)) probs.push(`plural ${x[1]} has unknown branch ${k}`);
    }
  }
  return probs;
}

const numRuns = (s) => s.match(/\d+(?:[.,]\d+)*/g) ?? [];
const isBig = (n) => n.length >= 3 || /[.,]/.test(n);
const CURRENCY = /(?:[A-Z]{3}|[A-Z]{1,2}\$|[$€£¥₱₹]|RM|Rp)\s?\d[\d,.]*\d|\d[\d,.]*\d\s?[A-Z]{3}\b/g;

/** Strip placeholders, tags, URLs, protected names and digits, leaving only the words that should be translated. */
export function wordsOnly(s) {
  let prev;
  do { prev = s; s = s.replace(/\{[^{}]*\}/g, " "); } while (prev !== s);
  return s
    .replace(/<\/?\w+>/g, " ")
    .replace(/\]\([^)]*\)/g, "]")
    .replace(/https?:\/\/\S+|\S+@\S+\.\S+/g, " ")
    .replace(PROTECTED_RE, " ")
    .replace(/\d+(?:[.,]\d+)*/g, " ")
    .replace(/\b[A-Z]{2,}\b/g, " ");
}

const TITLE_KEY = /(^|\/)(title|metaTitle|categoryMetaTitle)$/;
const DESC_KEY = /(^|\/)(description|metaDescription|categoryMetaDescription)$/;
const len = (s) => [...s].length;

/** Length rules for SEO fields. Returns [] for any other key. */
export function limitProblems(unit, path, tr, en = "") {
  const probs = [];
  const sample = tr.replaceAll("{name}", "United Arab Emirates").replaceAll("{category}", "Visa rules");
  if (unit === "messages" && path.startsWith("pages/")) {
    if (TITLE_KEY.test(path)) { if (len(sample) > 60) probs.push(`title is ${len(sample)} characters (max 60)`); if (en.includes("VIZA") && !sample.includes("VIZA")) probs.push("title lacks VIZA"); }
    if (DESC_KEY.test(path) && len(sample) > 160) probs.push(`description is ${len(sample)} characters (max 160)`);
  }
  if (unit.startsWith("guides/") || unit.startsWith("arrival/")) {
    if (path === "title") { if (len(tr) > 60) probs.push(`title is ${len(tr)} characters (max 60)`); if (!tr.includes("VIZA")) probs.push("title lacks VIZA"); }
    if (path === "description" && len(tr) > 160) probs.push(`description is ${len(tr)} characters (max 160)`);
  }
  if (unit === "seo") {
    // Title options run longest to shortest: only the last (index 3) must always fit; the site steps down to it.
    if (/Titles\/\d+$/.test(path) || /^overrides\/[^/]+\/title$/.test(path)) {
      if ((/Titles\/3$/.test(path) || path.startsWith("overrides/")) && len(sample) > 60) probs.push(`title is ${len(sample)} characters (max 60 with a 20 character name)`);
      if (!sample.includes("VIZA")) probs.push("title lacks VIZA");
    }
    if (/Description$/.test(path) || /^overrides\/[^/]+\/description$/.test(path)) {
      if (len(sample) > 160) probs.push(`description is ${len(sample)} characters (max 160 with a 20 character name)`);
    }
    if (/^patterns\//.test(path) && !tr.includes("{name}")) probs.push("lost the {name} placeholder");
  }
  return probs;
}

/**
 * Every rule a translated string must pass. `kind` is "icu" (messages) or "plain" (content, SEO, legal).
 * Returns a list of problem descriptions; empty means the string is good.
 */
export function entryProblems({ unit, path, en, tr, locale, kind, mock = process.env.I18N_SKIP_LANGUAGE_CHECKS === "1" }) {
  const cfg = LANGS[locale];
  if (typeof tr !== "string" || !tr.trim()) return ["empty"];
  const probs = [];
  if (DASH.test(tr)) probs.push("contains an em or en dash");
  if (kind === "icu") probs.push(...icuProblems(en, tr, locale));
  else {
    const links = (s) => [...s.matchAll(/\]\(([^)\s]*)\)/g)].map((m) => m[1]).join("|");
    if (links(en) !== links(tr)) probs.push("link targets differ from the English");
    const open = (s) => (s.match(/\[/g) ?? []).length + ":" + (s.match(/\]\(/g) ?? []).length;
    if (open(en) !== open(tr)) probs.push("link brackets differ from the English");
    const braces = (s) => (s.match(/\{[A-Za-z]+\}/g) ?? []).sort().join("|");
    if (braces(en) !== braces(tr)) probs.push("placeholders differ from the English");
  }
  // Protected names kept verbatim.
  for (const m of new Set(en.match(PROTECTED_RE) ?? [])) if (!tr.includes(m)) probs.push(`lost "${m}"`);
  // Fees, dates and amounts: every number in the English must survive.
  const ne = numRuns(en), nt = numRuns(tr);
  const have = [...nt];
  for (const n of ne.filter(isBig)) {
    const i = have.indexOf(n);
    if (i < 0) { probs.push(`lost the number ${n}`); break; }
    have.splice(i, 1);
  }
  for (const n of ne.filter((x) => !isBig(x))) if (!nt.includes(n)) { probs.push(`lost the number ${n}`); break; }
  for (const n of nt.filter(isBig)) if (!ne.includes(n)) { probs.push(`added the number ${n}`); break; }
  for (const m of en.match(CURRENCY) ?? []) {
    const num = m.match(/\d[\d,.]*\d/)[0];
    const code = m.replace(num, "").trim();
    if (!tr.includes(num) || (code && !tr.includes(code))) probs.push(`currency "${m}" not kept`);
  }
  // Language checks.
  const rest = wordsOnly(tr);
  if (!mock) {
    if (cfg.latin) {
      const words = wordsOnly(en).split(/\s+/).filter((w) => /[A-Za-z]/.test(w));
      if (tr.trim() === en.trim() && words.length >= 4) probs.push("identical to the English");
    } else {
      const letters = [...rest].filter((c) => /\p{L}/u.test(c));
      if (letters.length >= 6) {
        const ok = letters.filter((c) => cfg.script.some(([lo, hi]) => c.codePointAt(0) >= lo && c.codePointAt(0) <= hi)).length;
        if (ok / letters.length < 0.5) probs.push(`script ratio ${(ok / letters.length).toFixed(2)}`);
      }
    }
    // Truncation and rambling.
    if (en.length > 60) {
      const ratio = tr.length / en.length;
      const [lo, hi] = CJK.has(locale) ? [0.12, 1.6] : [0.3, 3.2];
      if (ratio < lo) probs.push(`far shorter than the English (${ratio.toFixed(2)}x)`);
      if (ratio > hi) probs.push(`far longer than the English (${ratio.toFixed(2)}x)`);
    }
  }
  probs.push(...limitProblems(unit, path, tr, en));
  return probs;
}

export function listUnitFiles(locale) {
  const dir = join(TRANSLATIONS, locale);
  if (!existsSync(dir)) return [];
  const out = [];
  const walk = (d, prefix) => {
    for (const name of readdirSync(d, { withFileTypes: true })) {
      if (name.isDirectory()) walk(join(d, name.name), `${prefix}${name.name}/`);
      else if (name.name.endsWith(".json") && !name.name.endsWith(".src.json")) out.push(`${prefix}${name.name.replace(/\.json$/, "")}`);
    }
  };
  walk(dir, "");
  return out;
}
