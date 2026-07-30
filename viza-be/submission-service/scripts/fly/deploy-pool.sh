#!/usr/bin/env bash
set -euo pipefail

# Deploy one immutable submission-service image to the retained ten-Machine
# shared pool. Required: FLY_API_TOKEN, FLY_ORG and boot secrets.
image="${1:?immutable image reference is required}"
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
app="viza-runner-pool"

if ! fly apps create "$app" --org "$FLY_ORG"; then
  fly status --app "$app" >/dev/null
fi

bash "$root/scripts/fly/sync-runtime-secrets.sh" "$app" pool
fly_image="registry.fly.io/$app:${image##*:}"
docker pull "$image"
docker tag "$image" "$fly_image"
docker push "$fly_image"
fly deploy \
  --app "$app" \
  --config "$root/deploy/fly/fly.pool.toml" \
  --image "$fly_image" \
  --strategy immediate
fly scale count 10 --app "$app" --yes

echo "[deploy] shared pool deployed with ten retained Machines; idle workers exit after 120 seconds"
