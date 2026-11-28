# Vendored from groovesheet/groovesheet-social platforms/zernio.py @ f0c7fee (VIZA shorts runs the same posting code).
"""TikTok posting through Zernio (zernio.com), for the 9:16 shorts.

Zernio's TikTok app is already audited, so a video goes up PUBLIC straight
away, which our own TikTok app (platforms/tiktok.py) cannot do until TikTok
approves it. GrooveSheet's Zernio workspace is the same one the blog publisher
uses for LinkedIn; TikTok holds its second free account slot (Facebook moved to
the Graph API on 2026-10-18 to make room).

credentials/zernio.json: {"api_key": "...", "tiktok_account_id": "..."}
(`--check` fills in the account id from the API when it is missing.)
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import requests

CREDS = Path("credentials/zernio.json")
API = "https://zernio.com/api/v1"


def _c() -> dict:
    if not CREDS.exists():
        raise RuntimeError(f"missing {CREDS}")
    return json.loads(CREDS.read_text())


def _h(c: dict) -> dict:
    return {"Authorization": f"Bearer {c['api_key']}"}


def tiktok_account(c: dict) -> str:
    if c.get("tiktok_account_id"):
        return c["tiktok_account_id"]
    r = requests.get(f"{API}/accounts", params={"platform": "tiktok"}, headers=_h(c), timeout=30)
    r.raise_for_status()
    acc = next((a for a in r.json().get("accounts", []) if a.get("platform") == "tiktok" and a.get("isActive", True)), None)
    if not acc:
        raise RuntimeError("no TikTok account is connected in Zernio")
    c["tiktok_account_id"] = acc.get("_id") or acc.get("id")
    CREDS.write_text(json.dumps(c, indent=2))
    CREDS.chmod(0o600)
    return c["tiktok_account_id"]


def _upload(c: dict, mp4: Path, content_type: str = "video/mp4") -> str:
    """Presigned upload to Zernio's media store; returns the public URL."""
    size = mp4.stat().st_size
    p = requests.post(f"{API}/media/presign", headers=_h(c), timeout=30,
                      json={"filename": mp4.name, "contentType": content_type, "size": size})
    p.raise_for_status()
    j = p.json()
    put = requests.put(j["uploadUrl"], data=mp4.read_bytes(), headers={"Content-Type": content_type}, timeout=600)
    if put.status_code not in (200, 201, 204):
        raise RuntimeError(f"Zernio media upload: HTTP {put.status_code} {put.text[:200]}")
    return j["publicUrl"]


def public_url(path: Path, content_type: str) -> str:
    """Host any file (e.g. a reel cover for Instagram's cover_url) publicly."""
    return _upload(_c(), path, content_type)


def upload_tiktok(mp4: Path, *, caption: str, dry_run: bool = False, cover_url: str | None = None) -> dict:
    c = _c()
    account = tiktok_account(c)
    body = {
        "content": caption[:2200],
        "mediaItems": [{"type": "video", "url": _upload(c, mp4) if not dry_run else "https://example.com/x.mp4"}],
        "platforms": [{"platform": "tiktok", "accountId": account}],
        "tiktokSettings": {
            # Business-app connections publish videos public-only; TikTok
            # requires every interaction flag and both consent flags.
            "privacy_level": "PUBLIC_TO_EVERYONE",
            "allow_comment": True, "allow_duet": True, "allow_stitch": True,
            "video_cover_timestamp_ms": 1000,
            "content_preview_confirmed": True, "express_consent_given": True,
        },
        "publishNow": True,
    }
    if cover_url:
        # Zernio's own field: a custom cover image, overriding the frame pick.
        body["tiktokSettings"]["video_cover_image_url"] = cover_url
    if dry_run:
        body["dryRun"] = True
    r = requests.post(f"{API}/posts", headers=_h(c), json=body, timeout=600)
    try:
        j = r.json()
    except ValueError:
        raise RuntimeError(f"Zernio {r.status_code}: {r.text[:300]}")
    if dry_run:
        return j
    post = j.get("post") or {}
    entry = next((p for p in post.get("platforms", []) if p.get("platform") == "tiktok"), {})
    # 207 = created but the platform rejected it; still a 2xx.
    if r.status_code >= 400 or post.get("status") == "failed" or entry.get("status") == "failed":
        raise RuntimeError(f"Zernio TikTok post failed ({r.status_code}): "
                           f"{entry.get('errorMessage') or j.get('error') or str(j)[:300]}")
    return {"post_id": post.get("_id"), "status": entry.get("status"), "privacy": "PUBLIC_TO_EVERYONE",
            "url": entry.get("platformPostUrl")}


def check() -> dict:
    c = _c()
    account = tiktok_account(c)
    r = requests.get(f"{API}/accounts/{account}/tiktok/creator-info", params={"mediaType": "video"},
                     headers=_h(c), timeout=30)
    info = r.json() if r.ok else {"error": r.text[:200]}
    return {"account_id": account, "creator": (info.get("creator") or {}).get("nickname"),
            "can_post_more": (info.get("creator") or {}).get("canPostMore"),
            "privacy_levels": [p.get("value") for p in info.get("privacyLevels", [])]}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    if ap.parse_args().check:
        print(json.dumps(check(), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
