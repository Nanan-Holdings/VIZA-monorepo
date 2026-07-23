#!/usr/bin/env bash
set -euo pipefail

# Required: FLY_API_TOKEN, FLY_ORG. Usage: deploy-legacy.sh <image>
image="${1:?immutable image reference is required}"
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
app="viza-submission-legacy"
deploy_ready_url="https://${app}.fly.dev/deploy-ready"

require_deploy_ready() {
  local status
  if ! status="$(curl --location --silent --show-error --max-time 10 \
    --output /dev/null --write-out '%{http_code}' "$deploy_ready_url")"; then
    echo "Refusing to deploy: could not verify ${app} deployment readiness." >&2
    exit 3
  fi
  if [[ "$status" != "200" ]]; then
    echo "Refusing to deploy: ${app} is busy or holds an unconsumed one-time card session (HTTP ${status})." >&2
    exit 4
  fi
}

if ! fly apps create "$app" --org "$FLY_ORG"; then
  # An existing app is normal on repeat deploys; any other create failure must
  # remain visible to the operator instead of being mistaken for an app lookup.
  fly status --app "$app" >/dev/null
fi

# Fail closed before staging secrets or replacing the only memory-backed worker.
require_deploy_ready
bash "$root/scripts/fly/sync-runtime-secrets.sh" "$app" "legacy"
fly_image="registry.fly.io/$app:${image##*:}"
docker pull "$image"
docker tag "$image" "$fly_image"
docker push "$fly_image"

# Re-check immediately before replacement because image transfer may take long
# enough for another queue item or card session to arrive.
require_deploy_ready
fly deploy --app "$app" --config "$root/deploy/fly/fly.legacy.toml" --image "$fly_image" --strategy rolling
