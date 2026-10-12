#!/usr/bin/env bash
# Copies the marketing pipeline's provider settings from .env.local to the
# Vercel project viza-internal (Production), shows what Vercel holds before and
# after, then redeploys production so the values take effect.
#
# viza-internal lives in the VIZA Vercel account, not the Kelin team, so the CLI
# needs a token from that account. Create one at vercel.com/account/settings/tokens
# while signed in as the VIZA account (scope: viza-gmail-s-projects), and add it to
# viza-fe/internal-website/.env.local as:
#
#   VIZA_VERCEL_TOKEN=...
#
# Then:
#
#   bash viza-fe/internal-website/scripts/set-marketing-env.sh            # set, verify, redeploy
#   bash viza-fe/internal-website/scripts/set-marketing-env.sh --check    # only list what is set
#
# Values are read from the file and piped to the CLI. None is printed.
set -euo pipefail

APP="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$APP/.env.local"
SCOPE="viza-gmail-s-projects"
PROJECT="viza-internal"
NAMES=(ZERNIO_API_KEY ZERNIO_TIMEZONE ZERNIO_ACCOUNT_ID_LINKEDIN ZERNIO_LINKEDIN_ORGANIZATION_URN
       ZERNIO_ACCOUNT_ID_FACEBOOK ZERNIO_FACEBOOK_PAGE_ID UPLOAD_POST_API_KEY UPLOAD_POST_USER)

[ -f "$ENV_FILE" ] || { echo "No $ENV_FILE"; exit 1; }
from_local() { { grep -E "^$1=" "$ENV_FILE" || true; } | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"; }

TOKEN="${VIZA_VERCEL_TOKEN:-$(from_local VIZA_VERCEL_TOKEN)}"
[ -n "$TOKEN" ] || { echo "Add VIZA_VERCEL_TOKEN to $ENV_FILE first (see the top of this script)."; exit 1; }

# A throwaway directory linked to the project, so the app folder's own link is untouched.
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
cd "$WORK"
vc() { npx --yes vercel@latest "$@" --token "$TOKEN" --scope "$SCOPE"; }
vc link --yes --project "$PROJECT" >/dev/null 2>&1 || { echo "Could not link $PROJECT in $SCOPE. Is the token from the VIZA account?"; exit 1; }

report() {
  local listing; listing="$(vc env ls production 2>/dev/null)"
  for NAME in "${NAMES[@]}"; do
    if grep -qE "^\s*$NAME\s" <<<"$listing"; then echo "  ok       $NAME"; else echo "  MISSING  $NAME"; fi
  done
}

echo "On Vercel ($PROJECT, Production) now:"; report
[ "${1:-}" = "--check" ] && exit 0

echo "Setting from .env.local:"
for NAME in "${NAMES[@]}"; do
  VALUE="$(from_local "$NAME")"
  if [ -z "$VALUE" ]; then echo "  skipped  $NAME (not in .env.local)"; continue; fi
  printf '%s' "$VALUE" | vc env add "$NAME" production --force >/dev/null 2>&1 && echo "  set      $NAME" || echo "  FAILED   $NAME"
done

echo "On Vercel after:"; report

LATEST="$(vc ls "$PROJECT" --prod 2>/dev/null | grep -oE 'https://[a-z0-9.-]+\.vercel\.app' | head -1 || true)"
if [ -n "$LATEST" ]; then
  echo "Redeploying $LATEST to production..."
  vc redeploy "$LATEST" --target production >/dev/null && echo "  redeployed" || echo "  redeploy failed: redeploy the latest production deployment from the dashboard"
else
  echo "Could not find the latest production deployment: redeploy it from the dashboard."
fi
