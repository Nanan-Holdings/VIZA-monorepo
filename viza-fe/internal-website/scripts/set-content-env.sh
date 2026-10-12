#!/usr/bin/env bash
# Writes VIZA marketing server variables to the linked portal Vercel project.
# Reads local values without echoing them. A production deploy is required after use.
set -euo pipefail

APP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_ROOT="$(cd "$APP_ROOT/../.." && pwd)"
cd "$PROJECT_ROOT"
test -f .vercel/project.json || { echo "Link the repository root to the portal Vercel project first: npx vercel link"; exit 1; }

put() {
  printf '%s' "$2" | npx --yes vercel env add "$1" production --force >/dev/null
  echo "Set $1"
}

from_local() {
  local name="$1"
  local value
  value="$(sed -n "s/^${name}=//p" "$APP_ROOT/.env.local" | head -1)"
  value="${value#\"}"
  value="${value%\"}"
  test -n "$value" || { echo "Missing $name in $APP_ROOT/.env.local"; exit 1; }
  printf '%s' "$value"
}

case "${1:-}" in
  --social)
    for name in ZERNIO_API_KEY ZERNIO_ACCOUNT_ID_LINKEDIN ZERNIO_LINKEDIN_ORGANIZATION_URN ZERNIO_ACCOUNT_ID_FACEBOOK ZERNIO_FACEBOOK_PAGE_ID UPLOAD_POST_API_KEY UPLOAD_POST_USER UPLOAD_POST_PINTEREST_BOARD_ID; do
      put "$name" "$(from_local "$name")"
    done
    put ZERNIO_TIMEZONE "Asia/Singapore"
    ;;
  --clipboard)
    key="$(pbpaste | tr -d '[:space:]')"
    case "$key" in sk-*) ;; *) echo "Clipboard does not contain a DeepSeek key"; exit 1 ;; esac
    put DEEPSEEK_API_KEY "$key"
    put CRON_SECRET "$(node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))")"
    ;;
  *)
    echo "Usage: bash $APP_ROOT/scripts/set-content-env.sh --social|--clipboard"
    exit 1
    ;;
esac

echo "Values take effect after the next production deploy."
