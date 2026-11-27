# VIZA daily shorts

The VIZA version of GrooveSheet's daily shorts job: same machine, same scheduler, same posting code.

## GrooveSheet's pipeline (what this copies)

| Stage | GrooveSheet | Where it runs | Cost per video |
|---|---|---|---|
| Schedule | launchd `com.groovesheet.shorts`, 08:30 SGT, `ops/shorts-daily.sh` | Robert (Mac mini), own checkout `~/Github/GrooveSheet/gs-social-shorts` | 0 |
| Pick | `pipelines/shorts/picker.py`: week-old songs ranked by YouTube Analytics (bilibili lane by creator-centre views) | Robert | 0 |
| Material | `library_pack.py`: stems, cover, lyrics from the GrooveSheet library and LRCLIB | Robert | 0 |
| Timing | `lyrics_align.py`: Whisper small on the vocal stem | Robert | 0 (local) |
| Render | `prepare.py` + Remotion (`renderers/stem_remotion`), covers via `tools/shorts_covers.mjs` | Robert | 0 (local) |
| Post | `platforms/youtube.py` (Data API), `platforms/meta.py` (IG Reels + FB Reels, Page token), `platforms/zernio.py` (TikTok), bilibili / Douyin / Xiaohongshu web uploaders | Robert | 0, TikTok on Zernio's plan |
| Record | `runs/shorts/ledger.jsonl`, one row per platform, 2 tries per platform | Robert | 0 |
| Report | `platforms/telegram.py` summary; watchdog `com.groovesheet.watchdog` escalates to a headless Claude Code agent; post-watch on Andy checks the networks | Robert, Andy | 0 (subscription) |
| YouTube "related video" link | `platforms/andy_studio.py` briefs Andy (OpenClaw Chrome) | Andy | 0 |

## VIZA's pipeline

| Stage | VIZA | Cost per video |
|---|---|---|
| Schedule | launchd `com.viza.shorts` (`ops/com.viza.shorts.plist`, 11:30 SGT) runs `ops/viza-shorts-daily.sh` on Robert | 0 |
| Pick | next topic in `topics.json` (queue from Search Console demand, facts from the site's own pages) | 0 |
| Script | `scripts/draft-topic.ts`: DeepSeek writes the scene script from the topic's source files only, `scripts/script-rules.ts` checks it (length, VIZA facts, no approval or speed claims, no money amounts, no dashes) and asks for fixes | about US$0.002 |
| Voice | `scripts/tts_local.py`: Kokoro (EN `af_heart`, ZH `zf_001`), clause timings snapped to whisper words | 0 (local) |
| Spec | `scripts/build-spec.ts` (unchanged) | 0 |
| Render | `styles/<slug>/build.sh` (Lemo Opuscar looks: silkscreen-poster, ascii-crt, precise-mechanism) or the original Remotion scenes | 0 (local) |
| Post | GrooveSheet's `platforms/` modules, vendored in `pipeline/platforms/` | 0 |
| Record | `runs/ledger.jsonl` (topic, lang, platform, style, id, url) | 0 |
| Report | Telegram summary (same bot as GrooveSheet); `metrics.py` scores each style at 48 h | 0 |

Posting is off (`posting.json` `enabled: false`) until Edward approves samples and a rhythm.

## Accounts (checked 27 Nov 2026)

| Network | Account | Connected for posting |
|---|---|---|
| Facebook | VIZA Page 1295218977003879 | Yes: never-expiring Page token from the "Kelin Social Publisher" Meta app (`~/.config/kelin/social/page-1295218977003879.env`) |
| Instagram | @viza_com (17841447940558846) | Yes: same token, `instagram_content_publish` |
| YouTube | @viza_com (UCpuXOccUlIDfniCYQqBt9CQ) | Yes since 27 Nov 2026: OAuth token for nanan.viza2016@gmail.com via youtube_connect.py (GrooveSheet's Desktop client) |
| TikTok | @viza_it_com | Yes since 27 Nov 2026: VIZA's Zernio (Facebook slot freed, Facebook posts direct), account 6b091f7b12016961c5daf5c3 |

## Credentials (`pipeline/credentials/`, gitignored)

- `meta.json`: `{"graph_version": "v26.0", "page_id", "page_token", "ig_user_id"}` from the page env file above.
- `youtube_oauth.json` + `youtube_token.json`: OAuth client and the VIZA channel's token (`python -m platforms.youtube --auth`).
- `zernio.json`: `{"api_key", "tiktok_account_id"}` from VIZA's Zernio workspace.
- `telegram.json`: symlink to GrooveSheet's.

## Commands

```bash
scripts/make-short.sh sg-arrival-card                    # one topic, Remotion look
STYLE=ascii-crt scripts/make-short.sh sg-arrival-card    # one topic, a Lemo style
cd pipeline && python daily.py --dry-run                 # what launchd does, without posting
python daily.py --caption sg-arrival-card                # print the captions a topic would post with
python metrics.py --print                                # style scoreboard
```
