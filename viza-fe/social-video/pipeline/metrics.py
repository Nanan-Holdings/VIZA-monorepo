"""Style A/B scoreboard for VIZA shorts. Same readers as GrooveSheet's pipelines/outliers/metrics.py.

For every post in runs/ledger.jsonl that is at least 48 h old, read its views once (YouTube Data API
statistics, Instagram `views` insight, Facebook video `views`, TikTok through Zernio analytics), save
them in runs/metrics.jsonl, and send Telegram a per-style table. Each post is compared with the
median of its own platform, so a strong platform does not flatter the style that happened to land there.

    python metrics.py            # collect + send the scoreboard
    python metrics.py --print    # collect + print only
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import statistics
import sys
from pathlib import Path

import requests

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
os.chdir(HERE)

from platforms import telegram, youtube, zernio  # noqa: E402

LEDGER = HERE / "runs" / "ledger.jsonl"
METRICS = HERE / "runs" / "metrics.jsonl"
AGE_H = 48


def rows(p: Path) -> list[dict]:
    return [json.loads(x) for x in p.read_text().splitlines() if x.strip()] if p.exists() else []


def meta() -> tuple[str, str]:
    c = json.loads((HERE / "credentials/meta.json").read_text())
    return f"https://graph.facebook.com/{c.get('graph_version', 'v26.0')}", c["page_token"]


def views(platform: str, pid: str) -> int | None:
    if platform == "youtube":
        r = youtube._build_service().videos().list(part="statistics", id=pid).execute()
        items = r.get("items") or []
        return int(items[0]["statistics"].get("viewCount", 0)) if items else None
    if platform == "instagram":
        g, tok = meta()
        ins = requests.get(f"{g}/{pid}/insights", params={"metric": "views", "access_token": tok}, timeout=30).json()
        for m in ins.get("data", []):
            v = (m.get("values") or [{}])[0].get("value")
            if v is not None:
                return int(v)
        return None
    if platform == "facebook":
        g, tok = meta()
        r = requests.get(f"{g}/{pid}", params={"fields": "views", "access_token": tok}, timeout=30).json()
        return int(r["views"]) if r.get("views") is not None else None
    if platform == "tiktok":
        c = zernio._c()
        j = requests.get(f"{zernio.API}/analytics", params={"postId": pid}, headers=zernio._h(c), timeout=30).json()
        for p in j.get("platformAnalytics") or []:
            a = p.get("analytics") or {}
            if p.get("platform") == "tiktok" and a.get("views") is not None:
                return int(a["views"])
        return None
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--print", action="store_true")
    a = ap.parse_args()
    now = dt.datetime.now(dt.timezone.utc)
    have = {(m["platform"], m["id"]) for m in rows(METRICS)}
    new = []
    for r in rows(LEDGER):
        if r.get("status") != "posted" or (r["platform"], r.get("id")) in have:
            continue
        if (now - dt.datetime.fromisoformat(r["at"])).total_seconds() < AGE_H * 3600:
            continue
        try:
            v = views(r["platform"], r["id"])
        except Exception as e:  # noqa: BLE001
            print(f"{r['platform']} {r['id']}: {e}")
            continue
        if v is None:
            continue
        m = {"at": now.isoformat(timespec="seconds"), "platform": r["platform"], "id": r["id"], "topic": r["topic"],
             "lang": r.get("lang"), "style": r.get("style", "remotion"), "views_48h": v}
        new.append(m)
    if new:
        METRICS.parent.mkdir(parents=True, exist_ok=True)
        with METRICS.open("a") as f:
            for m in new:
                f.write(json.dumps(m) + "\n")
    allm = rows(METRICS)
    plat_med = {p: max(1.0, statistics.median([m["views_48h"] for m in allm if m["platform"] == p]))
                for p in {m["platform"] for m in allm}}
    by_style: dict[str, list[float]] = {}
    for m in allm:
        by_style.setdefault(m["style"], []).append(m["views_48h"] / plat_med[m["platform"]])
    lines = ["<b>VIZA shorts: style scoreboard</b> (views at 48 h vs platform median, 1.0 = typical)"]
    for s, v in sorted(by_style.items(), key=lambda kv: -statistics.median(kv[1])):
        lines.append(f"{s}: {statistics.median(v):.2f} over {len(v)} posts")
    if not by_style:
        lines.append("no posts old enough yet")
    msg = "\n".join(lines)
    print(msg)
    if not a.print and new:
        telegram.send_message(msg)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
