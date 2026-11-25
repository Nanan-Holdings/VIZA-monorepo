// Translation pipeline CLI. It makes no network calls and spends no money: the translating itself is done by a
// person or an agent who writes the translated JSON files (see "Layout" below).
//
//   npm run i18n:extract -- ja            write what still needs translating (new or changed English only)
//   npm run i18n:extract -- ja --all      write everything, even strings already translated
//   npm run i18n:validate -- ja [group]   check the translator's files in work/i18n/ja/ (nothing is installed)
//   npm run i18n:write -- ja [group]      validate, then install the passing strings into the locale files
//   npm run i18n:check -- ja              check the installed files (what the build ships)
//
// Layout (work/ is not committed):
//   work/i18n/<locale>/source/<group>.json   written by extract. { meta, strings: {key: English}, context: {key: note} }
//   work/i18n/<locale>/<group>.json          written by the translator. Flat { key: translated text }, the same keys
//                                            as `strings` (a subset is fine, run again for the rest)
// Groups: messages.<namespace> (one per top-level key of messages/en.json), visa__<slug>, guides__<slug>,
// arrival__<slug>, legal, meta, seo. Installed files: messages/<locale>.json and translations/<locale>/<unit>.json
// (+ <unit>.src.json, the hash of the English each string was translated from, which makes re-runs incremental).
// A string that is missing or invalid is simply not installed, so the site shows its English text.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ROOT, SEP, TRANSLATIONS, WORK, PROTECTED, entryProblems, hash, readJson, unflattenInto } from "./core.mjs";
import { LANGS } from "./langs.mjs";
import { loadSources } from "./sources.mjs";

