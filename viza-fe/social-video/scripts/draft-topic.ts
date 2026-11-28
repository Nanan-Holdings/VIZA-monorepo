/**
 * Drafts a short-video script for one topic in pipeline/topics.json, using only the repo files the
 * topic names (VIZA's own fact-checked visa and arrival card pages) as the source. Same scene
 * library, rules and validator as the blog drafter, plus VIZA_FACTS and the banned-claims check.
 *
 *   npx tsx scripts/draft-topic.ts --topic sg-arrival-card [--name sg-arrival-card]
 *
 * Writes scripts/scripts-in/<name>-<lang>.json for each language the topic lists.
 * Env: DEEPSEEK_API_KEY (from ../internal-website/.env.local or the process).
 */
import fs from "node:fs";
import path from "node:path";
import { RULES, SCENE_LIBRARY, VIZA_FACTS, validate, type Draft } from "./script-rules";

const root = path.resolve(__dirname, "..");
const site = path.resolve(root, "../marketing-website");
const arg = (k: string) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
for (const f of [path.join(root, ".env.local"), path.join(root, "../internal-website/.env.local")]) {
  if (!fs.existsSync(f)) continue;
  for (const line of fs.readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

export type Topic = {
  id: string;
  langs: ("en" | "zh")[];
  audience: string;
  angle: string;
  sources: string[];
  link: string;
  hashtags: string[];
};

export const loadTopic = (id: string): Topic => {
  const all = JSON.parse(fs.readFileSync(path.join(root, "pipeline/topics.json"), "utf8")).topics as Topic[];
  const t = all.find((x) => x.id === id);
  if (!t) throw new Error(`topic not in pipeline/topics.json: ${id}`);
  return t;
};

async function main() {
  const id = arg("topic");
  if (!id) throw new Error("usage: draft-topic --topic <id> [--name <name>]");
  const name = arg("name") ?? id;
  const topic = loadTopic(id);
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("missing env DEEPSEEK_API_KEY");
  // Sources are the site's own content files, or a fact brief the VIZA agent wrote (pipeline/briefs/*.md,
  // official sources only) for news the site does not cover yet.
  const read = (f: string) => fs.readFileSync(fs.existsSync(path.join(site, f)) ? path.join(site, f) : path.join(root, f), "utf8");
  const source = topic.sources.map((f) => `=== ${f}\n${read(f)}`).join("\n\n");
  const shape = topic.langs.map((l) => `"${l}": {"topic", "voiceText", "scenes": [...]}`).join(", ");
  const rules = RULES.replace(/^- Audience:.*$/m, `- Audience: ${topic.audience}. VIZA is a free visa help service in Singapore.`)
    .replace(/Use only facts stated in the article\./, "Use only facts stated in the source files below. Prefer the 'glance', 'lede' and FAQ facts.")
    .replace(/leave the rest to the blog post/, "leave the rest to the web page")
    .replace(/^Return JSON:.*$/m, `Return JSON: {${shape}${topic.langs.includes("zh") ? ', "captionReplaceZh": [[spoken, written], ...]' : ""}}. Only these languages.`);
  const messages: { role: string; content: string }[] = [
    { role: "system", content: `You write short vertical explainer videos for VIZA.${SCENE_LIBRARY}\n${rules}\n${VIZA_FACTS}` },
    {
      role: "user",
      content: `Topic: ${topic.angle}\nAudience: ${topic.audience}\nWeb page for more detail: ${topic.link}\n\nSource files (TypeScript content objects; the strings are the facts):\n${source}`,
    },
  ];
  let draft: Draft | null = null;
  for (let attempt = 1; attempt <= 6; attempt++) {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env.VIZA_VIDEO_MODEL ?? "deepseek-chat", temperature: 0.4, response_format: { type: "json_object" }, messages }),
    });
    if (!res.ok) throw new Error(`deepseek ${res.status}: ${await res.text()}`);
    const content = ((await res.json()) as { choices: { message: { content: string } }[] }).choices[0].message.content;
    const candidate = JSON.parse(content) as Draft;
    const errors = validate(candidate, topic.langs);
    if (!errors.length) {
      draft = candidate;
      break;
    }
    console.log(`attempt ${attempt}: ${errors.length} problems, asking for a fix\n  - ${errors.join("\n  - ")}`);
    messages.push({ role: "assistant", content }, { role: "user", content: `Fix these problems and return the full JSON again:\n- ${errors.join("\n- ")}` });
  }
  if (!draft) throw new Error("draft still invalid after 6 attempts; see problems above");
  const outDir = path.join(root, "scripts/scripts-in");
  for (const lang of topic.langs) {
    const d = draft[lang];
    const script = {
      slug: name,
      locale: lang === "en" ? "en" : "zh-CN",
      topic: d.topic,
      voiceText: d.voiceText,
      voice: `voice/${name}-${lang}.mp3`,
      music: "music/bed-calm-tech.mp3",
      timings: `timings/${name}-${lang}.json`,
      out: `specs/${name}-${lang}.json`,
      captionReplace: lang === "en" ? [["viza dot it dot com", "viza.it.com"]] : [["viza点it点com", "viza.it.com"], ...(draft.captionReplaceZh ?? [])],
      scenes: d.scenes,
    };
    const file = path.join(outDir, `${name}-${lang}.json`);
    fs.writeFileSync(file, JSON.stringify(script, null, 2));
    console.log(`wrote ${path.relative(root, file)}`);
  }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
