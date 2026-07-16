#!/usr/bin/env bash
set -euo pipefail

# Read-only post-deploy probe. It proves that the country-scoped worker has a
# running Fly machine and that its readiness endpoint is reachable; it never
# enqueues an applicant job or touches an official portal.
country="${1:?country is required}"
app="viza-runner-$country"

fly status --app "$app" >/dev/null
url="https://${app}.fly.dev/ready"
body="$(curl --fail --silent --show-error --max-time 20 "$url")"
if ! grep -Eq '"status"[[:space:]]*:[[:space:]]*"ready"' <<<"$body"; then
  echo "Readiness probe returned an unexpected response for $app" >&2
  exit 1
fi
echo "[deploy] $app is ready"
