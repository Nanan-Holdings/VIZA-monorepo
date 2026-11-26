// Collects every translatable unit from the English sources in code. A unit is one file's worth of strings:
//   messages        messages/en.json (ICU messages)
//   visa/<slug>     lib/visa-content/<slug>.ts
//   guides/<slug>   lib/guides/en/<slug>.ts
//   arrival/<slug>  lib/arrival-cards/en/<slug>.ts
//   legal           lib/legal/en.ts
//   meta            guide and arrival card names, tags and summaries (hub cards)
//   seo             destination title and description wording (lib/seo/titles.ts)
// Run through scripts/i18n/register.mjs so the .ts files import under plain Node.
import { join } from "node:path";
import { ROOT, extract, readJson } from "./core.mjs";

const ts = (rel) => import(join(ROOT, rel));

export async function loadSources(filter = null) {
  const units = [];
  const want = (name) => !filter || filter.some((f) => name === f || name.startsWith(f.endsWith("/") ? f : f + "/") || name.startsWith(f));
  const add = (name, kind, source, skipExact = new Set()) => {
    if (!want(name)) return;
    units.push({ name, kind, source, skipExact, entries: extract(source, skipExact) });
  };

  add("messages", "icu", readJson(join(ROOT, "messages/en.json")));

  const { CONTENT } = await ts("lib/visa-content/index.ts");
  for (const [slug, content] of Object.entries(CONTENT)) add(`visa/${slug}`, "plain", content);

  const { GUIDES } = await ts("lib/guides/index.ts");
  for (const g of GUIDES) add(`guides/${g.slug}`, "plain", (await ts(`lib/guides/en/${g.slug}.ts`)).default);

  const arrival = await ts("lib/arrival-cards/index.ts");
  for (const g of arrival.GUIDES) add(`arrival/${g.slug}`, "plain", (await ts(`lib/arrival-cards/en/${g.slug}.ts`)).default);

  const { COMPANY } = await ts("lib/legal/company.ts");
  const company = new Set(Object.values(COMPANY).filter((v) => typeof v === "string"));
  add("legal", "plain", (await ts("lib/legal/en.ts")).en, company);

  add("meta", "plain", {
    guides: Object.fromEntries(GUIDES.map((g) => [g.slug, { name: g.name.en, tag: g.tag.en, summary: g.summary.en }])),
    arrival: Object.fromEntries(arrival.GUIDES.map((g) => [g.slug, { name: g.name.en, country: g.country.en }])),
  });

  add("seo", "plain", (await ts("lib/seo/titles.ts")).SEO_SOURCE);
  return units;
}

export function wordCount(units) {
  return units.reduce((n, u) => n + u.entries.reduce((m, e) => m + e.text.split(/\s+/).filter(Boolean).length, 0), 0);
}
