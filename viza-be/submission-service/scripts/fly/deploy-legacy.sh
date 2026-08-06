#!/usr/bin/env bash
set -euo pipefail

# Required: FLY_API_TOKEN, FLY_ORG. Usage: deploy-legacy.sh <image>
image="${1:?immutable image reference is required}"
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
app="${FLY_SUBMISSION_LEGACY_APP:-viza-submission-legacy}"
deploy_ready_url="https://${app}.fly.dev/deploy-ready"

has_retained_machine() {
  fly machines list --app "$app" --json | jq -e 'length > 0' >/dev/null
}

ensure_retained_machine_started() {
  local machine_ids
  machine_ids="$(fly machines list --app "$app" --json | jq -r '.[] | select(.state != "started" and .state != "starting") | .id')"
  if [[ -n "$machine_ids" ]]; then
    # HTTP autostart is intentionally disabled. Start only the retained
    # Machine so its fail-closed readiness endpoint can be queried. The worker
    # exits again after the normal 120-second idle window if deployment aborts.
    while read -r machine_id; do
      [[ -n "$machine_id" ]] && fly machine start --app "$app" "$machine_id"
    done <<< "$machine_ids"
  fi
}

require_deploy_ready() {
  local attempt status="000"
  ensure_retained_machine_started
  for attempt in $(seq 1 18); do
    status="$(curl --location --silent --show-error --max-time 10 \
      --output /dev/null --write-out '%{http_code}' "$deploy_ready_url" || true)"
    if [[ "$status" == "200" ]]; then
      return 0
    fi
    if [[ "$status" != "000" && "$status" != "502" && "$status" != "503" ]]; then
      echo "Refusing to deploy: ${app} is busy or holds an unconsumed one-time card session (HTTP ${status})." >&2
      exit 4
    fi
    sleep 5
  done
  echo "Refusing to deploy: could not verify ${app} deployment readiness after 90 seconds (HTTP ${status})." >&2
  exit 3
}

if ! fly apps create "$app" --org "$FLY_ORG"; then
  # An existing app is normal on repeat deploys; any other create failure must
  # remain visible to the operator instead of being mistaken for an app lookup.
  fly status --app "$app" >/dev/null
fi

# A brand-new app has no process to query. Existing retained Machines always
# fail closed before secret staging or replacement.
if has_retained_machine; then
  require_deploy_ready
fi
bash "$root/scripts/fly/sync-runtime-secrets.sh" "$app" "legacy"
fly_image="registry.fly.io/$app:${image##*:}"
docker pull "$image"
docker tag "$image" "$fly_image"
docker push "$fly_image"

# Re-check immediately before replacement because image transfer may take long
# enough for another queue item or card session to arrive.
if has_retained_machine; then
  require_deploy_ready
fi
fly deploy --app "$app" --config "$root/deploy/fly/fly.legacy.toml" --image "$fly_image" --strategy rolling
fly scale count 1 --app "$app" --yes
