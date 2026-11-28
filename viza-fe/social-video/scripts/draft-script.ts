/**
 * Drafts English and Simplified Chinese short-video scripts from a VIZA blog post, using the same
 * DeepSeek key the blog pipeline uses. Output goes to scripts/scripts-in/<name>-{en,zh}.json for a
 * human to check before voice and render.
 *
 *   npx tsx scripts/draft-script.ts --slug saudi-arabia-family-visa-rule-change-skilled-workers --name saudi-family
 *
 * Env (read from ../internal-website/.env.local of the main checkout or the process):
 *   DEEPSEEK_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import fs from "node:fs";
import path from "node:path";
import { SCENE_LIBRARY, RULES, validate, type Draft } from "./script-rules";

const root = path.resolve(__dirname, "..");
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
const need = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`missing env ${k}`);
  return v;
};

async function main() {
  const slug = arg("slug");
  const name = arg("name") ?? slug;
  if (!slug || !name) throw new Error("usage: draft-script --slug <blog slug> [--name <short name>]");
  const url = `${need("NEXT_PUBLIC_SUPABASE_URL")}/rest/v1/marketing_blog_posts?slug=eq.${encodeURIComponent(slug)}&select=title,excerpt,body_markdown,published_at,locale&limit=1`;
  const key = need("SUPABASE_SERVICE_ROLE_KEY");
  const rows = (await (await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } })).json()) as {
    title: string;
    excerpt: string;
    body_markdown: string;
    published_at: string | null;
  }[];
  const post = rows[0];
  if (!post) throw new Error(`post not found: ${slug}`);

  const messages: { role: string; content: string }[] = [
    { role: "system", content: `You write short vertical explainer videos for VIZA.${SCENE_LIBRARY}\n${RULES}` },
    { role: "user", content: `Article (published ${post.published_at ?? "unpublished"}):\n# ${post.title}\n${post.excerpt}\n\n${post.body_markdown}` },
  ];
  let draft: Draft | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${need("DEEPSEEK_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env.VIZA_VIDEO_MODEL ?? "deepseek-chat", temperature: 0.4, response_format: { type: "json_object" }, messages }),
    });
    if (!res.ok) throw new Error(`deepseek ${res.status}: ${await res.text()}`);
    const content = ((await res.json()) as { choices: { message: { content: string } }[] }).choices[0].message.content;
    const candidate = JSON.parse(content) as Draft;
    const errors = validate(candidate);
    if (!errors.length) {
      draft = candidate;
      break;
    }
    console.log(`attempt ${attempt}: ${errors.length} problems, asking for a fix`);
    messages.push({ role: "assistant", content }, { role: "user", content: `Fix these problems and return the full JSON again:\n- ${errors.join("\n- ")}` });
  }
  if (!draft) throw new Error("draft still invalid after 3 attempts; see problems above");
  const outDir = path.join(root, "scripts/scripts-in");
  for (const [lang, locale] of [["en", "en"], ["zh", "zh-CN"]] as const) {
    const d = draft[lang];
    // Every cue must be an exact substring of the voice text, or the spec builder cannot align it.
    const script = {
      slug,
      locale,
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
