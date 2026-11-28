"""Voice a VIZA short locally with Kokoro (Apache-2.0, runs offline, no credits).

    ~/.venvs/kokoro/bin/python scripts/tts_local.py scripts/scripts-in/<name>-<lang>.json

Writes the script's `voice` MP3 (loudness -14 LUFS) under public/ and its `timings` JSON in the
same shape as the ElevenLabs timings ({durationSec, words: [{text, start, end}]}), so
build-spec.ts works unchanged.

How the timings are made: every clause is synthesised on its own and joined with set pauses, so
clause starts and ends are exact. English words inside a clause are spread by estimated syllables
(clauses are 3 to 10 words, so a word lands within ~0.1 s). Chinese gets one timing entry per
clause, which build-spec already interpolates per character.

Models (downloaded once into ~/.cache/hyperframes/tts/models, shared with `hyperframes tts`):
  English  kokoro-v1.0.onnx + voices-v1.0.bin, misaki en G2P
  Chinese  kokoro-v1.1-zh.onnx + voices-v1.1-zh.bin, misaki zh G2P (English words via misaki en)
Venv: uv venv -p 3.12 ~/.venvs/kokoro && uv pip install --python ~/.venvs/kokoro/bin/python3 \
  kokoro-onnx soundfile "misaki[en,zh]" en_core_web_sm@<spacy wheel url>
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent
MODELS = Path(os.path.expanduser("~/.cache/hyperframes/tts/models"))
RELEASE = "https://github.com/thewh1teagle/kokoro-onnx/releases/download"
FILES = {
    "en": ("kokoro-v1.0.onnx", "voices-v1.0.bin", f"{RELEASE}/model-files-v1.0"),
    "zh": ("kokoro-v1.1-zh.onnx", "voices-v1.1-zh.bin", f"{RELEASE}/model-files-v1.1"),
}
VOICE = {"en": os.environ.get("VIZA_VOICE_EN", "af_heart"), "zh": os.environ.get("VIZA_VOICE_ZH", "zf_001")}
SPEED = {"en": float(os.environ.get("VIZA_SPEED_EN", "1.05")), "zh": float(os.environ.get("VIZA_SPEED_ZH", "1.1"))}
PAUSE_SENTENCE, PAUSE_CLAUSE, LEAD_IN = 0.32, 0.14, 0.15

# Spoken forms for the TTS only; captions and cues keep the written words.
SAY_EN = [
    (r"\bica\.gov\.sg\b", "I C A dot gov dot S G"),
    (r"\bMyICA\b", "My I C A"),
    (r"\bICA's\b", "I C A's"),
    (r"\bICA\b", "I C A"),
    (r"\bSGAC\b", "S G A C"),
    (r"\bSG\b", "S G"),
    (r"\bTDAC\b", "T D A C"),
    (r"\bMDAC\b", "M D A C"),
    (r"\bK-ETA\b", "K E T A"),
    (r"\bETA\b", "E T A"),
    (r"\bDS-160\b", "D S one sixty"),
    (r"\beVISA\b", "e visa"),
    (r"\be-[Vv]isa\b", "e visa"),
    (r"\bviza\b", "veeza"),
    (r"\bVIZA\b", "veeza"),
    (r"\bTM6\b", "T M six"),
]


def ensure_models(lang: str) -> tuple[Path, Path]:
    model, voices, base = FILES[lang]
    MODELS.mkdir(parents=True, exist_ok=True)
    for f in (model, voices):
        if not (MODELS / f).exists():
            print(f"downloading {f}")
            urllib.request.urlretrieve(f"{base}/{f}", MODELS / f)
    return MODELS / model, MODELS / voices


def clauses(text: str, lang: str) -> list[tuple[str, float]]:
    """Split on punctuation that ends a clause; keep the punctuation; never split ica.gov.sg."""
    if lang == "zh":
        parts = re.findall(r"[^，。？！；：,?!;]+[，。？！；：,?!;]?", text)
    else:
        parts = re.findall(r".+?(?:[.?!;:,](?=\s|$)|$)", text)
    out = []
    for p in (x.strip() for x in parts):
        if not p:
            continue
        end = p[-1]
        out.append((p, PAUSE_SENTENCE if end in ".?!。？！" else PAUSE_CLAUSE))
    return out


def syllables(word: str) -> float:
    w = re.sub(r"[^a-z0-9]", "", word.lower())
    if not w:
        return 0.3
    if w.isdigit():
        return 1.5 * len(w)
    if w.isupper() or len(w) <= 3 and not re.search(r"[aeiouy]", w):
        return float(len(w))
    n = len(re.findall(r"[aeiouy]+", w)) - (1 if w.endswith("e") and len(w) > 3 else 0)
    return float(max(1, n))


def refine_with_whisper(mp3: Path, words: list[dict]) -> None:
    """Snap English word times to whisper's where the words match (median error ~0.1 s -> ~0.03 s).

    Optional: needs `npx hyperframes transcribe` (whisper.cpp, small.en). Unmatched words keep the
    syllable estimate, nudged to sit between their matched neighbours."""
    with tempfile.TemporaryDirectory() as d:
        try:
            subprocess.run(["npx", "-y", "hyperframes@0.9.99", "transcribe", str(mp3), "--json", "-d", d],
                           check=True, capture_output=True, timeout=600)
            heard = json.loads((Path(d) / "transcript.json").read_text())
        except Exception as e:  # noqa: BLE001
            print(f"whisper refine skipped: {e}")
            return
    norm = lambda s: re.sub(r"[^a-z0-9]", "", s.lower())  # noqa: E731
    j, hits = 0, 0
    for w in words:
        for k in range(j, min(j + 4, len(heard))):
            if norm(w["text"]) and norm(heard[k]["text"]) == norm(w["text"]):
                w["start"], w["end"] = round(heard[k]["start"], 3), round(heard[k]["end"], 3)
                j, hits = k + 1, hits + 1
                break
    for i in range(1, len(words)):
        if words[i]["start"] < words[i - 1]["start"]:
            words[i]["start"] = words[i - 1]["end"]
            words[i]["end"] = max(words[i]["end"], words[i]["start"] + 0.08)
    print(f"whisper refine: {hits}/{len(words)} words snapped")


def main() -> int:
    script_path = Path(sys.argv[1]).resolve()
    script = json.loads(script_path.read_text())
    lang = "zh" if script["locale"].startswith("zh") else "en"
    text = re.sub(r"\[[^\]]*\]\s*", "", script["voiceText"]).strip()

    from kokoro_onnx import Kokoro
    from misaki import en as misaki_en

    g_en = misaki_en.G2P(trf=False, british=False, fallback=None)

    def say_en(t: str) -> str:
        for pat, rep in SAY_EN:
            t = re.sub(pat, rep, t)
        return t

    if lang == "zh":
        from misaki import zh as misaki_zh

        g_zh = misaki_zh.ZHG2P(version="1.1", en_callable=lambda t: g_en(say_en(t))[0])
        phon = lambda t: g_zh(t)[0]  # noqa: E731
    else:
        phon = lambda t: g_en(say_en(t))[0]  # noqa: E731

    model, voices = ensure_models(lang)
    k = Kokoro(str(model), str(voices), vocab_config=None) if lang == "zh" else Kokoro(str(model), str(voices))
    sr = 24000
    pieces: list[np.ndarray] = [np.zeros(int(LEAD_IN * sr), dtype=np.float32)]
    t = LEAD_IN
    words: list[dict] = []
    for clause, pause in clauses(text, lang):
        # The URL is the one thing viewers must catch: say it a little slower.
        speed = SPEED[lang] * (0.88 if re.search(r"dot com|点 ?com", clause, re.I) else 1.0)
        audio, sr = k.create(phon(clause), voice=VOICE[lang], speed=speed, is_phonemes=True)
        audio = np.asarray(audio, dtype=np.float32)
        # Kokoro pads each clip with a little silence; trim it so clause times are tight.
        loud = np.where(np.abs(audio) > 0.01)[0]
        if len(loud):
            audio = audio[max(0, loud[0] - int(0.02 * sr)) : loud[-1] + int(0.04 * sr)]
        dur = len(audio) / sr
        if lang == "zh":
            words.append({"text": clause, "start": round(t, 3), "end": round(t + dur, 3)})
        else:
            toks = clause.split()
            weights = [syllables(say_en(w)) for w in toks]
            total = sum(weights) or 1.0
            c = t
            for w, wt in zip(toks, weights):
                d = dur * wt / total
                words.append({"text": w, "start": round(c, 3), "end": round(c + d, 3)})
                c += d
        pieces += [audio, np.zeros(int(pause * sr), dtype=np.float32)]
        t += dur + pause

    wav = np.concatenate(pieces)
    duration = round(len(wav) / sr, 3)
    voice_out = ROOT / "public" / script["voice"]
    voice_out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as d:
        raw = Path(d) / "raw.wav"
        sf.write(raw, wav, sr)
        subprocess.run(
            ["ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-i", str(raw), "-af", "loudnorm=I=-14:TP=-1.5:LRA=7",
             "-ar", "48000", "-b:a", "192k", str(voice_out)],
            check=True,
        )
    if lang == "en":
        refine_with_whisper(voice_out, words)
    timings = {"source": f"kokoro {VOICE[lang]} x{SPEED[lang]}, clause-synthesised", "durationSec": duration, "words": words}
    timings_out = ROOT / script["timings"]
    timings_out.parent.mkdir(parents=True, exist_ok=True)
    timings_out.write_text(json.dumps(timings, ensure_ascii=False, indent=1))
    print(f"voiced {script_path.name}: {duration}s, {len(words)} timing entries -> {voice_out.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
