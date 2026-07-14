#!/usr/bin/env bash
set -euo pipefail

# Required: FLY_API_TOKEN, FLY_ORG. Usage: deploy-legacy.sh <image>
image="${1:?immutable image reference is required}"
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
app="viza-submission-legacy"

if ! fly apps create "$app" --org "$FLY_ORG"; then
  # An existing app is normal on repeat deploys; any other create failure must
  # remain visible to the operator instead of being mistaken for an app lookup.
  fly status --app "$app" >/dev/null
fi
bash "$root/scripts/fly/sync-runtime-secrets.sh" "$app"
fly_image="registry.fly.io/$app:${image##*:}"
docker pull "$image"
docker tag "$image" "$fly_image"
docker push "$fly_image"
fly deploy --app "$app" --config "$root/deploy/fly/fly.legacy.toml" --image "$fly_image" --strategy immediate
