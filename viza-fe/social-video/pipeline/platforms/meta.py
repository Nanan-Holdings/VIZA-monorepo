# Vendored from groovesheet/groovesheet-social platforms/meta.py @ f0c7fee (VIZA shorts runs the same posting code).
"""Instagram Reels + Facebook Page Reels through the Graph API, for the shorts.

App: "GrooveSheet Shorts Publisher" (Meta for Developers, GrooveSheet business
portfolio), use cases "Manage messaging & content on Instagram" and "Manage
everything on your Page". In development mode the app's admins can publish to
their own Page and Instagram account without App Review.

credentials/meta.json:
    {"graph_version": "v26.0", "page_id": "...", "page_token": "...",
     "ig_user_id": "..."}

`page_token` is a Page access token derived from a LONG-LIVED user token, which
makes it non-expiring; it carries instagram_content_publish for the Instagram
account linked to the Page. `python -m platforms.meta --check` prints what the
token can see.

Both uploads are resumable (rupload.facebook.com), so the video never needs a
public URL.
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import requests

CREDS = Path("credentials/meta.json")


def _c() -> dict:
    if not CREDS.exists():
        raise RuntimeError(f"missing {CREDS}; see platforms/meta.py")
    c = json.loads(CREDS.read_text())
    c.setdefault("graph_version", "v26.0")
    return c


def _graph(c: dict) -> str:
    return f"https://graph.facebook.com/{c['graph_version']}"


def _ok(r: requests.Response, what: str) -> dict:
    try:
        j = r.json()
    except ValueError:
        raise RuntimeError(f"{what}: HTTP {r.status_code} {r.text[:200]}")
    if r.status_code >= 400 or "error" in j:
        e = j.get("error", {})
        raise RuntimeError(f"{what}: {e.get('code')} {e.get('error_subcode', '')} {e.get('message', r.text[:200])}")
    return j


def upload_instagram_reel(mp4_path: Path, *, caption: str, share_to_feed: bool = True,
                          cover_url: str | None = None, trial: str | None = None) -> dict:
    """`cover_url`: a public JPEG Instagram downloads itself (9:16; the profile
    grid shows its centre 3:4).

    `trial`: post as a Trial reel, shown to non-followers first. "MANUAL" keeps
    it a trial until it is shared to followers in the app; "SS_PERFORMANCE"
    lets Instagram share it to followers when it performs well."""
    c = _c()
    g, tok = _graph(c), c["page_token"]
    data = {
        "media_type": "REELS", "upload_type": "resumable", "caption": caption[:2200],
        "share_to_feed": "true" if share_to_feed else "false", "access_token": tok,
    }
    if cover_url:
        data["cover_url"] = cover_url
    if trial:
        data["trial_params"] = json.dumps({"graduation_strategy": trial})
    container = _ok(requests.post(f"{g}/{c['ig_user_id']}/media", timeout=60, data=data), "IG create container")
    cid = container["id"]
    size = mp4_path.stat().st_size
    _ok(requests.post(f"https://rupload.facebook.com/ig-api-upload/{c['graph_version']}/{cid}", timeout=600,
                      data=mp4_path.read_bytes(), headers={
                          "Authorization": f"OAuth {tok}", "offset": "0", "file_size": str(size)}),
        "IG upload")
    # Instagram transcodes before the container can be published.
    status = ""
    for _ in range(60):
        time.sleep(5)
        s = _ok(requests.get(f"{g}/{cid}", timeout=30, params={"fields": "status_code,status", "access_token": tok}),
                "IG container status")
        status = s.get("status_code", "")
        if status in ("FINISHED", "ERROR", "EXPIRED"):
            break
    if status != "FINISHED":
        raise RuntimeError(f"IG container {cid} ended {status or 'unfinished'}")
    pub = _ok(requests.post(f"{g}/{c['ig_user_id']}/media_publish", timeout=60,
                            data={"creation_id": cid, "access_token": tok}), "IG publish")
    media = _ok(requests.get(f"{g}/{pub['id']}", timeout=30, params={"fields": "permalink", "access_token": tok}),
                "IG permalink")
    return {"media_id": pub["id"], "url": media.get("permalink")}


def upload_facebook_reel(mp4_path: Path, *, description: str, thumbnail: Path | None = None) -> dict:
    c = _c()
    g, tok, page = _graph(c), c["page_token"], c["page_id"]
    start = _ok(requests.post(f"{g}/{page}/video_reels", timeout=60,
                              data={"upload_phase": "start", "access_token": tok}), "FB reel start")
    vid = start["video_id"]
    size = mp4_path.stat().st_size
    _ok(requests.post(f"https://rupload.facebook.com/video-upload/{c['graph_version']}/{vid}", timeout=600,
                      data=mp4_path.read_bytes(), headers={
                          "Authorization": f"OAuth {tok}", "offset": "0", "file_size": str(size)}),
        "FB reel upload")
    _ok(requests.post(f"{g}/{page}/video_reels", timeout=60, data={
        "upload_phase": "finish", "video_id": vid, "video_state": "PUBLISHED",
        "description": description[:2200], "access_token": tok,
    }), "FB reel finish")
    # Publishing continues after `finish`; report where it lands.
    for _ in range(36):
        time.sleep(5)
        s = _ok(requests.get(f"{g}/{vid}", timeout=30, params={"fields": "status,permalink_url", "access_token": tok}),
                "FB reel status")
        st = (s.get("status") or {})
        phase = (st.get("publishing_phase") or {}).get("status")
        if st.get("video_status") == "error" or phase == "error":
            raise RuntimeError(f"FB reel {vid} failed: {st}")
        if phase == "complete":
            break
    link = s.get("permalink_url") or ""
    cover = None
    if thumbnail:
        # The reels flow has no cover field; the video's thumbnails edge takes a
        # preferred image. Best effort: a failure here must not fail the post.
        try:
            with thumbnail.open("rb") as f:
                _ok(requests.post(f"{g}/{vid}/thumbnails", timeout=120, files={"source": (thumbnail.name, f, "image/jpeg")},
                                  data={"is_preferred": "true", "access_token": tok}), "FB reel thumbnail")
            cover = "set"
        except Exception as e:  # noqa: BLE001
            cover = f"failed: {str(e)[:120]}"
    return {"video_id": vid, "url": ("https://www.facebook.com" + link) if link.startswith("/") else link or None,
            "cover": cover}


def check() -> dict:
    c = _c()
    g, tok = _graph(c), c["page_token"]
    page = _ok(requests.get(f"{g}/{c['page_id']}", timeout=30, params={
        "fields": "name,instagram_business_account{id,username}", "access_token": tok}), "page")
    dbg = _ok(requests.get(f"{g}/debug_token", timeout=30, params={"input_token": tok, "access_token": tok}),
              "debug_token").get("data", {})
    return {"page": page.get("name"), "instagram": page.get("instagram_business_account"),
            "scopes": dbg.get("scopes"), "expires_at": dbg.get("expires_at")}


def save_from_user_token(user_token: str, page_name: str = "GrooveSheet", version: str = "v26.0") -> dict:
    """Turn a LONG-LIVED user token (Access Token Debugger > Extend Access Token)
    into credentials/meta.json: the Page's own token, which then never expires,
    plus the Instagram account linked to that Page, if any."""
    g = f"https://graph.facebook.com/{version}"
    pages = _ok(requests.get(f"{g}/me/accounts", timeout=30, params={
        "fields": "id,name,access_token,instagram_business_account{id,username}", "access_token": user_token,
    }), "me/accounts").get("data", [])
    page = next((p for p in pages if p.get("name") == page_name), None)
    if not page:
        raise RuntimeError(f"no Page named {page_name!r} among {[p.get('name') for p in pages]}")
    ig = page.get("instagram_business_account") or {}
    cur = json.loads(CREDS.read_text()) if CREDS.exists() else {}
    cur.update(graph_version=version, page_id=page["id"], page_token=page["access_token"])
    if ig.get("id"):
        cur["ig_user_id"] = ig["id"]
    CREDS.parent.mkdir(parents=True, exist_ok=True)
    CREDS.write_text(json.dumps(cur, indent=2))
    CREDS.chmod(0o600)
    return {"page": page["name"], "page_id": page["id"], "instagram": ig.get("username")}


def main() -> int:
    import sys
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--save-from-user-token", action="store_true",
                    help="read a long-lived user token on stdin (e.g. `pbpaste |`) and write credentials/meta.json")
    a = ap.parse_args()
    if a.save_from_user_token:
        print(json.dumps(save_from_user_token(sys.stdin.read().strip()), indent=2))
    if a.check:
        print(json.dumps(check(), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
