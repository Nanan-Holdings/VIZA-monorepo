# Vendored from groovesheet/groovesheet-social platforms/telegram.py @ f0c7fee (VIZA shorts runs the same posting code).
"""Telegram Bot API client — used for the pre-publish review channel.

Reads credentials/telegram.json:
    {
      "bot_token": "<from @BotFather>",
      "review_chat_id": -100<channel-id>,   # int, negative for supergroups
      "review_thread_id": <topic-id>        # int, the forum topic
    }
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from pathlib import Path

import requests

log = logging.getLogger(__name__)

CREDS_PATH = Path("credentials/telegram.json")


@dataclass
class TelegramConfig:
    bot_token: str
    review_chat_id: int
    review_thread_id: int | None = None


def load_config() -> TelegramConfig:
    if CREDS_PATH.exists():
        d = json.loads(CREDS_PATH.read_text())
        return TelegramConfig(
            bot_token=d["bot_token"],
            review_chat_id=int(d["review_chat_id"]),
            review_thread_id=int(d["review_thread_id"]) if d.get("review_thread_id") else None,
        )
    tok = os.environ.get("TELEGRAM_BOT_TOKEN")
    chat = os.environ.get("TELEGRAM_REVIEW_CHAT_ID")
    if not tok or not chat:
        raise RuntimeError(
            "Telegram not configured (credentials/telegram.json or TELEGRAM_BOT_TOKEN/REVIEW_CHAT_ID env)"
        )
    thread = os.environ.get("TELEGRAM_REVIEW_THREAD_ID")
    return TelegramConfig(
        bot_token=tok,
        review_chat_id=int(chat),
        review_thread_id=int(thread) if thread else None,
    )


def _api(method: str) -> str:
    return f"https://api.telegram.org/bot{load_config().bot_token}/{method}"


def _post_with_retry(method: str, *, data: dict, files: dict | None = None,
                     timeout: int = 60, attempts: int = 4) -> dict:
    """POST to the Bot API, retrying transient network failures (timeouts, reset
    connections) with exponential backoff. Telegram media uploads over a slow
    link intermittently time out; without a retry the review message is silently
    dropped — the recurring 'no telegram message' bug. Re-opens file handles per
    attempt so a retried upload re-reads from the start."""
    delay = 3
    last = None
    for i in range(1, attempts + 1):
        fh = None
        try:
            send_files = None
            if files:
                # files is {field: (name, path, mime)} — open fresh each attempt
                field, (name, path, mime) = next(iter(files.items()))
                fh = open(path, "rb")
                send_files = {field: (name, fh, mime)}
            r = requests.post(_api(method), data=data, files=send_files, timeout=timeout)
            r.raise_for_status()
            return r.json()
        except requests.exceptions.RequestException as e:
            last = repr(e)[:160]
            log.warning("telegram %s attempt %d/%d failed: %s", method, i, attempts, last)
        finally:
            if fh is not None:
                fh.close()
        if i < attempts:
            import time
            time.sleep(delay)
            delay = min(delay * 2, 30)
    raise RuntimeError(f"telegram {method} failed after {attempts} attempts: {last}")


def send_message(text: str, *, parse_mode: str = "HTML", reply_markup: dict | None = None) -> dict:
    cfg = load_config()
    data: dict[str, str | int] = {
        "chat_id": cfg.review_chat_id,
        "text": text,
        "parse_mode": parse_mode,
        "disable_web_page_preview": True,
    }
    if cfg.review_thread_id is not None:
        data["message_thread_id"] = cfg.review_thread_id
    if reply_markup is not None:
        data["reply_markup"] = json.dumps(reply_markup)
    return _post_with_retry("sendMessage", data=data, timeout=30)


def send_video(
    video_path: Path,
    *,
    caption: str,
    parse_mode: str = "HTML",
    reply_markup: dict | None = None,
) -> dict:
    cfg = load_config()
    data: dict[str, str | int] = {
        "chat_id": cfg.review_chat_id,
        "caption": caption[:1024],  # Telegram's caption limit
        "parse_mode": parse_mode,
        "supports_streaming": "true",
    }
    if cfg.review_thread_id is not None:
        data["message_thread_id"] = cfg.review_thread_id
    if reply_markup is not None:
        data["reply_markup"] = json.dumps(reply_markup)
    return _post_with_retry(
        "sendVideo", data=data,
        files={"video": (video_path.name, str(video_path), "video/mp4")},
        timeout=180,
    )


def answer_callback_query(callback_query_id: str, text: str = "", show_alert: bool = False) -> dict:
    r = requests.post(
        _api("answerCallbackQuery"),
        data={
            "callback_query_id": callback_query_id,
            "text": text[:200],
            "show_alert": "true" if show_alert else "false",
        },
        timeout=30,
    )
    r.raise_for_status()
    return r.json()


def edit_message_caption(
    chat_id: int,
    message_id: int,
    caption: str,
    *,
    parse_mode: str = "HTML",
    reply_markup: dict | None = None,
) -> dict:
    data: dict[str, str | int] = {
        "chat_id": chat_id,
        "message_id": message_id,
        "caption": caption[:1024],
        "parse_mode": parse_mode,
    }
    if reply_markup is not None:
        data["reply_markup"] = json.dumps(reply_markup)
    r = requests.post(_api("editMessageCaption"), data=data, timeout=30)
    r.raise_for_status()
    return r.json()


def edit_message_text(
    chat_id: int,
    message_id: int,
    text: str,
    *,
    parse_mode: str = "HTML",
    reply_markup: dict | None = None,
) -> dict:
    """Edit a TEXT message (no media). Used when the review message was sent as a
    text fallback (send_message) rather than a video — editMessageCaption only
    works on media messages, so the outcome edit must branch on message type."""
    data: dict[str, str | int] = {
        "chat_id": chat_id,
        "message_id": message_id,
        "text": text[:4096],
        "parse_mode": parse_mode,
        "disable_web_page_preview": True,
    }
    if reply_markup is not None:
        data["reply_markup"] = json.dumps(reply_markup)
    r = requests.post(_api("editMessageText"), data=data, timeout=30)
    r.raise_for_status()
    return r.json()


def get_updates(offset: int | None = None, timeout: int = 30) -> list[dict]:
    """Long-poll Telegram for new updates. Returns the list."""
    params: dict = {"timeout": timeout, "allowed_updates": json.dumps(["callback_query"])}
    if offset is not None:
        params["offset"] = offset
    r = requests.get(_api("getUpdates"), params=params, timeout=timeout + 10)
    r.raise_for_status()
    body = r.json()
    if not body.get("ok"):
        raise RuntimeError(f"getUpdates failed: {body}")
    return body.get("result") or []


def main() -> int:
    """`python -m platforms.telegram --check` — confirms config + posts a test message."""
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--check", action="store_true")
    args = p.parse_args()
    if args.check:
        cfg = load_config()
        log.info("config OK: chat=%s thread=%s", cfg.review_chat_id, cfg.review_thread_id)
        send_message("GrooveSheet pipeline ready ✓")
        print("posted test message to review topic")
        return 0
    p.print_help()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
