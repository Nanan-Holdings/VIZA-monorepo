#!/usr/bin/env bash
set -euo pipefail

# Deploy the single sticky Indonesia worker without interrupting an active
# browser or unconsumed one-time card session.
image="${1:?immutable image reference is required}"
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
app="${FLY_RUNNER_INDONESIA_APP:-viza-runner-indonesia}"
deploy_ready_url="https://${app}.fly.dev/deploy-ready"

require_deploy_ready() {
  local status=""
  for attempt in $(seq 1 18); do
    if status="$(curl --location --silent --show-error --max-time 10 \
      --output /dev/null --write-out '%{http_code}' "$deploy_ready_url")" \
      && [[ "$status" == "200" ]]; then
      return 0
    fi
    if [[ "$attempt" -lt 18 ]]; then
      echo "[deploy] Waiting for ${app} deployment readiness (attempt ${attempt}/18, HTTP ${status:-unreachable})..."
      sleep 10
    fi
  done

  echo "Refusing to deploy: ${app} stayed busy, unreachable, or held an unconsumed card session (HTTP ${status:-unreachable})." >&2
  exit 4
}

if ! fly apps create "$app" --org "$FLY_ORG"; then
  fly status --app "$app" >/dev/null
fi

has_retained_machine() {
  fly machines list --app "$app" --json | jq -e 'length > 0' >/dev/null
}

if has_retained_machine; then
  require_deploy_ready
fi
bash "$root/scripts/fly/sync-runtime-secrets.sh" "$app" indonesia
fly_image="registry.fly.io/$app:${image##*:}"
docker pull "$image"
docker tag "$image" "$fly_image"
docker push "$fly_image"
if has_retained_machine; then
  require_deploy_ready
fi
fly deploy \
  --app "$app" \
  --config "$root/deploy/fly/fly.indonesia.toml" \
  --image "$fly_image" \
  --env "SUBMISSION_SERVICE_WORKER_ID=$app" \
  --strategy rolling
fly scale count 1 --app "$app" --yes

echo "[deploy] Indonesia sticky worker retained at shared-cpu-1x/2048MB; idle exit is 120 seconds"