const [cmd, locale, ...rest] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const ALL = process.argv.includes("--all");
const groupsWanted = rest.length ? rest : null;
if (!["extract", "validate", "write", "check"].includes(cmd) || !LANGS[locale]) {
  console.error("usage: npm run i18n:<extract|validate|write|check> -- <locale> [group...]   (locale must be one of the 58 in scripts/i18n/langs.mjs; en is the source, zh-CN is native)");
  process.exit(2);
}
const cfg = LANGS[locale];
const out = (path, data) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, JSON.stringify(data, null, 2) + "\n"); };
const groupOf = (unit, path) => (unit === "messages" ? `messages.${path.split(SEP)[0]}` : unit.replace(/\//g, "__"));

const RULES = `Translate the English strings into ${cfg.name} for VIZA, a free visa application service for people living in Singapore (run by Kelin Studio). ${cfg.notes}
FACTS ARE SACRED: never change, drop or reorder a fee, amount, currency code, date, duration, count, pass type or legal term. Keep money as written ("JPY 15,000", "S$132", "EUR 90"). Dates keep the same day, month and year (month names may be localised). Add no fact, number, promise or sentence. Never say VIZA charges a fee or guarantees approval.
KEEP VERBATIM: ${PROTECTED.join(", ")} and every Latin-letter brand, portal or visa scheme name. Country and city names use the standard ${cfg.name} name.
Inline links [label](/visa/japan): keep the target exactly, translate the label, same number of links. ICU messages (groups messages.*): keep every {placeholder}, {n, plural, ...} and {x, select, ...} structure and branch keywords, tags such as <strong> <em> <br> <terms>, and # ; translate only the text inside; plural blocks may gain CLDR branches the language needs.
NEVER use the em dash or en dash (use a comma, colon, full stop, "to" or a hyphen-minus). Western digits 0-9 only.
SEO: keys ending in title or metaTitle: at most 60 characters including " | VIZA"; description or metaDescription: at most 160. In group seo, {name} is a destination name of about 20 characters: keep {name}; "...Titles" run longest to shortest and the last must fit 60 characters.
Style: plain, factual, friendly; short UI labels; natural wording a native product writer would use. Write translations only, no notes.`;

function contextFor(unit, path) {
  const notes = [];
  const last = path.split(SEP).pop();
  if (/^(title|metaTitle)$/.test(last) && (unit === "messages" ? path.startsWith("pages/") : /^(guides|arrival)\//.test(unit))) notes.push("page title, max 60 characters incl. ' | VIZA'");
  if (/^(description|metaDescription)$/.test(last) && (unit === "messages" ? path.startsWith("pages/") : /^(guides|arrival)\//.test(unit))) notes.push("meta description, max 160 characters");
  if (unit === "seo") notes.push("destination title/description wording, keep {name}");
  if (unit === "messages") notes.push(`UI text, ${path.split(SEP).slice(0, -1).join(" > ")}`);
  else notes.push(`${unit}, ${path.split(SEP).slice(0, -1).join(" > ") || "top level"}`);
  return notes.join("; ");
}

function readInstalled(units) {
  const existing = {};
  for (const u of units) {
    if (u.name === "messages") {
      const flat = {};
      (function walk(n, p) {
        if (typeof n === "string") flat[p] = n;
        else if (Array.isArray(n)) n.forEach((v, i) => walk(v, p ? `${p}${SEP}${i}` : String(i)));
        else if (n && typeof n === "object") for (const [k, v] of Object.entries(n)) walk(v, p ? `${p}${SEP}${k}` : k);
      })(readJson(join(ROOT, "messages", `${locale}.json`), {}), "");
      existing[u.name] = { flat, src: readJson(join(TRANSLATIONS, locale, "messages.src.json"), {}) };
    } else {
      existing[u.name] = { flat: readJson(join(TRANSLATIONS, locale, `${u.name}.json`), {}), src: readJson(join(TRANSLATIONS, locale, `${u.name}.src.json`), {}) };
    }
  }
  return existing;
}
const isDone = (ex, e) => ex.flat[e.path] !== undefined && ex.src[e.path] === hash(e.text);

const units = await loadSources();
const installed = readInstalled(units);
/** group -> [{ unit, kind, path, text }] for every translatable string. */
const groups = new Map();
for (const u of units) for (const e of u.entries) {
  const g = groupOf(u.name, e.path);
  if (!groups.has(g)) groups.set(g, []);
  groups.get(g).push({ unit: u.name, kind: u.kind, path: e.path, text: e.text });
}
const wanted = [...groups.keys()].filter((g) => !groupsWanted || groupsWanted.includes(g));
const unitByName = new Map(units.map((u) => [u.name, u]));

const keyOf = (it) => (it.unit === "messages" ? it.path : `${it.path}`); // keys are unique within a group
const problemsFor = (it, tr) => entryProblems({ unit: it.unit, path: it.path, en: it.text, tr, locale, kind: it.kind });

if (cmd === "extract") {
  rmSync(join(WORK, locale, "source"), { recursive: true, force: true });
  let files = 0, strings = 0, words = 0;
  for (const g of wanted) {
    const pending = groups.get(g).filter((it) => ALL || !isDone(installed[it.unit], it));
    if (!pending.length) continue;
    const doc = {
      meta: { locale, language: cfg.name, group: g, kind: pending[0].kind, rules: RULES, output: `Write work/i18n/${locale}/${g}.json as a flat JSON object { key: translation } using these exact keys.` },
      strings: Object.fromEntries(pending.map((it) => [keyOf(it), it.text])),
      context: Object.fromEntries(pending.map((it) => [keyOf(it), contextFor(it.unit, it.path)])),
    };
    out(join(WORK, locale, "source", `${g}.json`), doc);
    files++; strings += pending.length; words += pending.reduce((n, it) => n + it.text.split(/\s+/).length, 0);
  }
  console.log(`${locale}: wrote ${files} source files (${strings} strings, ${words} words) to work/i18n/${locale}/source/${ALL ? "" : " (only new or changed English)"}`);
  process.exit(0);
}

if (cmd === "validate" || cmd === "write") {
  let bad = 0, good = 0, missing = 0, installedCount = 0;
  const accepted = new Map(); // unit -> { path: translation }
  for (const g of wanted) {
    const file = join(WORK, locale, `${g}.json`);
    const tr = readJson(file);
    const items = groups.get(g);
    if (!tr) { const n = items.filter((it) => !isDone(installed[it.unit], it)).length; if (n) { console.log(`  ${g}: no translator file yet (${n} strings pending)`); missing += n; } continue; }
    const known = new Map(items.map((it) => [keyOf(it), it]));
    for (const k of Object.keys(tr)) if (!known.has(k)) { console.log(`  ${g}: unknown key ${k}`); bad++; }
    for (const it of items) {
      const v = tr[keyOf(it)];
      if (v === undefined) { if (!isDone(installed[it.unit], it)) missing++; continue; }
      const p = problemsFor(it, v);
      if (p.length) { bad++; console.log(`  ${g} ${it.path}: ${p.join("; ")}`); continue; }
      good++;
      if (!accepted.has(it.unit)) accepted.set(it.unit, {});
      accepted.get(it.unit)[it.path] = { text: v, en: it.text };
    }
  }
  console.log(`${locale}: ${good} strings valid, ${bad} problems, ${missing} not translated yet`);
  if (cmd === "write") {
    for (const [unitName, map] of accepted) {
      const u = unitByName.get(unitName);
      const ex = installed[unitName];
      const flat = {}, src = {};
      for (const e of u.entries) {
        if (isDone(ex, e)) { flat[e.path] = ex.flat[e.path]; src[e.path] = ex.src[e.path]; }
        if (map[e.path]) { flat[e.path] = map[e.path].text; src[e.path] = hash(e.text); installedCount++; }
      }
      if (unitName === "messages") {
        out(join(ROOT, "messages", `${locale}.json`), unflattenInto(u.source, flat) ?? {});
        out(join(TRANSLATIONS, locale, "messages.src.json"), src);
      } else {
        out(join(TRANSLATIONS, locale, `${unitName}.json`), flat);
        out(join(TRANSLATIONS, locale, `${unitName}.src.json`), src);
      }
    }
    console.log(`${locale}: installed ${installedCount} strings. Run npm run i18n:check -- ${locale}, then add "${locale}" to ENABLED_LOCALES in lib/locales.ts and run npm run og.`);
  }
  process.exit(bad ? 1 : 0);
}

// check: validate the installed files
{
  const problems = [], stale = [];
  let total = 0, missing = 0;
  const ex = readInstalled(units);
  for (const u of units) {
    const e0 = ex[u.name];
    const known = new Set(u.entries.map((e) => e.path));
    for (const k of Object.keys(e0.flat)) if (!known.has(k)) problems.push(`${u.name}|${k}: key is not in the English source`);
    for (const e of u.entries) {
      total++;
      const tr = e0.flat[e.path];
      if (tr === undefined) { missing++; continue; }
      if (e0.src[e.path] !== hash(e.text)) stale.push(`${u.name}|${e.path}`);
      for (const p of entryProblems({ unit: u.name, path: e.path, en: e.text, tr, locale, kind: u.kind })) problems.push(`${u.name}|${e.path}: ${p}`);
    }
  }
  const { COUNTRIES, isPublished } = await import(join(ROOT, "lib/countries.ts"));
  const { destinationTitle, destinationDescription, SEO_SOURCE, TITLE_MAX, DESCRIPTION_MAX } = await import(join(ROOT, "lib/seo/titles.ts"));
  const { applyOverlay } = await import(join(ROOT, "lib/i18n-overlay.ts"));
  const copy = applyOverlay(SEO_SOURCE, ex.seo.flat);
  const msgs = readJson(join(ROOT, "messages", `${locale}.json`), {});
  const chars = (s) => [...s].length;
  const seenT = new Map(), seenD = new Map();
  for (const c of COUNTRIES.filter(isPublished)) {
    const name = msgs.countries?.[c.slug] ?? c.name;
    const t = destinationTitle(c, name, locale, copy), d = destinationDescription(c, name, locale, copy);
    if (chars(t) > TITLE_MAX) problems.push(`/visa/${c.slug} title is ${chars(t)} characters: ${t}`);
    if (chars(d) > DESCRIPTION_MAX) problems.push(`/visa/${c.slug} description is ${chars(d)} characters`);
    if (seenT.has(t)) problems.push(`/visa/${c.slug} duplicates the title of ${seenT.get(t)}`);
    if (seenD.has(d)) problems.push(`/visa/${c.slug} duplicates the description of ${seenD.get(d)}`);
    seenT.set(t, c.slug); seenD.set(d, c.slug);
  }
  const ok = !problems.length && !missing && !stale.length;
  console.log(`${ok ? "PASS" : "FAIL"} ${locale}: ${total} translatable strings, ${missing} missing, ${stale.length} stale, ${problems.length} problems`);
  for (const p of problems.slice(0, 40)) console.log("  " + p);
  process.exit(ok ? 0 : 1);
}
