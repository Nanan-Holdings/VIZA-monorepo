/**
 * Turns a video script (what the writer or the LLM produces) plus the voice timings into a
 * render-ready VideoSpec: scene start times, animation beats and caption chunks all land on
 * the moment the matching words are spoken.
 *
 *   npx tsx scripts/build-spec.ts scripts/scripts-in/etias-en.json
 *
 * Writes specs/<slug>-<lang>.json.
 */
import fs from "node:fs";
import path from "node:path";
import type { Caption, SceneSpec, VideoSpec, Word } from "../src/spec";

type ScriptScene = { kind: SceneSpec["kind"]; cue: string; beats?: string[]; props: unknown };
type Script = Omit<VideoSpec, "scenes" | "captions" | "durationSec"> & {
  timings: string;
  out: string;
  scenes: ScriptScene[];
  /** Spoken form -> written form for captions, e.g. ["viza dot it dot com", "viza.it.com"]. */
  captionReplace?: [string, string][];
};
type Timings = { durationSec: number; words: Word[] };

const root = path.resolve(__dirname, "..");
const scriptPath = process.argv[2];
if (!scriptPath) throw new Error("usage: build-spec <script.json>");
const script: Script = JSON.parse(fs.readFileSync(path.resolve(scriptPath), "utf8"));
const timings: Timings = JSON.parse(fs.readFileSync(path.join(root, script.timings), "utf8"));

// Drop performance tags such as "[calm]" that the TTS aligner reports as words.
const words = timings.words.filter((w) => !/^\[|\]$/.test(w.text));
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

// One long normalised string with a char -> word index map, so cues can span word boundaries.
let flat = "";
const owner: number[] = [];
const wordPos: number[] = [];
words.forEach((w, i) => {
  const n = norm(w.text);
  wordPos.push(flat.length);
  flat += n;
  for (let k = 0; k < n.length; k++) owner.push(i);
});

/** Finds a cue at or after `from`; returns its position and the time it is spoken. */
const findCue = (cue: string, from: number): { pos: number; time: number } => {
  const n = norm(cue);
  const pos = flat.indexOf(n, from);
  if (pos < 0) throw new Error(`cue not found after position ${from}: "${cue}"`);
  const wi = owner[pos];
  const w = words[wi];
  // CJK aligners give clause-level times only, so interpolate inside the clause.
  const len = norm(w.text).length || 1;
  const frac = (pos - wordPos[wi]) / len;
  return { pos, time: +(w.start + (w.end - w.start) * frac).toFixed(3) };
};

let cursor = 0;
const scenes: SceneSpec[] = [];
for (const s of script.scenes) {
  const c = findCue(s.cue, cursor);
  let last = c.pos;
  const beats = (s.beats ?? [s.cue]).map((b) => {
    const r = findCue(b, c.pos);
    last = Math.max(last, r.pos);
    return r.time;
  });
  cursor = last + 1;
  scenes.push({ kind: s.kind, start: c.time, end: 0, beats, props: s.props } as SceneSpec);
}
// Scenes start a touch before their cue so the visual lands with the word.
const LEAD = 0.18;
scenes.forEach((s, i) => {
  s.start = i === 0 ? 0 : Math.max(0, +(s.start - LEAD).toFixed(3));
});
scenes.forEach((s, i) => {
  s.end = i < scenes.length - 1 ? scenes[i + 1].start : timings.durationSec + 1.2;
});

/** Merge spoken forms into their written form (one caption word spanning several spoken words). */
const mergeSpoken = (input: Word[]): Word[] => {
  const chunk = input.map((w) => ({ ...w }));
  for (const [from, to] of script.captionReplace ?? []) {
    const target = norm(from);
    for (let i = 0; i < chunk.length; i++) {
      let acc = "";
      for (let j = i; j < chunk.length && acc.length < target.length; j++) {
        acc += norm(chunk[j].text);
        if (acc === target) {
          const lead = (chunk[i].text.match(/^[^\p{L}\p{N}]*/u) ?? [""])[0];
          const trail = (chunk[j].text.match(/[.,?!。，？！]+$/u) ?? [""])[0];
          chunk.splice(i, j - i + 1, { text: lead + to + trail, start: chunk[i].start, end: chunk[j].end });
          break;
        }
      }
    }
  }
  return chunk;
};

// Captions: short chunks, broken at sentence ends or every few words.
const isCjk = (t: string) => /[㐀-鿿]/.test(t);
const captions: Caption[] = [];
let chunk: Word[] = [];
const flush = () => {
  if (!chunk.length) return;
  const text = chunk.reduce((acc, w, i) => {
    if (i === 0) return w.text;
    const prev = chunk[i - 1].text;
    const tight = isCjk(prev.slice(-1)) && isCjk(w.text.slice(0, 1));
    return acc + (tight ? "" : " ") + w.text;
  }, "");
  captions.push({
    text: (script.captionReplace ?? []).reduce(
      (t, [from, to]) => t.split(from).join(to),
      isCjk(text) ? text.replace(/[，。、]$/u, "").replace(/\s+/g, " ") : text,
    ),
    start: chunk[0].start,
    end: chunk[chunk.length - 1].end,
    words: chunk.map((w) => ({ ...w })),
  });
  chunk = [];
};
const capWords = mergeSpoken(words);
// Re-join words the aligner split on a hyphen ("visa-" + "free.").
for (let i = capWords.length - 2; i >= 0; i--) {
  if (capWords[i].text.endsWith("-")) {
    capWords.splice(i, 2, { text: capWords[i].text + capWords[i + 1].text, start: capWords[i].start, end: capWords[i + 1].end });
  }
}
const endsSentence = (t: string) => /[.?!。？！，,:]$/u.test(t);
capWords.forEach((w, idx) => {
  chunk.push(w);
  const text = chunk.map((x) => x.text).join("");
  if (isCjk(text)) {
    if (endsSentence(w.text) && Array.from(text).length >= 4) flush();
    return;
  }
  if (endsSentence(w.text)) return flush();
  // Break long sentences, but never leave one or two words dangling on their own.
  let left = 0;
  for (let k = idx + 1; k < capWords.length; k++) {
    left++;
    if (endsSentence(capWords[k].text)) break;
  }
  if (chunk.length >= 4 && left > 2) flush();
});
flush();

const spec: VideoSpec = {
  slug: script.slug,
  locale: script.locale,
  topic: script.topic,
  voice: script.voice,
  music: script.music,
  musicVolume: script.musicVolume,
  durationSec: +(timings.durationSec + 1.2).toFixed(2),
  scenes,
  captions,
};
const out = path.join(root, script.out);
fs.writeFileSync(out, JSON.stringify(spec, null, 1));
console.log(`wrote ${path.relative(root, out)}: ${scenes.length} scenes, ${captions.length} captions, ${spec.durationSec}s`);
