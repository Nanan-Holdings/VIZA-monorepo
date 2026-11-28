/** Scene library, writing rules and the validator shared by draft-script.ts (blog posts) and draft-topic.ts (daily topics). */
export const SCENE_LIBRARY = `
Scene kinds (use each at most once, 5 to 7 scenes, in a sensible order, always end with "cta"):
- hook: props {kicker: short question naming the audience, lines: [headline sentence, ...accent words from it], turn: the twist sentence, ring?: "eu" ONLY for EU or Schengen topics (draws the EU stars)}. beats: 3 cues (kicker, headline, turn).
- acronym: props {acronym, words: one English word per letter, note?: local-language full name}. Only if the topic has an acronym.
- notA: props {struck: the wrong word (max 6 chars), stamp: "NOT A <WORD>" style stamp, is: what it actually is, like?: a familiar comparison, rows?: up to 3 short ticked facts from the source (under 24 characters each, never an approval or speed claim)}. beats: 2 cues.
- stats: props {title?, items: up to 3 of {value, countTo?, prefix?, suffix?, struck?, label}}. beats: one cue per item.
- timeline: props {title, points: 3 to 5 of {label, note?, state: "slipped"|"target"}, caveat}. beats: 2 cues (history, current target).
- verdict: props {badge, headline, note}. The practical takeaway.
- cta: props {question, url: "viza.it.com", pill: "Free" (zh: "免费"), disclaimer: "VIZA is not a government agency. Always verify with official sources." (zh: "VIZA 并非政府机构，请以官方信息为准。")}.
Every scene has "cue": a short exact substring of voiceText where the scene starts. "beats" are exact substrings of voiceText, in order.`;

export const RULES = `
Rules:
- Audience: Singapore residents and Singapore passport holders. VIZA is a free visa help service.
- voiceText is read by a TTS voice: 30 to 40 seconds. HARD LIMITS: English 75 to 100 words, Chinese 130 to 190 characters. Pick the 3 or 4 facts that matter most; leave the rest to the blog post.
- Open with a hook that names who this affects in under 8 words.
- Calm, direct, practical. No exclamation marks, no hype, no promises about approval.
- No money amounts at all (fees change and VIZA is free): say the government fee is paid to the embassy or the issuing authority. No processing times; lead-time advice such as \"apply at least 3 weeks ahead\" is fine if the source says it.
- Use only facts stated in the article. If the article says something is unconfirmed, say so.
- In voiceText write numbers the way they are spoken. In English, dates as digits are fine ("2026"). In Chinese, write years and amounts in Chinese words (二零二六年, 二十欧元) and end with "上 viza 点 it 点 com，免费查询。". English ends with "Check free at viza dot it dot com.".
- On-screen props are written form (digits, symbols) and short: headline lines under 28 English characters or 12 Chinese characters.
- Start voiceText with the performance tag "[calm] ".
- Chinese is Simplified Chinese, natural for Singapore and mainland readers, not a literal translation.
Return JSON: {"en": {"topic", "voiceText", "scenes": [...]}, "zh": {"topic", "voiceText", "scenes": [...]}, "captionReplaceZh": [[spoken, written], ...]}.
"topic" is a pill label like "EU · ETIAS" or "欧盟 · ETIAS".`;

export type DraftScene = { kind: string; cue: string; beats?: string[]; props: Record<string, unknown> };
export type DraftLang = { topic: string; voiceText: string; scenes: DraftScene[] };
export type Draft = { en: DraftLang; zh: DraftLang; captionReplaceZh?: [string, string][] };

/** Checks a draft against what the spec builder and a 30-40 s short need. */
/** Facts every VIZA video must keep straight (Edward, Nov 2026). Sent with every draft request. */
export const VIZA_FACTS = `
VIZA facts (never contradict these):
- VIZA's service is free since 15 September 2026. Two plans, Guided and Full-service, both free.
- Government visa fees are separate and paid directly to the issuing authority, never to VIZA.
- VIZA covers 19 destinations and has 6 free arrival card guides (MDAC, SG Arrival Card, TDAC, Visit Japan Web, Korea e-Arrival, All Indonesia).
- VIZA is not a government agency. The issuing government decides every application.
- Never claim guaranteed or assured approval, fast, quick, express or same-day processing, or any processing time from VIZA.`;

/** Phrases a VIZA video must never say. Checked on voiceText and every on-screen prop. */
const BANNED: [RegExp, string][] = [
  [/guarantee|assured approval|100%|保证|包过|确保获批/i, "no guaranteed approval claims"],
  [/\b(fast|faster|quick|quickly|express|same[- ]day|instant|speedy)\b|极速|加急|快速出签|当天出签/i, "no speed or delivery promises"],
  [/[\u2013\u2014]/, "no em or en dashes"],
  [/\bPSG\b/, "no grant claims"],
  [/S\$|US\$|\$\s?\d|€|£|¥|日元|新元|欧元|美元|英镑|\bSGD\b|\bRM\s?\d/, "no money amounts; say the government fee is paid to the issuing authority"],
];

export const validate = (d: Draft, langs: ("en" | "zh")[] = ["en", "zh"]): string[] => {
  const errs: string[] = [];
  for (const lang of langs) {
    const all = JSON.stringify(d[lang] ?? {});
    for (const [re, why] of BANNED) if (re.test(all)) errs.push(`${lang}: ${why} (matched ${String(all.match(re)?.[0])})`);
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
    // Scene cues in order, each searched after the previous one; every beat must sit inside its own
    // scene (from its cue up to the next scene's cue), or build-spec cannot place it.
    const cues: number[] = [];
    let from = 0;
    for (const sc of l.scenes) {
      const at = sc.cue ? l.voiceText.indexOf(sc.cue, from) : -1;
      if (at < 0) errs.push(`${lang}: cue "${sc.cue}" (scene ${sc.kind}) is not an exact substring of voiceText after the previous scene's cue; scenes must follow the voiceText order`);
      cues.push(at);
      if (at >= 0) from = at + 1;
    }
    l.scenes.forEach((sc, i) => {
      const at = cues[i];
      if (at < 0) return;
      const end = cues.slice(i + 1).find((x) => x >= 0) ?? l.voiceText.length;
      // Beats the model misplaced are dropped rather than failing the draft: each scene falls back
      // to its default timing for a missing beat.
      let bp = at;
      sc.beats = (sc.beats ?? []).filter((b) => {
        const bi = l.voiceText.indexOf(b, bp);
        if (bi < 0 || bi >= end) return false;
        bp = bi;
        return true;
      });
      if (!sc.beats.length) sc.beats = [sc.cue];
    });
  }
  return errs;
};

