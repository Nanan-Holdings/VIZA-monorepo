"""Connect the VIZA YouTube channel without opening a browser on Robert.

    python youtube_connect.py --url                  # prints the consent link (state saved in runs/)
    python youtube_connect.py --exchange '<url>'     # the http://localhost/?code=... address the browser landed on

Andy opens the link in his OpenClaw Chrome, signed in as the Google account that owns @viza_com, approves,
and copies the address of the page that fails to load (http://localhost/...). The exchange writes
credentials/youtube_token.json, which daily.py then uses. Client: credentials/youtube_oauth.json (the same
Desktop OAuth client GrooveSheet's shorts use).
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
os.chdir(HERE)
sys.path.insert(0, str(HERE))
os.environ.setdefault("OAUTHLIB_INSECURE_TRANSPORT", "1")  # the redirect is http://localhost by design

from google_auth_oauthlib.flow import Flow  # noqa: E402

from platforms.youtube import CLIENT_FILE, SCOPES, TOKEN_FILE  # noqa: E402

STATE = HERE / "runs" / "youtube_oauth_state.json"


def flow() -> Flow:
    return Flow.from_client_secrets_file(str(CLIENT_FILE), SCOPES, redirect_uri="http://localhost")


def main() -> int:
    if sys.argv[1:2] == ["--url"]:
        f = flow()
        url, state = f.authorization_url(access_type="offline", prompt="consent", include_granted_scopes="true")
        STATE.parent.mkdir(parents=True, exist_ok=True)
        STATE.write_text(json.dumps({"state": state, "code_verifier": getattr(f, "code_verifier", None)}))
        print(url)
        return 0
    if sys.argv[1:2] == ["--exchange"] and len(sys.argv) > 2:
        saved = json.loads(STATE.read_text())
        f = flow()
        if saved.get("code_verifier"):
            f.code_verifier = saved["code_verifier"]
        f.fetch_token(authorization_response=sys.argv[2])
        TOKEN_FILE.write_text(f.credentials.to_json())
        TOKEN_FILE.chmod(0o600)
        from platforms.youtube import _build_service
        me = _build_service().channels().list(part="snippet", mine=True).execute()
        title = (me.get("items") or [{}])[0].get("snippet", {}).get("title")
        print(f"saved {TOKEN_FILE}; channel: {title}")
        return 0
    print(__doc__)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
