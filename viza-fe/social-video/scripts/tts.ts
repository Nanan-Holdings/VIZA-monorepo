/**
 * Voices a script with ElevenLabs and writes the audio plus word timings the spec builder reads.
 * Needs ELEVENLABS_API_KEY. Without it, voice the script through Claude's Magnific connector
 * (audio_tts + audio_timing_get) and save the same two files by hand; see README.
 *
 *   npx tsx scripts/tts.ts scripts/scripts-in/saudi-family-en.json
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = path.resolve(__dirname, "..");
const VOICES: Record<string, string> = {
  // ElevenLabs voice ids. Pick by a blind listening test with native speakers.
  en: process.env.VIZA_VOICE_EN ?? "",
  "zh-CN": process.env.VIZA_VOICE_ZH ?? "",
};

async function main() {
  const file = process.argv[2];
  const key = process.env.ELEVENLABS_API_KEY;
  if (!file || !key) throw new Error("usage: ELEVENLABS_API_KEY=... tts <script.json>");
  const script = JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
  const voiceId = VOICES[script.locale];
  if (!voiceId) throw new Error(`set VIZA_VOICE_${script.locale === "en" ? "EN" : "ZH"} to an ElevenLabs voice id`);
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ text: script.voiceText, model_id: "eleven_v3", voice_settings: { stability: 0.5, speed: 1.1 } }),
  });
  if (!res.ok) throw new Error(`elevenlabs ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as {
    audio_base64: string;
    alignment: { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] };
  };
  const mp3 = path.join(root, "public", script.voice);
  fs.writeFileSync(mp3, Buffer.from(body.audio_base64, "base64"));
  execFileSync(path.join(root, "scripts/normalize-audio.sh"), [mp3, "-14"], { stdio: "inherit" });

  // Characters -> words (Latin) or clauses (CJK), matching what the spec builder expects.
  const a = body.alignment;
  const words: { text: string; start: number; end: number }[] = [];
  let cur = { text: "", start: 0, end: 0 };
  const cjk = script.locale === "zh-CN";
  a.characters.forEach((ch, i) => {
    if (!cur.text) cur.start = a.character_start_times_seconds[i];
    const breaker = cjk ? /[，。？！、]/.test(ch) : /\s/.test(ch);
    if (!breaker || cjk) cur.text += ch;
    cur.end = a.character_end_times_seconds[i];
    if (breaker && cur.text.trim()) {
      words.push({ ...cur, text: cur.text.trim() });
      cur = { text: "", start: 0, end: 0 };
    } else if (breaker) cur.text = "";
  });
  if (cur.text.trim()) words.push({ ...cur, text: cur.text.trim() });
  const duration = parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp3]).toString());
  fs.writeFileSync(path.join(root, script.timings), JSON.stringify({ source: "elevenlabs with-timestamps", durationSec: duration, words }, null, 1));
  console.log(`voiced ${script.voice} (${duration.toFixed(1)}s, ${words.length} words)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
