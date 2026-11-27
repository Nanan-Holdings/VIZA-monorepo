# Vendored from groovesheet/groovesheet-social platforms/youtube.py @ f0c7fee (VIZA shorts runs the same posting code).
"""YouTube Data API v3 uploader.

OAuth client + refresh token from credentials/youtube_oauth.json + youtube_token.json.

Usage:
    from platforms import youtube
    video_id = youtube.upload(Path("final.mp4"), title="...", description="...",
                              tags=["..."], privacy="private")

CLI:
    python -m platforms.youtube --auth         # one-time browser flow
    python -m platforms.youtube --check        # confirm credentials work
"""

from __future__ import annotations

import argparse
import json
import logging
import os
from pathlib import Path
from typing import Iterable

log = logging.getLogger(__name__)

SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.readonly",
    # required to update privacy status / delete videos from the review bot
    "https://www.googleapis.com/auth/youtube.force-ssl",
]
CREDS_DIR = Path("credentials")
CLIENT_FILE = CREDS_DIR / "youtube_oauth.json"
TOKEN_FILE = CREDS_DIR / "youtube_token.json"


def _build_service():
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    from googleapiclient.discovery import build

    if not TOKEN_FILE.exists():
        raise RuntimeError(
            f"missing {TOKEN_FILE}. Run: python -m platforms.youtube --auth"
        )
    creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)
    if not creds.valid:
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
            TOKEN_FILE.write_text(creds.to_json())
        else:
            raise RuntimeError("youtube creds expired and no refresh_token; re-run --auth")
    return build("youtube", "v3", credentials=creds, cache_discovery=False)


def upload(
    mp4_path: Path,
    *,
    title: str,
    description: str,
    tags: Iterable[str] | None = None,
    privacy: str = "private",
    category_id: str = "10",  # Music
) -> str:
    """Upload one MP4. Returns the YouTube video_id."""
    if os.environ.get("STEM_VIDEOS_FAKE_UPLOAD") == "1":
        fake_id = f"FAKE_{mp4_path.stem}"
        log.info("STEM_VIDEOS_FAKE_UPLOAD set, returning %s", fake_id)
        return fake_id

    from googleapiclient.http import MediaFileUpload

    yt = _build_service()
    body = {
        "snippet": {
            "title": title[:100],
            "description": description[:5000],
            "tags": list(tags or [])[:30],
            "categoryId": category_id,
        },
        "status": {
            "privacyStatus": privacy,
            "selfDeclaredMadeForKids": False,
        },
    }
    media = MediaFileUpload(str(mp4_path), chunksize=8 * 1024 * 1024, resumable=True, mimetype="video/mp4")
    req = yt.videos().insert(part="snippet,status", body=body, media_body=media)
    response = None
    while response is None:
        status, response = req.next_chunk()
        if status:
            log.info("uploading %s: %d%%", mp4_path.name, int(status.progress() * 100))
    return response["id"]


def get_snippet(video_id: str) -> dict:
    """Current snippet for a video. Used to preserve title/tags/category when
    only the description changes, and to capture a before-image for backfills."""
    if os.environ.get("STEM_VIDEOS_FAKE_UPLOAD") == "1":
        log.info("STEM_VIDEOS_FAKE_UPLOAD set, returning empty snippet for %s", video_id)
        return {}
    yt = _build_service()
    resp = yt.videos().list(part="snippet", id=video_id).execute()
    items = resp.get("items") or []
    if not items:
        raise RuntimeError(f"video {video_id} not found")
    return items[0]["snippet"]


def update_description(video_id: str, description: str) -> dict:
    """Replace only the description of an existing video.

    `videos.update(part="snippet")` replaces the WHOLE snippet, so the current
    title, tags, categoryId and default language are read back and resent
    unchanged. Sending a partial snippet would silently wipe the tags.
    Requires the `youtube.force-ssl` scope.
    """
    if os.environ.get("STEM_VIDEOS_FAKE_UPLOAD") == "1":
        log.info("STEM_VIDEOS_FAKE_UPLOAD set, skipping description update for %s", video_id)
        return {"id": video_id, "snippet": {"description": description}}

    current = get_snippet(video_id)
    snippet = {
        "title": current.get("title", "")[:100],
        "description": description[:5000],
        "categoryId": current.get("categoryId", "10"),
    }
    if current.get("tags"):
        snippet["tags"] = current["tags"][:30]
    for optional in ("defaultLanguage", "defaultAudioLanguage"):
        if current.get(optional):
            snippet[optional] = current[optional]

    yt = _build_service()
    return yt.videos().update(part="snippet", body={"id": video_id, "snippet": snippet}).execute()


def set_privacy(video_id: str, privacy: str) -> None:
    """Flip an existing video's privacyStatus. Requires `youtube.force-ssl` scope."""
    if privacy not in {"public", "unlisted", "private"}:
        raise ValueError(f"invalid privacy: {privacy}")
    yt = _build_service()
    yt.videos().update(
        part="status",
        body={"id": video_id, "status": {"privacyStatus": privacy}},
    ).execute()


def delete_video(video_id: str) -> None:
    """Delete a video. Requires `youtube.force-ssl` scope."""
    yt = _build_service()
    yt.videos().delete(id=video_id).execute()


def set_thumbnail(video_id: str, image_path: Path) -> None:
    """Set a custom thumbnail on a video (e.g. video2's cover.png). Requires the
    channel to be verified for custom thumbnails. No-op under fake upload."""
    if os.environ.get("STEM_VIDEOS_FAKE_UPLOAD") == "1":
        log.info("STEM_VIDEOS_FAKE_UPLOAD set, skipping thumbnail for %s", video_id)
        return
    from googleapiclient.http import MediaFileUpload

    yt = _build_service()
    media = MediaFileUpload(str(image_path), mimetype="image/png")
    yt.thumbnails().set(videoId=video_id, media_body=media).execute()
    log.info("set custom thumbnail on %s from %s", video_id, image_path.name)


def _auth_flow() -> None:
    from google_auth_oauthlib.flow import InstalledAppFlow
    if not CLIENT_FILE.exists():
        raise RuntimeError(f"missing {CLIENT_FILE} (download Desktop OAuth client from Google Cloud Console)")
    flow = InstalledAppFlow.from_client_secrets_file(str(CLIENT_FILE), SCOPES)
    creds = flow.run_local_server(port=0)
    TOKEN_FILE.write_text(creds.to_json())
    print(f"saved {TOKEN_FILE}")


def _check() -> None:
    yt = _build_service()
    me = yt.channels().list(part="snippet", mine=True).execute()
    items = me.get("items", [])
    if not items:
        print("no channels found for this auth")
        return
    print("authenticated as:", items[0]["snippet"]["title"])


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--auth", action="store_true")
    p.add_argument("--check", action="store_true")
    args = p.parse_args()
    if args.auth:
        _auth_flow()
        return 0
    if args.check:
        _check()
        return 0
    p.print_help()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
