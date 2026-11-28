"""VIZA daily short: the next topic in topics.json -> script, voice, render -> YouTube Shorts,
Instagram Reels, Facebook Reels and TikTok. Same shape as GrooveSheet's pipelines/shorts/daily.py:
launchd on Robert, one new topic per run plus catch-up, a JSONL ledger row per platform, a
platform without its credentials file is skipped, two tries per platform per topic, Telegram summary.

    cd viza-fe/social-video/pipeline
    python daily.py --dry-run              # make the next topic's video, post nothing
    python daily.py --topic sg-arrival-card --only youtube,instagram
    python daily.py                        # what launchd runs; posts only if posting.json says so

Posting is OFF until Edward approves the samples: posting.json {"enabled": false}. With it off a
run still renders and sends the video to Telegram for review, and records nothing as posted.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import subprocess
import sys
import traceback
from pathlib import Path

HERE = Path(__file__).resolve().parent
VIDEO = HERE.parent
sys.path.insert(0, str(HERE))

from platforms import meta, telegram, youtube, zernio  # noqa: E402

LEDGER = HERE / "runs" / "ledger.jsonl"
POSTING = HERE / "posting.json"
TOPICS = HERE / "topics.json"
PLAN = HERE / "plan.json"
PLATFORMS = ["youtube", "instagram", "facebook", "tiktok"]
CREDS = {
    "youtube": HERE / "credentials/youtube_token.json",
    "instagram": HERE / "credentials/meta.json",
    "facebook": HERE / "credentials/meta.json",
    "tiktok": HERE / "credentials/zernio.json",
}
MAX_FAILS = 2
DISCLAIMER = {
    "en": "VIZA is not a government agency. Always check the official source before you travel.",
    "zh": "VIZA 并非政府机构，出行前请以官方信息为准。",
}
FREE_LINE = {
    "en": "VIZA's visa help is free. Government fees are paid directly to the issuing authority.",
    "zh": "VIZA 的签证服务免费，政府签证费直接付给签发机构。",
}
DASHES = "[" + chr(0x2013) + chr(0x2014) + "]"
BANNED = re.compile(DASHES + r"|guarantee|\b(fast|quick|express|same[- ]day|instant)\b|保证|包过|加急|极速", re.I)


def now() -> str:
    return dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).isoformat(timespec="seconds")


def ledger() -> list[dict]:
    if not LEDGER.exists():
        return []
    return [json.loads(x) for x in LEDGER.read_text().splitlines() if x.strip()]


def record(row: dict) -> None:
    LEDGER.parent.mkdir(parents=True, exist_ok=True)
    with LEDGER.open("a") as f:
        f.write(json.dumps({"at": now(), **row}, ensure_ascii=False) + "\n")


def posting() -> dict:
    cfg = {"enabled": False, "platforms": PLATFORMS}
    if POSTING.exists():
        cfg.update(json.loads(POSTING.read_text()))
    return cfg


def configured(p: str) -> bool:
    return CREDS[p].exists()


def status(topic: str, lang: str, platform: str, rows: list[dict]) -> str:
    mine = [r for r in rows if r.get("topic") == topic and r.get("lang") == lang and r.get("platform") == platform]
    if any(r["status"] == "posted" for r in mine):
        return "posted"
    if sum(r["status"] == "failed" for r in mine) >= MAX_FAILS:
        return "gave_up"
    return "due"


def caption(topic: dict, lang: str) -> dict:
    """Title + caption from the reviewed script. Facts come from the script, which came from the site."""
    s = json.loads((VIDEO / f"scripts/scripts-in/{topic['id']}-{lang}.json").read_text())
    spoken = re.sub(r"\[[^\]]*\]\s*", "", s["voiceText"]).strip()
    # Split only where a sentence really ends (a stop then a space), so "ica.gov.sg" stays whole.
    sentences = re.split(r"(?<=[.?!])\s+|(?<=[。？！])", spoken)
    # Drop the spoken URL sign-off; the caption carries the real link.
    sentences = [x.strip() for x in sentences if x.strip() and not re.search(r"dot com|点 ?com|免费查询", x, re.I)]
    hook = next((sc["props"] for sc in s["scenes"] if sc["kind"] == "hook"), {})
    title = (hook.get("kicker", "") + (" " if lang == "en" else "") + hook.get("turn", "")).strip() or sentences[0]
    body = (" " if lang == "en" else "").join(sentences)
    tags = " ".join(topic.get("hashtags", []) + (["#VIZA", "#Shorts"] if lang == "en" else ["#VIZA"]))
    more = "Full guide" if lang == "en" else "详细指南"
    text = f"{body}\n\n{FREE_LINE[lang]}\n{more}: {topic['link']}\n\n{DISCLAIMER[lang]}\n\n{tags}"
    bad = BANNED.search(title + text)
    if bad:
        raise RuntimeError(f"caption breaks the copy rules ({bad.group(0)!r}); fix the script")
    return {"title": title[:95], "text": text, "tags": [t.lstrip("#") for t in topic.get("hashtags", [])]}


def style_for(topic: dict, rows: list[dict], cfg: dict) -> str:
    """A/B test: every new topic takes the next style in turn, so consecutive posts differ and each
    style meets every kind of topic. A topic already started keeps its style for catch-up posts."""
    styles = cfg.get("styles") or ["remotion"]
    mine = [r.get("style") for r in rows if r.get("topic") == topic["id"] and r.get("style")]
    if mine:
        return mine[-1]
    started = []
    for r in rows:
        if r.get("style") and r["topic"] not in started:
            started.append(r["topic"])
    return styles[len(started) % len(styles)]


def ordered(topics: list[dict]) -> list[dict]:
    """plan.json (written by the VIZA OpenClaw agent) puts its picks first and can hold topics back."""
    if not PLAN.exists():
        return topics
    plan = json.loads(PLAN.read_text())
    skip = set(plan.get("skip", []))
    by_id = {t["id"]: t for t in topics}
    first = [by_id[i] for i in plan.get("next", []) if i in by_id and i not in skip]
    return first + [t for t in topics if t not in first and t["id"] not in skip]


def mp4_path(topic_id: str, lang: str, style: str) -> Path:
    return VIDEO / ("out/viza-%s-%s%s.mp4" % (topic_id, lang, "" if style == "remotion" else "-" + style))


def render(topic_id: str, keep_script: bool, style: str) -> None:
    cmd = [str(VIDEO / "scripts/make-short.sh"), topic_id] + (["--keep-script"] if keep_script else [])
    subprocess.run(cmd, check=True, cwd=VIDEO, env={**os.environ, "STYLE": style})


def post(platform: str, mp4: Path, cap: dict) -> dict:
    if platform == "youtube":
        vid = youtube.upload(mp4, title=cap["title"], description=cap["text"], tags=cap["tags"] + ["VIZA", "visa"],
                             privacy="public", category_id="19")  # 19 = Travel & Events
        return {"id": vid, "url": f"https://youtube.com/shorts/{vid}"}
    if platform == "instagram":
        r = meta.upload_instagram_reel(mp4, caption=cap["text"])
        return {"id": r["media_id"], "url": r.get("url")}
    if platform == "facebook":
        r = meta.upload_facebook_reel(mp4, description=cap["text"])
        return {"id": r["video_id"], "url": r.get("url")}
    if platform == "tiktok":
        r = zernio.upload_tiktok(mp4, caption=cap["text"])
        return {"id": r.get("post_id"), "url": r.get("url")}
    raise ValueError(platform)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="render only, post nothing")
    ap.add_argument("--topic", help="limit the run to one topic id")
    ap.add_argument("--only", help="comma list of platforms")
    ap.add_argument("--keep-script", action="store_true", help="reuse an edited script and an existing MP4")
    ap.add_argument("--caption", help="print the caption for a topic id and exit")
    ap.add_argument("--style", help="force one style slug (default: rotate posting.json styles)")
    a = ap.parse_args()

    os.chdir(HERE)  # the vendored platform modules read credentials/ relative to the cwd
    topics = json.loads(TOPICS.read_text())["topics"]
    all_topics = list(topics)
    if a.caption:
        t = next(t for t in topics if t["id"] == a.caption)
        for lang in t["langs"]:
            print(json.dumps(caption(t, lang), ensure_ascii=False, indent=1))
        return 0
    cfg = posting()
    live = cfg["enabled"] and not a.dry_run
    wanted = [p for p in (a.only.split(",") if a.only else cfg["platforms"]) if p in PLATFORMS]
    active = [p for p in wanted if configured(p)]
    topics = [t for t in topics if t["id"] == a.topic] if a.topic else ordered(topics)
    rows = ledger()
    # A topic whose render failed twice is dropped from the queue (the agent sees it in the ledger).
    broken = {t["id"] for t in topics if sum(r.get("topic") == t["id"] and r.get("platform") == "render"
                                             and r.get("status") == "failed" for r in rows) >= 2}
    topics = [t for t in topics if t["id"] not in broken]

    # One new topic per run, plus catch-up for topics already started that still have platforms due.
    started = {r["topic"] for r in rows if r.get("status") in ("posted", "failed") and r.get("platform") != "render"}
    queue: list[dict] = []
    for t in topics:
        due = any(status(t["id"], lang, p, rows) == "due" for lang in t["langs"] for p in active)
        if t["id"] in started and due:
            queue.append(t)
    fresh = next((t for t in topics if t["id"] not in started and t not in queue), None)
    if fresh:
        queue.append(fresh)
    if not live:
        queue = [fresh] if fresh else queue[:1]

    lines = [f"<b>VIZA shorts</b> {'LIVE' if live else 'review only, posting off'} {now()[:16]}"]
    for t in queue:
        style = a.style or style_for(t, rows, cfg)
        try:
            have = all(mp4_path(t["id"], lang, style).exists() for lang in t["langs"])
            if not (have and a.keep_script):
                render(t["id"], a.keep_script, style)
        except Exception as e:  # noqa: BLE001
            record({"topic": t["id"], "lang": "*", "platform": "render", "status": "failed", "style": style, "error": str(e)[:300]})
            lines.append(f"{t['id']}: render failed: {str(e)[:200]}")
            continue
        for lang in t["langs"]:
            mp4 = mp4_path(t["id"], lang, style)
            cap = caption(t, lang)
            if not live:
                try:
                    telegram.send_video(mp4, caption=f"VIZA review: {t['id']} ({lang}, {style})\n\n{cap['title']}"[:1000])
                except Exception as e:  # noqa: BLE001
                    lines.append(f"telegram video failed: {e}")
                lines.append(f"{t['id']} ({lang}): rendered for review, nothing posted")
                continue
            for p in active:
                if status(t["id"], lang, p, rows) != "due":
                    continue
                try:
                    r = post(p, mp4, cap)
                    record({"topic": t["id"], "lang": lang, "platform": p, "status": "posted", "style": style, **r})
                    lines.append(f"{t['id']} ({lang}) {p}: {r.get('url') or r.get('id')}")
                except Exception as e:  # noqa: BLE001
                    record({"topic": t["id"], "lang": lang, "platform": p, "status": "failed", "style": style, "error": str(e)[:300]})
                    lines.append(f"{t['id']} ({lang}) {p}: FAILED {str(e)[:160]}")
                    traceback.print_exc()
    skipped = [p for p in wanted if p not in active]
    if skipped:
        lines.append("not connected yet: " + ", ".join(skipped))
    if not queue:
        lines.append("queue empty: add topics to pipeline/topics.json")
    msg = "\n".join(lines)
    print(msg)
    try:
        telegram.send_message(msg)
    except Exception as e:  # noqa: BLE001
        print(f"telegram failed: {e}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
