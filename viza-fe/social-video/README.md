# VIZA social video

Turns a VIZA blog post into 9:16 short-form videos (TikTok, Reels, Shorts, Xiaohongshu) in English and Simplified Chinese. Built on [Remotion](https://www.remotion.dev): every frame is React, so the look is VIZA's own design system rather than stock footage, and Claude can edit scenes like any other code.

## Pipeline

```
blog post (Supabase marketing_blog_posts)
  -> scripts/draft-script.ts   DeepSeek drafts EN + ZH scripts from the scene library, validated, auto-repaired
  -> human review              facts, tone, Mandarin wording (edit scripts/scripts-in/<name>-{en,zh}.json)
  -> scripts/tts.ts            ElevenLabs voice + word timings, loudness-normalised to -14 LUFS
  -> scripts/build-spec.ts     aligns scenes, animation beats and captions to the spoken words
  -> scripts/render.ts         1080x1920 H.264 MP4 in out/
```

```bash
npm install
npx tsx --env-file=../internal-website/.env.local scripts/draft-script.ts --slug <blog-slug> --name <short-name>
ELEVENLABS_API_KEY=... VIZA_VOICE_EN=... VIZA_VOICE_ZH=... npx tsx scripts/tts.ts scripts/scripts-in/<name>-en.json
npx tsx scripts/build-spec.ts scripts/scripts-in/<name>-en.json
npx tsx scripts/render.ts specs/<name>-en.json
npm run studio   # live preview and timeline scrubbing
```

Without an ElevenLabs key, voice the `voiceText` through Claude's Magnific connector (`audio_tts` with ElevenLabs v3, then `audio_timing_get`), save the MP3 to `public/voice/` and the words to `timings/` in the same shape as `timings/etias-en.json`, then run `scripts/normalize-audio.sh`. That is how the ETIAS sample was made (EN voice "Daniel Koh", Singaporean English; ZH voice "Wei Zhang").

## Scene library (`src/scenes/`)

| Kind | What it shows |
|---|---|
| `hook` | Passport booklet, EU-star ring, headline that flips on the twist |
| `acronym` | Giant letters land, stack and unfold into the full name |
| `notA` | Wrong word struck and stamped, then what it really is as a ticked form |
| `stats` | Up to three fact cards with count-ups and struck old values |
| `timeline` | Marker runs past slipped dates to the current target, with a caveat |
| `verdict` | Drawn check and the practical takeaway |
| `cta` | Navy close: logotype, question, `viza.it.com` pill, disclaimer |

Add a scene by writing a component in `src/scenes/`, adding its props to `src/spec.ts`, wiring it in `src/Short.tsx`, and describing it in `SCENE_LIBRARY` in `draft-script.ts`.

## Rules baked in

- Brand: navy `#03346E`, Switzer display, Geist body, Noto Sans SC for Chinese, no exclamation marks, no prices (VIZA is free).
- Captions come from the script and the voice timings, never from speech recognition. Spoken forms are rewritten to written ones (`captionReplace`).
- Text stays out of the top 200 px and bottom 520 px, where platform UI sits.
- Every CTA carries "VIZA is not a government agency".
- Xiaohongshu restricts accounts whose posts are fully generated and published by AI, and limits reach of unlabelled AI content: post there by hand and tick the AI-content label. TikTok, Reels and Shorts can be scheduled.

## Licence note

Remotion is free for companies of up to 3 people; from 4 it needs a company licence (from US$25 per seat per month). Check before scaling the team that runs this.
