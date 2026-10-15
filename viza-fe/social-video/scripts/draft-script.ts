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

const SCENE_LIBRARY = `
Scene kinds (use each at most once, 5 to 7 scenes, in a sensible order, always end with "cta"):
- hook: props {kicker: short question naming the audience, lines: [headline sentence, ...accent words from it], turn: the twist sentence}. beats: 3 cues (kicker, headline, turn).
- acronym: props {acronym, words: one English word per letter, note?: local-language full name}. Only if the topic has an acronym.
- notA: props {struck: the wrong word (max 6 chars), stamp: "NOT A <WORD>" style stamp, is: what it actually is, like?: a familiar comparison}. beats: 2 cues.
- stats: props {title?, items: up to 3 of {value, countTo?, prefix?, suffix?, struck?, label}}. beats: one cue per item.
- timeline: props {title, points: 3 to 5 of {label, note?, state: "slipped"|"target"}, caveat}. beats: 2 cues (history, current target).
- verdict: props {badge, headline, note}. The practical takeaway.
- cta: props {question, url: "viza.it.com", pill: "Free" (zh: "免费"), disclaimer: "VIZA is not a government agency. Always verify with official sources." (zh: "VIZA 并非政府机构，请以官方信息为准。")}.
Every scene has "cue": a short exact substring of voiceText where the scene starts. "beats" are exact substrings of voiceText, in order.`;

const RULES = `
Rules:
- Audience: Singapore residents and Singapore passport holders. VIZA is a free visa help service.
- voiceText is read by a TTS voice: 30 to 40 seconds. HARD LIMITS: English 75 to 100 words, Chinese 130 to 190 characters. Pick the 3 or 4 facts that matter most; leave the rest to the blog post.
- Open with a hook that names who this affects in under 8 words.
- Calm, direct, practical. No exclamation marks, no hype, no prices for VIZA, no promises about approval.
- Use only facts stated in the article. If the article says something is unconfirmed, say so.
- In voiceText write numbers the way they are spoken. In English, dates as digits are fine ("2026"). In Chinese, write years and amounts in Chinese words (二零二六年, 二十欧元) and end with "上 viza 点 it 点 com，免费查询。". English ends with "Check free at viza dot it dot com.".
- On-screen props are written form (digits, symbols) and short: headline lines under 28 English characters or 12 Chinese characters.
- Start voiceText with the performance tag "[calm] ".
- Chinese is Simplified Chinese, natural for Singapore and mainland readers, not a literal translation.
Return JSON: {"en": {"topic", "voiceText", "scenes": [...]}, "zh": {"topic", "voiceText", "scenes": [...]}, "captionReplaceZh": [[spoken, written], ...]}.
"topic" is a pill label like "EU · ETIAS" or "欧盟 · ETIAS".`;

type DraftScene = { kind: string; cue: string; beats?: string[]; props: Record<string, unknown> };
type DraftLang = { topic: string; voiceText: string; scenes: DraftScene[] };
type Draft = { en: DraftLang; zh: DraftLang; captionReplaceZh?: [string, string][] };

/** Checks a draft against what the spec builder and a 30-40 s short need. */
const validate = (d: Draft): string[] => {
  const errs: string[] = [];
  for (const lang of ["en", "zh"] as const) {
    const l = d[lang];
    if (!l?.voiceText || !Array.isArray(l.scenes)) {
      errs.push(`${lang}: missing voiceText or scenes`);
      continue;
    }
    const spoken = l.voiceText.replace(/\[[^\]]*\]/g, "");
    const size = lang === "en" ? spoken.split(/\s+/).filter(Boolean).length : Array.from(spoken.replace(/[\s，。？！、,.?!a-zA-Z]/g, "")).length;
    const [min, max] = lang === "en" ? [75, 100] : [130, 190];
    if (size > max || size < min) errs.push(`${lang}: voiceText is ${size} ${lang === "en" ? "words" : "Chinese characters"}, must be ${min} to ${max}. Cut detail, keep the hook and the takeaway.`);
    if (/[!！]/.test(l.voiceText)) errs.push(`${lang}: remove exclamation marks`);
    if (l.scenes.length < 4 || l.scenes.length > 7) errs.push(`${lang}: use 4 to 7 scenes`);
    if (l.scenes[l.scenes.length - 1]?.kind !== "cta") errs.push(`${lang}: last scene must be cta`);
    let pos = -1;
    for (const sc of l.scenes) {
      for (const c of [sc.cue, ...(sc.beats ?? [])]) {
        const at = l.voiceText.indexOf(c);
        if (at < 0) errs.push(`${lang}: "${c}" (scene ${sc.kind}) is not an exact substring of voiceText`);
      }
      const at = l.voiceText.indexOf(sc.cue);
      if (at >= 0 && at <= pos) errs.push(`${lang}: scene ${sc.kind} cue comes before the previous scene's cue; scenes must follow the voiceText order`);
      if (at >= 0) pos = at;
      let bp = at;
      for (const b of sc.beats ?? []) {
        const bi = l.voiceText.indexOf(b, Math.max(0, at));
        if (bi < 0 || bi < bp) errs.push(`${lang}: beat "${b}" in scene ${sc.kind} must appear after the scene cue and the previous beat`);
        else bp = bi;
      }
    }
  }
  return errs;
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
