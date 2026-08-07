#!/usr/bin/env bash
set -euo pipefail

# Required: FLY_API_TOKEN, FLY_ORG. Usage: deploy-legacy.sh <image>
image="${1:?immutable image reference is required}"
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
app="${FLY_SUBMISSION_LEGACY_APP:-viza-submission-legacy}"
deploy_ready_url="https://${app}.fly.dev/deploy-ready"

require_deploy_ready() {
  local status="000"
  local attempt
  # A request to a stopped Machine cold-starts the worker. During its first
  # queue poll activeWork can briefly be non-zero even though no task or card
  # session exists. Retry that transient 409, while keeping the gate bounded
  # and fail-closed for genuinely protected work.
  for attempt in {1..12}; do
    status="$(curl --location --silent --show-error --max-time 10 \
      --output /dev/null --write-out '%{http_code}' "$deploy_ready_url" || true)"
    if [[ "$status" == "200" ]]; then
      return 0
    fi
    if [[ "$status" != "409" ]]; then
      echo "Refusing to deploy: could not verify ${app} deployment readiness (HTTP ${status})." >&2
      exit 3
    fi
    if (( attempt < 12 )); then
      sleep 5
    fi
  done
  echo "Refusing to deploy: ${app} remained busy or held an unconsumed one-time card session (HTTP ${status})." >&2
  exit 4
}

has_retained_machine() {
  fly machines list --app "$app" --json | jq -e 'length > 0' >/dev/null
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
